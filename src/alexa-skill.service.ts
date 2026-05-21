import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  escapeXmlCharacters,
  getIntentName,
  getRequestType,
  HandlerInput,
  Skill,
  SkillBuilders,
} from 'ask-sdk-core';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import type { IntentRequest, SessionEndedRequest } from 'ask-sdk-model';
import type { RequestHandler } from 'express';
import { AlexaAiService } from './alexa-ai.service';
import {
  ALEXA_ERROR_FALLBACK,
  ALEXA_FORCE_TEST_SPEECH,
  ALEXA_LATENCY_WARN_MS,
  buildMinimalAlexaResponse,
  getOutputSpeechText,
  toAlexaResponseEnvelope,
  toSessionEndedEnvelope,
} from './alexa-response.util';
import { parseAlexaRequestMeta } from './alexa-request.util';
import { AlexaUserAccessService } from './alexa-user-access.service';
import { extractUserQuestion } from './alexa-utterance.util';

const GPT_QUERY_INTENT = 'GptQueryIntent';

@Injectable()
export class AlexaSkillService implements OnModuleInit {
  private readonly logger = new Logger(AlexaSkillService.name);
  private readonly skill: Skill;
  private readonly expressHandlers: RequestHandler[];
  private readonly forceTestResponse: boolean;

  constructor(
    private readonly aiService: AlexaAiService,
    private readonly userAccess: AlexaUserAccessService,
    configService: ConfigService,
  ) {
    const verifySignature =
      configService.get<string>('ALEXA_VERIFY_SIGNATURE') === 'true';

    this.forceTestResponse =
      configService.get<string>('ALEXA_FORCE_TEST_RESPONSE') === 'true';

    this.skill = SkillBuilders.custom()
      .addRequestHandlers(
        this.buildLaunchHandler(),
        this.buildQueryHandler(),
        this.buildHelpHandler(),
        this.buildCancelAndStopHandler(),
        this.buildFallbackHandler(),
        this.buildCatchAllIntentHandler(),
        this.buildSessionEndedHandler(),
      )
      .addErrorHandlers({
        canHandle: () => true,
        handle: (input, error) => {
          this.logger.error('Erro na skill', error);
          return input.responseBuilder
            .speak(ALEXA_ERROR_FALLBACK)
            .getResponse();
        },
      })
      .create();

    const adapter = new ExpressAdapter(
      this.skill,
      verifySignature,
      verifySignature,
    );
    this.expressHandlers = this.wrapHandlers(adapter.getRequestHandlers());

    this.logger.log(
      `Verificação de assinatura Alexa: ${verifySignature ? 'ATIVADA' : 'desativada'}`,
    );
    if (this.forceTestResponse) {
      this.logger.warn(
        `ALEXA_FORCE_TEST_RESPONSE=true: respostas de IA substituídas por "${ALEXA_FORCE_TEST_SPEECH}"`,
      );
    }
  }

  onModuleInit(): void {
    this.logger.log('Handlers da skill registrados em POST /alexa');
  }

  getExpressHandlers(): RequestHandler[] {
    const logRequest: RequestHandler = (_req, _res, next) => {
      this.logger.log('>>> POST /alexa recebido da Amazon');
      next();
    };

    return [logRequest, ...this.expressHandlers];
  }

  private wrapHandlers(handlers: RequestHandler[]): RequestHandler[] {
    const wrapped = [...handlers];
    const skillHandler = wrapped[wrapped.length - 1];

    wrapped[wrapped.length - 1] = async (req, res, next) => {
      const startedAt = Date.now();
      const requestMeta = parseAlexaRequestMeta(req.body);
      this.logger.log(
        `>>> Alexa request type=${requestMeta.type ?? '?'} intent=${requestMeta.intent ?? '-'}` +
          (requestMeta.sessionEndedReason
            ? ` reason=${requestMeta.sessionEndedReason}`
            : '') +
          (requestMeta.sessionEndedError
            ? ` (${requestMeta.sessionEndedError})`
            : ''),
      );

      const sendJson = res.json.bind(res);
      res.json = (body?: unknown) => {
        const envelope =
          requestMeta.type === 'SessionEndedRequest'
            ? toSessionEndedEnvelope(body)
            : toAlexaResponseEnvelope(body);
        const speechText = getOutputSpeechText(envelope);
        const latencyMs = Date.now() - startedAt;

        if (requestMeta.type === 'SessionEndedRequest') {
          this.logger.log(
            `<<< SessionEnded (${latencyMs}ms) — resposta vazia (sessão já encerrada no dispositivo): ${JSON.stringify(envelope)}`,
          );
        } else if (!speechText) {
          this.logger.error(
            'outputSpeech.text vazio após normalização (request não é SessionEnded)',
          );
        } else {
          this.logger.log(
            `<<< JSON enviado à Alexa (${latencyMs}ms): ${JSON.stringify(envelope)}`,
          );
        }
        if (latencyMs > ALEXA_LATENCY_WARN_MS) {
          this.logger.warn(
            `Latência ${latencyMs}ms — a Alexa costuma encerrar em ~8s (som "tum" sem fala)`,
          );
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return sendJson(envelope);
      };

      const sendAlexaFallback = () => {
        const envelope = buildMinimalAlexaResponse(ALEXA_ERROR_FALLBACK);
        this.logger.warn(`<<< Fallback Alexa: ${JSON.stringify(envelope)}`);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        sendJson(envelope);
      };

      try {
        await skillHandler(req, res, next);
        if (!res.headersSent) {
          this.logger.error('Skill handler não enviou resposta');
          sendAlexaFallback();
        }
      } catch (error) {
        this.logger.error('Erro ao processar requisição da Alexa', error);
        if (!res.headersSent) {
          sendAlexaFallback();
        }
      }
    };

    return wrapped;
  }

  private buildLaunchHandler() {
    return {
      canHandle: (input: HandlerInput) =>
        getRequestType(input.requestEnvelope) === 'LaunchRequest',
      handle: (input: HandlerInput) => {
        if (!this.userAccess.isAllowed(input)) {
          return this.userAccess.deniedResponse(input);
        }
        this.logger.log('LaunchRequest — saudação (sem elicitar slot; evita ERROR sem Dialog no console)');
        return input.responseBuilder
          .speak(
            'Oi. Sou um assistente desenvolvido por Bruno Sales. Pode perguntar o que quiser.',
          )
          .reprompt(
            'Por exemplo: o que acontece no episódio dois de better call saul.',
          )
          .getResponse();
      },
    };
  }

  private buildQueryHandler() {
    return {
      canHandle: (input: HandlerInput) =>
        getRequestType(input.requestEnvelope) === 'IntentRequest' &&
        getIntentName(input.requestEnvelope) === GPT_QUERY_INTENT,
      handle: async (input: HandlerInput) => {
        if (!this.userAccess.isAllowed(input)) {
          return this.userAccess.deniedResponse(input);
        }
        this.logger.log('Intent: GptQueryIntent');
        const request = input.requestEnvelope.request as IntentRequest;
        this.logIntentSlots(request);
        return this.respondWithAi(input, extractUserQuestion(request));
      },
    };
  }

  private buildHelpHandler() {
    return {
      canHandle: (input: HandlerInput) =>
        getRequestType(input.requestEnvelope) === 'IntentRequest' &&
        getIntentName(input.requestEnvelope) === 'AMAZON.HelpIntent',
      handle: (input: HandlerInput) => {
        if (!this.userAccess.isAllowed(input)) {
          return this.userAccess.deniedResponse(input);
        }
        return input.responseBuilder
          .speak(
            'Pergunte o que quiser. Assistente desenvolvido por Bruno Sales.',
          )
          .reprompt('Qual é a sua pergunta?')
          .getResponse();
      },
    };
  }

  private buildCancelAndStopHandler() {
    return {
      canHandle: (input: HandlerInput) =>
        getRequestType(input.requestEnvelope) === 'IntentRequest' &&
        ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(
          getIntentName(input.requestEnvelope) ?? '',
        ),
      handle: (input: HandlerInput) =>
        input.responseBuilder.speak('Até logo!').getResponse(),
    };
  }

  private buildFallbackHandler() {
    return {
      canHandle: (input: HandlerInput) =>
        getRequestType(input.requestEnvelope) === 'IntentRequest' &&
        getIntentName(input.requestEnvelope) === 'AMAZON.FallbackIntent',
      handle: (input: HandlerInput) => {
        if (!this.userAccess.isAllowed(input)) {
          return this.userAccess.deniedResponse(input);
        }
        this.logger.warn(
          'Intent: AMAZON.FallbackIntent — frase não bateu no GptQueryIntent; atualize o modelo no Developer Console',
        );
        return input.responseBuilder
          .speak(
            'Não entendi o formato. Tente começar com o que acontece, o que é, ou me fale sobre, e depois sua pergunta.',
          )
          .reprompt('Qual é a sua pergunta?')
          .getResponse();
      },
    };
  }

  private buildCatchAllIntentHandler() {
    return {
      canHandle: (input: HandlerInput) =>
        getRequestType(input.requestEnvelope) === 'IntentRequest',
      handle: async (input: HandlerInput) => {
        if (!this.userAccess.isAllowed(input)) {
          return this.userAccess.deniedResponse(input);
        }
        const request = input.requestEnvelope.request as IntentRequest;
        const intentName = getIntentName(input.requestEnvelope) ?? 'unknown';
        this.logger.log(`Intent não previsto: ${intentName}`);
        this.logIntentSlots(request);
        return this.respondWithAi(input, extractUserQuestion(request));
      },
    };
  }

  private logIntentSlots(request: IntentRequest): void {
    const slots = request.intent.slots ?? {};
    const summary = Object.fromEntries(
      Object.entries(slots).map(([name, slot]) => [name, slot?.value ?? null]),
    );
    this.logger.log(`Slots Alexa: ${JSON.stringify(summary)}`);
  }

  private async respondWithAi(
    input: HandlerInput,
    userPrompt: string | undefined,
  ) {
    if (!this.userAccess.isAllowed(input)) {
      return this.userAccess.deniedResponse(input);
    }

    if (!userPrompt) {
      return input.responseBuilder
        .speak('Não entendi. Repita a pergunta, por favor.')
        .reprompt('Qual é a sua pergunta?')
        .getResponse();
    }

    this.logger.log(`Pergunta: ${userPrompt}`);

    if (this.forceTestResponse) {
      this.logger.warn(
        `Modo teste ativo — falando: "${ALEXA_FORCE_TEST_SPEECH}"`,
      );
      return input.responseBuilder.speak(ALEXA_FORCE_TEST_SPEECH).getResponse();
    }

    const aiStartedAt = Date.now();
    try {
      const aiResponse = await this.aiService.generateResponse(userPrompt);
      this.logger.log(
        `OpenAI respondeu em ${Date.now() - aiStartedAt}ms (${aiResponse.length} chars)`,
      );
      return input.responseBuilder
        .speak(escapeXmlCharacters(aiResponse))
        .reprompt('Tem mais alguma pergunta?')
        .getResponse();
    } catch (error) {
      this.logger.error('Erro em respondWithAi', error);
      return input.responseBuilder
        .speak(ALEXA_ERROR_FALLBACK)
        .reprompt('Qual é a sua pergunta?')
        .getResponse();
    }
  }

  private buildSessionEndedHandler() {
    return {
      canHandle: (input: HandlerInput) =>
        getRequestType(input.requestEnvelope) === 'SessionEndedRequest',
      handle: (input: HandlerInput) => {
        const ended = input.requestEnvelope.request as SessionEndedRequest;
        const reason = ended.reason ?? 'UNKNOWN';
        const err = ended.error;
        this.logger.warn(
          `Sessão encerrada (reason=${reason})` +
            (err
              ? ` error=${err.type ?? '?'}: ${err.message ?? ''}`
              : '') +
            ' — o POST útil costuma ser Launch/Intent ANTES deste; se só aparece SessionEnded, a abertura falhou no dispositivo ou no Render (cold start).',
        );
        return input.responseBuilder.getResponse();
      },
    };
  }
}

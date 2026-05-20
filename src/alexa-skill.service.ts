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
import type { IntentRequest } from 'ask-sdk-model';
import type { RequestHandler } from 'express';
import { AlexaAiService } from './alexa-ai.service';
import { AlexaUserAccessService } from './alexa-user-access.service';
import { extractUserQuestion } from './alexa-utterance.util';

const GPT_QUERY_INTENT = 'GptQueryIntent';

@Injectable()
export class AlexaSkillService implements OnModuleInit {
  private readonly logger = new Logger(AlexaSkillService.name);
  private readonly skill: Skill;
  private readonly expressHandlers: RequestHandler[];

  constructor(
    private readonly aiService: AlexaAiService,
    private readonly userAccess: AlexaUserAccessService,
    configService: ConfigService,
  ) {
    const verifySignature =
      configService.get<string>('ALEXA_VERIFY_SIGNATURE') === 'true';

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
            .speak('Desculpe, ocorreu um erro interno.')
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
      const sendJson = res.json.bind(res);
      res.json = (body?: unknown) => {
        const envelope = toAlexaResponseEnvelope(body);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return sendJson(envelope);
      };

      try {
        await skillHandler(req, res, next);
        if (!res.headersSent) {
          res.status(500).send('Skill handler did not send a response');
        } else {
          this.logger.log('<<< Resposta enviada para a Amazon (200)');
        }
      } catch (error) {
        this.logger.error('Erro ao processar requisição da Alexa', error);
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error');
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
        return input.responseBuilder
          .speak(
            'Oi. Em que posso ajudar? Sou um assistente desenvolvido por Bruno Sales.',
          )
          .reprompt('Pode perguntar.')
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
        this.logger.log('Intent: AMAZON.FallbackIntent');
        return input.responseBuilder
          .speak(
            'Não entendi. Tente de novo, por exemplo: para que serve o azox, ou como está a maré hoje.',
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
        return this.respondWithAi(input, extractUserQuestion(request));
      },
    };
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

    try {
      const aiResponse = await this.aiService.generateResponse(userPrompt);
      return input.responseBuilder
        .speak(escapeXmlCharacters(aiResponse))
        .reprompt('Tem mais alguma pergunta?')
        .getResponse();
    } catch {
      return input.responseBuilder
        .speak(
          'Desculpe, tive um problema ao processar sua pergunta. Tente novamente.',
        )
        .reprompt('Qual é a sua pergunta?')
        .getResponse();
    }
  }

  private buildSessionEndedHandler() {
    return {
      canHandle: (input: HandlerInput) =>
        getRequestType(input.requestEnvelope) === 'SessionEndedRequest',
      handle: (input: HandlerInput) => input.responseBuilder.getResponse(),
    };
  }
}

type SpeechOutput = {
  type?: string;
  ssml?: string;
  text?: string;
  playBehavior?: string;
};

function ssmlToPlainText(ssml: string): string {
  return ssml
    .replace(/<speak[^>]*>/gi, '')
    .replace(/<\/speak>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function toPlainTextSpeech(speech: unknown): SpeechOutput {
  const s = speech as SpeechOutput;
  if (s.type === 'SSML' && s.ssml) {
    return { type: 'PlainText', text: ssmlToPlainText(s.ssml) };
  }
  return s;
}

function toAlexaResponseEnvelope(body: unknown): Record<string, unknown> {
  const envelope = body as Record<string, unknown>;
  const response = envelope?.response as Record<string, unknown> | undefined;

  if (response?.outputSpeech) {
    response.outputSpeech = toPlainTextSpeech(response.outputSpeech);
  }

  const reprompt = response?.reprompt as Record<string, unknown> | undefined;
  if (reprompt?.outputSpeech) {
    reprompt.outputSpeech = toPlainTextSpeech(reprompt.outputSpeech);
  }

  return {
    version: envelope.version ?? '1.0',
    sessionAttributes: envelope.sessionAttributes ?? {},
    response,
  };
}

/** Mensagem padrão quando a resposta para a Alexa não pode ser montada. */
export const ALEXA_ERROR_FALLBACK =
  'Desculpe, tive um erro ao processar sua pergunta';

/** Texto fixo para validar o pipeline sem chamar a OpenAI. */
export const ALEXA_FORCE_TEST_SPEECH = 'Teste funcionando';

/** Alexa costuma falhar em silêncio acima de ~8s; avisamos antes disso. */
export const ALEXA_LATENCY_WARN_MS = 7000;

type SpeechOutput = {
  type?: string;
  ssml?: string;
  text?: string;
  playBehavior?: string;
};

function stripControlChars(text: string): string {
  return [...text]
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return !(
        (code >= 0x00 && code <= 0x08) ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        code === 0x7f
      );
    })
    .join('');
}

export function sanitizeSpeechText(text: string): string {
  return stripControlChars(text)
    .replace(/[*#`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ssmlToPlainText(ssml: string): string {
  return sanitizeSpeechText(
    ssml
      .replace(/<speak[^>]*>/gi, '')
      .replace(/<\/speak>/gi, '')
      .replace(/<[^>]+>/g, ''),
  );
}

function toPlainTextSpeech(speech: unknown): SpeechOutput {
  const s = speech as SpeechOutput;
  if (s?.type === 'SSML' && s.ssml) {
    return { type: 'PlainText', text: ssmlToPlainText(s.ssml) };
  }
  if (s?.type === 'PlainText' && s.text) {
    return { type: 'PlainText', text: sanitizeSpeechText(s.text) };
  }
  return { type: 'PlainText', text: '' };
}

function ensurePlainTextSpeech(
  speech: unknown,
  fallback: string,
): SpeechOutput {
  const plain = toPlainTextSpeech(speech);
  const text = plain.text?.trim();
  if (!text) {
    return { type: 'PlainText', text: fallback };
  }
  return plain;
}

export function buildMinimalAlexaResponse(
  text: string,
  shouldEndSession = true,
): Record<string, unknown> {
  return {
    version: '1.0',
    sessionAttributes: {},
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: sanitizeSpeechText(text) || ALEXA_ERROR_FALLBACK,
      },
      shouldEndSession,
    },
  };
}

/** Resposta vazia exigida pela Amazon após SessionEndedRequest (não fala no dispositivo). */
export function toSessionEndedEnvelope(
  body: unknown,
): Record<string, unknown> {
  const envelope = (body ?? {}) as Record<string, unknown>;
  return {
    version: envelope.version ?? '1.0',
    sessionAttributes: envelope.sessionAttributes ?? {},
    response: (envelope.response as Record<string, unknown>) ?? {},
  };
}

function applyShouldEndSessionDefault(response: Record<string, unknown>): void {
  if (response.shouldEndSession !== undefined) {
    return;
  }
  response.shouldEndSession = response.reprompt ? false : true;
}

export function toAlexaResponseEnvelope(
  body: unknown,
  fallback = ALEXA_ERROR_FALLBACK,
): Record<string, unknown> {
  const envelope = (body ?? {}) as Record<string, unknown>;
  const response = (envelope.response as Record<string, unknown>) ?? {};

  if (response.outputSpeech) {
    const before = toPlainTextSpeech(response.outputSpeech).text;
    response.outputSpeech = ensurePlainTextSpeech(
      response.outputSpeech,
      fallback,
    );
    if (!before && (response.outputSpeech as SpeechOutput).text === fallback) {
      // substituído SSML/texto vazio pelo fallback
    }
  } else if (Object.keys(response).length > 0) {
    // Resposta parcial sem fala (erro do SDK) — não confundir com SessionEnded (response {})
    response.outputSpeech = { type: 'PlainText', text: fallback };
  }

  const reprompt = response.reprompt as Record<string, unknown> | undefined;
  if (reprompt?.outputSpeech) {
    reprompt.outputSpeech = ensurePlainTextSpeech(
      reprompt.outputSpeech,
      fallback,
    );
  }

  if (response.outputSpeech) {
    applyShouldEndSessionDefault(response);
  }

  return {
    version: envelope.version ?? '1.0',
    sessionAttributes: envelope.sessionAttributes ?? {},
    response,
  };
}

export function getOutputSpeechText(envelope: Record<string, unknown>): string {
  const response = envelope.response as Record<string, unknown> | undefined;
  const speech = response?.outputSpeech as SpeechOutput | undefined;
  return speech?.text?.trim() ?? '';
}

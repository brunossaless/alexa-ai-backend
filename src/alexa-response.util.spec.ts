import {
  ALEXA_ERROR_FALLBACK,
  ALEXA_FORCE_TEST_SPEECH,
  buildMinimalAlexaResponse,
  getOutputSpeechText,
  sanitizeSpeechText,
  toAlexaResponseEnvelope,
} from './alexa-response.util';

describe('alexa-response.util', () => {
  it('converte SSML vazio para fallback PlainText', () => {
    const envelope = toAlexaResponseEnvelope({
      version: '1.0',
      response: {
        outputSpeech: { type: 'SSML', ssml: '<speak></speak>' },
      },
    });

    expect(getOutputSpeechText(envelope)).toBe(ALEXA_ERROR_FALLBACK);
    expect(envelope.response).toMatchObject({
      outputSpeech: { type: 'PlainText', text: ALEXA_ERROR_FALLBACK },
    });
  });

  it('preserva texto SSML válido como PlainText', () => {
    const envelope = toAlexaResponseEnvelope({
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'SSML',
          ssml: '<speak>Olá mundo</speak>',
        },
      },
    });

    expect(getOutputSpeechText(envelope)).toBe('Olá mundo');
  });

  it('injeta outputSpeech quando a resposta do SDK não traz fala', () => {
    const envelope = toAlexaResponseEnvelope({
      version: '1.0',
      response: { shouldEndSession: true },
    });

    expect(getOutputSpeechText(envelope)).toBe(ALEXA_ERROR_FALLBACK);
  });

  it('sanitiza markdown e espaços extras', () => {
    expect(sanitizeSpeechText('  **Olá**   mundo  ')).toBe('Olá mundo');
  });

  it('buildMinimalAlexaResponse segue o formato esperado pela Alexa', () => {
    const envelope = buildMinimalAlexaResponse(ALEXA_FORCE_TEST_SPEECH);

    expect(envelope).toEqual({
      version: '1.0',
      sessionAttributes: {},
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: ALEXA_FORCE_TEST_SPEECH,
        },
        shouldEndSession: true,
      },
    });
  });
});

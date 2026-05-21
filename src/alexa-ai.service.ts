import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { sanitizeSpeechText } from './alexa-response.util';

/** Limite de caracteres falados na Alexa (~20–25 palavras). */
const MAX_SPEECH_CHARS = 280;

const SYSTEM_PROMPT = [
  'Assistente de voz Alexa em português do Brasil.',
  'Responda em no máximo 4 frases curtas (até 100 palavras no total).',
  'Seja direto, sem listas, sem markdown, sem emojis e sem caracteres especiais.',
  'Se não souber, diga em uma frase que não tem essa informação.',
].join(' ');

@Injectable()
export class AlexaAiService {
  private readonly logger = new Logger(AlexaAiService.name);
  private readonly openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt.trim() },
        ],
        max_tokens: 80,
        temperature: 0.3,
      });

      const choice = response.choices?.[0];
      const rawContent = choice?.message?.content?.trim();

      if (!rawContent) {
        this.logger.warn('OpenAI sem content na resposta', {
          choices: response.choices?.length ?? 0,
          finish_reason: choice?.finish_reason,
        });
        return truncateForVoice('Não consegui processar a resposta.');
      }

      const sanitized = sanitizeSpeechText(rawContent);
      if (!sanitized) {
        this.logger.warn('OpenAI retornou texto vazio após sanitização');
        return truncateForVoice('Não consegui processar a resposta.');
      }

      this.logger.debug(`OpenAI raw (${sanitized.length} chars): ${sanitized}`);
      return truncateForVoice(sanitized);
    } catch (error) {
      this.logger.error('Erro na API de IA', error);
      throw error;
    }
  }
}

function truncateForVoice(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_SPEECH_CHARS) {
    return normalized;
  }
  const cut = normalized.slice(0, MAX_SPEECH_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
}

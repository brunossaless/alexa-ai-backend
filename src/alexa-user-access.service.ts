import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandlerInput } from 'ask-sdk-core';
import type { RequestEnvelope } from 'ask-sdk-model';

@Injectable()
export class AlexaUserAccessService {
  private readonly logger = new Logger(AlexaUserAccessService.name);
  private readonly allowedUserIds: Set<string>;
  private readonly enforceAllowlist: boolean;
  private readonly loggedUnknownUsers = new Set<string>();

  constructor(configService: ConfigService) {
    const raw = configService.get<string>('ALLOWED_ALEXA_USER_IDS') ?? '';
    const ids = raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    this.allowedUserIds = new Set(ids);
    this.enforceAllowlist = this.allowedUserIds.size > 0;

    if (this.enforceAllowlist) {
      this.logger.log(
        `Acesso restrito a ${this.allowedUserIds.size} usuário(s) Alexa`,
      );
    } else {
      this.logger.warn(
        'ALLOWED_ALEXA_USER_IDS vazio: qualquer usuário pode usar. Defina seu userId após o primeiro acesso.',
      );
    }
  }

  isAllowed(input: HandlerInput): boolean {
    const userId = resolveAlexaUserId(input.requestEnvelope);
    if (!userId) {
      if (this.enforceAllowlist) {
        this.logger.warn(
          'Acesso negado: request sem userId (context.System.user e session.user)',
        );
      }
      return !this.enforceAllowlist;
    }

    if (!this.enforceAllowlist) {
      if (!this.loggedUnknownUsers.has(userId)) {
        this.loggedUnknownUsers.add(userId);
        this.logger.log(
          `Alexa userId (copie para ALLOWED_ALEXA_USER_IDS): ${userId}`,
        );
      }
      return true;
    }

    const allowed = this.allowedUserIds.has(userId);
    if (!allowed) {
      this.logAccessMismatch(userId);
    }
    return allowed;
  }

  deniedResponse(input: HandlerInput) {
    const userId = resolveAlexaUserId(input.requestEnvelope);
    if (userId && !this.loggedUnknownUsers.has(userId)) {
      this.loggedUnknownUsers.add(userId);
      this.logAccessMismatch(userId);
    }

    return input.responseBuilder
      .speak('Esta skill é privada e não está disponível para a sua conta.')
      .getResponse();
  }

  private logAccessMismatch(receivedUserId: string): void {
    const configured = [...this.allowedUserIds][0] ?? '';
    const sameLength = receivedUserId.length === configured.length;
    this.logger.warn(
      `Acesso negado: userId do request (${receivedUserId.length} chars) não bate com ALLOWED_ALEXA_USER_IDS (${configured.length} chars, mesmo tamanho=${sameLength})`,
    );
    this.logger.warn(
      `userId recebido (copie para .env): ${receivedUserId}`,
    );
  }
}

/** context.System.user e session.user — o simulador às vezes só preenche um deles. */
export function resolveAlexaUserId(
  envelope: RequestEnvelope,
): string | undefined {
  const fromContext = envelope.context?.System?.user?.userId;
  const fromSession = envelope.session?.user?.userId;
  const userId = (fromContext ?? fromSession)?.trim();
  return userId || undefined;
}

export type AlexaRequestMeta = {
  type?: string;
  intent?: string;
  sessionEndedReason?: string;
};

export function parseAlexaRequestMeta(body: unknown): AlexaRequestMeta {
  try {
    const raw =
      typeof body === 'string'
        ? body
        : Buffer.isBuffer(body)
          ? body.toString('utf8')
          : null;
    if (!raw) {
      return {};
    }

    const envelope = JSON.parse(raw) as {
      request?: {
        type?: string;
        intent?: { name?: string };
        reason?: string;
      };
    };
    const request = envelope.request;
    return {
      type: request?.type,
      intent: request?.intent?.name,
      sessionEndedReason: request?.reason,
    };
  } catch {
    return {};
  }
}

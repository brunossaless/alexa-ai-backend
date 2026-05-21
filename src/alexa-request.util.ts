export type AlexaRequestMeta = {
  type?: string;
  intent?: string;
  sessionEndedReason?: string;
  sessionEndedError?: string;
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
        error?: { type?: string; message?: string };
      };
    };
    const request = envelope.request;
    const err = request?.error;
    return {
      type: request?.type,
      intent: request?.intent?.name,
      sessionEndedReason: request?.reason,
      sessionEndedError: err
        ? `${err.type ?? 'Error'}: ${err.message ?? ''}`
        : undefined,
    };
  } catch {
    return {};
  }
}

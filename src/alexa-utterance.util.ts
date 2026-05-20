import type { IntentRequest, Slot } from 'ask-sdk-model';

const QUESTION_SLOT_NAMES = ['query', 'question', 'searchQuery'];

/**
 * Monta o texto da pergunta a partir dos slots que a Alexa preencheu.
 * Com utterances como "para que serve {query}", o slot pode trazer só parte da frase;
 * por isso priorizamos o slot com mais conteúdo.
 */
export function extractUserQuestion(
  request: IntentRequest,
): string | undefined {
  const slots = request.intent.slots ?? {};
  const values = Object.values(slots)
    .map((slot) => slotValue(slot))
    .filter((v): v is string => Boolean(v));

  if (values.length === 0) {
    return undefined;
  }

  const byName = QUESTION_SLOT_NAMES.map((name) => slotValue(slots[name])).find(
    Boolean,
  );
  if (byName) {
    return byName;
  }

  return values.sort((a, b) => b.length - a.length)[0];
}

function slotValue(slot: Slot | undefined): string | undefined {
  const value = slot?.value?.trim();
  if (!value) {
    return undefined;
  }

  const resolutions = slot?.resolutions?.resolutionsPerAuthority;
  const resolved = resolutions
    ?.flatMap((r) => r.values ?? [])
    .map((v) => v.value?.name?.trim())
    .find(Boolean);

  return resolved || value;
}

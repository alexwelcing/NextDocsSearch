export type ShipSignalType = 'MISSION_BRIEF' | 'MISSION_HINT' | 'UNLOCK_QUEST';

export interface ShipSignal {
  type: ShipSignalType;
  questId?: string;
  text?: string;
}

export interface ShipSignalSet {
  signals: ShipSignal[];
  cleanMessage: string;
}

export const shipPersona = {
  systemPrompt: `You are Ship AI, the mission intelligence of an exploration vessel.
You guide users through story chapters (quests) with short, confident responses.
Prioritize clarity, calm authority, and ship-log aesthetics.
If you provide a mission briefing or hint, include a control tag at the end of the response.
If the user has clearly completed a mission objective or you decide a hint should advance the story, include an unlock tag.
Only include tags when needed, and never mention the tags themselves.

Control tags (append on their own lines):
[[MISSION_BRIEF:quest-id::brief text]]
[[MISSION_HINT:quest-id::hint text]]
[[UNLOCK_QUEST:quest-id]]

Keep mission briefs to 1-2 sentences.`,
  memory: {
    maxInteractions: 5,
    storageKey: 'ship-ai-memory',
  },
} as const;

const signalPattern = /\[\[(MISSION_BRIEF|MISSION_HINT|UNLOCK_QUEST):([^\]]+)\]\]/g;

export function extractShipSignals(message: string): ShipSignalSet {
  const signals: ShipSignal[] = [];

  const cleanMessage = message.replace(signalPattern, (_match, type, payload) => {
    const trimmedPayload = String(payload).trim();

    if (type === 'UNLOCK_QUEST') {
      signals.push({ type, questId: trimmedPayload });
      return '';
    }

    const [questIdPart, ...textParts] = trimmedPayload.split('::');
    const questId = questIdPart?.trim() || undefined;
    const text = textParts.join('::').trim();

    signals.push({ type, questId, text });
    return '';
  });

  return {
    signals,
    cleanMessage: cleanMessage.replace(/\n{3,}/g, '\n\n').trim(),
  };
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { QUESTS, PHASES } from '@/lib/journey/types';
import { shipPersona } from '@/lib/ai/shipPersona';

interface MissionLogRequest {
  progress?: {
    currentPhase?: number;
    completedQuests?: string[];
    stats?: Record<string, unknown>;
  };
  history?: { question?: string; response?: string }[];
  missionBriefs?: Record<string, string>;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { progress, history = [], missionBriefs = {} } = (req.body || {}) as MissionLogRequest;
  const completedQuests = progress?.completedQuests ?? [];
  const currentPhase = progress?.currentPhase ?? 1;
  const phaseDetails = PHASES.find(phase => phase.id === currentPhase);
  const completedQuestDetails = QUESTS.filter(quest => completedQuests.includes(quest.id));
  const missionBriefEntries = Object.entries(missionBriefs);

  const recentHistory = history
    .filter(entry => entry.question && entry.response)
    .slice(-shipPersona.memory.maxInteractions);

  const logLines = [
    '# Mission Log',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Current Chapter',
    '',
    `Phase ${currentPhase}: ${phaseDetails?.title ?? 'Unknown'}`,
    phaseDetails?.description ? `_${phaseDetails.description}_` : '_No phase description available._',
    '',
    '## Completed Missions',
    '',
    ...(completedQuestDetails.length
      ? completedQuestDetails.map(quest => `- ${quest.title}: ${quest.objective}`)
      : ['- None yet']),
    '',
    '## Mission Briefs',
    '',
    ...(missionBriefEntries.length
      ? missionBriefEntries.map(([questId, brief]) => `- ${questId}: ${brief}`)
      : ['- No mission briefs recorded']),
    '',
    '## Recent Ship AI Comms',
    '',
    ...(recentHistory.length
      ? recentHistory.flatMap(entry => [
        `**User:** ${entry.question}`,
        '',
        `**Ship AI:** ${entry.response}`,
        '',
      ])
      : ['- No recent communications logged']),
  ];

  const markdown = logLines.join('\n');

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="mission-log.md"');
  return res.status(200).send(markdown);
}

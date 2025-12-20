export interface NarrativeChapter {
  id: string;
  title: string;
  unlockCondition: string;
  reward: string;
  brief: string;
}

export const CHAPTERS: NarrativeChapter[] = [
  {
    id: 'chapter-01-arrival',
    title: 'Signal in the Static',
    unlockCondition: 'start',
    reward: 'Mission console online',
    brief: 'Boot the terminal and triangulate the source of the anomaly. The signal is faint but persistent.',
  },
  {
    id: 'chapter-02-contact',
    title: 'First Contact Protocol',
    unlockCondition: 'first-question',
    reward: 'Decoded intel fragment',
    brief: 'Interrogate the AI for any trace of the relic. One solid lead will stabilize the feed.',
  },
  {
    id: 'chapter-03-calibration',
    title: 'Calibration Run',
    unlockCondition: 'game-complete',
    reward: 'Targeting systems tuned',
    brief: 'Complete a live-fire simulation to sync reflex data with the uplink.',
  },
  {
    id: 'chapter-04-artifact',
    title: 'Artifact Interface',
    unlockCondition: 'artifact-interaction',
    reward: 'Relic interface synchronized',
    brief: 'Engage the field tablet and let the artifact imprint your signature.',
  },
  {
    id: 'chapter-05-ascension',
    title: 'Ascension Signal',
    unlockCondition: 'leaderboard-rank',
    reward: 'Access to the deep archive',
    brief: 'Prove mastery in the arena to open the final archive channel.',
  },
];

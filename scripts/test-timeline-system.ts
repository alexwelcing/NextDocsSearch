#!/usr/bin/env tsx

/**
 * TEST SCRIPT: Timeline Convergence System
 *
 * Tests article generation and timeline convergence logic
 * Run with: npx tsx scripts/test-timeline-system.ts
 */

import {
  type TimelineState,
  calculateConvergence,
  selectNextTimeline,
  getNextConvergencePoint,
  generateConvergenceNarrative,
  CONVERGENCE_POINTS,
} from '../lib/knowledge/timeline-convergence';
import {
  estimateGenerationCost,
} from '../lib/knowledge/ai-article-generator';

console.log('Testing Timeline Convergence System\n');

// Test 1: Initial State
console.log('Test 1: Initial State');
const initialState: TimelineState = {
  currentConvergence: 0,
  lastArticlePublished: {},
  nextConvergencePoint: null,
  totalArticlesPublished: 0,
};

const convergence = calculateConvergence(initialState);
console.log(`  Initial convergence: ${convergence.toFixed(1)}%`);

// Test 2: Timeline Selection
console.log('\nTest 2: Timeline Selection');
const timelines = Array.from({ length: 10 }, () => selectNextTimeline(initialState));
const presentCount = timelines.filter((t) => t === 'present').length;
const futureCount = timelines.filter((t) => t === 'future').length;
console.log(`  Timeline distribution: ${presentCount} present, ${futureCount} future`);
console.log(`  (Expected ~70% present in early convergence)`);

// Test 3: Next Convergence Point
console.log('\nTest 3: Next Convergence Point');
const nextPoint = getNextConvergencePoint();
if (nextPoint) {
  console.log(`  Next convergence: ${nextPoint.technology} (${nextPoint.date})`);
  console.log(`  Present: ${nextPoint.presentEvent}`);
  console.log(`  Future: ${nextPoint.futureEvent}`);
} else {
  console.log('  All convergence points passed');
}

// Test 4: Convergence Narrative
console.log('\nTest 4: Convergence Narrative');
const narrative = generateConvergenceNarrative(convergence, nextPoint);
console.log(`  Narrative: ${narrative}`);

// Test 5: Convergence Points
console.log('\nTest 5: Convergence Points');
console.log(`  Total convergence points: ${CONVERGENCE_POINTS.length}`);
CONVERGENCE_POINTS.forEach((point, index) => {
  const status = new Date(point.date) < new Date() ? '[passed]' : '[upcoming]';
  console.log(`  ${status} ${index + 1}. ${point.technology} (${point.date})`);
});

// Test 6: Cost Estimation
console.log('\nTest 6: Cost Estimation');
const cost = estimateGenerationCost();
console.log(`  Estimated tokens per article: ${cost.tokens}`);
console.log(`  Estimated cost per article: $${cost.cost.toFixed(3)}`);
console.log(`  Estimated monthly cost (720 articles): $${(cost.cost * 720).toFixed(2)}`);

// Test 7: State Progression
console.log('\nTest 7: State Progression Simulation');
let state = { ...initialState };
for (let i = 1; i <= 5; i++) {
  const timeline = selectNextTimeline(state);
  state = {
    ...state,
    totalArticlesPublished: i,
    lastArticlePublished: {
      ...state.lastArticlePublished,
      [timeline]: new Date().toISOString(),
    },
  };
  const conv = calculateConvergence(state);
  console.log(`  Article ${i}: ${timeline} timeline (convergence: ${conv.toFixed(1)}%)`);
}

// Test 8: Environment Check
console.log('\nTest 8: Environment Check');
const requiredVars = [
  'OPENAI_KEY',
  'ARTICLE_GENERATION_API_KEY',
  'CRON_SECRET',
];

requiredVars.forEach((varName) => {
  const exists = !!process.env[varName];
  console.log(`  ${exists ? '[set]' : '[missing]'} ${varName}`);
});

console.log('\nAll tests completed!\n');
console.log('Next steps:');
console.log('1. Set environment variables (see .env.example)');
console.log('2. Deploy to Vercel');
console.log('3. Monitor /api/articles/timeline-status for convergence progress');
console.log('4. Check Vercel logs for hourly cron job execution\n');

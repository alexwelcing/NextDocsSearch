/**
 * Build-time recommendation index generator.
 *
 * Reads the article manifest and produces a deep similarity matrix using:
 *   1. TF-IDF weighted keyword/term vectors
 *   2. Jaccard similarity on mechanics, domains, and author sets
 *   3. Dimensional proximity for horizon and polarity
 *   4. Content fingerprinting via description n-gram overlap
 *   5. Composite multi-signal scoring with per-category ranked lists
 *
 * Output: lib/generated/recommendation-index.json
 *   { [slug]: { similar, horizon, polarity, mechanics, trending, scores } }
 *
 * Run: tsx scripts/generate-recommendation-index.ts
 * Runs automatically as part of the build pipeline.
 */

import fs from 'fs';
import path from 'path';

// ── Types ──

interface ArticleData {
  slug: string;
  filename: string;
  title: string;
  date: string;
  author: string[];
  description?: string;
  keywords?: (string | null)[];
  readingTime: number;
  wordCount: number;
  horizon?: string;
  polarity?: string;
  mechanics?: string[];
  domains?: string[];
  articleType: string;
}

interface ScoredRecommendation {
  slug: string;
  score: number; // 0-100 composite match percentage
}

interface ArticleRecommendations {
  similar: ScoredRecommendation[];
  horizon: ScoredRecommendation[];
  polarity: ScoredRecommendation[];
  mechanics: ScoredRecommendation[];
  trending: ScoredRecommendation[];
}

type RecommendationIndex = Record<string, ArticleRecommendations>;

// ── TF-IDF Engine ──

/** Tokenise a string into lowercase terms, stripping common noise */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'them',
  'than', 'its', 'over', 'such', 'that', 'this', 'with', 'will', 'each',
  'from', 'they', 'were', 'which', 'their', 'what', 'about', 'would',
  'make', 'like', 'just', 'into', 'when', 'more', 'also', 'how', 'after',
  'could', 'other', 'these', 'then', 'most', 'only', 'very', 'being',
]);

function removeStopWords(tokens: string[]): string[] {
  return tokens.filter(t => !STOP_WORDS.has(t));
}

/**
 * Build a TF-IDF matrix for a corpus of documents.
 * Returns a map from slug → { term → tfidf weight }.
 */
function buildTfIdf(
  docs: Array<{ slug: string; terms: string[] }>
): Map<string, Map<string, number>> {
  const N = docs.length;

  // Document frequency: how many docs contain each term
  const df = new Map<string, number>();
  for (const doc of docs) {
    const unique = new Set(doc.terms);
    for (const term of unique) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  const tfidfMatrix = new Map<string, Map<string, number>>();

  for (const doc of docs) {
    // Term frequency within this document
    const tf = new Map<string, number>();
    for (const term of doc.terms) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }

    const tfidf = new Map<string, number>();
    const maxTf = Math.max(...tf.values(), 1);

    for (const [term, count] of tf) {
      // Augmented TF to prevent bias toward long documents
      const normalizedTf = 0.5 + 0.5 * (count / maxTf);
      const idf = Math.log(N / (1 + (df.get(term) || 0)));
      tfidf.set(term, normalizedTf * idf);
    }

    tfidfMatrix.set(doc.slug, tfidf);
  }

  return tfidfMatrix;
}

/** Cosine similarity between two TF-IDF vectors */
function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, weightA] of a) {
    normA += weightA * weightA;
    const weightB = b.get(term);
    if (weightB !== undefined) {
      dot += weightA * weightB;
    }
  }
  for (const [, weightB] of b) {
    normB += weightB * weightB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Set Similarity ──

/** Jaccard index: |A ∩ B| / |A ∪ B| */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of a) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Overlap coefficient: |A ∩ B| / min(|A|, |B|) — favours partial subset matches */
function overlapCoefficient(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let intersection = 0;
  for (const item of a) {
    if (setB.has(item)) intersection++;
  }
  return intersection / Math.min(a.length, b.length);
}

// ── Description n-gram fingerprinting ──

function bigrams(text: string): string[] {
  const tokens = tokenize(text);
  const result: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return result;
}

function bigramSimilarity(a: string, b: string): number {
  const biA = bigrams(a);
  const biB = bigrams(b);
  if (biA.length === 0 || biB.length === 0) return 0;
  return jaccard(biA, biB);
}

// ── Dimensional Proximity ──

const HORIZON_ORDER = ['NQ', 'NY', 'N5', 'N20', 'N50', 'N100'];
const POLARITY_ORDER = ['C3', 'C2', 'C1', 'N0', 'P1', 'P2', 'P3'];

function horizonProximity(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const idxA = HORIZON_ORDER.indexOf(a);
  const idxB = HORIZON_ORDER.indexOf(b);
  if (idxA === -1 || idxB === -1) return 0;
  const maxDist = HORIZON_ORDER.length - 1;
  return 1 - Math.abs(idxA - idxB) / maxDist;
}

function polarityProximity(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const idxA = POLARITY_ORDER.indexOf(a);
  const idxB = POLARITY_ORDER.indexOf(b);
  if (idxA === -1 || idxB === -1) return 0;
  const maxDist = POLARITY_ORDER.length - 1;
  return 1 - Math.abs(idxA - idxB) / maxDist;
}

// ── Composite Score ──

interface PairwiseSignals {
  tfidfCosine: number;       // 0-1, TF-IDF cosine similarity on all text
  keywordJaccard: number;    // 0-1, keyword set Jaccard
  keywordOverlap: number;    // 0-1, keyword overlap coefficient
  mechanicsJaccard: number;  // 0-1
  domainJaccard: number;     // 0-1
  authorOverlap: number;     // 0-1
  descriptionBigram: number; // 0-1
  horizonProximity: number;  // 0-1
  polarityProximity: number; // 0-1
  typeMatch: number;         // 0 or 1
  recencyScore: number;      // 0-1, how recent the candidate is
}

/** Weighted composite: produces a 0-100 match score */
function compositeScore(s: PairwiseSignals): number {
  // Weights tuned for meaningful spread across typical article pairs
  const weighted =
    s.tfidfCosine       * 22 + // Content similarity is the strongest signal
    s.keywordJaccard    *  8 +
    s.keywordOverlap    *  7 + // Partial keyword matches still valuable
    s.mechanicsJaccard  * 15 + // Thematic mechanics alignment
    s.domainJaccard     * 10 +
    s.authorOverlap     *  3 + // Same author = slight relevance
    s.descriptionBigram *  5 + // Description phrasing similarity
    s.horizonProximity  * 12 + // Timeline closeness
    s.polarityProximity *  8 + // Outlook similarity
    s.typeMatch         * 10;  // Fiction↔fiction or research↔research
  // Sum of weights = 100, so result is already 0-100
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

// ── Diversified selection (same greedy algorithm as client, but richer signals) ──

function diversifiedTopN(
  sourceSlug: string,
  candidates: Array<{ slug: string; score: number; article: ArticleData }>,
  allArticles: Map<string, ArticleData>,
  limit: number,
  diversityWeight: number = 0.4
): ScoredRecommendation[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= limit) {
    return candidates
      .sort((a, b) => b.score - a.score)
      .map(c => ({ slug: c.slug, score: c.score }));
  }

  // Normalize scores to 0-1
  const maxScore = Math.max(...candidates.map(c => c.score));
  const minScore = Math.min(...candidates.map(c => c.score));
  const range = maxScore - minScore || 1;
  const normalized = candidates.map(c => ({
    ...c,
    norm: (c.score - minScore) / range,
  }));
  normalized.sort((a, b) => b.norm - a.norm);

  const selected: Array<{ slug: string; score: number; article: ArticleData }> = [];
  const remaining = [...normalized];

  // Pick top-scored first
  selected.push(remaining[0]);
  remaining.splice(0, 1);

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestAdj = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      // Diversity penalty: average overlap with selected items
      let penalty = 0;
      for (const sel of selected) {
        if (cand.article.horizon && cand.article.horizon === sel.article.horizon) penalty += 3;
        if (cand.article.polarity && cand.article.polarity === sel.article.polarity) penalty += 2;
        if (cand.article.articleType === sel.article.articleType) penalty += 1;
        const sharedMech = (cand.article.mechanics || []).filter(m =>
          (sel.article.mechanics || []).includes(m)
        ).length;
        penalty += sharedMech * 2;
      }
      const avgPenalty = Math.min(1, (penalty / selected.length) / 15);
      const adj = cand.norm * (1 - diversityWeight) + (1 - avgPenalty) * diversityWeight;
      if (adj > bestAdj) {
        bestAdj = adj;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected.map(c => ({ slug: c.slug, score: c.score }));
}

// ── Main ──

function main() {
  const manifestPath = path.join(process.cwd(), 'lib', 'generated', 'article-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('Error: article-manifest.json not found. Run generate-article-manifest.ts first.');
    process.exit(1);
  }

  const articles: ArticleData[] = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Building recommendation index for ${articles.length} articles...`);

  const articleMap = new Map<string, ArticleData>();
  for (const a of articles) articleMap.set(a.slug, a);

  // ── Step 1: Build TF-IDF vectors from combined text ──
  console.log('  Computing TF-IDF vectors...');
  const docs = articles.map(a => {
    const keywordText = (a.keywords || []).filter(Boolean).join(' ');
    const domainText = (a.domains || []).join(' ');
    const mechanicText = (a.mechanics || []).join(' ');
    const combined = [
      a.title,
      a.title, // title weighted double
      a.description || '',
      keywordText,
      keywordText, // keywords weighted double
      domainText,
      mechanicText,
    ].join(' ');
    return {
      slug: a.slug,
      terms: removeStopWords(tokenize(combined)),
    };
  });

  const tfidfMatrix = buildTfIdf(docs);

  // ── Step 2: Precompute all pairwise signals ──
  console.log('  Computing pairwise similarity signals...');
  const now = Date.now();

  // Pairwise composite scores: slug → slug → score
  const pairScores = new Map<string, Map<string, PairwiseSignals>>();

  for (const a of articles) {
    const aScores = new Map<string, PairwiseSignals>();
    const aKeywords = (a.keywords || []).filter(Boolean).map(k => (k as string).toLowerCase());
    const aTfidf = tfidfMatrix.get(a.slug)!;

    for (const b of articles) {
      if (a.slug === b.slug) continue;
      const bKeywords = (b.keywords || []).filter(Boolean).map(k => (k as string).toLowerCase());
      const bTfidf = tfidfMatrix.get(b.slug)!;

      const ageInDays = (now - new Date(b.date).getTime()) / (1000 * 60 * 60 * 24);
      // Recency normalised over ~2 years, clamped to [0, 1]
      // (future-dated fiction articles get capped at 1.0)
      const recency = Math.min(1, Math.max(0, 1 - ageInDays / 730));

      const signals: PairwiseSignals = {
        tfidfCosine: cosineSimilarity(aTfidf, bTfidf),
        keywordJaccard: jaccard(aKeywords, bKeywords),
        keywordOverlap: overlapCoefficient(aKeywords, bKeywords),
        mechanicsJaccard: jaccard(a.mechanics || [], b.mechanics || []),
        domainJaccard: jaccard(a.domains || [], b.domains || []),
        authorOverlap: overlapCoefficient(
          a.author.map(x => x.toLowerCase()),
          b.author.map(x => x.toLowerCase())
        ),
        descriptionBigram: bigramSimilarity(a.description || '', b.description || ''),
        horizonProximity: horizonProximity(a.horizon, b.horizon),
        polarityProximity: polarityProximity(a.polarity, b.polarity),
        typeMatch: a.articleType === b.articleType ? 1 : 0,
        recencyScore: recency,
      };

      aScores.set(b.slug, signals);
    }
    pairScores.set(a.slug, aScores);
  }

  // ── Step 3: Build ranked lists per category for each article ──
  console.log('  Generating per-article ranked recommendations...');
  const index: RecommendationIndex = {};
  const LIMIT = 15; // Store top 15 per category for client-side flexibility

  for (const article of articles) {
    const pairs = pairScores.get(article.slug)!;
    const candidates = articles
      .filter(b => b.slug !== article.slug)
      .map(b => {
        const signals = pairs.get(b.slug)!;
        return { slug: b.slug, signals, article: b };
      });

    // ─ Similar: full composite score ─
    const similarScored = candidates.map(c => ({
      slug: c.slug,
      score: compositeScore(c.signals),
      article: c.article,
    }));
    const similar = diversifiedTopN(article.slug, similarScored, articleMap, LIMIT, 0.35);

    // ─ Horizon: weight horizon proximity + secondary signals ─
    const horizonScored = candidates
      .filter(c => c.article.horizon)
      .map(c => ({
        slug: c.slug,
        score: Math.round(
          c.signals.horizonProximity * 40 +
          c.signals.tfidfCosine * 20 +
          c.signals.mechanicsJaccard * 15 +
          c.signals.typeMatch * 10 +
          c.signals.keywordOverlap * 10 +
          c.signals.polarityProximity * 5
        ),
        article: c.article,
      }));
    const horizon = diversifiedTopN(article.slug, horizonScored, articleMap, LIMIT, 0.5);

    // ─ Polarity: weight polarity proximity + secondary signals ─
    const polarityScored = candidates
      .filter(c => c.article.polarity)
      .map(c => ({
        slug: c.slug,
        score: Math.round(
          c.signals.polarityProximity * 40 +
          c.signals.tfidfCosine * 20 +
          c.signals.domainJaccard * 15 +
          c.signals.typeMatch * 10 +
          c.signals.keywordOverlap * 10 +
          c.signals.horizonProximity * 5
        ),
        article: c.article,
      }));
    const polarity = diversifiedTopN(article.slug, polarityScored, articleMap, LIMIT, 0.5);

    // ─ Mechanics: weight mechanics + complementary discovery ─
    const mechanicsScored = candidates
      .filter(c => (c.article.mechanics || []).length > 0)
      .map(c => {
        const shared = (c.article.mechanics || []).filter(m =>
          (article.mechanics || []).includes(m)
        ).length;
        const complementary = (c.article.mechanics || []).filter(m =>
          !(article.mechanics || []).includes(m)
        ).length;
        return {
          slug: c.slug,
          score: Math.round(
            c.signals.mechanicsJaccard * 35 +
            (shared > 0 ? 1 : 0) * 15 + // Must share at least one mechanic
            Math.min(1, complementary / 3) * 10 + // Complementary exploration bonus
            c.signals.tfidfCosine * 20 +
            c.signals.keywordOverlap * 10 +
            c.signals.typeMatch * 10
          ),
          article: c.article,
        };
      });
    const mechanics = diversifiedTopN(article.slug, mechanicsScored, articleMap, LIMIT, 0.45);

    // ─ Trending: recency + context relevance ─
    const trendingScored = candidates.map(c => ({
      slug: c.slug,
      score: Math.round(
        c.signals.recencyScore * 50 +
        c.signals.tfidfCosine * 20 +
        c.signals.mechanicsJaccard * 10 +
        c.signals.keywordOverlap * 10 +
        c.signals.typeMatch * 10
      ),
      article: c.article,
    }));
    const trending = diversifiedTopN(article.slug, trendingScored, articleMap, LIMIT, 0.3);

    index[article.slug] = {
      similar,
      horizon,
      polarity,
      mechanics,
      trending,
    };
  }

  // ── Step 4: Also generate a "no context" fallback (global recommendations) ──
  // Used when no currentArticle is set — provides diverse browsing
  console.log('  Generating global fallback recommendations...');
  const globalCandidates = articles.map(a => {
    const richness =
      (a.mechanics?.length || 0) * 3 +
      (a.domains?.length || 0) * 2 +
      ((a.keywords || []).filter(Boolean).length > 5 ? 2 : 0) +
      (a.description && a.description.length > 100 ? 1 : 0);
    return { slug: a.slug, score: richness, article: a };
  });

  // Global similar: diverse high-richness articles
  const globalSimilar = diversifiedTopN('__global__', globalCandidates, articleMap, LIMIT, 0.7);

  // Global horizon: round-robin across horizons
  const byHorizon: Record<string, ArticleData[]> = {};
  for (const h of HORIZON_ORDER) byHorizon[h] = [];
  for (const a of articles) {
    if (a.horizon && byHorizon[a.horizon]) byHorizon[a.horizon].push(a);
  }
  const globalHorizon: ScoredRecommendation[] = [];
  let hRound = 0;
  while (globalHorizon.length < LIMIT) {
    let added = false;
    for (const h of HORIZON_ORDER) {
      if (hRound < byHorizon[h].length && globalHorizon.length < LIMIT) {
        globalHorizon.push({ slug: byHorizon[h][hRound].slug, score: 80 - hRound * 3 });
        added = true;
      }
    }
    if (!added) break;
    hRound++;
  }

  // Global polarity: round-robin across polarity spectrum
  const byPolarity: Record<string, ArticleData[]> = {};
  for (const p of POLARITY_ORDER) byPolarity[p] = [];
  for (const a of articles) {
    if (a.polarity && byPolarity[a.polarity]) byPolarity[a.polarity].push(a);
  }
  const globalPolarity: ScoredRecommendation[] = [];
  let pRound = 0;
  while (globalPolarity.length < LIMIT) {
    let added = false;
    for (const p of POLARITY_ORDER) {
      if (pRound < byPolarity[p].length && globalPolarity.length < LIMIT) {
        globalPolarity.push({ slug: byPolarity[p][pRound].slug, score: 80 - pRound * 3 });
        added = true;
      }
    }
    if (!added) break;
    pRound++;
  }

  // Global mechanics: diverse mechanics coverage
  const globalMechanics = diversifiedTopN(
    '__global__',
    articles
      .filter(a => (a.mechanics || []).length > 0)
      .map(a => ({ slug: a.slug, score: (a.mechanics?.length || 0) * 15, article: a })),
    articleMap,
    LIMIT,
    0.65
  );

  // Global trending: most recent
  const globalTrending = [...articles]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, LIMIT)
    .map((a, i) => ({ slug: a.slug, score: Math.max(30, 95 - i * 4) }));

  index['__global__'] = {
    similar: globalSimilar,
    horizon: globalHorizon,
    polarity: globalPolarity,
    mechanics: globalMechanics,
    trending: globalTrending,
  };

  // ── Write output ──
  const outDir = path.join(process.cwd(), 'lib', 'generated');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'recommendation-index.json');
  fs.writeFileSync(outPath, JSON.stringify(index));

  // Stats
  const totalPairs = Object.keys(index).length;
  const sampleSlug = articles[0]?.slug;
  const sampleTopMatch = index[sampleSlug]?.similar[0];
  console.log(`\nRecommendation index built:`);
  console.log(`  ${totalPairs} article entries (incl. __global__ fallback)`);
  console.log(`  ${LIMIT} recommendations per category × 5 categories`);
  if (sampleTopMatch) {
    console.log(`  Sample: "${sampleSlug}" top similar → "${sampleTopMatch.slug}" (${sampleTopMatch.score}%)`);
  }
  console.log(`  Output: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}

main();

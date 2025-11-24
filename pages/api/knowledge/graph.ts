import { NextApiRequest, NextApiResponse } from 'next';
import {
  R3F_KNOWLEDGE_INDEX,
  R3F_CATEGORIES,
  getTopicsByCategory,
  type R3FTopic,
} from '../../../lib/knowledge/r3f-taxonomy';

interface TopicNode {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  difficulty: R3FTopic['difficulty'];
  seoValue: number;
}

interface TopicEdge {
  source: string;
  target: string;
  weight: number;
  relationship: 'category' | 'keyword' | 'difficulty' | 'prerequisite';
}

interface KnowledgeGraphResponse {
  nodes: TopicNode[];
  edges: TopicEdge[];
  categories: typeof R3F_CATEGORIES;
  stats: {
    totalTopics: number;
    totalCategories: number;
    avgSeoValue: number;
    difficultyDistribution: Record<R3FTopic['difficulty'], number>;
  };
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<KnowledgeGraphResponse | { error: string }>
) {
  const { category, difficulty } = req.query;

  try {
    // Filter topics based on query parameters
    let topics = R3F_KNOWLEDGE_INDEX;

    if (category && typeof category === 'string') {
      topics = getTopicsByCategory(category);
    }

    if (difficulty && typeof difficulty === 'string') {
      topics = topics.filter(t => t.difficulty === difficulty);
    }

    // Build nodes
    const nodes: TopicNode[] = topics.map(topic => ({
      id: topic.id,
      title: topic.title,
      category: topic.category,
      subcategory: topic.subcategory,
      difficulty: topic.difficulty,
      seoValue: topic.seoValue,
    }));

    // Build edges based on relationships
    const edges: TopicEdge[] = [];
    const topicMap = new Map(topics.map(t => [t.id, t]));

    topics.forEach(topic => {
      // Connect topics in same category
      topics.forEach(otherTopic => {
        if (topic.id !== otherTopic.id) {
          // Same category relationship
          if (topic.category === otherTopic.category) {
            edges.push({
              source: topic.id,
              target: otherTopic.id,
              weight: 0.5,
              relationship: 'category',
            });
          }

          // Shared keywords
          const sharedKeywords = topic.keywords.filter(k =>
            otherTopic.keywords.includes(k)
          );
          if (sharedKeywords.length > 0) {
            edges.push({
              source: topic.id,
              target: otherTopic.id,
              weight: sharedKeywords.length * 0.3,
              relationship: 'keyword',
            });
          }

          // Same difficulty (learning path)
          if (topic.difficulty === otherTopic.difficulty) {
            edges.push({
              source: topic.id,
              target: otherTopic.id,
              weight: 0.2,
              relationship: 'difficulty',
            });
          }

          // Prerequisite relationships (beginner -> intermediate -> advanced -> expert)
          const difficultyOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
          const topicDiffIdx = difficultyOrder.indexOf(topic.difficulty);
          const otherDiffIdx = difficultyOrder.indexOf(otherTopic.difficulty);
          
          if (topicDiffIdx === otherDiffIdx - 1 && 
              topic.category === otherTopic.category) {
            edges.push({
              source: topic.id,
              target: otherTopic.id,
              weight: 0.8,
              relationship: 'prerequisite',
            });
          }
        }
      });
    });

    // Remove duplicate edges (keep highest weight)
    const edgeMap = new Map<string, TopicEdge>();
    edges.forEach(edge => {
      const key = `${edge.source}-${edge.target}`;
      const existing = edgeMap.get(key);
      if (!existing || existing.weight < edge.weight) {
        edgeMap.set(key, edge);
      }
    });

    const uniqueEdges = Array.from(edgeMap.values());

    // Calculate stats
    const difficultyDistribution: Record<R3FTopic['difficulty'], number> = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
    };

    topics.forEach(topic => {
      difficultyDistribution[topic.difficulty]++;
    });

    const avgSeoValue =
      topics.reduce((sum, t) => sum + t.seoValue, 0) / topics.length;

    res.status(200).json({
      nodes,
      edges: uniqueEdges,
      categories: R3F_CATEGORIES,
      stats: {
        totalTopics: topics.length,
        totalCategories: Object.keys(R3F_CATEGORIES).length,
        avgSeoValue,
        difficultyDistribution,
      },
    });
  } catch (error) {
    console.error('Knowledge graph API error:', error);
    res.status(500).json({ error: 'Failed to generate knowledge graph' });
  }
}

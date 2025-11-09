import { CreationTemplate, ThemeCategory } from '../generators/types';
import horrorTemplates from './horror';
import editorialTemplates from './editorial';
import hybridTemplates from './hybrid';

export const allTemplates: CreationTemplate[] = [
  ...horrorTemplates,
  ...editorialTemplates,
  ...hybridTemplates,
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: ThemeCategory): CreationTemplate[] {
  return allTemplates.filter((template) => template.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): CreationTemplate | undefined {
  return allTemplates.find((template) => template.id === id);
}

/**
 * Search templates by keywords
 */
export function searchTemplates(query: string): CreationTemplate[] {
  const lowerQuery = query.toLowerCase();
  return allTemplates.filter((template) => {
    const matchesName = template.name.toLowerCase().includes(lowerQuery);
    const matchesDescription = template.description.toLowerCase().includes(lowerQuery);
    const matchesKeywords = template.keywords.some((keyword) =>
      keyword.toLowerCase().includes(lowerQuery)
    );
    return matchesName || matchesDescription || matchesKeywords;
  });
}

/**
 * Find best matching template for a prompt
 */
export function findBestTemplate(prompt: string): CreationTemplate | null {
  const lowerPrompt = prompt.toLowerCase();
  let bestMatch: CreationTemplate | null = null;
  let highestScore = 0;

  for (const template of allTemplates) {
    let score = 0;

    // Check keyword matches
    for (const keyword of template.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }

    // Check name match
    if (lowerPrompt.includes(template.name.toLowerCase())) {
      score += 3;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = template;
    }
  }

  // Only return if we have a reasonable match
  return highestScore >= 2 ? bestMatch : null;
}

/**
 * Get random template
 */
export function getRandomTemplate(category?: ThemeCategory): CreationTemplate {
  const templates = category ? getTemplatesByCategory(category) : allTemplates;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Get featured templates (curated selection)
 */
export function getFeaturedTemplates(): CreationTemplate[] {
  return [
    getTemplateById('spectral-orb')!,
    getTemplateById('bleeding-text')!,
    getTemplateById('floating-quote')!,
    getTemplateById('twisted-tree')!,
    getTemplateById('data-corruption')!,
    getTemplateById('gothic-arch')!,
  ].filter(Boolean);
}

export { horrorTemplates, editorialTemplates, hybridTemplates };
export default allTemplates;

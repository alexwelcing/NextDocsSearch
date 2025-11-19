// Character Prompt Parser - Converts text descriptions to character configurations

import {
  CharacterType,
  CharacterPromptParsed,
  CharacterAnimationPreset,
} from './characterTypes';

interface KeywordMapping {
  types: Record<string, CharacterType>;
  features: Record<string, string>;
  animations: Record<string, CharacterAnimationPreset>;
  textures: string[];
  scales: Record<string, number>;
}

const KEYWORD_MAPPINGS: KeywordMapping = {
  types: {
    person: 'humanoid',
    human: 'humanoid',
    man: 'humanoid',
    woman: 'humanoid',
    child: 'humanoid',
    humanoid: 'humanoid',
    robot: 'humanoid',
    android: 'humanoid',
    toad: 'creature',
    frog: 'creature',
    lizard: 'creature',
    dragon: 'creature',
    creature: 'creature',
    monster: 'creature',
    beast: 'creature',
    animal: 'creature',
    bird: 'creature',
    fish: 'creature',
    cat: 'creature',
    dog: 'creature',
    wolf: 'creature',
    bear: 'creature',
    spider: 'creature',
    insect: 'creature',
    alien: 'creature',
    object: 'object',
    prop: 'object',
    furniture: 'object',
  },
  features: {
    tail: 'hasTail',
    'with tail': 'hasTail',
    tailed: 'hasTail',
    'long tail': 'hasTail',
    wings: 'hasWings',
    winged: 'hasWings',
    'with wings': 'hasWings',
    flying: 'hasWings',
    tentacles: 'tentacles',
    horns: 'horns',
    spikes: 'spikes',
    claws: 'claws',
    fangs: 'fangs',
    scales: 'scaly',
    fur: 'furry',
    feathers: 'feathery',
    'multiple arms': 'extraLimbs',
    'four arms': 'extraLimbs',
    'six legs': 'extraLimbs',
  },
  animations: {
    walking: 'walk',
    running: 'run',
    jumping: 'jump',
    flying: 'idle',
    swimming: 'walk',
    dancing: 'dance',
    fighting: 'attack',
    waving: 'wave',
    sitting: 'idle',
    standing: 'idle',
  },
  textures: ['smooth', 'rough', 'scaly', 'furry', 'metallic', 'slimy', 'wet', 'dry'],
  scales: {
    tiny: 0.3,
    small: 0.6,
    medium: 1.0,
    large: 1.5,
    huge: 2.5,
    giant: 4.0,
  },
};

export function parseCharacterPrompt(prompt: string): CharacterPromptParsed {
  const lowerPrompt = prompt.toLowerCase();
  const words = lowerPrompt.split(/\s+/);

  // Detect character type
  let characterType: CharacterType = 'creature'; // Default
  for (const [keyword, type] of Object.entries(KEYWORD_MAPPINGS.types)) {
    if (lowerPrompt.includes(keyword)) {
      characterType = type;
      break;
    }
  }

  // Detect features
  const features = {
    hasTail: false,
    hasWings: false,
    limbCount: characterType === 'humanoid' ? 4 : 4, // Default
    specialFeatures: [] as string[],
  };

  for (const [keyword, feature] of Object.entries(KEYWORD_MAPPINGS.features)) {
    if (lowerPrompt.includes(keyword)) {
      if (feature === 'hasTail') features.hasTail = true;
      else if (feature === 'hasWings') features.hasWings = true;
      else if (feature === 'extraLimbs') features.limbCount = 6;
      else if (!['scaly', 'furry', 'feathery'].includes(feature)) {
        features.specialFeatures.push(feature);
      }
    }
  }

  // Detect suggested animations
  const suggestedAnimations: CharacterAnimationPreset[] = ['idle', 'walk']; // Defaults
  for (const [keyword, animation] of Object.entries(KEYWORD_MAPPINGS.animations)) {
    if (lowerPrompt.includes(keyword) && !suggestedAnimations.includes(animation)) {
      suggestedAnimations.push(animation);
    }
  }

  // Detect material hints
  const colors: string[] = [];
  const colorKeywords = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
    'black', 'white', 'gray', 'brown', 'gold', 'silver', 'bronze',
    'crimson', 'azure', 'emerald', 'violet', 'cyan', 'magenta',
  ];

  for (const color of colorKeywords) {
    if (lowerPrompt.includes(color)) {
      colors.push(color);
    }
  }

  // Detect texture
  let texture: 'smooth' | 'rough' | 'scaly' | 'furry' | 'metallic' = 'smooth';
  if (lowerPrompt.includes('scaly') || lowerPrompt.includes('scales') || lowerPrompt.includes('reptile')) {
    texture = 'scaly';
  } else if (lowerPrompt.includes('furry') || lowerPrompt.includes('fur') || lowerPrompt.includes('hairy')) {
    texture = 'furry';
  } else if (lowerPrompt.includes('rough') || lowerPrompt.includes('rocky')) {
    texture = 'rough';
  } else if (lowerPrompt.includes('metallic') || lowerPrompt.includes('metal') || lowerPrompt.includes('shiny')) {
    texture = 'metallic';
  }

  // Detect scale
  let scaleValue = 1.0;
  for (const [keyword, scale] of Object.entries(KEYWORD_MAPPINGS.scales)) {
    if (lowerPrompt.includes(keyword)) {
      scaleValue = scale;
      break;
    }
  }
  const scale: [number, number, number] = [scaleValue, scaleValue, scaleValue];

  // Generate tags
  const tags: string[] = [characterType];
  if (features.hasTail) tags.push('tailed');
  if (features.hasWings) tags.push('winged');
  tags.push(texture);
  if (colors.length > 0) tags.push(...colors);

  return {
    description: prompt,
    characterType,
    features,
    suggestedAnimations,
    materialHints: {
      colors,
      texture,
    },
    scale,
    tags,
  };
}

export function extractCharacterName(prompt: string): string {
  // Try to extract a character name from the prompt
  // Look for patterns like "a toad" -> "Toad", "the dragon" -> "Dragon"
  const patterns = [
    /(?:a|an|the)\s+(\w+(?:\s+\w+)?)/i,
    /^(\w+(?:\s+\w+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1]
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return 'Character';
}

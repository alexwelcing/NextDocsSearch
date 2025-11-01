/**
 * Seasonal Theme Configuration System
 * Determines the current season based on date and provides theme settings
 * including colors, effects, and backgrounds for each season
 */

export type Season = 'winter' | 'spring' | 'summer' | 'autumn' | 'halloween' | 'christmas';

export interface SeasonalTheme {
  colors: string[];
  emissiveColor: string;
  effectType: 'snow' | 'petals' | 'fireflies' | 'leaves' | 'spiderwebs' | 'none';
  particleIntensity: number;
  lightColor: string;
  backgroundPrefix: string;
  backgroundColor: string;
}

export const seasonalThemes: Record<Season, SeasonalTheme> = {
  christmas: {
    colors: ['#FF6B6B', '#00D084', '#FFD700', '#FFFFFF'],
    emissiveColor: '#FF6B6B',
    effectType: 'snow',
    particleIntensity: 0.8,
    lightColor: '#FFD700',
    backgroundPrefix: 'christmas',
    backgroundColor: '#1a1a3e',
  },
  halloween: {
    colors: ['#FF6B00', '#8B00FF', '#000000', '#FFD700'],
    emissiveColor: '#FF6B00',
    effectType: 'spiderwebs',
    particleIntensity: 0.6,
    lightColor: '#FF6B00',
    backgroundPrefix: 'halloween',
    backgroundColor: '#1a0a1a',
  },
  winter: {
    colors: ['#87CEEB', '#FFFFFF', '#B0E0E6', '#4682B4'],
    emissiveColor: '#87CEEB',
    effectType: 'snow',
    particleIntensity: 0.5,
    lightColor: '#87CEEB',
    backgroundPrefix: 'winter',
    backgroundColor: '#0a1a2e',
  },
  spring: {
    colors: ['#FFB7B7', '#87CEEB', '#90EE90', '#FFD700'],
    emissiveColor: '#FFB7B7',
    effectType: 'petals',
    particleIntensity: 0.4,
    lightColor: '#FFB7B7',
    backgroundPrefix: 'spring',
    backgroundColor: '#1e2a1e',
  },
  summer: {
    colors: ['#FFD700', '#FFA500', '#87CEEB', '#90EE90'],
    emissiveColor: '#FFD700',
    effectType: 'fireflies',
    particleIntensity: 0.3,
    lightColor: '#FFD700',
    backgroundPrefix: 'summer',
    backgroundColor: '#1e2a3e',
  },
  autumn: {
    colors: ['#FF6B00', '#FFD700', '#8B4513', '#DC143C'],
    emissiveColor: '#FF6B00',
    effectType: 'leaves',
    particleIntensity: 0.5,
    lightColor: '#FF6B00',
    backgroundPrefix: 'autumn',
    backgroundColor: '#2a1e0a',
  },
};

/**
 * Special holiday dates (month is 0-indexed: 0 = January, 11 = December)
 */
interface HolidayDate {
  month: number;
  startDay: number;
  endDay: number;
  season: Season;
}

const specialHolidays: HolidayDate[] = [
  // Halloween period (October 15 - November 1)
  { month: 9, startDay: 15, endDay: 31, season: 'halloween' },
  { month: 10, startDay: 1, endDay: 1, season: 'halloween' },

  // Christmas period (December 1 - January 1)
  { month: 11, startDay: 1, endDay: 31, season: 'christmas' },
  { month: 0, startDay: 1, endDay: 1, season: 'christmas' },
];

/**
 * Determines the current season based on the current date
 * @param override Optional season override (from query params, etc.)
 * @returns The current season
 */
export function getCurrentSeason(override?: string | null): Season {
  // If there's an override, use it (if valid)
  if (override) {
    const normalized = override.toLowerCase() as Season;
    if (['winter', 'spring', 'summer', 'autumn', 'halloween', 'christmas'].includes(normalized)) {
      return normalized;
    }
  }

  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  // Check for special holidays first
  for (const holiday of specialHolidays) {
    if (month === holiday.month && day >= holiday.startDay && day <= holiday.endDay) {
      return holiday.season;
    }
  }

  // Otherwise determine by season (Northern Hemisphere)
  // Winter: December, January, February
  if (month === 11 || month === 0 || month === 1) {
    return 'winter';
  }
  // Spring: March, April, May
  if (month >= 2 && month <= 4) {
    return 'spring';
  }
  // Summer: June, July, August
  if (month >= 5 && month <= 7) {
    return 'summer';
  }
  // Autumn: September, October, November
  return 'autumn';
}

/**
 * Validates if a string is a valid season
 * @param season The season string to validate
 * @returns True if valid season
 */
export function isValidSeason(season: string | null | undefined): boolean {
  if (!season) return false;
  const normalized = season.toLowerCase();
  return ['winter', 'spring', 'summer', 'autumn', 'halloween', 'christmas'].includes(normalized);
}

/**
 * Gets the theme configuration for a specific season
 * @param season The season to get the theme for
 * @returns The theme configuration
 */
export function getSeasonalTheme(season: Season): SeasonalTheme {
  return seasonalThemes[season];
}

/**
 * Gets a specific color from the current season's palette
 * @param season The current season
 * @param colorType The type of color to retrieve
 * @returns The hex color string
 */
export function getSeasonalColor(season: Season, colorType: 'primary' | 'emissive' | 'light'): string {
  const theme = seasonalThemes[season];

  switch (colorType) {
    case 'emissive':
      return theme.emissiveColor;
    case 'light':
      return theme.lightColor;
    case 'primary':
    default:
      return theme.colors[0];
  }
}

/**
 * Gets a random color from the current season's palette
 * @param season The current season
 * @returns A random hex color from the season's palette
 */
export function getRandomSeasonalColor(season: Season): string {
  const colors = seasonalThemes[season].colors;
  return colors[Math.floor(Math.random() * colors.length)];
}

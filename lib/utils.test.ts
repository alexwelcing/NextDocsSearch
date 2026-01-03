import { describe, it, expect } from 'vitest';
import { cn, escapeMdxContent } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
    });

    it('handles conditional classes', () => {
      expect(cn('bg-red-500', false && 'text-white', 'p-4')).toBe('bg-red-500 p-4');
    });

    it('merges tailwind classes', () => {
      expect(cn('p-4', 'p-8')).toBe('p-8');
    });
  });

  describe('escapeMdxContent', () => {
    it('escapes < followed by a letter', () => {
      const input = 'This is a <tag> inside text.';
      const expected = 'This is a &lt;tag> inside text.';
      expect(escapeMdxContent(input)).toBe(expected);
    });

    it('does not escape < inside code blocks', () => {
      const input = '```\n<tag>\n```';
      expect(escapeMdxContent(input)).toBe(input);
    });

    it('does not escape < followed by non-letter', () => {
      const input = '1 < 2';
      expect(escapeMdxContent(input)).toBe(input);
    });
  });
});

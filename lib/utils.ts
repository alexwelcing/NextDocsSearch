import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function escapeMdxContent(content: string): string {
  const lines = content.split('\n');
  let inCodeBlock = false;
  
  return lines.map(line => {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return line;
    }
    
    if (inCodeBlock) {
      return line;
    }
    
    // Escape < followed by a letter to prevent it from being interpreted as a tag
    return line.replace(/<([a-zA-Z])/g, '&lt;$1');
  }).join('\n');
}

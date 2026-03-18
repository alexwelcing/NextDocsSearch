export interface ShipTrick {
  id: string
  command: string
  label: string
  description: string
  directive: string
  responseShape: string
  defaultTopic: string
  example: string
}

export interface ResolvedShipTrick {
  trick?: ShipTrick
  searchQuery: string
  transformedQuery: string
  styleInstruction?: string
  helpResponse?: string
}

export const SHIP_TRICKS: ShipTrick[] = [
  {
    id: 'brief',
    command: '/brief',
    label: 'Executive Brief',
    description: 'Blunt summary with the important bits first.',
    directive: 'Give a sharp executive brief on the topic.',
    responseShape: 'Open with a one-line verdict, then 3 compact bullets, then a short why-it-matters line.',
    defaultTopic: "Alex's core product and AI work",
    example: '/brief Alex\'s product management approach',
  },
  {
    id: 'signal',
    command: '/signal',
    label: 'High-Signal Takeaways',
    description: 'Extract the strongest insights without the filler.',
    directive: 'Extract the highest-signal takeaways from the topic.',
    responseShape: 'Return 3 to 5 crisp takeaways with one sentence each.',
    defaultTopic: 'the most important themes across Alex\'s work',
    example: '/signal what matters most in Alex\'s AI work?',
  },
  {
    id: 'map',
    command: '/map',
    label: 'Systems Map',
    description: 'Connect the topic to strategy, tech, and narrative themes.',
    directive: 'Map the topic across product strategy, technical execution, and worldbuilding or narrative patterns when relevant.',
    responseShape: 'Use 3 short sections: Product, Technical, Narrative.',
    defaultTopic: 'how this site fits together',
    example: '/map how NextDocsSearch is structured',
  },
  {
    id: 'roast',
    command: '/roast',
    label: 'Brutal Critique',
    description: 'Stress-test an idea without being polite about bad assumptions.',
    directive: 'Critique the idea hard, but keep it useful and aimed at improving the work rather than mocking the person.',
    responseShape: 'Call out weak assumptions, risks, and what to fix next.',
    defaultTopic: 'this product idea',
    example: '/roast this homepage concept for Alex\'s portfolio',
  },
  {
    id: 'compare',
    command: '/compare',
    label: 'Head-to-Head',
    description: 'Contrast two approaches or ideas cleanly.',
    directive: 'Compare the competing ideas directly and call the tradeoffs honestly.',
    responseShape: 'Use: Similarities, Differences, Best choice, Why.',
    defaultTopic: 'Alex\'s product work versus his speculative writing',
    example: '/compare Alex\'s product leadership and speculative AI writing',
  },
  {
    id: 'mission',
    command: '/mission',
    label: 'Next-Move Mission',
    description: 'Turn a topic into concrete next steps.',
    directive: 'Turn the topic into an actionable mission with immediate next steps.',
    responseShape: 'Use a mission title, objective, and 3 next actions.',
    defaultTopic: 'improving Ship AI',
    example: '/mission make Ship AI more memorable',
  },
]

function getHelpResponse(): string {
  const trickLines = SHIP_TRICKS.map(
    (trick) => `${trick.command} — ${trick.description} Example: ${trick.example}`
  )

  return [
    'Ship AI tricks are live. Here is the useful version:',
    '',
    ...trickLines,
    '',
    'You can also just ask normal questions. The slash commands only change the response mode.',
  ].join('\n')
}

export function resolveShipTrick(rawInput: string): ResolvedShipTrick {
  const trimmedInput = rawInput.trim()

  if (!trimmedInput.startsWith('/')) {
    return {
      searchQuery: trimmedInput,
      transformedQuery: trimmedInput,
    }
  }

  const [rawCommand, ...rest] = trimmedInput.split(/\s+/)
  const command = rawCommand.toLowerCase()

  if (command === '/tricks' || command === '/help') {
    return {
      searchQuery: '',
      transformedQuery: '',
      helpResponse: getHelpResponse(),
    }
  }

  const trick = SHIP_TRICKS.find((candidate) => candidate.command === command)

  if (!trick) {
    return {
      searchQuery: trimmedInput,
      transformedQuery: trimmedInput,
      helpResponse: `Unknown Ship AI command: ${rawCommand}\n\n${getHelpResponse()}`,
    }
  }

  const topic = rest.join(' ').trim() || trick.defaultTopic

  return {
    trick,
    searchQuery: topic,
    transformedQuery: `${trick.directive}\n\nTopic: ${topic}`,
    styleInstruction: trick.responseShape,
  }
}
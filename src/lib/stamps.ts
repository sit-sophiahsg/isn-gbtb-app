import type { EventInfo, StampKey } from './types'

export interface StampDef {
  key: StampKey
  title: string
  /** Bold capitals in the stamp centre, one entry per line. */
  lines: string[]
  ink: string
  inkDark: string
  /** Resting angle of the inked stamp, in degrees. */
  tilt: number
  prompt: string[]
  photoHint: string
}

const BASE: StampDef[] = [
  {
    key: 'flower_home',
    title: 'A flower from home',
    lines: ['FLOWER', 'FROM HOME'],
    ink: '#b8326f',
    inkDark: '#f07fb0',
    tilt: -8,
    prompt: [
      'Find a flower or plant in the Flower Dome that reminds you of home. It could even be one of the poinsettias or conifers dressed up for Christmas.',
      'Take a photo and tell us why it reminds you of home.',
    ],
    photoHint: 'A photo of the flower or plant',
  },
  {
    key: 'this_is_sg',
    title: 'This is Singapore',
    lines: ['THIS IS', 'SINGAPORE'],
    ink: '#24408e',
    inkDark: '#8fa8f0',
    tilt: 6,
    prompt: [
      'Find something that represents Singapore to you.',
      'Take a photo and tell us why it feels like Singapore.',
    ],
    photoHint: 'A photo of what feels like Singapore',
  },
  {
    key: 'swap_story',
    title: 'Swap a story',
    lines: ['SWAP A', 'STORY'],
    ink: '#0d7471',
    inkDark: '#5fd0c8',
    tilt: -4,
    prompt: [
      "Chat with someone who grew up in a different country from you. If you're an international student, find a local student; if you're local, find an international student.",
      'Swap one phrase, fun fact or food recommendation from each of your homes, and write down what you learned.',
      'Take a photo together.',
    ],
    photoHint: 'A photo of the two of you',
  },
  {
    key: 'bridge',
    title: 'Bridge between countries',
    lines: ['BRIDGE', 'BETWEEN', 'COUNTRIES'],
    ink: '#9a6a00',
    inkDark: '#e9c46a',
    tilt: 9,
    prompt: [
      'Find something that connects Singapore with another country: a plant, a word, a food, or a festive tradition.',
      'International students can link Singapore to home; local students can pick any country they have a connection to, whether family, travel, or a friend.',
      'How is the end of the year celebrated in both places?',
    ],
    photoHint: 'A photo of the connection you found',
  },
  {
    key: 'seasonal',
    title: 'All aboard the MRT',
    lines: ['ALL ABOARD', 'THE MRT'],
    ink: '#1e5b3a',
    inkDark: '#7fcf9c',
    tilt: -6,
    prompt: [
      'Find the SMRT trains and reimagined MRT stations in the Christmas Train Show and take a photo with them.',
      "Which real MRT station does it remind you of, and what's your favourite stop or memory on that line?",
      "New to Singapore? Tell us which station you've used most since arriving, or the one you most want to visit.",
    ],
    photoHint: 'A photo with the trains or stations',
  },
]

/** Stamp definitions, with the seasonal stamp's text taken from the event (editable by organisers). */
export function getStamps(event: EventInfo | null): StampDef[] {
  if (!event) return BASE
  return BASE.map((s) =>
    s.key === 'seasonal'
      ? {
          ...s,
          title: event.seasonalTitle || s.title,
          lines: splitStampText(event.seasonalStampText) ?? s.lines,
          prompt: event.seasonalPrompt ? event.seasonalPrompt.split(/\n+/).filter(Boolean) : s.prompt,
        }
      : s,
  )
}

function splitStampText(text: string): string[] | null {
  const lines = text
    .split(/\n|\//)
    .map((l) => l.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3)
  return lines.length ? lines : null
}

export const STAMP_KEYS: StampKey[] = BASE.map((s) => s.key)

export const DEFAULT_SEASONAL = {
  title: BASE[4].title,
  stampText: BASE[4].lines.join('\n'),
  prompt: BASE[4].prompt.join('\n'),
}

export const REFLECTION_MAX = 280

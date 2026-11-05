/** Precise Temperament and chakra-tone constants shared by the DSP and the page. */

export const VERSION_IDS = ['ptt', 'shimmer', 'drone'] as const
export type VersionId = (typeof VERSION_IDS)[number]

export type MusicalMode = 'major' | 'minor'

export const A4_CONCERT = 440
export const A4_PTT = 432.081

/** Whole-lattice pitch ratio from concert A4 to Grant's Precise Temperament A4. */
export const PTT_RATIO = A4_PTT / A4_CONCERT

export const PTT_CENTS = 1200 * Math.log2(PTT_RATIO)

/** Tape varispeed amount when tempo is allowed to follow the pitch (percent slower). */
export const VARISPEED_PERCENT = (1 - PTT_RATIO) * 100

/** C5 in 12-TET once A4 has moved to 432.081 Hz. */
export const C5_PTT = A4_PTT * 2 ** (3 / 12)

/** Grant's 528-region tone used as the quarter-tone halo above C5. */
export const FREQ_528 = 528.099

export const SHIMMER_RATIO = FREQ_528 / C5_PTT
export const SHIMMER_CENTS = 1200 * Math.log2(SHIMMER_RATIO)

export const JUST_FIFTH = 3 / 2
export const JUST_FIFTH_CENTS = 1200 * Math.log2(JUST_FIFTH)
export const JUST_NINTH = 9 / 8
export const PTT_MAJOR_THIRD = 2 ** (1 / 3)

export const SHIMMER_HP_HZ = 280
export const SHIMMER_LP_HZ = 7500
export const SHIMMER_LEVEL_DB = -18
export const SHIMMER_TAP_MS = [45, 82, 120, 158, 195] as const

export const DRONE_HP_HZ = 45
export const DRONE_LP_HZ = 1200
export const DRONE_LEVEL_DB = -20
export const DRONE_BREATH_HZ = 0.08

/** Output peak ceiling so rendered WAVs do not kiss digital full scale. */
export const PEAK_CEILING_DB = -1
export const PEAK_CEILING = 10 ** (PEAK_CEILING_DB / 20)

export const PITCH_CLASS_SHORT = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
] as const

export const PITCH_CLASS_LABELS = [
  'C',
  'C# / Db',
  'D',
  'D# / Eb',
  'E',
  'F',
  'F# / Gb',
  'G',
  'G# / Ab',
  'A',
  'A# / Bb',
  'B'
] as const

export interface ChakraCentre {
  name: string
  bridge: boolean
  explanation: string
}

/**
 * Seven naturals name the chakra centres. The five accidentals are the bridges
 * between them. A 24-tone wheel would drop a quarter-tone halfway between each
 * of these semitone steps — the same neighbourhood as the 528 Hz halo above C5.
 */
export const CHAKRA_BY_PITCH_CLASS: readonly ChakraCentre[] = [
  {
    name: 'Root',
    bridge: false,
    explanation: 'C is the root centre.'
  },
  {
    name: 'Root–Sacral bridge',
    bridge: true,
    explanation: 'C# / Db sits between Root (C) and Sacral (D).'
  },
  {
    name: 'Sacral',
    bridge: false,
    explanation: 'D is the sacral centre.'
  },
  {
    name: 'Sacral–Solar bridge',
    bridge: true,
    explanation: 'D# / Eb sits between Sacral (D) and Solar Plexus (E).'
  },
  {
    name: 'Solar Plexus',
    bridge: false,
    explanation: 'E is the solar plexus centre.'
  },
  {
    name: 'Heart',
    bridge: false,
    explanation: 'F is the heart centre.'
  },
  {
    name: 'Heart–Throat bridge',
    bridge: true,
    explanation: 'F# / Gb sits between Heart (F) and Throat (G).'
  },
  {
    name: 'Throat',
    bridge: false,
    explanation: 'G is the throat centre.'
  },
  {
    name: 'Throat–Third Eye bridge',
    bridge: true,
    explanation: 'G# / Ab sits between Throat (G) and Third Eye (A).'
  },
  {
    name: 'Third Eye',
    bridge: false,
    explanation: 'A is the third eye centre.'
  },
  {
    name: 'Third Eye–Crown bridge',
    bridge: true,
    explanation: 'A# / Bb sits between Third Eye (A) and Crown (B).'
  },
  {
    name: 'Crown',
    bridge: false,
    explanation: 'B is the crown centre.'
  }
]

/** Krumhansl & Kessler 1982 key profiles, as used by Krumhansl–Schmuckler. */
export const KS_MAJOR = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
] as const

export const KS_MINOR = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
] as const

export interface KeyCandidate {
  tonic: number
  mode: MusicalMode
  correlation: number
}

export interface KeyResult {
  tonic: number
  mode: MusicalMode
  correlation: number
  ambiguous: boolean
  runnerUp: KeyCandidate | null
}

export interface DronePartial {
  label: string
  ratio: number
  gain: number
}

export function formatCents(cents: number): string {
  const rounded = cents.toFixed(2)
  return cents > 0 ? `+${rounded}` : rounded
}

export function keyName(tonic: number, mode: MusicalMode): string {
  const note = PITCH_CLASS_SHORT[((tonic % 12) + 12) % 12]
  return `${note} ${mode}`
}

export function chakraFor(tonic: number): ChakraCentre {
  return CHAKRA_BY_PITCH_CLASS[((tonic % 12) + 12) % 12]!
}

/** Lowest tonic octave whose fundamental sits in a warm bass register, above the drone high-pass. */
export function tonicFundamental(pitchClass: number): { midi: number; hz: number } {
  const pc = ((pitchClass % 12) + 12) % 12
  let fallback = { midi: pc + 36, hz: A4_PTT }
  let fallbackDistance = Infinity
  for (let midi = pc; midi < 128; midi += 12) {
    const hz = A4_PTT * 2 ** ((midi - 69) / 12)
    const distance = Math.abs(Math.log2(hz / 80))
    if (distance < fallbackDistance) {
      fallback = { midi, hz }
      fallbackDistance = distance
    }
    if (hz >= 52 && hz <= 110) return { midi, hz }
  }
  return fallback
}

export function midiNoteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${PITCH_CLASS_SHORT[pc]}${octave}`
}

/**
 * Just-ratio stack for the drone.
 * Major keys take Grant's PTT major third, 2^(1/3).
 * Minor keys stay on the open fifth and ninth so a third never fights the mode.
 * The 5th harmonic (a just major third) is included only for major keys.
 */
export function droneRecipe(mode: MusicalMode): DronePartial[] {
  const partials: DronePartial[] = [
    { label: 'Unison 1:1', ratio: 1, gain: 1 },
    { label: 'Octave 2:1', ratio: 2, gain: 0.55 },
    { label: 'Pure fifth 3:2', ratio: JUST_FIFTH, gain: 0.38 },
    { label: 'Ninth 9:8', ratio: JUST_NINTH, gain: 0.22 },
    { label: 'Warm octave 4:1', ratio: 4, gain: 0.08 }
  ]
  if (mode === 'major') {
    partials.push({
      label: 'PTT major third 2^(1/3)',
      ratio: PTT_MAJOR_THIRD,
      gain: 0.18
    })
    partials.push({ label: 'Warm fifth harmonic', ratio: 5, gain: 0.05 })
  } else {
    partials.push({ label: 'Octave plus fifth 3:1', ratio: 3, gain: 0.12 })
  }
  partials.push({ label: 'Warm sixth harmonic', ratio: 6, gain: 0.03 })
  return partials
}

export function outputFilename(originalName: string, version: VersionId): string {
  const base = originalName.replace(/\.(wav|wave)$/i, '') || 'audio'
  if (version === 'ptt') return `${base}_432Hz_PTT.wav`
  if (version === 'shimmer') return `${base}_432_528_shimmer.wav`
  return `${base}_432_chakra_drone.wav`
}

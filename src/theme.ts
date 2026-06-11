/**
 * Athlr design tokens.
 *
 * Direction: "night training session" — deep ink-blue field, a single
 * high-visibility amber accent borrowed from reflective running gear,
 * and oversized tabular numerals as the signature element. Stats are
 * the hero of this app, so the type does the talking.
 */

export const colors = {
  /** app background — deep ink blue, not pure black */
  bg: '#0B1220',
  /** raised surfaces (cards, tab bar) */
  surface: '#121C2E',
  surfaceAlt: '#1A2740',
  /** hairline borders */
  border: '#22304A',
  /** primary text */
  text: '#EDF2FB',
  /** secondary text */
  textDim: '#8A97AD',
  /** high-vis amber accent (reflective gear) */
  accent: '#FFB020',
  accentPressed: '#E09A12',
  /** GPS / live signal green */
  live: '#3DDC84',
  /** stop / danger */
  danger: '#FF5A5F',
  /** route polyline on map */
  route: '#FFB020',
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
} as const;

export const type = {
  /** giant live numerals — the signature */
  stat: {
    fontSize: 64,
    fontWeight: '800' as const,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'] as const,
    color: colors.text,
  },
  statSmall: {
    fontSize: 28,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'] as const,
    color: colors.text,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: colors.textDim,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    color: colors.textDim,
  },
} as const;

export const radii = {
  card: 16,
  pill: 999,
} as const;

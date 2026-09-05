/**
 * Darkroom Editorial Design System Tokens
 */
export const TOKENS = {
  colors: {
    background: '#181410',
    surface1: '#211B15',
    surface2: '#2A2219',
    border: '#3D3226',
    accentPrimary: '#D97A3F',
    accentSecondary: '#B8443A',
    textPrimary: '#F5EFE6',
    textBody: '#D8CDBC',
    textMuted: '#9C8E78',
    textPlaceholder: '#6B5F4E',
  },
  radius: {
    default: '4px',
    btn: '2px',
    pill: '9999px',
  },
  fonts: {
    display: "'Fraunces', serif",
    body: "'General Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
} as const

export type DarkroomTokens = typeof TOKENS

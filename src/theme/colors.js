const emerald = {
  key: 'emerald',
  primary: '#00c795',
  accent: '#22d3ee',
  primarySoft: 'rgba(0,199,149,0.16)',
  danger: '#ef4444',
  success: '#34d399',
  warning: '#fb923c',
  info: '#38bdf8',
  primaryGradient: ['#34f5c5', '#0fb8b8', '#0ea5e9'],
  accentGradient: ['#67e8f9', '#22d3ee', '#0284c7'],
  glow: 'rgba(0,199,149,0.45)',
  dark: {
    bg: '#050b18',
    bgSoft: '#0c1426',
    card: '#0f1a2f',
    cardSoft: 'rgba(31,41,69,0.5)',
    text: '#f8fafc',
    textMuted: 'rgba(226,232,240,0.72)',
    border: 'rgba(125,145,175,0.28)',
    glassBg: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.12)',
    shadow: 'rgba(3, 7, 18, 0.55)'
  },
  light: {
    bg: '#f3f7ff',
    bgSoft: '#e6effd',
    card: '#ffffff',
    cardSoft: 'rgba(11,59,106,0.06)',
    text: '#0f172a',
    textMuted: 'rgba(15,23,42,0.58)',
    border: 'rgba(15,23,42,0.12)',
    glassBg: 'rgba(255,255,255,0.7)',
    glassBorder: 'rgba(255,255,255,0.38)',
    shadow: 'rgba(2, 6, 23, 0.12)'
  }
};

const navy = {
  key: 'navy',
  primary: '#1e3a8a',
  accent: '#60a5fa',
  primarySoft: 'rgba(30,58,138,0.2)',
  danger: '#f87171',
  success: '#38bdf8',
  warning: '#fbbf24',
  info: '#60a5fa',
  primaryGradient: ['#93c5fd', '#3b82f6', '#1e3a8a'],
  accentGradient: ['#c7d2fe', '#818cf8', '#312e81'],
  glow: 'rgba(96,165,250,0.45)',
  dark: {
    bg: '#050816',
    bgSoft: '#0d1324',
    card: '#0f1b33',
    cardSoft: 'rgba(49,55,87,0.55)',
    text: '#f8fafc',
    textMuted: 'rgba(226,232,240,0.72)',
    border: 'rgba(125,145,175,0.28)',
    glassBg: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.12)',
    shadow: 'rgba(3, 7, 18, 0.55)'
  },
  light: {
    bg: '#f5f7ff',
    bgSoft: '#e6ebff',
    card: '#ffffff',
    cardSoft: 'rgba(17,63,120,0.07)',
    text: '#0f172a',
    textMuted: 'rgba(15,23,42,0.6)',
    border: 'rgba(15,23,42,0.12)',
    glassBg: 'rgba(255,255,255,0.7)',
    glassBorder: 'rgba(15,23,42,0.14)',
    shadow: 'rgba(2, 6, 23, 0.12)'
  }
};

export const palettes = { emerald, navy };

// Default export kept for backward compatibility
export const colors = emerald;

export default palettes;

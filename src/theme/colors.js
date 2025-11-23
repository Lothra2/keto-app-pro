const emerald = {
  key: 'emerald',
  primary: '#0f766e',
  accent: '#0ea5e9',
  primarySoft: 'rgba(15,118,110,0.16)',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f97316',
  info: '#0ea5e9',
  dark: {
    bg: '#0b1120',
    bgSoft: '#111b2b',
    card: '#101a2e',
    cardSoft: 'rgba(31,41,69,0.5)',
    text: '#f8fafc',
    textMuted: 'rgba(226,232,240,0.72)',
    border: 'rgba(125,145,175,0.28)'
  },
  light: {
    bg: '#f5f6fb',
    bgSoft: '#e7ecf5',
    card: '#ffffff',
    cardSoft: 'rgba(11,59,106,0.05)',
    text: '#0f172a',
    textMuted: 'rgba(15,23,42,0.58)',
    border: 'rgba(15,23,42,0.12)'
  }
};

const navy = {
  key: 'navy',
  primary: '#0b3b6a',
  accent: '#5ad4ff',
  primarySoft: 'rgba(11,59,106,0.16)',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f97316',
  info: '#0ea5e9',
  dark: {
    bg: '#0b1120',
    bgSoft: '#111b2b',
    card: '#101a2e',
    cardSoft: 'rgba(31,41,69,0.5)',
    text: '#f8fafc',
    textMuted: 'rgba(226,232,240,0.72)',
    border: 'rgba(125,145,175,0.28)'
  },
  light: {
    bg: '#f6f8fc',
    bgSoft: '#e6edf7',
    card: '#ffffff',
    cardSoft: 'rgba(11,59,106,0.05)',
    text: '#0f172a',
    textMuted: 'rgba(15,23,42,0.58)',
    border: 'rgba(15,23,42,0.12)'
  }
};

export const palettes = { emerald, navy };

// Default export kept for backward compatibility
export const colors = emerald;

export default palettes;

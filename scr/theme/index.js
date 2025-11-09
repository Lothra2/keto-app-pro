// colors.js
export const colors = {
  primary: '#0f766e',
  primarySoft: 'rgba(15,118,110,0.1)',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f97316',
  info: '#0ea5e9',
  
  dark: {
    bg: '#0f172a',
    bgSoft: '#111827',
    card: '#1e293b',
    cardSoft: 'rgba(15,23,42,0.35)',
    text: '#e2e8f0',
    textMuted: 'rgba(226,232,240,0.6)',
    border: 'rgba(148,163,184,0.2)'
  },
  
  light: {
    bg: '#f1f5f9',
    bgSoft: '#e2e8f0',
    card: '#ffffff',
    cardSoft: 'rgba(255,255,255,0.5)',
    text: '#0f172a',
    textMuted: 'rgba(15,23,42,0.55)',
    border: 'rgba(148,163,184,0.3)'
  }
};

// spacing.js
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

// typography.js
export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5
  },
  h2: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3
  },
  h3: {
    fontSize: 18,
    fontWeight: '600'
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  caption: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.7
  }
};

// radius.js
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999
};

// Theme completo
export const getTheme = (mode = 'dark') => {
  const colorScheme = mode === 'dark' ? colors.dark : colors.light;
  
  return {
    colors: {
      ...colors,
      ...colorScheme,
      primary: colors.primary,
      primarySoft: colors.primarySoft,
      danger: colors.danger,
      success: colors.success,
      warning: colors.warning,
      info: colors.info
    },
    spacing,
    typography,
    radius,
    mode
  };
};

export default { colors, spacing, typography, radius, getTheme };

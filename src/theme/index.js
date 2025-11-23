import palettes, { colors as defaultColors } from './colors';
import spacing from './spacing';
import typography from './typography';
import radius from './radius';

export const getTheme = (mode = 'dark') => {
  const paletteKey = mode === 'navy' ? 'navy' : 'emerald';
  const palette = palettes[paletteKey] || palettes.emerald;
  const isLight = mode === 'light';
  const colorScheme = isLight ? palette.light : palette.dark;

  return {
    colors: {
      ...palette,
      ...colorScheme,
      primary: palette.primary,
      primarySoft: palette.primarySoft,
      accent: palette.accent || palette.primary,
      danger: palette.danger,
      success: palette.success,
      warning: palette.warning,
      info: palette.info,
      background: colorScheme.bg,
      surface: colorScheme.card,
      onPrimary: '#ffffff',
      onSurface: colorScheme.text
    },
    spacing,
    typography,
    radius,
    mode: isLight ? 'light' : 'dark',
    name: paletteKey
  };
};

export { defaultColors as colors, spacing, typography, radius, palettes };

export default {
  colors: defaultColors,
  spacing,
  typography,
  radius,
  getTheme
};

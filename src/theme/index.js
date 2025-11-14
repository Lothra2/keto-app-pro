import colors from './colors';
import spacing from './spacing';
import typography from './typography';
import radius from './radius';

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
      info: colors.info,
      background: colorScheme.bg,
      surface: colorScheme.card,
      onPrimary: '#ffffff',
      onSurface: colorScheme.text
    },
    spacing,
    typography,
    radius,
    mode
  };
};

export { colors, spacing, typography, radius };

export default {
  colors,
  spacing,
  typography,
  radius,
  getTheme
};

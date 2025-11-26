import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { withAlpha } from '../../theme/utils';

const Card = ({ children, style, outlined = false, tone = 'default' }) => {
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const palette = {
    default: [
      withAlpha(theme.colors.glassBg, 1),
      withAlpha(theme.colors.glassBg, 0.7)
    ],
    info: [
      `${theme.colors.info}33`,
      `${theme.colors.info}12`
    ],
    success: [withAlpha(theme.colors.success, 0.22), withAlpha(theme.colors.success, 0.1)],
    warning: [withAlpha(theme.colors.warning, 0.2), withAlpha(theme.colors.warning, 0.1)],
  };

  const gradient = palette[tone] || palette.default;

  return (
    <View style={[styles.shadowWrap, style]}>
      <LinearGradient
        colors={outlined ? ['transparent', 'transparent'] : gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, outlined ? styles.outlined : styles.filled]}
      >
        <View style={[styles.inner, outlined && styles.innerOutlined]}>{children}</View>
      </LinearGradient>
    </View>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    shadowWrap: {
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.16,
      shadowRadius: 24,
      elevation: 8,
      backgroundColor: 'transparent',
    },
    base: {
      borderRadius: theme.radius.xl,
      padding: 1,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.glassBorder, 0.4),
      backgroundColor: withAlpha(theme.colors.glassBg, 0.7),
    },
    inner: {
      borderRadius: theme.radius.xl,
      padding: theme.spacing.lg,
      backgroundColor: withAlpha(theme.colors.surface, 0.9),
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.glassBorder, 0.4),
    },
    innerOutlined: {
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
    },
    filled: {},
    outlined: {
      borderWidth: 1.25,
      borderColor: theme.colors.glassBorder,
      backgroundColor: 'transparent'
    }
  });

export default Card;

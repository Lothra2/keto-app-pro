import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const Card = ({ children, style, outlined = false, tone = 'default' }) => {
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const palette = {
    default: [
      theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
      theme.colors.cardSoft || 'rgba(15,23,42,0.06)',
    ],
    info: [
      `${theme.colors.info}29`,
      `${theme.colors.info}14`,
    ],
    success: ['rgba(34,197,94,0.18)', 'rgba(34,197,94,0.06)'],
    warning: ['rgba(249,115,22,0.18)', 'rgba(249,115,22,0.06)'],
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
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      shadowColor: theme.colors.accent || theme.colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.mode === 'dark' ? 0.18 : 0.12,
      shadowRadius: 14,
      elevation: 4,
      backgroundColor: 'transparent',
    },
    base: {
      borderRadius: theme.radius.lg,
      padding: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    inner: {
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    innerOutlined: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filled: {},
    outlined: {
      backgroundColor: 'transparent'
    }
  });

export default Card;

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
    default: ['rgba(11,59,106,0.14)', 'rgba(10,18,32,0.18)'],
    info: ['rgba(90,212,255,0.18)', 'rgba(90,212,255,0.06)'],
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
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.mode === 'dark' ? 0.26 : 0.12,
      shadowRadius: 18,
      elevation: 6,
      backgroundColor: 'transparent',
    },
    base: {
      borderRadius: theme.radius.lg,
      padding: 1,
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? 'rgba(90,212,255,0.16)' : 'rgba(11,59,106,0.16)',
    },
    inner: {
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      backgroundColor: theme.mode === 'dark' ? 'rgba(12,20,36,0.78)' : 'rgba(255,255,255,0.9)',
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

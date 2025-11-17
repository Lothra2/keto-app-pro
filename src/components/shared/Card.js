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
    default: ['rgba(255,255,255,0.06)', 'rgba(15,23,42,0.08)'],
    info: ['rgba(14,165,233,0.18)', 'rgba(14,165,233,0.06)'],
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
        <View style={styles.inner}>{children}</View>
      </LinearGradient>
    </View>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    shadowWrap: {
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      shadowColor: '#0ea5e9',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.mode === 'dark' ? 0.16 : 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
    base: {
      borderRadius: theme.radius.lg,
      padding: 1,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    inner: {
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      backgroundColor: theme.mode === 'dark' ? 'rgba(10,16,30,0.75)' : 'rgba(255,255,255,0.82)',
    },
    filled: {},
    outlined: {
      backgroundColor: 'transparent'
    }
  });

export default Card;

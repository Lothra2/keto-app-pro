import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const CalorieBar = ({ consumed = 0, goal = 1600, label, variant = 'card' }) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);
  const percent = Math.min(100, Math.round((consumed / Math.max(goal, 1)) * 100));

  return (
    <View style={[styles.container, variant === 'overlay' && styles.overlayContainer]}>
      <View style={styles.header}>
        <Text style={[styles.label, variant === 'overlay' && styles.overlayLabel]}>
          {label || (language === 'en' ? 'Calories today' : 'Calorías hoy')}
        </Text>
        <Text style={[styles.value, variant === 'overlay' && styles.overlayValue]}>
          {consumed}/{goal} kcal
        </Text>
      </View>
      <View style={[styles.progress, variant === 'overlay' && styles.overlayProgress]}>
        <View
          style={[styles.fill, variant === 'overlay' && styles.overlayFill, { width: `${percent}%` }]}
        />
      </View>
      <Text style={[styles.percent, variant === 'overlay' && styles.overlayPercent]}>{percent}%</Text>
    </View>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md
    },
    overlayContainer: {
      backgroundColor: 'rgba(15,23,42,0.22)',
      borderColor: 'rgba(248,250,252,0.25)'
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    overlayLabel: {
      color: 'rgba(248,250,252,0.95)'
    },
    value: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    overlayValue: {
      color: 'rgba(226,232,240,0.85)'
    },
    progress: {
      height: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.cardSoft,
      overflow: 'hidden'
    },
    overlayProgress: {
      backgroundColor: 'rgba(15,23,42,0.35)'
    },
    fill: {
      height: '100%',
      backgroundColor: theme.colors.primary
    },
    overlayFill: {
      backgroundColor: 'rgba(16,185,129,0.9)'
    },
    percent: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'right',
      marginTop: theme.spacing.xs
    },
    overlayPercent: {
      color: 'rgba(226,232,240,0.75)'
    }
  });

export default CalorieBar;

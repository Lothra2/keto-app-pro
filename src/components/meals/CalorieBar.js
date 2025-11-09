import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const CalorieBar = ({ consumed = 0, goal = 1600, label }) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);
  const percent = Math.min(100, Math.round((consumed / Math.max(goal, 1)) * 100));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>
          {label || (language === 'en' ? 'Calories today' : 'Calorías hoy')}
        </Text>
        <Text style={styles.value}>
          {consumed}/{goal} kcal
        </Text>
      </View>
      <View style={styles.progress}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.percent}>{percent}%</Text>
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
    value: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    progress: {
      height: 10,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.cardSoft,
      overflow: 'hidden'
    },
    fill: {
      height: '100%',
      backgroundColor: theme.colors.primary
    },
    percent: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'right',
      marginTop: theme.spacing.xs
    }
  });

export default CalorieBar;

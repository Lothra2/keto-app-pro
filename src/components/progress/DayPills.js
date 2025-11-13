import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { getDayDisplayName } from '../../utils/labels';

const DayPills = ({ week, currentDay, onDaySelect, derivedPlan }) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const startIdx = (week - 1) * 7;
  const endIdx = Math.min(week * 7, derivedPlan.length);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {derivedPlan.slice(startIdx, endIdx).map((day, index) => {
        const dayIndex = startIdx + index;
        const isActive = dayIndex === currentDay;

        return (
          <TouchableOpacity
            key={dayIndex}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onDaySelect(dayIndex)}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {getDayDisplayName({ label: day.dia, index: dayIndex, language })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md
  },
  content: {
    gap: theme.spacing.xs,
    paddingHorizontal: 4
  },
  pill: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  pillText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '500'
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '600'
  }
});

export default DayPills;

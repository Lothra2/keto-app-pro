import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { getDayDisplayName } from '../../utils/labels';

const DayPills = ({ week, currentDay, onDaySelect, derivedPlan }) => {
  const { theme: themeMode, language, user } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const safePlan = Array.isArray(derivedPlan) ? derivedPlan : [];
  const startIdx = (week - 1) * 7;
  const totalDays = safePlan.length;
  const endIdx = Math.min(week * 7, totalDays);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {safePlan.slice(startIdx, endIdx).map((day, index) => {
        const dayIndex = startIdx + index;
        const isActive = dayIndex === currentDay;

        return (
          <TouchableOpacity
            key={dayIndex}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onDaySelect(dayIndex)}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {getDayDisplayName({
                label: day.dia,
                index: dayIndex,
                language,
                startDate: user?.startDate
              })}
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
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowOpacity: 0.2,
    shadowColor: theme.colors.glow,
  },
  pillText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600'
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '600'
  }
});

export default DayPills;

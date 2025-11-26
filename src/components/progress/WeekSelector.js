import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const WeekSelector = ({ currentWeek, onWeekChange }) => {
  const { theme: themeMode, language, planWeeks } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {Array.from({ length: planWeeks }, (_, i) => i + 1).map((week) => {
        const start = (week - 1) * 7 + 1;
        const end = week * 7;
        const isActive = week === currentWeek;

        return (
          <TouchableOpacity
            key={week}
            style={[styles.weekButton, isActive && styles.weekButtonActive]}
            onPress={() => onWeekChange(week)}
          >
            <Text style={[styles.weekTitle, isActive && styles.weekTitleActive]}>
              {language === 'en' ? `Week ${week}` : `Semana ${week}`}
            </Text>
            <Text style={[styles.weekRange, isActive && styles.weekRangeActive]}>
              ({start}-{end})
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
    gap: theme.spacing.sm,
    paddingHorizontal: 4
  },
  weekButton: {
    backgroundColor: theme.colors.glassBg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    minWidth: 110,
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  weekButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowOpacity: 0.2,
    shadowColor: theme.colors.glow,
  },
  weekTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    marginBottom: 2
  },
  weekTitleActive: {
    color: '#fff'
  },
  weekRange: {
    ...theme.typography.caption,
    color: theme.colors.textMuted
  },
  weekRangeActive: {
    color: 'rgba(255,255,255,0.86)'
  }
});

export default WeekSelector;
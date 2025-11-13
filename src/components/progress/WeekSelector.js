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
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minWidth: 100,
    alignItems: 'center'
  },
  weekButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  weekTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
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
    color: 'rgba(255,255,255,0.8)'
  }
});

export default WeekSelector;
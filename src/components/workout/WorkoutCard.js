import React, { useState } from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import Card from '../shared/Card';
import ExerciseItem from './ExerciseItem';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const WorkoutCard = ({
  title,
  focus,
  exercises = [],
  collapsible = false,
  initiallyCollapsed = true,
  onExercisePress,
  collapsedHint
}) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);
  const [expanded, setExpanded] = useState(!collapsible || !initiallyCollapsed);

  const hintText = collapsedHint
    ? collapsedHint
    : language === 'en'
    ? 'Tap to open the reference plan.'
    : 'Toca para abrir el plan de referencia.';

  const toggleLabel = expanded
    ? language === 'en'
      ? 'Hide details'
      : 'Ocultar detalles'
    : language === 'en'
    ? 'Show details'
    : 'Mostrar detalles';

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {focus ? <Text style={styles.focus}>{focus}</Text> : null}
        </View>
        {exercises?.length ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{exercises.length}</Text>
          </View>
        ) : null}
      </View>
      {collapsible ? (
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setExpanded((prev) => !prev)}
        >
          <Text style={styles.toggleIcon}>{expanded ? '▲' : '▼'}</Text>
          <Text style={styles.toggleText}>{toggleLabel}</Text>
        </TouchableOpacity>
      ) : null}
      {expanded ? (
        <View style={styles.list}>
          {exercises.map((exercise, index) => (
            <ExerciseItem
              key={`${exercise.nombre || exercise.name}-${index}`}
              exercise={exercise}
              onPress={onExercisePress ? () => onExercisePress(exercise) : undefined}
            />
          ))}
        </View>
      ) : null}
      {!exercises.length && expanded ? (
        <Text style={styles.emptyText}>
          {language === 'en' ? 'No exercises yet.' : 'Sin ejercicios aún.'}
        </Text>
      ) : null}
      {!expanded ? (
        <Text style={styles.collapsedHint}>{hintText}</Text>
      ) : null}
    </Card>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text
    },
    focus: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    countBadge: {
      minWidth: 30,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center'
    },
    countBadgeText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    list: {
      gap: theme.spacing.sm
    },
    emptyText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      fontStyle: 'italic'
    },
    toggle: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.xs
    },
    toggleText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    toggleIcon: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    collapsedHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xs,
    }
  });

export default WorkoutCard;

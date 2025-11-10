import React, { useState } from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import Card from '../shared/Card';
import ExerciseItem from './ExerciseItem';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const WorkoutCard = ({ title, focus, exercises = [], collapsible = false, initiallyCollapsed = true }) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);
  const [expanded, setExpanded] = useState(!collapsible || !initiallyCollapsed);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {focus ? <Text style={styles.focus}>{focus}</Text> : null}
      {collapsible ? (
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setExpanded((prev) => !prev)}
        >
          <Text style={styles.toggleText}>
            {expanded
              ? language === 'en'
                ? 'Hide details'
                : 'Ocultar detalles'
              : language === 'en'
              ? 'Show details'
              : 'Mostrar detalles'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {expanded ? (
        <View style={styles.list}>
          {exercises.map((exercise, index) => (
            <ExerciseItem key={`${exercise.nombre}-${index}`} exercise={exercise} />
          ))}
        </View>
      ) : null}
      {!exercises.length && expanded ? (
        <Text style={styles.emptyText}>
          {language === 'en' ? 'No exercises yet.' : 'Sin ejercicios aún.'}
        </Text>
      ) : null}
      {!expanded ? (
        <Text style={styles.collapsedHint}>
          {language === 'en'
            ? 'Tap to open the reference plan.'
            : 'Toca para abrir el plan de referencia.'}
        </Text>
      ) : null}
    </Card>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    card: {
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
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.cardSoft
    },
    toggleText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    collapsedHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: -4
    }
  });

export default WorkoutCard;

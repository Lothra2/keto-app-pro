import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Card from '../shared/Card';
import ExerciseItem from './ExerciseItem';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const WorkoutCard = ({ title, focus, exercises = [] }) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {focus ? <Text style={styles.focus}>{focus}</Text> : null}
      <View style={styles.list}>
        {exercises.map((exercise, index) => (
          <ExerciseItem key={`${exercise.nombre}-${index}`} exercise={exercise} />
        ))}
      </View>
      {!exercises.length ? (
        <Text style={styles.emptyText}>
          {language === 'en' ? 'No exercises yet.' : 'Sin ejercicios aún.'}
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
    }
  });

export default WorkoutCard;

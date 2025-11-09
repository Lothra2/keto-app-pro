import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const ExerciseItem = ({ exercise }) => {
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  if (!exercise) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{exercise.nombre || exercise.name}</Text>
        {exercise.series ? (
          <Text style={styles.series}>{exercise.series}</Text>
        ) : null}
      </View>
      {exercise.descripcion ? (
        <Text style={styles.description}>{exercise.descripcion}</Text>
      ) : null}
    </View>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs
    },
    name: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    series: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    description: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    }
  });

export default ExerciseItem;

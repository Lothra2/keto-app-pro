import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const ExerciseItem = ({ exercise }) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  if (!exercise) return null;

  const infoLines = [
    exercise.descripcion && { icon: '📋', text: exercise.descripcion },
    exercise.detalle && { icon: '🧠', text: exercise.detalle },
    exercise.duracion && {
      icon: '⏱️',
      text: `${language === 'en' ? 'Duration' : 'Duración'}: ${exercise.duracion}`
    },
    exercise.descanso && {
      icon: '🧘',
      text: `${language === 'en' ? 'Rest' : 'Descanso'}: ${exercise.descanso}`
    },
    exercise.notas && { icon: '✨', text: exercise.notas }
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{exercise.nombre || exercise.name}</Text>
        {exercise.series ? (
          <Text style={styles.series}>{exercise.series}</Text>
        ) : null}
      </View>
      {infoLines.length ? (
        <View style={styles.infoList}>
          {infoLines.map((line, index) => (
            <View key={`${line.icon}-${index}`} style={styles.infoRow}>
              <Text style={styles.infoIcon}>{line.icon}</Text>
              <Text style={styles.infoText}>{line.text}</Text>
            </View>
          ))}
        </View>
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
    infoList: {
      gap: 4
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6
    },
    infoIcon: {
      fontSize: 12,
      lineHeight: 18
    },
    infoText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      flex: 1,
      lineHeight: 18
    }
  });

export default ExerciseItem;

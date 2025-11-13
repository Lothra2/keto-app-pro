import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const ExerciseItem = ({ exercise, onPress }) => {
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
    <TouchableOpacity
      style={[styles.container, onPress && styles.containerPressable]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
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
      {onPress ? (
        <Text style={styles.detailHint}>
          {language === 'en' ? 'Tap for detailed tips' : 'Toca para ver detalles'}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md
    },
    containerPressable: {
      borderWidth: 1,
      borderColor: theme.colors.border
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
    },
    detailHint: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      marginTop: theme.spacing.xs,
      fontWeight: '600'
    }
  });

export default ExerciseItem;

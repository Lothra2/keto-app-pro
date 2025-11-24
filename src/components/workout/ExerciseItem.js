import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { withAlpha } from '../../theme/utils';

const ExerciseItem = ({ exercise, onPress }) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  if (!exercise) return null;

  const shortText = (value = '') => {
    if (value.length <= 110) return value;
    return `${value.slice(0, 107)}…`;
  };

  const previewText =
    exercise.descripcion || exercise.detalle || exercise.notas || '';

  const badges = [
    exercise.duracion && `${language === 'en' ? 'Duration' : 'Duración'} · ${exercise.duracion}`,
    exercise.descanso && `${language === 'en' ? 'Rest' : 'Descanso'} · ${exercise.descanso}`
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
      {previewText ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{shortText(previewText)}</Text>
        </View>
      ) : null}
      {badges.length ? (
        <View style={styles.badgeRow}>
          {badges.map((badge, index) => (
            <View key={`${badge}-${index}`} style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
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
    previewBox: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: theme.spacing.xs
    },
    previewText: {
      ...theme.typography.caption,
      color: theme.colors.text
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: theme.spacing.xs
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    badgeText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      fontWeight: '600'
    },
    detailHint: {
      ...theme.typography.caption,
      color: theme.colors.accent,
      marginTop: theme.spacing.xs,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: withAlpha(theme.colors.accent, 0.14),
      borderRadius: theme.radius.sm,
      alignSelf: 'flex-start'
    }
  });

export default ExerciseItem;

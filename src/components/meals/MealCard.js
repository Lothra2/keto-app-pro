import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { hasLeadingEmoji } from '../../utils/labels';

const MealCard = ({
  title,
  icon,
  mealData,
  isCompleted = false,
  onToggleComplete,
  onGenerateAI,
  showAIButton = false,
  readOnly = false
}) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const hasAIData = mealData?.isAI || false;
  const isManual = mealData?.source === 'manual' || mealData?.isManual;
  const ingredientLines = useMemo(() => {
    if (!mealData?.qty) return [];

    return mealData.qty
      .split(/\r?\n|•|\u2022|,/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [mealData?.qty]);

  const noteText =
    mealData?.note ||
    mealData?.descripcion ||
    (hasAIData ? (language === 'en' ? 'Generated with AI' : 'Generado con IA') : '');

  const showIcon = icon && !hasLeadingEmoji(mealData?.nombre || '');
  const isDark = theme.mode === 'dark';
  const switchTrack = {
    false: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.3)',
    true: theme.colors.primary,
  };

  return (
    <View style={[styles.container, isCompleted && styles.containerCompleted]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {showIcon ? <Text style={styles.icon}>{icon}</Text> : null}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {showAIButton && !readOnly && (
            <TouchableOpacity
              style={styles.aiButton}
              onPress={onGenerateAI}
            >
              <Text style={styles.aiButtonText}>IA</Text>
            </TouchableOpacity>
          )}

          {!readOnly && (
            <Switch
              value={isCompleted}
              onValueChange={onToggleComplete}
              trackColor={switchTrack}
              thumbColor={isCompleted ? theme.colors.onPrimary : theme.colors.card}
              ios_backgroundColor={switchTrack.false}
            />
          )}
        </View>
      </View>

      {/* Body */}
      {mealData?.nombre && (
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.mealName}>{mealData.nombre}</Text>
            {hasAIData && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>IA</Text>
              </View>
            )}
            {isManual && (
              <View style={styles.manualBadge}>
                <Text style={styles.manualBadgeText}>
                  {language === 'en' ? 'Manual' : 'Manual'}
                </Text>
              </View>
            )}
          </View>
          {ingredientLines.length > 0 && (
            <View style={styles.ingredientsList}>
              {ingredientLines.map((line, index) => (
                <View key={`${line}-${index}`} style={styles.ingredientRow}>
                  <Text style={styles.ingredientBullet}>•</Text>
                  <Text style={styles.ingredientText}>{line}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Note */}
      {noteText ? (
        <Text style={styles.note}>{noteText}</Text>
      ) : null}
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  containerCompleted: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: 'rgba(15,118,110,0.45)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: theme.spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
  },
  aiButton: {
    backgroundColor: 'rgba(14,165,233,0.3)',
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  body: {
    marginBottom: theme.spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexWrap: 'wrap'
  },
  mealName: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    lineHeight: 18,
  },
  ingredientsList: {
    marginTop: theme.spacing.xs,
    gap: 6,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  ingredientBullet: {
    color: theme.colors.primary,
    fontSize: 12,
    lineHeight: 18,
  },
  ingredientText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 18,
  },
  aiBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  aiBadgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  manualBadge: {
    backgroundColor: 'rgba(147, 51, 234, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(147, 51, 234, 0.35)',
  },
  manualBadgeText: {
    color: '#6d28d9',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  note: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default MealCard;

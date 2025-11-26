import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { withAlpha } from '../../theme/utils';
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
  const normalizedSource = (
    mealData?.source ||
    mealData?.origen ||
    mealData?.origin ||
    mealData?.sourceType ||
    mealData?.logSource ||
    mealData?.inputSource ||
    mealData?.entryType ||
    mealData?.entrySource ||
    mealData?.type ||
    mealData?.via ||
    mealData?.createdFrom ||
    mealData?.provider ||
    mealData?.loggedFrom ||
    mealData?.logMethod ||
    mealData?.source_label ||
    mealData?.badge ||
    ''
  )
    .toString()
    .toLowerCase();

  const isManual = Boolean(
    normalizedSource.includes('manual') ||
      normalizedSource.includes('user') ||
      normalizedSource.includes('custom') ||
      normalizedSource.includes('offline') ||
      normalizedSource.includes('diary') ||
      normalizedSource.includes('log') ||
      normalizedSource.includes('manual-entry') ||
      normalizedSource === 'plan' ||
      mealData?.isManual ||
      mealData?.manual === true ||
      mealData?.manual === 'true' ||
      mealData?.manualEntry ||
      mealData?.loggedManually ||
      mealData?.manualKcal ||
      mealData?.manualSource ||
      mealData?.fromManual ||
      mealData?.manualTag ||
      mealData?.manualBadge ||
      mealData?.badge === 'manual' ||
      mealData?.createdBy === 'user' ||
      mealData?.createdBy === 'cliente' ||
      mealData?.createdBy === 'cliente_manual' ||
      mealData?.entryType === 'manual'
  );

  const kcalValue = useMemo(() => {
    const raw =
      mealData?.kcal ??
      mealData?.calorias ??
      mealData?.kcalEstimate ??
      mealData?.calorieEstimate;
    return Number.isFinite(Number(raw)) ? Math.round(Number(raw)) : null;
  }, [mealData?.calorias, mealData?.calorieEstimate, mealData?.kcal, mealData?.kcalEstimate]);

  const portionLabel = useMemo(
    () =>
      mealData?.portion ||
      mealData?.porcion ||
      mealData?.racion ||
      mealData?.qtyLabel ||
      '',
    [mealData?.portion, mealData?.porcion, mealData?.qtyLabel, mealData?.racion]
  );
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

  const displayName =
    mealData?.nombre ||
    mealData?.title ||
    mealData?.manualLabel ||
    (isManual ? (language === 'en' ? 'Manual entry' : 'Entrada manual') : '');

  const showIcon = icon && !hasLeadingEmoji(mealData?.nombre || '');
  const isDark = theme.mode === 'dark';
  const switchTrack = {
    false: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.3)',
    true: theme.colors.primary,
  };

  return (
    <LinearGradient
      colors={[
        withAlpha(theme.colors.primary, isCompleted ? 0.22 : 0.14),
        withAlpha(theme.colors.card, 0.96),
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientShell}
    >
      <View style={[styles.container, isCompleted && styles.containerCompleted]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {showIcon ? <Text style={styles.icon}>{icon}</Text> : null}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.headerBadges}>
                {mealData?.isCheat && (
                  <View style={[styles.metaPill, styles.metaAccent, styles.headerPill]}>
                    <Text style={styles.metaPillText}>{language === 'en' ? 'Cheat' : 'Cheat'}</Text>
                  </View>
                )}
                {isManual && (
                  <View style={[styles.manualBadge, styles.headerPill]}>
                    <Text style={styles.manualBadgeText}>
                      {language === 'en' ? 'Manual' : 'Manual'}
                    </Text>
                  </View>
                )}
              </View>
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
        {displayName && (
          <View style={styles.body}>
            <View style={styles.nameRow}>
              <Text style={styles.mealName}>{displayName}</Text>
              {hasAIData && (
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>IA</Text>
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              {kcalValue ? (
                <View style={[styles.metaPill, styles.metaPrimary]}>
                  <Text style={styles.metaPillText}>🔥 {kcalValue} kcal</Text>
                </View>
              ) : null}
              {portionLabel ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>🍽️ {portionLabel}</Text>
                </View>
              ) : null}
              {hasAIData ? (
                <View style={styles.metaPillMuted}>
                  <Text style={styles.metaPillText}>{language === 'en' ? 'AI guided' : 'IA sugerida'}</Text>
                </View>
              ) : null}
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
    </LinearGradient>
  );
};

const getStyles = (theme) => StyleSheet.create({
  gradientShell: {
    borderRadius: theme.radius.lg,
    padding: 1.5,
    marginBottom: theme.spacing.md,
  },
  container: {
    backgroundColor: withAlpha(theme.colors.card, 0.92),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.6),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  containerCompleted: {
    backgroundColor: withAlpha(theme.colors.primarySoft, 0.9),
    borderColor: withAlpha(theme.colors.primary, 0.65),
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
    gap: 4,
  },
  title: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
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
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.border, 0.4),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.8),
  },
  metaPillMuted: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.textMuted, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.textMuted, 0.3),
  },
  metaPillText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metaPrimary: {
    backgroundColor: withAlpha(theme.colors.primary, 0.16),
    borderColor: withAlpha(theme.colors.primary, 0.6),
  },
  metaAccent: {
    backgroundColor: withAlpha(theme.colors.accent || theme.colors.primary, 0.16),
    borderColor: withAlpha(theme.colors.accent || theme.colors.primary, 0.6),
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
    backgroundColor: withAlpha(theme.colors.accent || '#7c3aed', 0.26),
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accent || '#7c3aed', 0.65),
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  manualBadgeText: {
    color: theme.colors.accent || '#6d28d9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerPill: {
    paddingVertical: 2,
  },
  note: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default MealCard;

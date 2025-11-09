import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

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
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const hasAIData = mealData?.isAI || false;

  return (
    <View style={[styles.container, isCompleted && styles.containerCompleted]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {mealData?.qty && (
              <Text style={styles.qty}>{mealData.qty}</Text>
            )}
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
            <Pressable
              style={[styles.checkButton, isCompleted && styles.checkButtonActive]}
              onPress={onToggleComplete}
            >
              <Text style={styles.checkText}>{isCompleted ? '✓' : '+'}</Text>
            </Pressable>
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
          </View>
        </View>
      )}

      {/* Note */}
      {mealData?.note && (
        <Text style={styles.note}>{mealData.note}</Text>
      )}
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
  },
  containerCompleted: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.4)',
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
  qty: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
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
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  checkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    marginBottom: theme.spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  mealName: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
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
  note: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default MealCard;

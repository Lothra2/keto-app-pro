import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { getWorkoutData, saveWorkoutData } from '../../storage/storage';
import aiService from '../../api/aiService';
import WorkoutCard from '../../components/workout/WorkoutCard';
import Button from '../../components/shared/Button';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { getWorkoutForDay } from '../../data/workouts';
import Card from '../../components/shared/Card';

const WorkoutScreen = ({ route, navigation }) => {
  const { dayIndex, focusDay } = route.params || {};
  const {
    theme: themeMode,
    language,
    currentDay,
    apiCredentials,
    metrics,
    derivedPlan,
    setCurrentDay,
    updateSettings
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [workout, setWorkout] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [detailExercise, setDetailExercise] = useState(null);

  const intensities = ['soft', 'medium', 'hard'];
  const intensityLabels = {
    soft: language === 'en' ? 'Light' : 'Suave',
    medium: language === 'en' ? 'Medium' : 'Media',
    hard: language === 'en' ? 'Intense' : 'Intensa'
  };
  const selectedIntensity = metrics.workoutIntensity || 'medium';

  const totalDays = derivedPlan.length || 14;
  const clampDay = (day) => Math.min(Math.max(day ?? 0, 0), Math.max(totalDays - 1, 0));

  const initialDay = clampDay(
    typeof focusDay === 'number'
      ? focusDay
      : typeof dayIndex === 'number'
      ? dayIndex
      : currentDay
  );

  const [activeDay, setActiveDay] = useState(initialDay);
  const safeActiveDay = clampDay(activeDay);
  const week = weekNumber || Math.floor(safeActiveDay / 7) + 1;

  const clampDayIndex = useCallback(
    (dayValue = 0) => {
      const parsed = Number.isFinite(dayValue) ? dayValue : Number(dayValue) || 0;
      const maxIndex = Math.max(totalDays - 1, 0);
      return Math.min(Math.max(parsed, 0), maxIndex);
    },
    [totalDays]
  );

  const safeActiveDay = clampDayIndex(typeof currentDay === 'number' ? currentDay : 0);
  const week = Math.floor(safeActiveDay / 7) + 1;

  useEffect(() => {
    const clamped = clampDayIndex(typeof currentDay === 'number' ? currentDay : 0);
    if (clamped !== currentDay) {
      setCurrentDay(clamped);
    }
  }, [currentDay, clampDayIndex, setCurrentDay]);

  useEffect(() => {
    const incomingDay =
      typeof focusDay === 'number'
        ? focusDay
        : typeof dayIndex === 'number'
        ? dayIndex
        : null;

    if (incomingDay === null) return;

    const clamped = clampDayIndex(incomingDay);
    if (clamped !== safeActiveDay) {
      setCurrentDay(clamped);
    }
  }, [focusDay, dayIndex, clampDayIndex, safeActiveDay, setCurrentDay]);

  useEffect(() => {
    navigation.setParams({ focusDay: safeActiveDay, weekNumber: week });
  }, [navigation, safeActiveDay, week]);

  const loadWorkout = useCallback(async () => {
    const saved = await getWorkoutData(safeActiveDay);
    setWorkout(Array.isArray(saved) ? saved : []);
  }, [safeActiveDay]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  const handleGenerateWorkout = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      alert(language === 'en' ? 'Add your AI credentials in settings to use this feature.' : 'Agrega tus credenciales de IA en ajustes para usar esta función.');
      return;
    }

    setLoading(true);
    setLoadingType('day');
    setLoadingMessage(language === 'en' ? 'Creating your workout…' : 'Creando tu entreno…');
    try {
      const exercises = await aiService.generateWorkout({
        dayIndex: safeActiveDay,
        weekNumber: week,
        intensity: selectedIntensity,
        language,
        credentials: apiCredentials,
        userStats: {
          height: metrics.height || 170,
          weight: metrics.startWeight || 75,
          age: metrics.age || 30
        }
      });

      setWorkout(exercises);
      await saveWorkoutData(safeActiveDay, exercises);
    } catch (error) {
      console.error('Error generating workout:', error);
      alert(language === 'en' ? 'Error generating workout' : 'Error generando entreno');
    } finally {
      setLoading(false);
      setLoadingType(null);
      setLoadingMessage('');
    }
  };

  const handleGenerateWeek = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      alert(language === 'en' ? 'Add your AI credentials in settings to use this feature.' : 'Agrega tus credenciales de IA en ajustes para usar esta función.');
      return;
    }

    setLoading(true);
    setLoadingType('week');
    const startOfWeek = Math.floor(safeActiveDay / 7) * 7;
    const endOfWeek = Math.min(startOfWeek + 7, totalDays);
    try {
      for (let day = startOfWeek; day < endOfWeek; day += 1) {
        const step = day - startOfWeek + 1;
        setLoadingMessage(
          language === 'en'
            ? `Generating day ${step} of ${endOfWeek - startOfWeek}`
            : `Generando día ${step} de ${endOfWeek - startOfWeek}`
        );
        const exercises = await aiService.generateWorkout({
          dayIndex: day,
          weekNumber: Math.floor(day / 7) + 1,
          intensity: selectedIntensity,
          language,
          credentials: apiCredentials,
          userStats: {
            height: metrics.height || 170,
            weight: metrics.startWeight || 75,
            age: metrics.age || 30
          }
        });
        await saveWorkoutData(day, exercises);
        if (day === safeActiveDay) {
          setWorkout(exercises);
        }
      }
    } catch (error) {
      console.error('Error generating weekly workout:', error);
      alert(language === 'en' ? 'Error generating weekly plan' : 'Error generando plan semanal');
    } finally {
      setLoadingMessage('');
      setLoading(false);
      setLoadingType(null);
      await loadWorkout();
    }
  };

  const handleExercisePress = (exercise) => {
    if (!exercise) return;
    setDetailExercise(exercise);
  };

  const closeExerciseDetail = () => setDetailExercise(null);

  const localPlan = useMemo(() => {
    return getWorkoutForDay(language, week, safeActiveDay % 7);
  }, [language, week, safeActiveDay]);

  const referenceExercises = useMemo(() => {
    if (!localPlan || !Array.isArray(localPlan.days)) return [];
    const todayIndex = safeActiveDay % localPlan.days.length;
    return localPlan.days.map((item, index) => ({
      nombre: item,
      descripcion:
        index === todayIndex
          ? language === 'en'
            ? 'Suggested focus for today'
            : 'Enfoque sugerido para hoy'
          : '',
      notas:
        index === todayIndex
          ? language === 'en'
            ? 'Finish with light stretching and deep breathing.'
            : 'Termina con estiramientos suaves y respiración profunda.'
          : ''
    }));
  }, [localPlan, safeActiveDay, language]);

  const dayLabel = language === 'en' ? `Day ${safeActiveDay + 1}` : `Día ${safeActiveDay + 1}`;
  const weekLabel = language === 'en' ? `Week ${week}` : `Semana ${week}`;
  const intensityLabel = intensityLabels[selectedIntensity] || intensityLabels.medium;

  const handleChangeDay = (direction) => {
    const next = clampDayIndex(safeActiveDay + direction);
    if (next !== safeActiveDay) {
      setCurrentDay(next);
    }
  };

  const detailSections = useMemo(() => {
    if (!detailExercise) return [];

    const sections = [];
    const defaultHowTo =
      language === 'en'
        ? 'Focus on controlled reps, stable core and smooth breathing.'
        : 'Enfócate en repeticiones controladas, core estable y respiración fluida.';
    const description = detailExercise.descripcion || detailExercise.detalle || defaultHowTo;

    sections.push({
      label: language === 'en' ? 'How to perform' : 'Cómo hacerlo',
      value: description
    });

    if (detailExercise.series) {
      sections.push({
        label: language === 'en' ? 'Series / time' : 'Series / tiempo',
        value: detailExercise.series
      });
    }

    const restMessage =
      detailExercise.descanso ||
      (language === 'en'
        ? 'Rest 30-45 seconds between sets.'
        : 'Descansa 30-45 segundos entre series.');

    sections.push({
      label: language === 'en' ? 'Rest' : 'Descanso',
      value: restMessage
    });

    if (detailExercise.notas) {
      sections.push({
        label: language === 'en' ? 'Coach notes' : 'Notas del coach',
        value: detailExercise.notas
      });
    }

    const intensityName = intensityLabels[selectedIntensity] || intensityLabels.medium;
    const intensityTip =
      language === 'en'
        ? `Keep the effort at a ${intensityName.toLowerCase()} pace and finish with deep breathing.`
        : `Mantén el esfuerzo a un ritmo ${intensityName.toLowerCase()} y termina con respiración profunda.`;

    sections.push({
      label: language === 'en' ? 'Intensity tip' : 'Tip de intensidad',
      value: intensityTip
    });

    return sections;
  }, [detailExercise, language, selectedIntensity]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}> 
        <Text style={styles.title}>{language === 'en' ? '🏋️ Workouts' : '🏋️ Entrenos'}</Text>
        <Text style={styles.subtitle}>{weekLabel} · {dayLabel}</Text>
        <Text style={styles.subtitle}>
          {language === 'en' ? `Intensity: ${intensityLabel}` : `Intensidad: ${intensityLabel}`}
        </Text>
        <View style={styles.dayControls}>
        <TouchableOpacity
          onPress={() => handleChangeDay(-1)}
          style={[styles.dayButton, safeActiveDay === 0 && styles.dayButtonDisabled]}
          disabled={safeActiveDay === 0}
        >
          <Text style={styles.dayButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.dayBadge}>{dayLabel}</Text>
        <TouchableOpacity
          onPress={() => handleChangeDay(1)}
          style={[styles.dayButton, safeActiveDay >= totalDays - 1 && styles.dayButtonDisabled]}
          disabled={safeActiveDay >= totalDays - 1}
        >
          <Text style={styles.dayButtonText}>+</Text>
        </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.focusCard}>
          <View style={styles.focusHeader}>
            <Text style={styles.sectionTitle}>{language === 'en' ? 'Weekly focus' : 'Foco semanal'}</Text>
            <View style={styles.focusBadge}>
              <Text style={styles.focusBadgeText}>{weekLabel}</Text>
            </View>
          </View>
          <Text style={styles.focusDescription}>{localPlan.focus}</Text>
          <View style={styles.focusTodayRow}>
            <Text style={styles.focusTodayLabel}>
              {language === 'en' ? "Today's highlight" : 'Enfoque de hoy'}
            </Text>
            <Text style={styles.focusTodayValue}>{localPlan.today}</Text>
          </View>
        </Card>

        <Card style={styles.intensityCard}>
          <View style={styles.intensityHeader}>
            <Text style={styles.sectionSubtitle}>
              {language === 'en' ? 'Preferred intensity' : 'Intensidad preferida'}
            </Text>
            <Text style={styles.intensityBadge}>{intensityLabel}</Text>
          </View>
          <View style={styles.intensityRow}>
            {intensities.map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.intensityChip, selectedIntensity === value && styles.intensityChipActive]}
                onPress={() => updateSettings('workout-intensity', value)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.intensityChipText,
                    selectedIntensity === value && styles.intensityChipTextActive
                  ]}
                >
                  {intensityLabels[value]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <View style={styles.generateSection}>
          <Button
            title={language === 'en' ? 'Generate workout for today 🤖' : 'Generar entreno de hoy 🤖'}
            onPress={handleGenerateWorkout}
            loading={loading && loadingType === 'day'}
            disabled={loading && loadingType !== 'day'}
            style={styles.generateButton}
          />
          <Button
            title={language === 'en' ? 'Generate full week plan 📅' : 'Generar plan semanal 📅'}
            onPress={handleGenerateWeek}
            variant="secondary"
            loading={loading && loadingType === 'week'}
            disabled={loading && loadingType !== 'week'}
            style={styles.generateButton}
          />
          {loadingMessage ? (
            loadingType === 'week' ? (
              <LoadingSpinner label={loadingMessage} />
            ) : (
              <Text style={styles.loadingHint}>{loadingMessage}</Text>
            )
          ) : null}
        </View>

        <WorkoutCard
          title={language === 'en' ? 'AI workout' : 'Entreno IA'}
          focus={`${weekLabel} · ${dayLabel}`}
          exercises={workout}
          onExercisePress={handleExercisePress}
        />

        {referenceExercises.length ? (
          <WorkoutCard
            title={language === 'en' ? 'Local reference' : 'Referencia local'}
            focus={localPlan.focus}
            exercises={referenceExercises}
            collapsible
            initiallyCollapsed
            onExercisePress={handleExercisePress}
          />
        ) : null}

        {!workout.length && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {language === 'en'
                ? 'No workout yet. Generate one with AI!'
                : 'Sin entreno aún. ¡Genera uno con IA!'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={Boolean(detailExercise)}
        transparent
        animationType="fade"
        onRequestClose={closeExerciseDetail}
      >
        <View style={styles.detailOverlay}>
          <View style={[styles.detailCard, { backgroundColor: theme.colors.card }]}>
            <Text style={styles.detailTitle}>
              {detailExercise?.nombre || detailExercise?.name || (language === 'en' ? 'Exercise' : 'Ejercicio')}
            </Text>
            {detailSections.map((item, index) => (
              <View key={`${item.label}-${index}`} style={styles.detailSection}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.detailCloseButton} onPress={closeExerciseDetail}>
              <Text style={styles.detailCloseText}>{language === 'en' ? 'Close' : 'Cerrar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: 4
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted
  },
  dayControls: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayButtonDisabled: {
    backgroundColor: theme.colors.primarySoft
  },
  dayButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700'
  },
  dayBadge: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.cardSoft,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.lg
  },
  focusCard: {
    gap: theme.spacing.sm
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text
  },
  focusBadge: {
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full
  },
  focusBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600'
  },
  focusDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted
  },
  focusTodayRow: {
    marginTop: theme.spacing.sm,
    gap: 4
  },
  focusTodayLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted
  },
  focusTodayValue: {
    ...theme.typography.body,
    color: theme.colors.text
  },
  intensityCard: {
    gap: theme.spacing.md
  },
  intensityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  intensityBadge: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full
  },
  intensityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  intensityChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md
  },
  intensityChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  intensityChipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  intensityChipTextActive: {
    color: '#fff',
    fontWeight: '600'
  },
  generateSection: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg
  },
  generateButton: {
    width: '100%'
  },
  loadingHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center'
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md
  },
  detailTitle: {
    ...theme.typography.h2,
    color: theme.colors.text
  },
  detailSection: {
    gap: 4
  },
  detailLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase'
  },
  detailValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    lineHeight: 20
  },
  detailCloseButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary
  },
  detailCloseText: {
    ...theme.typography.caption,
    color: '#fff',
    fontWeight: '600'
  }
});

export default WorkoutScreen;

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { getWorkoutData, saveWorkoutData } from '../../storage/storage';
import aiService from '../../api/aiService';
import WorkoutCard from '../../components/workout/WorkoutCard';
import Button from '../../components/shared/Button';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { getWorkoutForDay } from '../../data/workouts';

const WorkoutScreen = ({ route, navigation }) => {
  const { dayIndex, weekNumber, focusDay } = route.params || {};
  const {
    theme: themeMode,
    language,
    currentDay,
    apiCredentials,
    metrics,
    derivedPlan,
    setCurrentDay
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [workout, setWorkout] = useState([]);
  const [loading, setLoading] = useState(false);
  const computedDay =
    dayIndex !== undefined ? dayIndex : focusDay !== undefined ? focusDay : currentDay;
  const [activeDay, setActiveDay] = useState(computedDay);
  const week = weekNumber || Math.floor(activeDay / 7) + 1;
  const totalDays = derivedPlan.length || 14;

  useEffect(() => {
    setActiveDay(computedDay);
  }, [computedDay]);

  useEffect(() => {
    loadWorkout();
  }, [activeDay]);

  const loadWorkout = async () => {
    const saved = await getWorkoutData(activeDay);
    if (saved && Array.isArray(saved)) {
      setWorkout(saved);
    }
  };

  const handleGenerateWorkout = async () => {
    setLoading(true);
    try {
      const exercises = await aiService.generateWorkout({
        dayIndex: activeDay,
        weekNumber: week,
        intensity: metrics.workoutIntensity || 'medium',
        language,
        credentials: apiCredentials,
        userStats: {
          height: metrics.height || 170,
          weight: metrics.startWeight || 75,
          age: metrics.age || 30
        }
      });

      setWorkout(exercises);
      await saveWorkoutData(activeDay, exercises);
    } catch (error) {
      console.error('Error generating workout:', error);
      alert(language === 'en' ? 'Error generating workout' : 'Error generando entreno');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentDay(activeDay);
    navigation.setParams({ focusDay: activeDay, weekNumber: week });
  }, [activeDay, setCurrentDay, navigation, week]);

  const localPlan = useMemo(() => {
    return getWorkoutForDay(language, week, activeDay % 7);
  }, [language, week, activeDay]);

  const referenceExercises = useMemo(() => {
    if (!localPlan || !Array.isArray(localPlan.days)) return [];
    const todayIndex = activeDay % localPlan.days.length;
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
  }, [localPlan, activeDay, language]);

  const dayLabel = language === 'en' ? `Day ${activeDay + 1}` : `Día ${activeDay + 1}`;
  const weekLabel = language === 'en' ? `Week ${week}` : `Semana ${week}`;
  const intensityLabels = {
    soft: language === 'en' ? 'Light' : 'Suave',
    medium: language === 'en' ? 'Medium' : 'Media',
    hard: language === 'en' ? 'Intense' : 'Intensa'
  };
  const intensityLabel = intensityLabels[metrics.workoutIntensity] || intensityLabels.medium;

  const handleChangeDay = (direction) => {
    const next = Math.min(Math.max(activeDay + direction, 0), Math.max(totalDays - 1, 0));
    if (next !== activeDay) {
      setActiveDay(next);
    }
  };

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
            style={[styles.dayButton, activeDay === 0 && styles.dayButtonDisabled]}
            disabled={activeDay === 0}
          >
            <Text style={styles.dayButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.dayBadge}>{dayLabel}</Text>
          <TouchableOpacity
            onPress={() => handleChangeDay(1)}
            style={[styles.dayButton, activeDay >= totalDays - 1 && styles.dayButtonDisabled]}
            disabled={activeDay >= totalDays - 1}
          >
            <Text style={styles.dayButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Generate Button */}
        <View style={styles.generateSection}>
          {loading ? (
            <LoadingSpinner label={language === 'en' ? 'Generating…' : 'Generando…'} />
          ) : (
            <Button
              title={language === 'en' ? 'Generate AI Workout 🤖' : 'Generar Entreno IA 🤖'}
              onPress={handleGenerateWorkout}
            />
          )}
        </View>

        <WorkoutCard
          title={language === 'en' ? 'Workout plan' : 'Plan de entrenamiento'}
          focus={dayLabel}
          exercises={workout}
        />

        {referenceExercises.length ? (
          <WorkoutCard
            title={language === 'en' ? 'Local reference' : 'Referencia local'}
            focus={localPlan.focus}
            exercises={referenceExercises}
            collapsible
            initiallyCollapsed
          />
        ) : null}

        {!workout.length ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {language === 'en'
                ? 'No workout yet. Generate one with AI!'
                : 'Sin entreno aún. ¡Genera uno con IA!'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
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
    paddingBottom: 100
  },
  generateSection: {
    marginBottom: theme.spacing.lg
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
  }
});

export default WorkoutScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { getWorkoutData, saveWorkoutData } from '../../storage/storage';
import aiService from '../../api/aiService';
import WorkoutCard from '../../components/workout/WorkoutCard';
import Button from '../../components/shared/Button';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const WorkoutScreen = ({ route, navigation }) => {
  const { dayIndex, weekNumber } = route.params || {};
  const {
    theme: themeMode,
    language,
    currentDay,
    apiCredentials,
    metrics
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [workout, setWorkout] = useState([]);
  const [loading, setLoading] = useState(false);
  const day = dayIndex !== undefined ? dayIndex : currentDay;
  const week = weekNumber || Math.floor(day / 7) + 1;

  useEffect(() => {
    loadWorkout();
  }, [day]);

  const loadWorkout = async () => {
    const saved = await getWorkoutData(day);
    if (saved && Array.isArray(saved)) {
      setWorkout(saved);
    }
  };

  const handleGenerateWorkout = async () => {
    setLoading(true);
    try {
      const exercises = await aiService.generateWorkout({
        dayIndex: day,
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
      await saveWorkoutData(day, exercises);
    } catch (error) {
      console.error('Error generating workout:', error);
      alert(language === 'en' ? 'Error generating workout' : 'Error generando entreno');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← {language === 'en' ? 'Back' : 'Volver'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {language === 'en' ? '🏋️ Workout' : '🏋️ Entrenamiento'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'en' ? `Day ${day + 1}` : `Día ${day + 1}`}
        </Text>
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
          focus={language === 'en' ? `Day ${day + 1}` : `Día ${day + 1}`}
          exercises={workout}
        />

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
    paddingTop: theme.spacing.xl + 20,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  backButton: {
    ...theme.typography.body,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm
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
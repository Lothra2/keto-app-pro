import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { getWorkoutData, saveWorkoutData } from '../../storage/storage';
import aiService from '../../api/aiService';

const WorkoutScreen = ({ route, navigation }) => {
  const { dayIndex, weekNumber } = route.params || {};
  const {
    theme: themeMode,
    language,
    currentDay,
    apiCredentials
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
        intensity: 'medium',
        language,
        credentials: apiCredentials,
        userStats: {
          height: 170,
          weight: 75,
          age: 30
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
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateWorkout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>
              {language === 'en' ? 'Generate AI Workout 🤖' : 'Generar Entreno IA 🤖'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Workout List */}
        {workout.length > 0 ? (
          <View style={styles.workoutList}>
            {workout.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{exercise.nombre}</Text>
                <Text style={styles.exerciseSeries}>{exercise.series}</Text>
                {exercise.descripcion ? (
                  <Text style={styles.exerciseDesc}>{exercise.descripcion}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {language === 'en' 
                ? 'No workout yet. Generate one with AI!' 
                : 'Sin entreno aún. ¡Genera uno con IA!'}
            </Text>
          </View>
        )}
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
  generateButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  generateButtonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600'
  },
  workoutList: {
    gap: theme.spacing.sm
  },
  exerciseCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  exerciseName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 4
  },
  exerciseSeries: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: 4
  },
  exerciseDesc: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontStyle: 'italic'
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
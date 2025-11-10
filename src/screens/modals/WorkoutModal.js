import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import Button from '../../components/shared/Button';
import WorkoutCard from '../../components/workout/WorkoutCard';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { getWorkoutData, saveWorkoutData } from '../../storage/storage';
import aiService from '../../api/aiService';
import { getWorkoutForDay } from '../../data/workouts';

const intensities = ['soft', 'medium', 'hard'];
const intensityLabels = {
  soft: { en: 'soft', es: 'suave' },
  medium: { en: 'medium', es: 'media' },
  hard: { en: 'hard', es: 'intensa' }
};

const WorkoutModal = ({ route, navigation }) => {
  const { dayIndex = 0, weekNumber } = route.params || {};
  const {
    theme: themeMode,
    language,
    currentDay,
    apiCredentials,
    metrics,
    updateSettings
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const day = dayIndex ?? currentDay;
  const week = weekNumber || Math.floor(day / 7) + 1;
  const [generated, setGenerated] = useState([]);
  const [loading, setLoading] = useState(false);
  const [intensity, setIntensity] = useState(metrics.workoutIntensity || 'medium');

  const localized = useMemo(
    () => getWorkoutForDay(language, week, day % 7),
    [language, week, day]
  );

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    loadStored();
  }, [day]);

  const loadStored = async () => {
    const stored = await getWorkoutData(day);
    if (stored && Array.isArray(stored)) {
      setGenerated(stored);
    }
  };

  const handleGenerate = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to use AI.'
          : 'Agrega tus credenciales de Grok en ajustes para usar la IA.'
      );
      return;
    }

    const height = metrics.height || 170;
    const weight = metrics.startWeight || 75;
    const age = metrics.age || 30;

    setLoading(true);
    try {
      const workout = await aiService.generateWorkout({
        dayIndex: day,
        weekNumber: week,
        intensity,
        language,
        credentials: apiCredentials,
        userStats: { height, weight, age }
      });
      setGenerated(workout);
      await saveWorkoutData(day, workout);
    } catch (error) {
      console.error(error);
      Alert.alert(
        language === 'en' ? 'AI error' : 'Error con IA',
        language === 'en'
          ? 'We could not generate the workout. Try later.'
          : 'No pudimos generar el entreno. Intenta más tarde.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{language === 'en' ? 'Workout' : 'Entrenamiento'}</Text>
        <Button
          title={language === 'en' ? 'Close' : 'Cerrar'}
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <WorkoutCard
          title={language === 'en' ? 'Local plan' : 'Plan local'}
          focus={localized.focus}
          exercises={localized.days.map((dayText, index) => ({
            nombre: `${language === 'en' ? 'Day' : 'Día'} ${index + 1}`,
            descripcion: dayText,
            series: ''
          }))}
          collapsible
          initiallyCollapsed
        />

        <View style={styles.intensityBox}>
          <Text style={styles.intensityTitle}>
            {language === 'en' ? 'Select intensity' : 'Selecciona intensidad'}
          </Text>
          <View style={styles.intensityRow}>
            {intensities.map((value) => (
              <Button
                key={value}
                title={intensityLabels[value]?.[language] || value}
                variant={intensity === value ? 'primary' : 'secondary'}
                onPress={() => {
                  setIntensity(value);
                  updateSettings('workout-intensity', value);
                }}
                style={styles.intensityButton}
              />
            ))}
          </View>
        </View>

        {loading ? (
          <LoadingSpinner label={language === 'en' ? 'Generating…' : 'Generando…'} />
        ) : (
          <Button
            title={language === 'en' ? 'Generate AI workout 🤖' : 'Generar entreno IA 🤖'}
            onPress={handleGenerate}
          />
        )}

        <WorkoutCard
          title={language === 'en' ? 'Your AI workout' : 'Tu entreno IA'}
          focus={language === 'en' ? `Week ${week}` : `Semana ${week}`}
          exercises={generated}
        />

        <Button
          title={language === 'en' ? 'Open detailed view' : 'Abrir vista detallada'}
          variant="secondary"
          onPress={() => navigation.navigate('Workout', { dayIndex: day, weekNumber: week })}
        />
      </ScrollView>
    </View>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1
    },
    header: {
      paddingTop: theme.spacing.xl + 16,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text
    },
    closeButton: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg
    },
    intensityBox: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      gap: theme.spacing.sm
    },
    intensityTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    intensityRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm
    },
    intensityButton: {
      flex: 1
    }
  });

export default WorkoutModal;

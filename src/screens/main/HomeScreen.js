import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import MealList from '../../components/meals/MealList';
import CalorieBar from '../../components/meals/CalorieBar';
import Button from '../../components/shared/Button';
import {
  getDayData,
  saveMealCompletion,
  getCalorieState,
  saveCalorieState
} from '../../storage/storage';
import { calculateConsumedCalories } from '../../utils/calculations';
import { getDailyTip, getMotivationalMessage } from '../../data/tips';

const HomeScreen = ({ navigation }) => {
  const { 
    theme: themeMode, 
    currentDay, 
    derivedPlan,
    user,
    language 
  } = useApp();
  
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);
  
  const [dayData, setDayData] = useState(null);
  const [mealStates, setMealStates] = useState({
    desayuno: false,
    snackAM: false,
    almuerzo: false,
    snackPM: false,
    cena: false
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDayData();
  }, [currentDay]);

  useFocusEffect(
    useCallback(() => {
      loadDayData();
    }, [currentDay])
  );

  const loadDayData = async () => {
    try {
      const baseDay = derivedPlan[currentDay];
      const stored = await getDayData(currentDay);
      
      // Merge base plan con datos IA guardados
      const merged = {
        ...baseDay,
        ...stored,
        dia: baseDay?.dia || `Día ${currentDay + 1}`
      };

      setDayData(merged);

      const calorieState = await getCalorieState(currentDay, baseDay?.kcal || 1600);
      const mealsState = calorieState.meals || {
        desayuno: false,
        snackAM: false,
        almuerzo: false,
        snackPM: false,
        cena: false
      };
      setMealStates(mealsState);
      setCalorieGoal(calorieState.goal || baseDay?.kcal || 1600);
      const consumed = calculateConsumedCalories(mealsState, calorieState.goal || baseDay?.kcal || 1600);
      setCaloriesConsumed(consumed);
    } catch (error) {
      console.error('Error cargando día:', error);
    }
  };

  const [calorieGoal, setCalorieGoal] = useState(1600);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);

  const handleToggleMeal = async (mealKey) => {
    const newState = !mealStates[mealKey];
    setMealStates(prev => ({ ...prev, [mealKey]: newState }));
    await saveMealCompletion(currentDay, mealKey, newState);
    const updatedMeals = { ...mealStates, [mealKey]: newState };
    const consumed = calculateConsumedCalories(updatedMeals, calorieGoal);
    setCaloriesConsumed(consumed);
    await saveCalorieState(currentDay, { goal: calorieGoal, meals: updatedMeals });
  };

  const handleGenerateAI = (mealKey) => {
    navigation.navigate('MealGenerator', {
      dayIndex: currentDay,
      mealKey
    });
  };

  const handleGenerateFullDay = async () => {
    navigation.navigate('MealGenerator', {
      dayIndex: currentDay,
      mode: 'full-day'
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDayData();
    setRefreshing(false);
  };

  if (!dayData) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const greeting = language === 'en'
    ? `Hey ${user.name || 'there'}!`
    : `Hola ${user.name || 'ahí'}!`;

  const meals = [
    {
      key: 'desayuno',
      title: language === 'en' ? '🍳 Breakfast' : '🍳 Desayuno',
      icon: '🍳',
      data: dayData.desayuno,
      isCompleted: mealStates.desayuno,
      onToggle: () => handleToggleMeal('desayuno'),
      onGenerateAI: () => handleGenerateAI('desayuno'),
      showAIButton: true
    },
    {
      key: 'snackAM',
      title: language === 'en' ? '⏰ Snack AM' : '⏰ Snack AM',
      icon: '⏰',
      data: dayData.snackAM,
      isCompleted: mealStates.snackAM,
      onToggle: () => handleToggleMeal('snackAM')
    },
    {
      key: 'almuerzo',
      title: language === 'en' ? '🥗 Lunch' : '🥗 Almuerzo',
      icon: '🥗',
      data: dayData.almuerzo,
      isCompleted: mealStates.almuerzo,
      onToggle: () => handleToggleMeal('almuerzo'),
      onGenerateAI: () => handleGenerateAI('almuerzo'),
      showAIButton: true
    },
    {
      key: 'snackPM',
      title: language === 'en' ? '🥜 Snack PM' : '🥜 Snack PM',
      icon: '🥜',
      data: dayData.snackPM,
      isCompleted: mealStates.snackPM,
      onToggle: () => handleToggleMeal('snackPM')
    },
    {
      key: 'cena',
      title: language === 'en' ? '🍖 Dinner' : '🍖 Cena',
      icon: '🍖',
      data: dayData.cena,
      isCompleted: mealStates.cena,
      onToggle: () => handleToggleMeal('cena'),
      onGenerateAI: () => handleGenerateAI('cena'),
      showAIButton: true
    }
  ];

  const tip = getDailyTip(language, currentDay);
  const motivation = getMotivationalMessage(language, currentDay);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.dayTitle}>{dayData.dia}</Text>
        <View style={styles.caloriesRow}>
          <Text style={styles.calories}>{dayData.kcal} kcal</Text>
          <View style={styles.macros}>
            <Text style={styles.macroText}>C {dayData.macros?.carbs}</Text>
            <Text style={styles.macroText}>P {dayData.macros?.prot}</Text>
            <Text style={styles.macroText}>G {dayData.macros?.fat}</Text>
          </View>
        </View>
      </View>

      {/* Motivation */}
      <View style={styles.motivationBox}>
        <Text style={styles.motivationText}>💡 {tip}</Text>
        <Text style={styles.motivationText}>💪 {motivation}</Text>
      </View>

      <CalorieBar consumed={caloriesConsumed} goal={calorieGoal} />

      {/* Meals */}
      <MealList meals={meals} style={styles.mealsSection} />

      {/* AI Actions */}
      <View style={styles.aiActionsSection}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'AI Actions' : 'Acciones IA'}
        </Text>
        <View style={styles.aiActionsGrid}>
          <TouchableOpacity 
            style={styles.aiActionButton}
            onPress={() => handleGenerateFullDay()}
          >
            <Text style={styles.aiActionEmoji}>🤖</Text>
            <Text style={styles.aiActionText}>
              {language === 'en' ? 'Full Day AI' : 'Día Completo IA'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.aiActionButton}
            onPress={() => navigation.navigate('Workout', { dayIndex: currentDay })}
          >
            <Text style={styles.aiActionEmoji}>🏋️</Text>
            <Text style={styles.aiActionText}>
              {language === 'en' ? 'Workout' : 'Entreno'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <Button
          title={language === 'en' ? 'Progress 📊' : 'Progreso 📊'}
          variant="secondary"
          onPress={() => navigation.navigate('Progress')}
          style={styles.actionButton}
        />
        <Button
          title={language === 'en' ? 'Workout 🏋️' : 'Entreno 🏋️'}
          variant="secondary"
          onPress={() => navigation.navigate('WorkoutModal', { dayIndex: currentDay })}
          style={styles.actionButton}
        />
      </View>
    </ScrollView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  greeting: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: 4,
  },
  dayTitle: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calories: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  macros: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  macroText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.cardSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  motivationBox: {
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.2)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  motivationText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  mealsSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  aiActionsSection: {
    marginBottom: theme.spacing.lg,
  },
  aiActionsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  aiActionButton: {
    flex: 1,
    backgroundColor: 'rgba(14,165,233,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  aiActionEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  aiActionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
  }
});

export default HomeScreen;
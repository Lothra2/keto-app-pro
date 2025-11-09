import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import MealCard from '../../components/meals/MealCard';
import { getDayData, saveMealCompletion } from '../../storage/storage';

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
      
      // Cargar estados de comidas completadas
      const states = await loadMealStates();
      setMealStates(states);
    } catch (error) {
      console.error('Error cargando día:', error);
    }
  };

  const loadMealStates = async () => {
    // Implementar carga desde AsyncStorage
    return {
      desayuno: false,
      snackAM: false,
      almuerzo: false,
      snackPM: false,
      cena: false
    };
  };

  const handleToggleMeal = async (mealKey) => {
    const newState = !mealStates[mealKey];
    setMealStates(prev => ({ ...prev, [mealKey]: newState }));
    await saveMealCompletion(currentDay, mealKey, newState);
  };

  const handleGenerateAI = (mealKey) => {
    navigation.navigate('MealGenerator', { 
      dayIndex: currentDay,
      mealKey 
    });
  };

  const handleGenerateFullDay = async () => {
    // Implementar generación de día completo
    alert(language === 'en' ? 'Generating full day with AI...' : 'Generando día completo con IA...');
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
        <Text style={styles.motivationText}>
          💪 {language === 'en' 
            ? 'One day at a time. Keep it simple.' 
            : 'Vas un día a la vez. Mantenlo simple.'}
        </Text>
      </View>

      {/* Meals */}
      <View style={styles.mealsSection}>
        <MealCard
          title={language === 'en' ? '🍳 Breakfast' : '🍳 Desayuno'}
          icon="🍳"
          mealData={dayData.desayuno}
          isCompleted={mealStates.desayuno}
          onToggleComplete={() => handleToggleMeal('desayuno')}
          onGenerateAI={() => handleGenerateAI('desayuno')}
          showAIButton={true}
        />

        <MealCard
          title={language === 'en' ? '⏰ Snack AM' : '⏰ Snack AM'}
          icon="⏰"
          mealData={dayData.snackAM}
          isCompleted={mealStates.snackAM}
          onToggleComplete={() => handleToggleMeal('snackAM')}
        />

        <MealCard
          title={language === 'en' ? '🥗 Lunch' : '🥗 Almuerzo'}
          icon="🥗"
          mealData={dayData.almuerzo}
          isCompleted={mealStates.almuerzo}
          onToggleComplete={() => handleToggleMeal('almuerzo')}
          onGenerateAI={() => handleGenerateAI('almuerzo')}
          showAIButton={true}
        />

        <MealCard
          title={language === 'en' ? '🥜 Snack PM' : '🥜 Snack PM'}
          icon="🥜"
          mealData={dayData.snackPM}
          isCompleted={mealStates.snackPM}
          onToggleComplete={() => handleToggleMeal('snackPM')}
        />

        <MealCard
          title={language === 'en' ? '🍖 Dinner' : '🍖 Cena'}
          icon="🍖"
          mealData={dayData.cena}
          isCompleted={mealStates.cena}
          onToggleComplete={() => handleToggleMeal('cena')}
          onGenerateAI={() => handleGenerateAI('cena')}
          showAIButton={true}
        />
      </View>

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
        <TouchableOpacity 
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => navigation.navigate('Progress')}
        >
          <Text style={styles.actionButtonTextSecondary}>📊 {language === 'en' ? 'Progress' : 'Progreso'}</Text>
        </TouchableOpacity>
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
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
});

export default HomeScreen;
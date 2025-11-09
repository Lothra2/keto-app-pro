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
import MealCard from '../../components/meals/MealCard';
import WeekSelector from '../../components/progress/WeekSelector';
import DayPills from '../../components/progress/DayPills';
import { 
  getDayData, 
  saveMealCompletion, 
  getCalorieState,
  getWaterState,
  addWater,
  resetWater,
  isDayCompleted,
  setDayCompleted
} from '../../storage/storage';

const DayScreen = ({ navigation }) => {
  const {
    theme: themeMode,
    language,
    currentDay,
    setCurrentDay,
    currentWeek,
    setCurrentWeek,
    derivedPlan
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [dayData, setDayData] = useState(null);
  const [mealStates, setMealStates] = useState({});
  const [calorieInfo, setCalorieInfo] = useState({ consumed: 0, goal: 1600 });
  const [waterInfo, setWaterInfo] = useState({ ml: 0, goal: 2400 });
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    loadDayData();
  }, [currentDay]);

  const loadDayData = async () => {
    const baseDay = derivedPlan[currentDay];
    const stored = await getDayData(currentDay);
    
    const merged = {
      ...baseDay,
      ...stored,
      dia: baseDay?.dia || `Día ${currentDay + 1}`
    };
    
    setDayData(merged);

    const calState = await getCalorieState(currentDay, baseDay.kcal);
    setMealStates(calState.meals);
    
    const consumed = calculateConsumed(calState.meals, calState.goal);
    setCalorieInfo({ consumed, goal: calState.goal });

    const water = await getWaterState(currentDay);
    setWaterInfo(water);

    const done = await isDayCompleted(currentDay);
    setIsDone(done);
  };

  const calculateConsumed = (meals, goal) => {
    const percents = {
      desayuno: 0.25,
      snackAM: 0.10,
      almuerzo: 0.35,
      snackPM: 0.10,
      cena: 0.20
    };

    let consumed = 0;
    Object.keys(meals).forEach(key => {
      if (meals[key]) {
        consumed += Math.round(goal * (percents[key] || 0));
      }
    });
    return consumed;
  };

  const handleToggleMeal = async (mealKey) => {
    const newState = !mealStates[mealKey];
    setMealStates(prev => ({ ...prev, [mealKey]: newState }));
    await saveMealCompletion(currentDay, mealKey, newState);
    
    const newConsumed = calculateConsumed({...mealStates, [mealKey]: newState}, calorieInfo.goal);
    setCalorieInfo(prev => ({ ...prev, consumed: newConsumed }));
  };

  const handleAddWater = async (ml) => {
    await addWater(currentDay, ml);
    const water = await getWaterState(currentDay);
    setWaterInfo(water);
  };

  const handleResetWater = async () => {
    await resetWater(currentDay, 0);
    const water = await getWaterState(currentDay);
    setWaterInfo(water);
  };

  const handleToggleDayComplete = async () => {
    await setDayCompleted(currentDay, !isDone);
    setIsDone(!isDone);
  };

  const handleWeekChange = (week) => {
    setCurrentWeek(week);
    const firstDayOfWeek = (week - 1) * 7;
    setCurrentDay(firstDayOfWeek);
  };

  if (!dayData) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const calPercent = Math.min(100, Math.round((calorieInfo.consumed / calorieInfo.goal) * 100));
  const waterPercent = Math.min(100, Math.round((waterInfo.ml / waterInfo.goal) * 100));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Week Selector */}
        <WeekSelector 
          currentWeek={currentWeek} 
          onWeekChange={handleWeekChange} 
        />

        {/* Day Pills */}
        <DayPills
          week={currentWeek}
          currentDay={currentDay}
          onDaySelect={setCurrentDay}
          derivedPlan={derivedPlan}
        />

        {/* Day Header */}
        <View style={styles.header}>
          <Text style={styles.dayTitle}>{dayData.dia}</Text>
          <Text style={styles.calories}>{dayData.kcal} kcal</Text>
          <View style={styles.macros}>
            <Text style={styles.macroText}>C {dayData.macros?.carbs}</Text>
            <Text style={styles.macroText}>P {dayData.macros?.prot}</Text>
            <Text style={styles.macroText}>G {dayData.macros?.fat}</Text>
          </View>
        </View>

        {/* Calorie Bar */}
        <View style={styles.calorieBar}>
          <View style={styles.calorieHead}>
            <Text style={styles.calorieText}>
              {language === 'en' ? 'Calories today' : 'Calorías hoy'}:
            </Text>
            <Text style={styles.calorieValue}>
              {calorieInfo.consumed}/{calorieInfo.goal} kcal
            </Text>
          </View>
          <View style={styles.progressLine}>
            <View style={[styles.progressFill, { width: `${calPercent}%` }]} />
          </View>
        </View>

        {/* Water */}
        <View style={styles.waterBox}>
          <View style={styles.waterHead}>
            <Text style={styles.waterText}>
              💧 {language === 'en' ? 'Water today' : 'Agua de hoy'}
            </Text>
            <Text style={styles.waterValue}>
              {waterInfo.ml} / {waterInfo.goal} ml
            </Text>
          </View>
          <View style={styles.progressLine}>
            <View style={[styles.progressFill, { width: `${waterPercent}%` }]} />
          </View>
          <View style={styles.waterActions}>
            <TouchableOpacity style={styles.waterButton} onPress={() => handleAddWater(250)}>
              <Text style={styles.waterButtonText}>+250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waterButton} onPress={() => handleAddWater(500)}>
              <Text style={styles.waterButtonText}>+500ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.waterButton, styles.waterButtonGhost]} onPress={handleResetWater}>
              <Text style={[styles.waterButtonText, styles.waterButtonTextGhost]}>
                {language === 'en' ? 'Reset' : 'Reiniciar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Meals */}
        <View style={styles.mealsSection}>
          <MealCard
            title={language === 'en' ? '🍳 Breakfast' : '🍳 Desayuno'}
            icon="🍳"
            mealData={dayData.desayuno}
            isCompleted={mealStates.desayuno}
            onToggleComplete={() => handleToggleMeal('desayuno')}
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
            showAIButton={true}
          />
        </View>

        {/* Complete Day Button */}
        <TouchableOpacity
          style={[styles.completeButton, isDone && styles.completeButtonDone]}
          onPress={handleToggleDayComplete}
        >
          <Text style={styles.completeButtonText}>
            {isDone 
              ? (language === 'en' ? '✓ Day completed' : '✓ Día completado')
              : (language === 'en' ? 'Mark day ✓' : 'Marcar día ✓')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 100
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 100
  },
  header: {
    marginBottom: theme.spacing.lg
  },
  dayTitle: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs
  },
  calories: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: theme.spacing.sm
  },
  macros: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  macroText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.cardSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm
  },
  calorieBar: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  calorieHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm
  },
  calorieText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  calorieValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600'
  },
  progressLine: {
    height: 6,
    backgroundColor: theme.colors.bgSoft,
    borderRadius: theme.radius.full,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full
  },
  waterBox: {
    backgroundColor: 'rgba(15,118,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.2)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg
  },
  waterHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm
  },
  waterText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600'
  },
  waterValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  waterActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm
  },
  waterButton: {
    flex: 1,
    backgroundColor: 'rgba(15,118,110,0.3)',
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    alignItems: 'center'
  },
  waterButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  waterButtonText: {
    ...theme.typography.bodySmall,
    color: '#fff',
    fontWeight: '600'
  },
  waterButtonTextGhost: {
    color: theme.colors.text
  },
  mealsSection: {
    marginBottom: theme.spacing.lg
  },
  completeButton: {
    backgroundColor: 'rgba(34,197,94,0.3)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center'
  },
  completeButtonDone: {
    backgroundColor: 'rgba(34,197,94,0.6)'
  },
  completeButtonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600'
  }
});

export default DayScreen;

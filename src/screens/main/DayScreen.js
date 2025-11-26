import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { withAlpha } from '../../theme/utils';
import MealList from '../../components/meals/MealList';
import CalorieBar from '../../components/meals/CalorieBar';
import WeekSelector from '../../components/progress/WeekSelector';
import DayPills from '../../components/progress/DayPills';
import {
  getDayData,
  saveMealCompletion,
  getCalorieState,
  saveCalorieState,
  getWaterState,
  addWater,
  resetWater,
  isDayCompleted,
  setDayCompleted,
  getCheatMeal,
  saveCheatMeal,
  clearCheatMeal,
  findCheatInWeek
} from '../../storage/storage';
import { calculateConsumedCalories, calculateDynamicDailyKcal } from '../../utils/calculations';
import { getDayDisplayName } from '../../utils/labels';
import { exportWeekPlanPdf } from '../../utils/pdf';

const DayScreen = ({ navigation }) => {
  const {
    theme: themeMode,
    language,
    currentDay,
    setCurrentDay,
    currentWeek,
    setCurrentWeek,
    derivedPlan,
    notifyProgressUpdate,
    gender,
    metrics,
    user
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [dayData, setDayData] = useState(null);
  const [mealStates, setMealStates] = useState({});
  const [calorieInfo, setCalorieInfo] = useState({ consumed: 0, goal: 1600 });
  const baseWaterGoal = metrics?.waterGoal ? Number(metrics.waterGoal) : 2400;
  const [waterInfo, setWaterInfo] = useState({ ml: 0, goal: baseWaterGoal });
  const [cheatMeal, setCheatMeal] = useState(null);
  const [cheatForm, setCheatForm] = useState({ mealKey: 'cena', description: '', kcal: '' });
  const [cheatConflict, setCheatConflict] = useState(null);
  const [isDone, setIsDone] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    loadDayData();
  }, [currentDay, language, baseWaterGoal, gender, metrics]);

  useEffect(() => {
    setWaterInfo((prev) => ({ ...prev, goal: baseWaterGoal }));
  }, [baseWaterGoal]);

  const loadDayData = async () => {
    const baseDay = derivedPlan[currentDay];
    const stored = await getDayData(currentDay);
    
    const merged = {
      ...baseDay,
      ...stored
    };

    merged.dia = getDayDisplayName({
      label: merged.dia || baseDay?.dia,
      index: currentDay,
      language,
      startDate: user?.startDate
    });
    
    setDayData(merged);

    const cheat = await getCheatMeal(currentDay);
    setCheatMeal(cheat);
    setCheatForm((prev) => ({
      mealKey: cheat?.mealKey || prev.mealKey,
      description: cheat?.description || '',
      kcal: cheat?.kcalEstimate ? String(cheat.kcalEstimate) : ''
    }));

    const dynamicGoal = calculateDynamicDailyKcal({
      baseKcal: baseDay.kcal,
      gender,
      metrics,
      cheatKcal: cheat?.kcalEstimate || 0
    });

    const calState = await getCalorieState(currentDay, dynamicGoal);
    const mealsState = calState.meals || {
      desayuno: false,
      snackAM: false,
      almuerzo: false,
      snackPM: false,
      cena: false
    };
    setMealStates(mealsState);

    const consumed = calculateConsumedCalories(mealsState, calState.goal || dynamicGoal, gender);
    const normalizedGoal = calState.goal !== dynamicGoal ? dynamicGoal : calState.goal;
    if (normalizedGoal !== calState.goal) {
      await saveCalorieState(currentDay, { ...calState, goal: normalizedGoal });
    }
    setCalorieInfo({ consumed, goal: normalizedGoal });

    const water = await getWaterState(currentDay, baseWaterGoal);
    setWaterInfo(water);

    const done = await isDayCompleted(currentDay);
    setIsDone(done);

    const conflict = await findCheatInWeek(currentDay);
    setCheatConflict(conflict);
  };

  const handleToggleMeal = async (mealKey) => {
    const newState = !mealStates[mealKey];
    setMealStates(prev => ({ ...prev, [mealKey]: newState }));
    await saveMealCompletion(currentDay, mealKey, newState);

    const newConsumed = calculateConsumedCalories(
      { ...mealStates, [mealKey]: newState },
      calorieInfo.goal,
      gender
    );
    setCalorieInfo(prev => ({ ...prev, consumed: newConsumed }));
  };

  const handleAddWater = async (ml) => {
    await addWater(currentDay, ml, baseWaterGoal);
    const water = await getWaterState(currentDay, baseWaterGoal);
    setWaterInfo(water);
    notifyProgressUpdate();
  };

  const handleResetWater = async () => {
    await resetWater(currentDay, baseWaterGoal);
    const water = await getWaterState(currentDay, baseWaterGoal);
    setWaterInfo(water);
    notifyProgressUpdate();
  };

  const handleSaveCheat = async () => {
    const kcalEstimate = Number(cheatForm.kcal) || 0;
    const payload = {
      mealKey: cheatForm.mealKey,
      description: cheatForm.description?.trim() || '',
      kcalEstimate,
      savedAt: new Date().toISOString()
    };

    if (cheatConflict && cheatConflict.dayIndex !== currentDay) {
      Alert.alert(
        language === 'en' ? 'Cheat already scheduled' : 'Cheat ya agendado',
        language === 'en'
          ? 'Solo 1 cheat meal por semana. Borra el existente o cámbialo a este día.'
          : 'Solo 1 cheat meal por semana. Borra el existente o cámbialo a este día.'
      );
      return;
    }

    await saveCheatMeal(currentDay, payload);
    const updatedGoal = calculateDynamicDailyKcal({
      baseKcal: dayData?.kcal || derivedPlan?.[currentDay]?.kcal,
      gender,
      metrics,
      cheatKcal: kcalEstimate
    });
    const currentCalState = await getCalorieState(currentDay, updatedGoal);
    await saveCalorieState(currentDay, { ...currentCalState, goal: updatedGoal });
    setCalorieInfo((prev) => ({ ...prev, goal: updatedGoal }));
    setCheatMeal(payload);
    const conflict = await findCheatInWeek(currentDay);
    setCheatConflict(conflict);
  };

  const handleClearCheat = async () => {
    await clearCheatMeal(currentDay);
    const updatedGoal = calculateDynamicDailyKcal({
      baseKcal: dayData?.kcal || derivedPlan?.[currentDay]?.kcal,
      gender,
      metrics,
      cheatKcal: 0
    });
    const currentCalState = await getCalorieState(currentDay, updatedGoal);
    await saveCalorieState(currentDay, { ...currentCalState, goal: updatedGoal });
    setCalorieInfo((prev) => ({ ...prev, goal: updatedGoal }));
    setCheatMeal(null);
    setCheatConflict(await findCheatInWeek(currentDay));
  };

  const handleToggleDayComplete = async () => {
    await setDayCompleted(currentDay, !isDone);
    setIsDone(!isDone);
    notifyProgressUpdate();
  };

  const handleWeekChange = (week) => {
    setCurrentWeek(week);
    const firstDayOfWeek = (week - 1) * 7;
    setCurrentDay(firstDayOfWeek);
  };

  const handleExportWeekPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);

    try {
      const result = await exportWeekPlanPdf({
        weekNumber: currentWeek,
        derivedPlan,
        language,
        gender,
        metrics,
        waterGoal: baseWaterGoal,
        startDate: user?.startDate
      });

      if (!result.shared) {
        Alert.alert(
          language === 'en' ? 'PDF ready' : 'PDF listo',
          language === 'en' ? `Saved to ${result.uri}` : `Guardado en ${result.uri}`
        );
      }
    } catch (error) {
      console.error('PDF export error', error);
      Alert.alert(
        language === 'en' ? 'Could not export' : 'No se pudo exportar',
        language === 'en'
          ? 'Try again in a few seconds.'
          : 'Intenta nuevamente en unos segundos.'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  if (!dayData) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const waterPercent = Math.min(100, Math.round((waterInfo.ml / waterInfo.goal) * 100));

  const meals = [
    {
      key: 'desayuno',
      title: language === 'en' ? 'Breakfast' : 'Desayuno',
      icon: '🍳',
      data: dayData.desayuno,
      isCompleted: mealStates.desayuno,
      onToggle: () => handleToggleMeal('desayuno')
    },
    {
      key: 'snackAM',
      title: language === 'en' ? 'Snack AM' : 'Snack AM',
      icon: '⏰',
      data: dayData.snackAM,
      isCompleted: mealStates.snackAM,
      onToggle: () => handleToggleMeal('snackAM')
    },
    {
      key: 'almuerzo',
      title: language === 'en' ? 'Lunch' : 'Almuerzo',
      icon: '🥗',
      data: dayData.almuerzo,
      isCompleted: mealStates.almuerzo,
      onToggle: () => handleToggleMeal('almuerzo')
    },
    {
      key: 'snackPM',
      title: language === 'en' ? 'Snack PM' : 'Snack PM',
      icon: '🥜',
      data: dayData.snackPM,
      isCompleted: mealStates.snackPM,
      onToggle: () => handleToggleMeal('snackPM')
    },
    {
      key: 'cena',
      title: language === 'en' ? 'Dinner' : 'Cena',
      icon: '🍖',
      data: dayData.cena,
      isCompleted: mealStates.cena,
      onToggle: () => handleToggleMeal('cena')
    }
  ];

  const displayGoalKcal = calorieInfo.goal || dayData?.dynamicKcal || dayData?.kcal;
  const cheatLabel = cheatMeal
    ? `${language === 'en' ? 'Cheat' : 'Cheat'} · ${
        meals.find((m) => m.key === cheatMeal.mealKey)?.title || cheatMeal.mealKey
      }${cheatMeal.kcalEstimate ? ` · ${cheatMeal.kcalEstimate} kcal` : ''}`
    : language === 'en'
    ? 'Plan your 1x/week cheat and we rebalance the day.'
    : 'Agenda tu cheat 1x/semana y reequilibramos el día.';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[withAlpha(theme.colors.primary, 0.35), withAlpha(theme.colors.accent || theme.colors.primary, 0.2)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroTitle}>{language === 'en' ? 'Premium menu' : 'Menú premium'}</Text>
          <Text style={styles.heroSubtitle}>
            {language === 'en'
              ? 'Glass cards, calmer spacing and inline chips to keep meals, water and extras at a glance.'
              : 'Cartas tipo cristal, espacios calmados y chips en línea para ver comidas, agua y extras de un vistazo.'}
          </Text>
          <View style={styles.heroRow}>
            <View style={[styles.heroChip, styles.heroChipPrimary]}>
              <Text style={styles.heroChipLabel}>{language === 'en' ? 'Today' : 'Hoy'}</Text>
              <Text style={styles.heroChipValue}>{dayData.dia}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>{language === 'en' ? 'Calories' : 'Calorías'}</Text>
              <Text style={styles.heroChipValue}>{displayGoalKcal} kcal</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>{language === 'en' ? 'Water' : 'Agua'}</Text>
              <Text style={styles.heroChipValue}>{waterPercent}%</Text>
            </View>
          </View>
        </LinearGradient>

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

        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={[styles.toolButton, exportingPdf && styles.toolButtonDisabled]}
            onPress={handleExportWeekPdf}
            activeOpacity={0.85}
            disabled={exportingPdf}
          >
            {exportingPdf ? (
              <ActivityIndicator color={theme.colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.toolButtonText}>
                📄 {language === 'en' ? 'Share weekly PDF' : 'Compartir PDF semanal'}
              </Text>
            )}
          </TouchableOpacity>
          <Text style={styles.toolHint}>
            {language === 'en'
              ? 'Includes meals, macros and notes for each day.'
              : 'Incluye comidas, macros y notas de cada día.'}
          </Text>
        </View>

        {/* Day Header */}
        <View style={styles.header}>
          <Text style={styles.dayTitle}>{dayData.dia}</Text>
          <Text style={styles.calories}>{displayGoalKcal} kcal</Text>
          <View style={styles.macros}>
            <Text style={styles.macroText}>C {dayData.macros?.carbs}</Text>
            <Text style={styles.macroText}>P {dayData.macros?.prot}</Text>
            <Text style={styles.macroText}>G {dayData.macros?.fat}</Text>
          </View>
          <View style={[styles.inlineCheat, cheatMeal && styles.inlineCheatActive]}>
            <Text style={[styles.inlineCheatText, cheatMeal && styles.inlineCheatTextActive]}>{cheatLabel}</Text>
          </View>
        </View>

        {/* Calorie Bar */}
        <CalorieBar consumed={calorieInfo.consumed} goal={calorieInfo.goal} />

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

        {/* Cheat meal planner */}
        <View style={styles.cheatBox}>
          <View style={styles.cheatHeader}>
            <Text style={styles.cheatTitle}>
              🍕 {language === 'en' ? 'Cheat meal (1x/week)' : 'Cheat meal (1x/semana)'}
            </Text>
            {cheatMeal ? <Text style={styles.cheatBadge}>IA balance on</Text> : null}
          </View>
          <Text style={styles.cheatHint}>
            {language === 'en'
              ? 'Choose the meal to loosen up, describe it and we will rebalance calories for the day.'
              : 'Elige la comida a liberar, descríbela y reequilibramos las calorías del día.'}
          </Text>

          <View style={styles.cheatSelector}>
            {meals.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.chip, cheatForm.mealKey === m.key && styles.chipActive]}
                onPress={() => setCheatForm((prev) => ({ ...prev, mealKey: m.key }))}
              >
                <Text style={[styles.chipText, cheatForm.mealKey === m.key && styles.chipTextActive]}>
                  {m.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.cheatInput}
            placeholder={language === 'en' ? 'What will you eat?' : '¿Qué vas a comer?'}
            placeholderTextColor={theme.colors.textMuted}
            value={cheatForm.description}
            onChangeText={(text) => setCheatForm((prev) => ({ ...prev, description: text }))}
            multiline
          />

          <View style={styles.cheatKcalRow}>
            <Text style={styles.cheatKcalLabel}>
              {language === 'en' ? 'Estimated kcal' : 'Kcal estimadas'}
            </Text>
            <TextInput
              style={styles.cheatKcalInput}
              keyboardType="numeric"
              value={cheatForm.kcal}
              onChangeText={(text) => setCheatForm((prev) => ({ ...prev, kcal: text }))}
              placeholder="450"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {cheatConflict && cheatConflict.dayIndex !== currentDay ? (
            <Text style={styles.cheatWarning}>
              {language === 'en'
                ? `Already scheduled on day ${cheatConflict.dayIndex + 1}.`
                : `Ya programado en el día ${cheatConflict.dayIndex + 1}.`}
            </Text>
          ) : null}

          <View style={styles.cheatActions}>
            <TouchableOpacity style={styles.cheatButton} onPress={handleSaveCheat}>
              <Text style={styles.cheatButtonText}>
                {cheatMeal ? (language === 'en' ? 'Update cheat' : 'Actualizar cheat') : language === 'en' ? 'Save cheat' : 'Guardar cheat'}
              </Text>
            </TouchableOpacity>
            {cheatMeal ? (
              <TouchableOpacity style={[styles.cheatButton, styles.cheatGhost]} onPress={handleClearCheat}>
                <Text style={[styles.cheatButtonText, styles.cheatGhostText]}>
                  {language === 'en' ? 'Remove' : 'Quitar'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.cheatFootnote}>
            {language === 'en'
              ? 'We add ~60% of the cheat kcal to your goal and keep protein on track.'
              : 'Sumamos ~60% de las kcal del cheat a tu meta y mantenemos la proteína.'}
          </Text>
        </View>

        {/* Meals */}
        <View style={styles.mealsSection}>
          <MealList meals={meals} />
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
  hero: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.35),
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: theme.spacing.lg
  },
  heroTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    letterSpacing: 0.2
  },
  heroSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    lineHeight: 18
  },
  heroRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm
  },
  heroChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.card, 0.7),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.7)
  },
  heroChipPrimary: {
    backgroundColor: withAlpha(theme.colors.primary, 0.16),
    borderColor: withAlpha(theme.colors.primary, 0.45)
  },
  heroChipLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 2
  },
  heroChipValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700'
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
  inlineCheat: {
    marginTop: theme.spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  inlineCheatActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary
  },
  inlineCheatText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '600'
  },
  inlineCheatTextActive: {
    color: theme.colors.primary
  },
  toolsRow: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs
  },
  toolButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  toolButtonDisabled: {
    opacity: 0.6
  },
  toolButtonText: {
    ...theme.typography.body,
    color: theme.colors.onPrimary,
    fontWeight: '600'
  },
  toolHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center'
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
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
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  waterButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  waterButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.onPrimary,
    fontWeight: '600'
  },
  waterButtonTextGhost: {
    color: theme.colors.text
  },
  cheatBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  cheatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs
  },
  cheatTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700'
  },
  cheatBadge: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    fontWeight: '700'
  },
  cheatHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm
  },
  cheatSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.sm
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  chipActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary
  },
  chipText: {
    ...theme.typography.caption,
    color: theme.colors.text
  },
  chipTextActive: {
    color: theme.colors.primary,
    fontWeight: '700'
  },
  cheatInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    minHeight: 60,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.cardSoft
  },
  cheatKcalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs
  },
  cheatKcalLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  cheatKcalInput: {
    width: 90,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.cardSoft,
    textAlign: 'center'
  },
  cheatWarning: {
    ...theme.typography.caption,
    color: '#f97316',
    marginBottom: theme.spacing.xs,
    fontWeight: '700'
  },
  cheatActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    alignItems: 'center'
  },
  cheatButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cheatButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.onPrimary,
    fontWeight: '700'
  },
  cheatGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowOpacity: 0
  },
  cheatGhostText: {
    color: theme.colors.text
  },
  cheatFootnote: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm
  },
  mealsSection: {
    marginBottom: theme.spacing.lg
  },
  completeButton: {
    backgroundColor: withAlpha(theme.colors.success, 0.32),
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center'
  },
  completeButtonDone: {
    backgroundColor: withAlpha(theme.colors.success, 0.6)
  },
  completeButtonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600'
  }
});

export default DayScreen;

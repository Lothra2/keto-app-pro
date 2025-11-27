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
  findCheatInWeek,
  getExtraIntakes,
  saveExtraIntakes
} from '../../storage/storage';
import aiService from '../../api/aiService';
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
    user,
    apiCredentials
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
  const [extras, setExtras] = useState([]);
  const [extraForm, setExtraForm] = useState({ description: '', portion: '', kcal: '', note: '' });
  const [extraEstimatedByAI, setExtraEstimatedByAI] = useState(false);
  const [extraEstimating, setExtraEstimating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const calculateExtrasKcal = (items = extras) =>
    (Array.isArray(items) ? items : []).reduce((sum, item) => sum + (Number(item?.kcalEstimate) || 0), 0);

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

    const storedExtras = await getExtraIntakes(currentDay);
    setExtras(storedExtras || []);
    setExtraEstimatedByAI(false);
    setExtraForm({ description: '', portion: '', kcal: '', note: '' });

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
    const extrasKcal = calculateExtrasKcal(storedExtras);
    const normalizedGoal = calState.goal !== dynamicGoal ? dynamicGoal : calState.goal;
    if (normalizedGoal !== calState.goal) {
      await saveCalorieState(currentDay, { ...calState, goal: normalizedGoal });
    }
    setCalorieInfo({ consumed: consumed + extrasKcal, goal: normalizedGoal, extrasKcal });

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
    const extrasKcal = calculateExtrasKcal();
    setCalorieInfo(prev => ({ ...prev, consumed: newConsumed + extrasKcal, extrasKcal }));
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

  const handleEstimateExtra = async () => {
    if (!extraForm.description.trim()) {
      Alert.alert(
        language === 'en' ? 'Describe what you ate' : 'Describe lo que comiste',
        language === 'en'
          ? 'Tell us what you had between meals so we can estimate kcal.'
          : 'Cuéntanos qué tomaste entre comidas para estimar las kcal.'
      );
      return;
    }

    if (!apiCredentials?.user || !apiCredentials?.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to ask AI for calories.'
          : 'Agrega tus credenciales de Grok en ajustes para pedir calorías a la IA.'
      );
      return;
    }

    setExtraEstimating(true);
    try {
      const dayGoal = calorieInfo.goal || dayData?.kcal || derivedPlan?.[currentDay]?.kcal || 1600;
      const mealConsumed = calculateConsumedCalories(mealStates, dayGoal, gender);
      const extrasKcal = calculateExtrasKcal();
      const estimate = await aiService.estimateMealCalories({
        mealKey: 'extra',
        description: extraForm.description.trim(),
        portion: extraForm.portion.trim(),
        language,
        credentials: apiCredentials,
        dayKcal: dayGoal,
        consumedKcal: mealConsumed + extrasKcal,
      });

      if (estimate?.kcalEstimate) {
        setExtraForm((prev) => ({ ...prev, kcal: String(estimate.kcalEstimate), note: estimate.note || prev.note }));
        setExtraEstimatedByAI(true);
      }
    } catch (error) {
      console.error('Error estimating extra kcal:', error);
      Alert.alert(
        language === 'en' ? 'AI not available' : 'IA no disponible',
        language === 'en'
          ? 'We could not estimate those calories. Try again or enter them manually.'
          : 'No pudimos estimar las calorías. Intenta nuevamente o ingrésalas manualmente.'
      );
    } finally {
      setExtraEstimating(false);
    }
  };

  const handleAddExtra = async () => {
    const cleanDescription = extraForm.description.trim();
    const parsedKcal = Number(extraForm.kcal);
    const cleanPortion = extraForm.portion.trim();
    const cleanNote = extraForm.note.trim();

    if (!cleanDescription) {
      Alert.alert(
        language === 'en' ? 'Add what you had' : 'Agrega qué tomaste',
        language === 'en' ? 'Describe the snack or protein you added.' : 'Describe el snack o proteína que sumaste.'
      );
      return;
    }

    if (!Number.isFinite(parsedKcal) || parsedKcal <= 0) {
      Alert.alert(
        language === 'en' ? 'Calories needed' : 'Faltan calorías',
        language === 'en' ? 'Add the estimated kcal so we can count them.' : 'Agrega las kcal estimadas para contarlas.'
      );
      return;
    }

    const payload = {
      id: Date.now(),
      description: cleanDescription,
      portion: cleanPortion,
      kcalEstimate: Math.round(parsedKcal),
      note: cleanNote,
      estimatedByAI: extraEstimatedByAI,
      createdAt: new Date().toISOString(),
    };

    const updatedExtras = [...extras, payload];
    await saveExtraIntakes(currentDay, updatedExtras);
    const extrasKcal = calculateExtrasKcal(updatedExtras);
    const consumed = calculateConsumedCalories(mealStates, calorieInfo.goal, gender);
    setExtras(updatedExtras);
    setCalorieInfo((prev) => ({ ...prev, consumed: consumed + extrasKcal, extrasKcal }));
    setExtraForm({ description: '', portion: '', kcal: '', note: '' });
    setExtraEstimatedByAI(false);
  };

  const handleRemoveExtra = async (id) => {
    const updatedExtras = extras.filter((item) => item.id !== id);
    await saveExtraIntakes(currentDay, updatedExtras);
    const extrasKcal = calculateExtrasKcal(updatedExtras);
    const consumed = calculateConsumedCalories(mealStates, calorieInfo.goal, gender);
    setExtras(updatedExtras);
    setCalorieInfo((prev) => ({ ...prev, consumed: consumed + extrasKcal, extrasKcal }));
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
    const extrasKcal = calculateExtrasKcal();
    const consumed = calculateConsumedCalories(mealStates, updatedGoal, gender);
    setCalorieInfo((prev) => ({ ...prev, goal: updatedGoal, consumed: consumed + extrasKcal, extrasKcal }));
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
    const extrasKcal = calculateExtrasKcal();
    const consumed = calculateConsumedCalories(mealStates, updatedGoal, gender);
    setCalorieInfo((prev) => ({ ...prev, goal: updatedGoal, consumed: consumed + extrasKcal, extrasKcal }));
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

  const waterPercent = Math.min(100, Math.round((waterInfo.ml / waterInfo.goal) * 100));
  const completedMeals = meals.filter((m) => m.isCompleted).length;
  const totalMeals = meals.length;
  const mealCompletion = totalMeals ? Math.round((completedMeals / totalMeals) * 100) : 0;

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
          colors={[withAlpha(theme.colors.primary, 0.45), withAlpha(theme.colors.accent || theme.colors.primary, 0.3)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroTitle}>{language === 'en' ? 'Chef-level menu' : 'Menú nivel chef'}</Text>
          <Text style={styles.heroSubtitle}>
            {language === 'en'
              ? 'Curated glass cards, soft glows and richer stats so your day feels bespoke.'
              : 'Tarjetas de cristal, brillos suaves y métricas ricas para que tu día se sienta hecho a medida.'}
          </Text>
          <View style={styles.heroRow}>
            <View style={[styles.heroChip, styles.heroChipPrimary]}>
              <Text style={styles.heroChipLabel}>{language === 'en' ? 'Today' : 'Hoy'}</Text>
              <Text style={styles.heroChipValue}>{dayData.dia}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>{language === 'en' ? 'Calorie target' : 'Meta calórica'}</Text>
              <Text style={styles.heroChipValue}>{displayGoalKcal} kcal</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>{language === 'en' ? 'Hydration' : 'Hidratación'}</Text>
              <Text style={styles.heroChipValue}>{waterPercent}%</Text>
            </View>
            <View style={[styles.heroChip, styles.heroChipAccent]}>
              <Text style={styles.heroChipLabel}>{language === 'en' ? 'Meals' : 'Comidas'}</Text>
              <Text style={styles.heroChipValue}>{mealCompletion}%</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.glassGrid}>
          <View style={[styles.glassCard, styles.glassAccent]}>
            <Text style={styles.glassLabel}>{language === 'en' ? 'Macros' : 'Macros'}</Text>
            <Text style={styles.glassValue}>
              C {dayData.macros?.carbs} · P {dayData.macros?.prot} · G {dayData.macros?.fat}
            </Text>
            <Text style={styles.glassHint}>
              {language === 'en' ? 'Balanced for today' : 'Balanceado para hoy'}
            </Text>
          </View>
          <View style={styles.glassCard}>
            <Text style={styles.glassLabel}>{language === 'en' ? 'Hydration' : 'Hidratación'}</Text>
            <Text style={styles.glassValue}>{waterPercent}%</Text>
            <Text style={styles.glassHint}>
              {language === 'en' ? 'Keep the flow above 80%' : 'Mantén el flujo arriba de 80%'}
            </Text>
          </View>
          <View style={styles.glassCard}>
            <Text style={styles.glassLabel}>{language === 'en' ? 'Cheat control' : 'Control cheat'}</Text>
            <Text style={styles.glassValue}>{cheatMeal ? '✅' : '—'}</Text>
            <Text style={styles.glassHint}>
              {cheatMeal
                ? cheatLabel
                : language === 'en'
                ? 'Plan it once per week'
                : 'Planéalo 1x por semana'}
            </Text>
          </View>
        </View>

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
        <View style={styles.caloriePanel}>
          <View style={styles.calorieHeader}>
            <Text style={styles.calorieTitle}>{language === 'en' ? 'Energy flow' : 'Flujo de energía'}</Text>
            <Text style={styles.calorieMetric}>
              {calorieInfo.consumed} / {calorieInfo.goal} kcal
            </Text>
          </View>
          <CalorieBar consumed={calorieInfo.consumed} goal={calorieInfo.goal} />
          <Text style={styles.calorieHint}>
            {language === 'en'
              ? 'We add extra bites, cheat meals and hydration boosts to your tally.'
              : 'Sumamos extras, cheats y subidas de hidratación a tu cuenta.'}
          </Text>
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

        {/* Extra intakes */}
        <View style={styles.extraBox}>
          <View style={styles.extraHeader}>
            <View>
              <Text style={styles.extraTitle}>
                🧃 {language === 'en' ? 'Extras between meals' : 'Extras entre comidas'}
              </Text>
              <Text style={styles.extraHint}>
                {language === 'en'
                  ? 'Log proteins or snacks outside the plan. They won’t change the cards, but we count the kcal.'
                  : 'Anota proteínas o snacks fuera del plan. No alteran las tarjetas, pero sí suman kcal.'}
              </Text>
            </View>
            <View style={styles.extraBadge}>
              <Text style={styles.extraBadgeText}>
                +{calorieInfo.extrasKcal || 0} kcal
              </Text>
            </View>
          </View>

          <TextInput
            style={styles.extraInput}
            placeholder={language === 'en' ? 'What did you add?' : '¿Qué agregaste?'}
            placeholderTextColor={theme.colors.textMuted}
            value={extraForm.description}
            onChangeText={(text) => setExtraForm((prev) => ({ ...prev, description: text }))}
            multiline
          />

          <View style={styles.extraRow}>
            <TextInput
              style={[styles.extraInput, styles.extraInputHalf]}
              placeholder={language === 'en' ? 'Portion / qty' : 'Porción / qty'}
              placeholderTextColor={theme.colors.textMuted}
              value={extraForm.portion}
              onChangeText={(text) => setExtraForm((prev) => ({ ...prev, portion: text }))}
            />
            <View style={styles.extraKcalGroup}>
              <TextInput
                style={[styles.extraInput, styles.extraInputKcal]}
                placeholder="220"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={extraForm.kcal}
                onChangeText={(text) => setExtraForm((prev) => ({ ...prev, kcal: text }))}
              />
              <TouchableOpacity
                style={[styles.extraAIButton, extraEstimating && styles.extraAIButtonDisabled]}
                onPress={handleEstimateExtra}
                disabled={extraEstimating}
              >
                {extraEstimating ? (
                  <ActivityIndicator color={theme.colors.onPrimary} size="small" />
                ) : (
                  <Text style={styles.extraAIText}>{language === 'en' ? 'Ask AI' : 'Pedir a IA'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {extraForm.note ? (
            <Text style={styles.extraNote}>🧠 {extraForm.note}</Text>
          ) : null}

          <View style={styles.extraActions}>
            <TouchableOpacity style={styles.extraButton} onPress={handleAddExtra}>
              <Text style={styles.extraButtonText}>
                {language === 'en' ? 'Add extra intake' : 'Sumar extra'}
              </Text>
            </TouchableOpacity>
          </View>

          {extras.length ? (
            <View style={styles.extraList}>
              {extras.map((item) => (
                <View key={item.id} style={styles.extraItem}>
                  <View style={styles.extraItemTextBox}>
                    <Text style={styles.extraItemTitle}>{item.description}</Text>
                    <Text style={styles.extraItemMeta}>
                      {item.portion ? `${item.portion} · ` : ''}{item.kcalEstimate} kcal
                      {item.estimatedByAI ? ' · IA' : ''}
                    </Text>
                    {item.note ? <Text style={styles.extraItemNote}>{item.note}</Text> : null}
                  </View>
                  <TouchableOpacity style={styles.extraRemove} onPress={() => handleRemoveExtra(item.id)}>
                    <Text style={styles.extraRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
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
          <LinearGradient
            colors={[
              withAlpha(theme.colors.primary, 0.38),
              withAlpha(theme.colors.accent || theme.colors.primary, 0.16)
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mealPanel}
          >
            <View style={styles.mealPanelHeader}>
              <View style={styles.mealPanelTitleRow}>
                <Text style={styles.mealPanelTitle}>{language === 'en' ? 'Meals of the day' : 'Comidas del día'}</Text>
                <View style={styles.mealPill}>
                  <Text style={styles.mealPillText}>{completedMeals}/{totalMeals}</Text>
                </View>
              </View>
              <Text style={styles.mealPanelSubtitle}>
                {language === 'en'
                  ? 'Curated glass cards with bold manual badges and soft glows for each dish.'
                  : 'Tarjetas de cristal con badges manuales marcados y brillos suaves para cada plato.'}
              </Text>
              <View style={styles.mealChipsRow}>
                <View style={[styles.mealChip, styles.mealChipPrimary]}>
                  <Text style={styles.mealChipLabel}>{language === 'en' ? 'Completion' : 'Completado'}</Text>
                  <Text style={styles.mealChipValue}>{mealCompletion}%</Text>
                </View>
                <View style={styles.mealChip}>
                  <Text style={styles.mealChipLabel}>{language === 'en' ? 'Hydration' : 'Hidratación'}</Text>
                  <Text style={styles.mealChipValue}>{waterPercent}%</Text>
                </View>
                <View style={styles.mealChip}>
                  <Text style={styles.mealChipLabel}>{language === 'en' ? 'Cheat status' : 'Estado cheat'}</Text>
                  <Text style={styles.mealChipValue}>{cheatMeal ? '⚡' : '—'}</Text>
                </View>
              </View>
            </View>

            <MealList meals={meals} style={styles.mealList} />
          </LinearGradient>
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
  heroChipAccent: {
    backgroundColor: withAlpha(theme.colors.accent || theme.colors.primary, 0.14),
    borderColor: withAlpha(theme.colors.accent || theme.colors.primary, 0.4)
  },
  glassGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  glassCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: withAlpha(theme.colors.card, 0.8),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.65),
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  glassAccent: {
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
    borderColor: withAlpha(theme.colors.primary, 0.4),
  },
  glassLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  glassValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  glassHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 4,
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
  caloriePanel: {
    backgroundColor: withAlpha(theme.colors.card, 0.92),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.35),
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  calorieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  calorieTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700'
  },
  calorieMetric: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700'
  },
  calorieHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs
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
  mealsSection: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg
  },
  mealPanel: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.7),
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    overflow: 'hidden'
  },
  mealPanelHeader: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md
  },
  mealPanelTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mealPanelTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    letterSpacing: 0.2
  },
  mealPanelSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    lineHeight: 18
  },
  mealPill: {
    backgroundColor: withAlpha(theme.colors.primary, 0.16),
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.45)
  },
  mealPillText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700'
  },
  mealChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs
  },
  mealChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.card, 0.8),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.7)
  },
  mealChipPrimary: {
    backgroundColor: withAlpha(theme.colors.primary, 0.16),
    borderColor: withAlpha(theme.colors.primary, 0.4)
  },
  mealChipLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 2
  },
  mealChipValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '700'
  },
  mealList: {
    gap: theme.spacing.sm
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
  extraBox: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  extraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm
  },
  extraTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700'
  },
  extraHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 4
  },
  extraBadge: {
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
    borderColor: withAlpha(theme.colors.primary, 0.4),
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full
  },
  extraBadgeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700'
  },
  extraInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.cardSoft
  },
  extraRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs
  },
  extraInputHalf: {
    flex: 1
  },
  extraKcalGroup: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flex: 1,
    alignItems: 'center'
  },
  extraInputKcal: {
    width: 90
  },
  extraAIButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    minWidth: 90,
    alignItems: 'center'
  },
  extraAIButtonDisabled: {
    opacity: 0.6
  },
  extraAIText: {
    ...theme.typography.bodySmall,
    color: theme.colors.onPrimary,
    fontWeight: '700'
  },
  extraNote: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontStyle: 'italic'
  },
  extraActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  extraButton: {
    backgroundColor: withAlpha(theme.colors.success, 0.18),
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.success, 0.5)
  },
  extraButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '700'
  },
  extraList: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm
  },
  extraItem: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.cardSoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  extraItemTextBox: {
    flex: 1,
    gap: 4
  },
  extraItemTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '700'
  },
  extraItemMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted
  },
  extraItemNote: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontStyle: 'italic'
  },
  extraRemove: {
    padding: 6,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.textMuted, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.7)
  },
  extraRemoveText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 12
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

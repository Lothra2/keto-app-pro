import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import WeekSelector from '../../components/progress/WeekSelector';
import DayPills from '../../components/progress/DayPills';
import MealList from '../../components/meals/MealList';
import CalorieBar from '../../components/meals/CalorieBar';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import {
  getDayData,
  getCalorieState,
  saveMealCompletion,
  saveCalorieState,
  getWaterState,
  addWater,
  resetWater,
  getWeekReview,
  saveWeekReview,
  getDayReview,
  saveDayReview,
  isDayCompleted,
  setDayCompleted
} from '../../storage/storage';
import { getDailyTip, getMotivationalMessage } from '../../data/tips';
import { getWorkoutForDay } from '../../data/workouts';
import aiService from '../../api/aiService';
import { calculateConsumedCalories, calculateDynamicMacros } from '../../utils/calculations';
import { mergePlanDay, MEAL_KEYS, buildWeekAiPayload } from '../../utils/plan';
import { getDayDisplayName, sanitizeReviewBullet, stripMarkdownHeadings } from '../../utils/labels';

const defaultMealState = {
  desayuno: false,
  snackAM: false,
  almuerzo: false,
  snackPM: false,
  cena: false
};

const extractIngredientsFromQty = (qty = '') =>
  qty
    .split(/,|•|\n|\r/g)
    .map((part) => part.trim())
    .filter(Boolean);

const collectExtrasFromAI = (storedDay) => {
  if (!storedDay || typeof storedDay !== 'object') return [];
  const extras = new Set();

  MEAL_KEYS.forEach((key) => {
    const qty = storedDay?.[key]?.qty;
    if (qty) {
      extractIngredientsFromQty(qty).forEach((item) => {
        const cleaned = item.replace(/^[-+•\s]+/, '').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 1) {
          extras.add(cleaned);
        }
      });
    }
  });

  return Array.from(extras);
};

const normalizeDayReview = (value, language = 'es') => {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            label: language === 'en' ? `Note ${index + 1}` : `Nota ${index + 1}`,
            text: sanitizeReviewBullet(item)
          };
        }
        if (item && typeof item === 'object') {
          const label = item.label || (language === 'en' ? `Note ${index + 1}` : `Nota ${index + 1}`);
          return { label, text: sanitizeReviewBullet(item.text || '') };
        }
        return null;
      })
      .filter((item) => item && item.text);
  }

  if (typeof value === 'object' && Array.isArray(value.items)) {
    return normalizeDayReview(value.items, language);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({
        label: language === 'en' ? `Note ${index + 1}` : `Nota ${index + 1}`,
        text: sanitizeReviewBullet(text)
      }));
  }

  return null;
};

const normalizeWeekReview = (value, language = 'es') => {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return stripMarkdownHeadings(item);
        if (item && typeof item === 'object') return stripMarkdownHeadings(item.text || '');
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'object' && Array.isArray(value.items)) {
    return normalizeWeekReview(value.items, language);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeWeekReview(parsed, language);
    } catch (error) {
      return value
        .split(/\n+/)
        .map((text) => stripMarkdownHeadings(text))
        .filter(Boolean);
    }
  }

  return null;
};

const HomeScreen = ({ navigation }) => {
  const {
    theme: themeMode,
    currentDay,
    currentWeek,
    derivedPlan,
    user,
    language,
    setCurrentDay,
    setCurrentWeek,
    apiCredentials,
    metrics,
    notifyProgressUpdate
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [dayData, setDayData] = useState(null);
  const [mealStates, setMealStates] = useState(defaultMealState);
  const [calorieGoal, setCalorieGoal] = useState(1600);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [waterInfo, setWaterInfo] = useState({ goal: metrics.waterGoal || 2400, ml: 0 });
  const [extras, setExtras] = useState([]);
  const [extrasExpanded, setExtrasExpanded] = useState(false);
  const [dayReview, setDayReview] = useState(null);
  const [weekReview, setWeekReview] = useState(null);
  const [showWeekReview, setShowWeekReview] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [weekReviewLoading, setWeekReviewLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const totalWeeks = Math.max(Math.ceil(derivedPlan.length / 7), 1);
  const safeWeek = Math.min(Math.max(currentWeek || 1, 1), totalWeeks);

  useEffect(() => {
    setWaterInfo((prev) => ({ ...prev, goal: metrics.waterGoal || prev.goal || 2400 }));
  }, [metrics.waterGoal]);

  const loadDayData = useCallback(async () => {
    const baseDay = derivedPlan[currentDay];

    if (!baseDay) {
      setDayData(null);
      setExtras([]);
      return;
    }

    try {
      const stored = await getDayData(currentDay);

      const merged = mergePlanDay(baseDay, stored || {});
      merged.dia = getDayDisplayName({
        label: merged.dia,
        index: currentDay,
        language
      });
      setDayData(merged);

      const calState = await getCalorieState(currentDay, merged.kcal || baseDay.kcal || 1600);
      const mealsState = {
        ...defaultMealState,
        ...(calState.meals || {})
      };
      setMealStates(mealsState);

      const goal = calState.goal || merged.kcal || baseDay.kcal || 1600;
      setCalorieGoal(goal);
      const consumed = calculateConsumedCalories(mealsState, goal);
      setCaloriesConsumed(consumed);

      const water = await getWaterState(currentDay, metrics.waterGoal || 2400);
      setWaterInfo({
        goal: water.goal || metrics.waterGoal || 2400,
        ml: water.ml || 0
      });

      const done = await isDayCompleted(currentDay);
      setIsDone(done);

      const storedReview = await getDayReview(currentDay);
      setDayReview(normalizeDayReview(storedReview, language));

      const savedWeekReview = await getWeekReview(Math.floor(currentDay / 7) + 1);
      setWeekReview(normalizeWeekReview(savedWeekReview, language));

      const extractedExtras = collectExtrasFromAI(stored);
      setExtras(extractedExtras);
      setExtrasExpanded(false);
    } catch (error) {
      console.error('Error loading day data:', error);
    }
  }, [currentDay, derivedPlan, language, metrics.waterGoal]);

  useEffect(() => {
    loadDayData();
  }, [loadDayData]);

  useFocusEffect(
    useCallback(() => {
      loadDayData();
    }, [loadDayData])
  );

  const localizedWorkout = useMemo(() => {
    if (!derivedPlan.length) return null;
    return getWorkoutForDay(language, safeWeek, currentDay % 7);
  }, [currentDay, derivedPlan.length, language, safeWeek]);

  const dynamicMacros = useMemo(() => {
    if (!dayData?.macros) return null;
    return calculateDynamicMacros(dayData.macros, caloriesConsumed, calorieGoal);
  }, [dayData, caloriesConsumed, calorieGoal]);

  const tip = useMemo(() => getDailyTip(language, currentDay), [language, currentDay]);
  const motivation = useMemo(
    () => getMotivationalMessage(language, currentDay),
    [language, currentDay]
  );

  const handleToggleMeal = async (mealKey) => {
    const newState = !mealStates[mealKey];
    const updatedMeals = { ...mealStates, [mealKey]: newState };
    setMealStates(updatedMeals);

    await saveMealCompletion(currentDay, mealKey, newState);
    const consumed = calculateConsumedCalories(updatedMeals, calorieGoal);
    setCaloriesConsumed(consumed);
    await saveCalorieState(currentDay, { goal: calorieGoal, meals: updatedMeals });
  };

  const handleAddWater = async (amount) => {
    await addWater(currentDay, amount);
    const water = await getWaterState(currentDay, metrics.waterGoal || 2400);
    setWaterInfo({
      goal: water.goal || metrics.waterGoal || 2400,
      ml: water.ml || 0
    });
    notifyProgressUpdate();
  };

  const handleResetWater = async () => {
    await resetWater(currentDay, metrics.waterGoal || 2400);
    const water = await getWaterState(currentDay, metrics.waterGoal || 2400);
    setWaterInfo({
      goal: water.goal || metrics.waterGoal || 2400,
      ml: water.ml || 0
    });
    notifyProgressUpdate();
  };

  const handleGenerateAI = (mealKey) => {
    navigation.navigate('MealGenerator', {
      dayIndex: currentDay,
      mealKey
    });
  };

  const handleGenerateFullDay = () => {
    navigation.navigate('MealGenerator', {
      dayIndex: currentDay,
      mode: 'full-day'
    });
  };

  const handleOpenWorkoutModal = () => {
    navigation.navigate('WorkoutModal', {
      dayIndex: currentDay,
      weekNumber: safeWeek
    });
  };

  const handleReviewDay = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to use AI.'
          : 'Agrega tus credenciales de Grok en ajustes para usar la IA.'
      );
      return;
    }

    if (!dayData) return;

    setReviewLoading(true);
    try {
      const review = await aiService.reviewDay({
        dayData,
        language,
        credentials: apiCredentials
      });
      setDayReview(review);
      await saveDayReview(currentDay, review);
    } catch (error) {
      console.error(error);
      Alert.alert(
        language === 'en' ? 'AI error' : 'Error con IA',
        language === 'en'
          ? 'We could not review the day. Try again later.'
          : 'No pudimos revisar el día. Intenta más tarde.'
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const handleGenerateWeekReview = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to use AI.'
          : 'Agrega tus credenciales de Grok en ajustes para usar la IA.'
      );
      return;
    }

    setWeekReviewLoading(true);
    try {
      const startIdx = (safeWeek - 1) * 7;
      const endIdx = Math.min(safeWeek * 7, derivedPlan.length);
      const weekDays = [];

      for (let index = startIdx; index < endIdx; index++) {
        const base = derivedPlan[index];
        const stored = await getDayData(index);
        weekDays.push(mergePlanDay(base, stored || {}));
      }

      const payload = buildWeekAiPayload(weekDays);
      const review = await aiService.generateWeekReview({
        weekNumber: safeWeek,
        days: payload,
        language,
        credentials: apiCredentials
      });

      setWeekReview(review.items);
      setShowWeekReview(true);
      await saveWeekReview(
        safeWeek,
        JSON.stringify({ items: review.items, generatedAt: new Date().toISOString() })
      );
    } catch (error) {
      console.error(error);
      Alert.alert(
        language === 'en' ? 'AI error' : 'Error con IA',
        language === 'en'
          ? 'We could not review the week. Try later.'
          : 'No pudimos revisar la semana. Intenta más tarde.'
      );
    } finally {
      setWeekReviewLoading(false);
    }
  };

  const handleToggleDayComplete = async () => {
    await setDayCompleted(currentDay, !isDone);
    setIsDone((prev) => !prev);
    notifyProgressUpdate();
  };

  const handleWeekChange = (week) => {
    setCurrentWeek(week);
    const firstDay = (week - 1) * 7;
    setCurrentDay(firstDay);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDayData();
    setRefreshing(false);
  };

  const meals = useMemo(() => {
    if (!dayData) return [];

    return [
      {
        key: 'desayuno',
        title: language === 'en' ? 'Breakfast' : 'Desayuno',
        icon: '🍳',
        data: dayData.desayuno,
        isCompleted: mealStates.desayuno,
        onToggle: () => handleToggleMeal('desayuno'),
        onGenerateAI: () => handleGenerateAI('desayuno'),
        showAIButton: true
      },
      {
        key: 'snackAM',
        title: language === 'en' ? 'Snack AM' : 'Snack AM',
        icon: '⏰',
        data: dayData.snackAM,
        isCompleted: mealStates.snackAM,
        onToggle: () => handleToggleMeal('snackAM'),
        showAIButton: false
      },
      {
        key: 'almuerzo',
        title: language === 'en' ? 'Lunch' : 'Almuerzo',
        icon: '🥗',
        data: dayData.almuerzo,
        isCompleted: mealStates.almuerzo,
        onToggle: () => handleToggleMeal('almuerzo'),
        onGenerateAI: () => handleGenerateAI('almuerzo'),
        showAIButton: true
      },
      {
        key: 'snackPM',
        title: language === 'en' ? 'Snack PM' : 'Snack PM',
        icon: '🥜',
        data: dayData.snackPM,
        isCompleted: mealStates.snackPM,
        onToggle: () => handleToggleMeal('snackPM'),
        showAIButton: false
      },
      {
        key: 'cena',
        title: language === 'en' ? 'Dinner' : 'Cena',
        icon: '🍖',
        data: dayData.cena,
        isCompleted: mealStates.cena,
        onToggle: () => handleToggleMeal('cena'),
        onGenerateAI: () => handleGenerateAI('cena'),
        showAIButton: true
      }
    ];
  }, [dayData, mealStates, language]);

  if (!dayData) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>
          {language === 'en' ? 'Loading…' : 'Cargando…'}
        </Text>
      </View>
    );
  }

  const greeting = language === 'en'
    ? `Hey ${user.name || 'there'}!`
    : `Hola ${user.name || 'ahí'}!`;

  const waterPercent = Math.min(100, Math.round((waterInfo.ml / (waterInfo.goal || 1)) * 100));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <WeekSelector currentWeek={safeWeek} onWeekChange={handleWeekChange} />

      <DayPills
        week={safeWeek}
        currentDay={currentDay}
        onDaySelect={setCurrentDay}
        derivedPlan={derivedPlan}
      />

      <Card style={styles.headerCard}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.dayTitle}>{dayData.dia}</Text>
        <View style={styles.macrosRow}>
          <Text style={styles.kcalText}>{(dayData.kcal || calorieGoal)} kcal</Text>
          <View style={styles.macrosList}>
            <Text style={styles.macroBadge}>C {dynamicMacros?.carbs || dayData.macros?.carbs}</Text>
            <Text style={styles.macroBadge}>P {dynamicMacros?.prot || dayData.macros?.prot}</Text>
            <Text style={styles.macroBadge}>G {dynamicMacros?.fat || dayData.macros?.fat}</Text>
          </View>
        </View>
        <CalorieBar consumed={caloriesConsumed} goal={calorieGoal} />
      </Card>

      <Card style={styles.tipCard}>
        <Text style={styles.tipText}>💡 {tip}</Text>
        <Text style={styles.tipText}>💪 {motivation}</Text>
      </Card>

      <Card style={styles.waterCard}>
        <View style={styles.waterHeader}>
          <Text style={styles.waterTitle}>
            {language === 'en' ? 'Water today' : 'Agua de hoy'}
          </Text>
          <Text style={styles.waterValue}>
            {waterInfo.ml} / {waterInfo.goal} ml
          </Text>
        </View>
        <View style={styles.progressLine}>
          <View style={[styles.progressFill, { width: `${waterPercent}%` }]} />
        </View>
        <View style={styles.waterButtons}>
          <TouchableOpacity style={styles.waterButton} onPress={() => handleAddWater(250)}>
            <Text style={styles.waterButtonText}>+250ml</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.waterButton} onPress={() => handleAddWater(500)}>
            <Text style={styles.waterButtonText}>+500ml</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.waterButton, styles.waterButtonGhost]}
            onPress={handleResetWater}
          >
            <Text style={[styles.waterButtonText, styles.waterButtonTextGhost]}>
              {language === 'en' ? 'Reset' : 'Reiniciar'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {extras.length ? (
        <Card style={styles.extrasCard}>
          <TouchableOpacity
            style={styles.extrasHeaderRow}
            onPress={() => setExtrasExpanded(prev => !prev)}
            activeOpacity={0.7}
          >
            <View style={styles.extrasHeaderText}>
              <Text style={styles.sectionTitle}>
                {language === 'en' ? 'AI extras for today' : 'Extras IA para hoy'}
              </Text>
              <Text style={styles.extrasHint}>
                {language === 'en'
                  ? 'Quick reminders from your AI meals'
                  : 'Recordatorios rápidos de tus comidas IA'}
              </Text>
            </View>
            <Text style={styles.extrasToggle}>{extrasExpanded ? '−' : '+'}</Text>
          </TouchableOpacity>
          {extrasExpanded ? (
            <View style={styles.extrasList}>
              {extras.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.extraRow}>
                  <Text style={styles.extraBullet}>•</Text>
                  <Text style={styles.extraText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {localizedWorkout ? (
        <Card style={styles.workoutCard}>
          <Text style={styles.sectionTitle}>
            {language === 'en' ? 'Weekly focus' : 'Foco semanal'}
          </Text>
          <Text style={styles.sectionDescription}>{localizedWorkout.focus}</Text>
          <Text style={[styles.sectionTitle, styles.topMargin]}>
            {language === 'en' ? "Today's training" : 'Entrenamiento de hoy'}
          </Text>
          <Text style={styles.sectionDescription}>{localizedWorkout.today}</Text>
          <View style={styles.workoutButtons}>
            <Button
              title={language === 'en' ? 'Open workout IA 🏋️' : 'Entreno IA 🏋️'}
              onPress={handleOpenWorkoutModal}
            />
            <Button
              title={language === 'en' ? 'Detail view' : 'Ver detalle'}
              variant="secondary"
              onPress={() => navigation.navigate('Workout', { dayIndex: currentDay, weekNumber: safeWeek })}
            />
          </View>
        </Card>
      ) : null}

      <Card style={styles.aiActionsCard}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'AI actions' : 'Acciones IA'}
        </Text>
        <View style={styles.aiButtons}>
          <Button
            title={language === 'en' ? 'Full day with AI 🤖' : 'Día completo IA 🤖'}
            onPress={handleGenerateFullDay}
            style={styles.aiButton}
          />
          <Button
            title={language === 'en' ? 'AI review of your day 💬' : 'Revisión IA de tu día 💬'}
            variant="secondary"
            onPress={handleReviewDay}
            style={styles.aiButton}
          />
          <Button
            title={language === 'en' ? 'Weekly AI review 📅' : 'Revisión IA de semana 📅'}
            variant="secondary"
            onPress={handleGenerateWeekReview}
            style={styles.aiButton}
          />
        </View>
      </Card>

      <Card style={styles.toolCard}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Planning tools' : 'Herramientas'}
        </Text>
        <View style={styles.aiButtons}>
          <Button
            title={language === 'en' ? 'Progress 📊' : 'Progreso 📊'}
            variant="secondary"
            onPress={() => navigation.navigate('Progress')}
            style={styles.aiButton}
          />
          <Button
            title={language === 'en' ? 'Shopping 🛒' : 'Compras 🛒'}
            variant="secondary"
            onPress={() => navigation.navigate('Shopping')}
            style={styles.aiButton}
          />
        </View>
      </Card>

      <MealList meals={meals} style={styles.mealList} />

      <Card style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.sectionTitle}>
            {language === 'en' ? 'AI review of your day' : 'Revisión IA de tu día'}
          </Text>
          <Text style={styles.reviewHint}>
            {language === 'en' ? 'Trigger it from AI actions ↑' : 'Lánzalo desde Acciones IA ↑'}
          </Text>
        </View>
        {reviewLoading ? (
          <Text style={styles.reviewLoading}>
            {language === 'en' ? 'Asking AI…' : 'Consultando IA…'}
          </Text>
        ) : dayReview?.length ? (
          <View style={styles.reviewList}>
            {dayReview.map((item, index) => (
              <View key={`${item.label}-${index}`} style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>{item.label}</Text>
                <Text style={styles.reviewText}>{item.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.reviewEmpty}>
            {language === 'en'
              ? 'Ask the AI to validate if your meals look balanced.'
              : 'Pídele a la IA que valide si tus comidas están balanceadas.'}
          </Text>
        )}
      </Card>

      <Card style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.sectionTitle}>
            {language === 'en' ? 'Weekly AI review' : 'Revisión IA de la semana'}
          </Text>
          <Text style={styles.reviewHint}>
            {language === 'en'
              ? 'Start it from AI actions ↑'
              : 'Dispara la IA desde Acciones ↑'}
          </Text>
        </View>
        {weekReviewLoading ? (
          <Text style={styles.reviewLoading}>
            {language === 'en' ? 'Processing…' : 'Procesando…'}
          </Text>
        ) : weekReview?.length ? (
          <View>
            <TouchableOpacity
              style={styles.weekToggle}
              onPress={() => setShowWeekReview((prev) => !prev)}
            >
              <Text style={styles.weekToggleText}>
                {showWeekReview
                  ? language === 'en'
                    ? 'Hide summary'
                    : 'Ocultar resumen'
                  : language === 'en'
                  ? 'Show summary'
                  : 'Mostrar resumen'}
              </Text>
            </TouchableOpacity>
            {showWeekReview ? (
              <View style={styles.weekList}>
                {weekReview.map((item, index) => (
                  <Text key={`${item}-${index}`} style={styles.weekItem}>
                    {item}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.reviewEmpty}>
            {language === 'en'
              ? 'Generate a weekly recap to stay accountable.'
              : 'Genera un resumen semanal para mantener el enfoque.'}
          </Text>
        )}
      </Card>

      <TouchableOpacity
        style={[styles.completeButton, isDone && styles.completeButtonDone]}
        onPress={handleToggleDayComplete}
      >
        <Text style={styles.completeButtonText}>
          {isDone
            ? language === 'en'
              ? '✓ Day completed'
              : '✓ Día completado'
            : language === 'en'
            ? 'Mark day ✓'
            : 'Marcar día ✓'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: 120,
      gap: theme.spacing.md
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center'
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text
    },
    headerCard: {
      gap: theme.spacing.sm
    },
    greeting: {
      ...theme.typography.body,
      color: theme.colors.text
    },
    dayTitle: {
      ...theme.typography.h1,
      color: theme.colors.text
    },
    macrosRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    kcalText: {
      ...theme.typography.body,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    macrosList: {
      flexDirection: 'row',
      gap: theme.spacing.xs
    },
    macroBadge: {
      ...theme.typography.caption,
      color: theme.colors.text,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.sm
    },
    tipCard: {
      gap: theme.spacing.xs
    },
    tipText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      textAlign: 'center'
    },
    waterCard: {
      gap: theme.spacing.sm
    },
    waterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    waterTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    waterValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.text
    },
    progressLine: {
      height: 8,
      backgroundColor: theme.colors.bgSoft,
      borderRadius: theme.radius.full,
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.full
    },
    waterButtons: {
      flexDirection: 'row',
      gap: theme.spacing.sm
    },
    waterButton: {
      flex: 1,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing.sm,
      backgroundColor: 'rgba(56,189,248,0.2)',
      alignItems: 'center'
    },
    waterButtonText: {
      ...theme.typography.bodySmall,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    waterButtonGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    waterButtonTextGhost: {
      color: theme.colors.text
    },
    extrasCard: {
      gap: theme.spacing.sm
    },
    extrasHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm
    },
    extrasHeaderText: {
      flex: 1,
      gap: 4
    },
    extrasHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    extrasToggle: {
      ...theme.typography.h1,
      color: theme.colors.primary,
      lineHeight: 24
    },
    extrasList: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs
    },
    extraRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8
    },
    extraBullet: {
      color: theme.colors.primary,
      fontSize: 14,
      lineHeight: 20
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.colors.text
    },
    sectionDescription: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    extraText: {
      ...theme.typography.caption,
      color: theme.colors.text,
      flex: 1,
      lineHeight: 18
    },
    workoutCard: {
      gap: theme.spacing.sm
    },
    topMargin: {
      marginTop: theme.spacing.sm
    },
    workoutButtons: {
      flexDirection: 'row',
      gap: theme.spacing.sm
    },
    aiActionsCard: {
      gap: theme.spacing.sm
    },
    toolCard: {
      gap: theme.spacing.sm
    },
    aiButtons: {
      gap: theme.spacing.sm,
      flexDirection: 'column'
    },
    aiButton: {
      width: '100%'
    },
    mealList: {
      gap: theme.spacing.sm
    },
    reviewCard: {
      gap: theme.spacing.sm
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    },
    reviewHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    reviewLoading: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    reviewEmpty: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      fontStyle: 'italic'
    },
    reviewList: {
      gap: theme.spacing.sm
    },
    reviewItem: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      gap: theme.spacing.xs
    },
    reviewLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textTransform: 'uppercase'
    },
    reviewText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text
    },
    weekToggle: {
      alignSelf: 'flex-start'
    },
    weekToggleText: {
      ...theme.typography.bodySmall,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    weekList: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs
    },
    weekItem: {
      ...theme.typography.bodySmall,
      color: theme.colors.text
    },
    completeButton: {
      backgroundColor: 'rgba(34,197,94,0.25)',
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center'
    },
    completeButtonDone: {
      backgroundColor: 'rgba(34,197,94,0.45)'
    },
    completeButtonText: {
      ...theme.typography.body,
      color: '#fff',
      fontWeight: '600'
    }
  });

export default HomeScreen;

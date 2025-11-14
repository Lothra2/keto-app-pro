import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Switch
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import WeekSelector from '../../components/progress/WeekSelector';
import DayPills from '../../components/progress/DayPills';
import CalorieBar from '../../components/meals/CalorieBar';
import Card from '../../components/shared/Card';
import ScreenBanner from '../../components/shared/ScreenBanner';
import Button from '../../components/shared/Button';
import { exportWeekPlanPdf } from '../../utils/pdf';
import {
  getDayData,
  saveDayData,            // 👈 agregado
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
  const rawWaterGoal = Number(metrics?.waterGoal);
  const weeklyWaterGoal = Number.isFinite(rawWaterGoal) && rawWaterGoal > 0 ? rawWaterGoal : 2400;

  const [dayData, setDayData] = useState(null);
  const [mealStates, setMealStates] = useState(defaultMealState);
  const [calorieGoal, setCalorieGoal] = useState(1600);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [waterInfo, setWaterInfo] = useState({ goal: weeklyWaterGoal, ml: 0 });
  const [extras, setExtras] = useState([]);
  const [extrasExpanded, setExtrasExpanded] = useState(false);
  const [dayReview, setDayReview] = useState(null);
  const [weekReview, setWeekReview] = useState(null);
  const [showWeekReview, setShowWeekReview] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [weekReviewLoading, setWeekReviewLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [showFullDayReview, setShowFullDayReview] = useState(false);
  const [aiDayLoading, setAiDayLoading] = useState(false); // 👈 nuevo
  const [exportingPdf, setExportingPdf] = useState(false);

  const totalWeeks = Math.max(Math.ceil(derivedPlan.length / 7), 1);
  const safeWeek = Math.min(Math.max(currentWeek || 1, 1), totalWeeks);

  const computeConsumedFromDay = (mergedDay, mealsStateObj, fallbackGoal) => {
    const mealKeys = ['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena'];
    const dayKcal = mergedDay?.kcal ? Number(mergedDay.kcal) : fallbackGoal;
    const dist = {
      desayuno: 0.25,
      snackAM: 0.1,
      almuerzo: 0.35,
      snackPM: 0.1,
      cena: 0.2
    };

    let consumed = 0;
    mealKeys.forEach((key) => {
      if (!mealsStateObj[key]) return;
      const mealObj = mergedDay?.[key];
      const kcal = mealObj?.kcal
        ? Number(mealObj.kcal)
        : Math.round(dayKcal * (dist[key] || 0.2));
      consumed += kcal;
    });

    return consumed;
  };

  useEffect(() => {
    setWaterInfo((prev) => ({ ...prev, goal: weeklyWaterGoal || prev.goal || 2400 }));
  }, [weeklyWaterGoal]);

  const loadDayData = useCallback(async () => {
    const baseDay = derivedPlan[currentDay];

    if (!baseDay) {
      setDayData(null);
      setExtras([]);
      return;
    }

    try {
      const stored = await getDayData(currentDay);

      let merged;

      // si lo que está guardado es un día IA completo, lo respetamos
      if (stored && stored.isAI) {
        merged = { ...baseDay, ...stored };
      } else {
        merged = mergePlanDay(baseDay, stored || {});
      }

      // si había comidas sueltas guardadas, las pisamos
      if (stored && typeof stored === 'object') {
        if (stored.desayuno) merged.desayuno = stored.desayuno;
        if (stored.snackAM) merged.snackAM = stored.snackAM;
        if (stored.almuerzo) merged.almuerzo = stored.almuerzo;
        if (stored.snackPM) merged.snackPM = stored.snackPM;
        if (stored.cena) merged.cena = stored.cena;

        if (stored.kcal) merged.kcal = Number(stored.kcal);
        if (stored.macros) merged.macros = stored.macros;
      }

      // nombre del día
      merged.dia = getDayDisplayName({
        label: merged.dia,
        index: currentDay,
        language
      });

      // calorías guardadas
      const calState = await getCalorieState(
        currentDay,
        merged.kcal || baseDay.kcal || 1600
      );

      const mealsState = {
        ...defaultMealState,
        ...(calState.meals || {})
      };
      setMealStates(mealsState);

      const goal = calState.goal || merged.kcal || baseDay.kcal || 1600;
      setCalorieGoal(goal);

      const consumed = computeConsumedFromDay(merged, mealsState, goal);
      setCaloriesConsumed(consumed);

      // agua
      const water = await getWaterState(currentDay, weeklyWaterGoal);
      setWaterInfo({
        goal: water.goal || weeklyWaterGoal,
        ml: water.ml || 0
      });

      // día completado
      const done = await isDayCompleted(currentDay);
      setIsDone(done);

      // reviews
      const storedReview = await getDayReview(currentDay);
      setDayReview(normalizeDayReview(storedReview, language));

      const savedWeekReview = await getWeekReview(Math.floor(currentDay / 7) + 1);
      setWeekReview(normalizeWeekReview(savedWeekReview, language));

      // extras de IA
      const extractedExtras = collectExtrasFromAI(stored);
      setExtras(extractedExtras);
      setExtrasExpanded(false);

      // set final day
      setDayData(merged);
    } catch (error) {
      console.error('Error loading day data:', error);
    }
  }, [currentDay, derivedPlan, language, weeklyWaterGoal]);

  useEffect(() => {
    loadDayData();
  }, [loadDayData]);

  useFocusEffect(
    useCallback(() => {
      loadDayData();
    }, [loadDayData, currentDay])
  );

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
    if (dayData) {
      const consumed = computeConsumedFromDay(dayData, updatedMeals, calorieGoal);
      setCaloriesConsumed(consumed);
    } else {
      const consumed = calculateConsumedCalories(updatedMeals, calorieGoal);
      setCaloriesConsumed(consumed);
    }
    await saveCalorieState(currentDay, { goal: calorieGoal, meals: updatedMeals });
  };

  const handleAddWater = async (amount) => {
    await addWater(currentDay, amount, weeklyWaterGoal);
    const water = await getWaterState(currentDay, weeklyWaterGoal);
    setWaterInfo({
      goal: water.goal || weeklyWaterGoal,
      ml: water.ml || 0
    });
    notifyProgressUpdate();
  };

  const handleResetWater = async () => {
    await resetWater(currentDay, weeklyWaterGoal);
    const water = await getWaterState(currentDay, weeklyWaterGoal);
    setWaterInfo({
      goal: water.goal || weeklyWaterGoal,
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

  // 👇 ESTA es la nueva versión: genera las 5 comidas acá y guarda
  const handleGenerateFullDay = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to use AI.'
          : 'Agrega tus credenciales de Grok en ajustes para usar la IA.'
      );
      return;
    }

    const baseDay = derivedPlan[currentDay];
    if (!baseDay) return;

    setAiDayLoading(true);

    try {
      const dayKcal = baseDay.kcal || 1600;

      const dist = {
        desayuno: 0.3,
        snackAM: 0.1,
        almuerzo: 0.3,
        snackPM: 0.1,
        cena: 0.2
      };

      const mealKeys = ['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena'];

      // intentamos sacar preferencias del usuario si las tuviera
      const preferences = {
        like: user?.likeFoods || user?.like || '',
        dislike: user?.dislikeFoods || user?.dislike || ''
      };

      const generatedMeals = {};
      const usedNames = [];

      for (const key of mealKeys) {
        const targetKcal = Math.round(dayKcal * (dist[key] || 0.2));

        const meal = await aiService.generateMeal({
          mealType: key,
          kcal: targetKcal,
          language,
          preferences,
          credentials: apiCredentials,
          existingMeals: usedNames
        });

        generatedMeals[key] = meal;

        if (meal?.nombre) {
          usedNames.push(meal.nombre);
        }
      }

      const finalDay = {
        ...baseDay,
        ...generatedMeals,
        kcal: dayKcal,
        isAI: true
      };

      // guardamos el día IA
      await saveDayData(currentDay, finalDay);

      // reseteamos los checks de comidas para el día nuevo
      await saveCalorieState(currentDay, {
        goal: dayKcal,
        meals: {
          desayuno: false,
          snackAM: false,
          almuerzo: false,
          snackPM: false,
          cena: false
        }
      });

      // recargar pantalla
      await loadDayData();
    } catch (error) {
      console.error('Error generating full day with AI:', error);
      Alert.alert(
        language === 'en' ? 'AI error' : 'Error con IA',
        language === 'en'
          ? 'We could not generate the full day.'
          : 'No pudimos generar el día completo.'
      );
    } finally {
      setAiDayLoading(false);
    }
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
      setShowFullDayReview(true);
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
        let merged = mergePlanDay(base, stored || {});
        if (stored && typeof stored === 'object') {
          MEAL_KEYS.forEach((key) => {
            if (stored[key]) {
              merged[key] = stored[key];
            }
          });
          if (stored.kcal) {
            merged.kcal = Number(stored.kcal);
          }
          if (stored.macros) {
            merged.macros = stored.macros;
          }
        }
        weekDays.push(merged);
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

  const handleExportWeekPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);

    try {
      const result = await exportWeekPlanPdf({
        weekNumber: safeWeek,
        derivedPlan,
        language,
        waterGoal: weeklyWaterGoal
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDayData();
    setRefreshing(false);
  };

  const meals = useMemo(() => {
    if (!dayData) return [];

    const isAi = (mealObj) => {
      if (!mealObj || typeof mealObj !== 'object') return false;
      return (
        mealObj.isAI ||
        mealObj.aiGenerated ||
        mealObj.source === 'ai' ||
        mealObj.fromAI ||
        mealObj.tag === 'ai'
      );
    };

    const getKcal = (mealObj, mealKey) => {
      if (mealObj?.kcal) return Number(mealObj.kcal);
      const dayKcal = dayData?.kcal ? Number(dayData.kcal) : calorieGoal;
      const dist = {
        desayuno: 0.25,
        snackAM: 0.1,
        almuerzo: 0.35,
        snackPM: 0.1,
        cena: 0.2
      };
      return Math.round(dayKcal * (dist[mealKey] || 0.2));
    };

    return [
      {
        key: 'desayuno',
        title: language === 'en' ? 'Breakfast' : 'Desayuno',
        icon: '🍳',
        data: dayData.desayuno,
        isCompleted: mealStates.desayuno,
        onToggle: () => handleToggleMeal('desayuno'),
        onGenerateAI: () => handleGenerateAI('desayuno'),
        showAIButton: true,
        isAI: isAi(dayData.desayuno),
        kcal: getKcal(dayData.desayuno, 'desayuno')
      },
      {
        key: 'snackAM',
        title: language === 'en' ? 'Snack AM' : 'Snack AM',
        icon: '⏰',
        data: dayData.snackAM,
        isCompleted: mealStates.snackAM,
        onToggle: () => handleToggleMeal('snackAM'),
        showAIButton: false,
        isAI: isAi(dayData.snackAM),
        kcal: getKcal(dayData.snackAM, 'snackAM')
      },
      {
        key: 'almuerzo',
        title: language === 'en' ? 'Lunch' : 'Almuerzo',
        icon: '🥗',
        data: dayData.almuerzo,
        isCompleted: mealStates.almuerzo,
        onToggle: () => handleToggleMeal('almuerzo'),
        onGenerateAI: () => handleGenerateAI('almuerzo'),
        showAIButton: true,
        isAI: isAi(dayData.almuerzo),
        kcal: getKcal(dayData.almuerzo, 'almuerzo')
      },
      {
        key: 'snackPM',
        title: language === 'en' ? 'Snack PM' : 'Snack PM',
        icon: '🥜',
        data: dayData.snackPM,
        isCompleted: mealStates.snackPM,
        onToggle: () => handleToggleMeal('snackPM'),
        showAIButton: false,
        isAI: isAi(dayData.snackPM),
        kcal: getKcal(dayData.snackPM, 'snackPM')
      },
      {
        key: 'cena',
        title: language === 'en' ? 'Dinner' : 'Cena',
        icon: '🍖',
        data: dayData.cena,
        isCompleted: mealStates.cena,
        onToggle: () => handleToggleMeal('cena'),
        onGenerateAI: () => handleGenerateAI('cena'),
        showAIButton: true,
        isAI: isAi(dayData.cena),
        kcal: getKcal(dayData.cena, 'cena')
      }
    ];
  }, [dayData, mealStates, language, calorieGoal]);

  if (!dayData) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>
          {language === 'en' ? 'Loading…' : 'Cargando…'}
        </Text>
      </View>
    );
  }

  const greeting =
    language === 'en'
      ? `Hey ${user.name || 'there'}!`
      : `Hola ${user.name || 'ahí'}!`;

  const waterPercent = Math.min(100, Math.round((waterInfo.ml / (waterInfo.goal || 1)) * 100));
  const completedMealsCount = Object.values(mealStates).filter(Boolean).length;
  const totalMeals = Object.keys(mealStates).length;
  const macrosDisplay = {
    carbs: dynamicMacros?.carbs || dayData.macros?.carbs || '--',
    prot: dynamicMacros?.prot || dayData.macros?.prot || '--',
    fat: dynamicMacros?.fat || dayData.macros?.fat || '--'
  };
  const mealToggleTrack = {
    false: theme.mode === 'dark' ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.3)',
    true: theme.colors.primary
  };
  const mealToggleThumbOn = theme.colors.onPrimary;
  const mealToggleThumbOff = theme.colors.card;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      stickyHeaderIndices={[0]}
    >
      <View style={styles.stickyWrapper}>
        <View style={styles.topNavCard}>
          <WeekSelector currentWeek={safeWeek} onWeekChange={handleWeekChange} />
          <View style={styles.topSeparator} />
          <DayPills
            week={safeWeek}
            currentDay={currentDay}
            onDaySelect={setCurrentDay}
            derivedPlan={derivedPlan}
          />
        </View>
      </View>

      <ScreenBanner
        theme={theme}
        icon="🍽️"
        title={greeting}
        subtitle={dayData.dia}
        description={language === 'en' ? `Week ${safeWeek}` : `Semana ${safeWeek}`}
        badge={
          isDone
            ? language === 'en'
              ? 'Completed'
              : 'Completado'
            : language === 'en'
            ? 'In progress'
            : 'En progreso'
        }
        badgeTone={isDone ? 'success' : 'muted'}
        rightSlot={
          <TouchableOpacity
            style={[styles.bannerToggle, isDone && styles.bannerToggleActive]}
            onPress={handleToggleDayComplete}
          >
            <Text style={[styles.bannerToggleText, isDone && styles.bannerToggleTextActive]}>
              {isDone
                ? language === 'en'
                  ? 'Undo'
                  : 'Desmarcar'
                : language === 'en'
                ? 'Mark day'
                : 'Marcar día'}
            </Text>
          </TouchableOpacity>
        }
        footnote={
          language === 'en'
            ? 'Track meals, water and workouts to keep your day on point.'
            : 'Registra comidas, agua y entrenos para mantener tu día en ruta.'
        }
        style={styles.homeBanner}
      >
        <View style={styles.bannerStatsRow}>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatLabel}>
              {language === 'en' ? 'Daily calories' : 'Calorías diarias'}
            </Text>
            <Text style={styles.bannerStatValue}>{(dayData.kcal || calorieGoal)} kcal</Text>
          </View>
          <View style={styles.bannerMacros}>
            <View style={styles.bannerMacroChip}>
              <Text style={styles.bannerMacroLabel}>C</Text>
              <Text style={styles.bannerMacroValue}>{macrosDisplay.carbs}</Text>
            </View>
            <View style={styles.bannerMacroChip}>
              <Text style={styles.bannerMacroLabel}>P</Text>
              <Text style={styles.bannerMacroValue}>{macrosDisplay.prot}</Text>
            </View>
            <View style={styles.bannerMacroChip}>
              <Text style={styles.bannerMacroLabel}>G</Text>
              <Text style={styles.bannerMacroValue}>{macrosDisplay.fat}</Text>
            </View>
          </View>
        </View>
        <CalorieBar consumed={caloriesConsumed} goal={calorieGoal} variant="overlay" />
      </ScreenBanner>

      <View style={styles.quickRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>
            {language === 'en' ? 'Meals' : 'Comidas'}
          </Text>
          <Text style={styles.statValue}>
            {completedMealsCount}/{totalMeals}
          </Text>
          <Text style={styles.statHint}>
            {language === 'en' ? 'today' : 'hoy'}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>
            {language === 'en' ? 'Water' : 'Agua'}
          </Text>
          <Text style={styles.statValue}>{waterPercent}%</Text>
          <Text style={styles.statHint}>
            {waterInfo.ml}/{waterInfo.goal} ml
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>
            {language === 'en' ? 'Kcal used' : 'Kcal usadas'}
          </Text>
          <Text style={styles.statValue}>
            {Math.min(100, Math.round((caloriesConsumed / (calorieGoal || 1)) * 100))}%
          </Text>
          <Text style={styles.statHint}>
            {language === 'en' ? 'of goal' : 'del objetivo'}
          </Text>
      </View>
    </View>

    <Card style={styles.pdfCard}>
      <View style={styles.pdfHeader}>
        <Text style={styles.sectionTitle}>
          📄 {language === 'en' ? 'Weekly PDF' : 'PDF semanal'}
        </Text>
        <Text style={styles.pdfHint}>
          {language === 'en'
            ? 'Share all meals, macros and notes for this week.'
            : 'Comparte todas las comidas, macros y notas de esta semana.'}
        </Text>
      </View>
      <Button
        title={language === 'en' ? 'Share weekly PDF' : 'Compartir PDF semanal'}
        onPress={handleExportWeekPdf}
        loading={exportingPdf}
        disabled={exportingPdf}
        style={styles.pdfButton}
      />
      <Text style={styles.pdfFootnote}>
        {language === 'en'
          ? `Hydration goal: ${weeklyWaterGoal} ml`
          : `Meta de hidratación: ${weeklyWaterGoal} ml`}
      </Text>
    </Card>

    <Card style={styles.aiActionsCard}>
        <View style={styles.aiActionsHeader}>
          <Text style={styles.sectionTitle}>
            🤖 {language === 'en' ? 'AI actions' : 'Acciones IA'}
          </Text>
          <Text style={styles.aiActionsHint}>
            {language === 'en'
              ? 'Boost today with 1 tap'
              : 'Mejora tu día con un toque'}
          </Text>
        </View>
        <View style={styles.aiButtons}>
          <Button
            title={
              aiDayLoading
                ? language === 'en'
                  ? 'Generating...'
                  : 'Generando...'
                : language === 'en'
                ? 'Full day with AI'
                : 'Día completo con IA'
            }
            onPress={aiDayLoading ? undefined : handleGenerateFullDay}
            disabled={aiDayLoading}
            style={styles.aiButton}
          />
          <Button
            title={language === 'en' ? 'AI review of today' : 'Revisión IA del día'}
            variant="secondary"
            onPress={handleReviewDay}
            style={styles.aiButton}
          />
          <TouchableOpacity
            style={styles.ghostLink}
            onPress={handleGenerateWeekReview}
          >
            <Text style={styles.ghostLinkText}>
              {language === 'en' ? 'Weekly AI review' : 'Revisión IA semanal'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.tipCard}>
        <View style={styles.tipMessage}>
          <Text style={styles.tipIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipText} numberOfLines={2}>
              {tip}
            </Text>
            {motivation ? (
              <Text style={styles.tipBadgeText}>{motivation}</Text>
            ) : null}
          </View>
        </View>
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
        <Card style={styles.extrasCard} outlined>
          <TouchableOpacity
            style={styles.extrasHeaderRow}
            onPress={() => setExtrasExpanded((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={styles.extrasHeaderText}>
              <Text style={styles.sectionTitleSm}>
                {language === 'en' ? 'AI extras for today' : 'Extras IA para hoy'}
              </Text>
              <Text style={styles.extrasHint}>
                {language === 'en'
                  ? 'Reminders from AI meals'
                  : 'Recordatorios de tus comidas IA'}
              </Text>
            </View>
            <View style={styles.extrasCountPill}>
              <Text style={styles.extrasCountText}>
                {extrasExpanded ? '−' : `+${extras.length}`}
              </Text>
            </View>
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

      <View style={styles.mealsWrapper}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Today’s meals' : 'Comidas de hoy'}
        </Text>
        <Text style={styles.sectionSub}>
          {language === 'en'
            ? 'Tap to complete or ask AI'
            : 'Toca para completar o pedir IA'}
        </Text>
        <View style={styles.mealCards}>
          {meals.map((meal) => (
            <View
              key={meal.key}
              style={[
                styles.mealCard,
                meal.isCompleted && styles.mealCardDone
              ]}
            >
              <View style={styles.mealHeaderRow}>
                <View style={styles.mealIconWrap}>
                  <Text style={styles.mealIcon}>{meal.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.mealTitleRow}>
                    <Text style={styles.mealTitle}>{meal.title}</Text>
                    {meal.isAI ? (
                      <Text style={styles.mealAiPill}>
                        IA
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.mealKcal}>
                    {meal.kcal ? `${meal.kcal} kcal` : (language === 'en' ? 'No kcal' : 'Sin kcal')}
                  </Text>
                </View>
                <View style={styles.mealToggleWrap}>
                  <Switch
                    value={meal.isCompleted}
                    onValueChange={meal.onToggle}
                    trackColor={mealToggleTrack}
                    thumbColor={meal.isCompleted ? mealToggleThumbOn : mealToggleThumbOff}
                    ios_backgroundColor={mealToggleTrack.false}
                  />
                </View>
              </View>
              {meal.data?.qty ? (
                <Text style={styles.mealDesc} numberOfLines={2}>
                  {meal.data.qty}
                </Text>
              ) : null}
              <View style={styles.mealActions}>
                {meal.showAIButton ? (
                  <TouchableOpacity
                    style={styles.mealAIButton}
                    onPress={meal.onGenerateAI}
                  >
                    <Text style={styles.mealAIText}>
                      {language === 'en' ? 'AI for this' : 'IA para esto'}
                    </Text>
                  </TouchableOpacity>
                ) : <View style={{ flex: 1 }} />}
                <Text style={styles.mealStatusText}>
                  {meal.isCompleted
                    ? language === 'en'
                      ? 'Completed'
                      : 'Completada'
                    : language === 'en'
                    ? 'Pending'
                    : 'Pendiente'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Card style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.sectionTitle}>
            📋 {language === 'en' ? 'AI review of your day' : 'Revisión IA de tu día'}
          </Text>
          {!reviewLoading && dayReview?.length ? (
            <TouchableOpacity onPress={() => setShowFullDayReview((p) => !p)}>
              <Text style={styles.weekToggleText}>
                {showFullDayReview
                  ? language === 'en' ? 'Hide' : 'Ocultar'
                  : language === 'en' ? 'Show' : 'Mostrar'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {reviewLoading ? (
          <Text style={styles.reviewLoading}>
            {language === 'en' ? 'Asking AI…' : 'Consultando IA…'}
          </Text>
        ) : dayReview?.length ? (
          <View style={styles.reviewList}>
            {dayReview
              .slice(0, showFullDayReview ? dayReview.length : 1)
              .map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>{item.label}</Text>
                  <Text style={styles.reviewText}>{item.text}</Text>
                </View>
              ))}
          </View>
        ) : (
          <Text style={styles.reviewEmpty}>
            {language === 'en'
              ? 'Run AI above to get feedback.'
              : 'Lanza la IA arriba para ver comentarios.'}
          </Text>
        )}
      </Card>

      <Card style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.sectionTitle}>
            🗓 {language === 'en' ? 'Weekly AI review' : 'Revisión IA de la semana'}
          </Text>
          {!weekReviewLoading && weekReview?.length ? (
            <TouchableOpacity onPress={() => setShowWeekReview((prev) => !prev)}>
              <Text style={styles.weekToggleText}>
                {showWeekReview
                  ? language === 'en' ? 'Hide' : 'Ocultar'
                  : language === 'en' ? 'Show' : 'Mostrar'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {weekReviewLoading ? (
          <Text style={styles.reviewLoading}>
            {language === 'en' ? 'Processing…' : 'Procesando…'}
          </Text>
        ) : weekReview?.length ? (
          showWeekReview ? (
            <View style={styles.weekList}>
              {weekReview.map((item, index) => (
                <Text key={`${item}-${index}`} style={styles.weekItem}>
                  {item}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.reviewEmpty}>
              {language === 'en'
                ? 'Summary generated. Open to read it.'
                : 'Resumen generado. Ábrelo para leerlo.'}
            </Text>
          )
        ) : (
          <Text style={styles.reviewEmpty}>
            {language === 'en'
              ? 'Trigger weekly review from AI actions.'
              : 'Dispara el resumen semanal desde Acciones IA.'}
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
      paddingBottom: 120,
      gap: theme.spacing.md
    },
    stickyWrapper: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      backgroundColor: theme.colors.bg
    },
    topNavCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: 'rgba(226,232,240,0.02)',
      padding: theme.spacing.sm,
      gap: theme.spacing.sm
    },
    topSeparator: {
      height: 1,
      backgroundColor: 'rgba(226,232,240,0.03)',
      marginHorizontal: 4
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center'
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text
    },
    homeBanner: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6
    },
    bannerToggle: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(15,23,42,0.35)'
    },
    bannerToggleActive: {
      backgroundColor: 'rgba(34,197,94,0.3)'
    },
    bannerToggleText: {
      ...theme.typography.caption,
      color: 'rgba(248,250,252,0.9)',
      fontWeight: '600'
    },
    bannerToggleTextActive: {
      color: 'rgba(248,250,252,1)'
    },
    bannerStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.md
    },
    bannerStat: {
      flex: 1,
      gap: 4
    },
    bannerStatLabel: {
      ...theme.typography.caption,
      color: 'rgba(226,232,240,0.85)'
    },
    bannerStatValue: {
      ...theme.typography.h2,
      color: 'rgba(248,250,252,0.98)' 
    },
    bannerMacros: {
      flexDirection: 'row',
      gap: theme.spacing.sm
    },
    bannerMacroChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.radius.md,
      backgroundColor: 'rgba(15,23,42,0.25)',
      alignItems: 'center'
    },
    bannerMacroLabel: {
      ...theme.typography.caption,
      color: 'rgba(226,232,240,0.75)',
      fontWeight: '600'
    },
    bannerMacroValue: {
      ...theme.typography.body,
      color: 'rgba(248,250,252,0.95)',
      fontWeight: '600'
    },
    quickRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    statValue: {
      ...theme.typography.h2,
      color: theme.colors.text
    },
    statHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    pdfCard: {
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg
    },
    pdfHeader: {
      gap: 4
    },
    pdfHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    pdfButton: {
      marginTop: theme.spacing.sm
    },
    pdfFootnote: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center'
    },
    aiActionsCard: {
      gap: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      marginHorizontal: theme.spacing.lg
    },
    aiActionsHeader: {
      gap: 4
    },
    aiActionsHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    aiButtons: {
      gap: theme.spacing.sm
    },
    aiButton: {
      width: '100%'
    },
    ghostLink: {
      paddingVertical: 4,
      alignSelf: 'flex-end'
    },
    ghostLinkText: {
      ...theme.typography.caption,
      color: theme.colors.primary
    },
    tipCard: {
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      marginHorizontal: theme.spacing.lg
    },
    tipMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm
    },
    tipIcon: {
      fontSize: 20
    },
    tipText: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    tipBadgeText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      marginTop: 2
    },
    waterCard: {
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg
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
      backgroundColor: 'rgba(56,189,248,0.12)',
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
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg
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
    extrasCountPill: {
      minWidth: 40,
      height: 28,
      borderRadius: 999,
      backgroundColor: 'rgba(15,118,110,.2)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8
    },
    extrasCountText: {
      ...theme.typography.bodySmall,
      color: theme.colors.primary,
      fontWeight: '700'
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
    extraText: {
      ...theme.typography.caption,
      color: theme.colors.text,
      flex: 1,
      lineHeight: 18
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.colors.text
    },
    sectionTitleSm: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    sectionSub: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.sm
    },
    mealsWrapper: {
      marginHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm
    },
    mealCards: {
      gap: theme.spacing.sm
    },
    mealCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: 'rgba(226,232,240,0.02)'
    },
    mealCardDone: {
      borderColor: 'rgba(34,197,94,0.5)',
      backgroundColor: 'rgba(34,197,94,0.03)'
    },
    mealHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm
    },
    mealIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: 'rgba(15,118,110,0.15)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    mealIcon: {
      fontSize: 22
    },
    mealTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6
    },
    mealTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    mealAiPill: {
      ...theme.typography.caption,
      backgroundColor: 'rgba(14,165,233,0.1)',
      color: theme.colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999
    },
    mealKcal: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    mealToggleWrap: {
      marginLeft: theme.spacing.xs,
      alignSelf: 'flex-start',
      transform: [{ scale: 0.9 }]
    },
    mealDesc: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      lineHeight: 18
    },
    mealActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm
    },
    mealAIButton: {
      backgroundColor: 'rgba(14,165,233,.15)',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999
    },
    mealAIText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    mealStatusText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    reviewCard: {
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
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
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.cardSoft
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
      alignItems: 'center',
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.lg
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

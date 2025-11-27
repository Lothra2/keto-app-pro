import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { withAlpha } from '../../theme/utils';
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
  setDayCompleted,
  getCheatMeal,
  saveCheatMeal,
  clearCheatMeal,
  findCheatInWeek,
  getDayExtras,
  saveDayExtras
} from '../../storage/storage';
import { getDailyTip, getMotivationalMessage } from '../../data/tips';
import aiService from '../../api/aiService';
import {
  calculateConsumedCalories,
  calculateDynamicMacros,
  calculateDynamicDailyKcal,
  getMealDistribution
} from '../../utils/calculations';
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
    gender,
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
  const [cheatMeal, setCheatMeal] = useState(null);
  const [cheatForm, setCheatForm] = useState({ mealKey: 'cena', description: '', portion: '', kcal: '' });
  const [cheatConflict, setCheatConflict] = useState(null);
  const [cheatExpanded, setCheatExpanded] = useState(false);
  const [cheatEstimating, setCheatEstimating] = useState(false);
  const [cheatAiNote, setCheatAiNote] = useState('');
  const [cheatEstimatedByAI, setCheatEstimatedByAI] = useState(false);
  const [aiExtras, setAiExtras] = useState([]);
  const [extrasExpanded, setExtrasExpanded] = useState(false);
  const [extraIntakes, setExtraIntakes] = useState([]);
  const [extraForm, setExtraForm] = useState({ description: '', portion: '', kcal: '', note: '' });
  const [extraEstimating, setExtraEstimating] = useState(false);
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
  const summaryAnim = useRef(new Animated.Value(0)).current;
  const summaryTranslate = summaryAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  const totalDays = Array.isArray(derivedPlan) ? derivedPlan.length : 0;
  const totalWeeks = Math.max(Math.ceil(totalDays / 7), 1);
  const safeWeek = Math.min(Math.max(currentWeek || 1, 1), totalWeeks);

  const computeConsumedFromDay = (mergedDay, mealsStateObj, fallbackGoal, extrasKcal = 0) => {
    const mealKeys = ['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena'];
    const dayKcal = mergedDay?.kcal ? Number(mergedDay.kcal) : fallbackGoal;
    const dist = getMealDistribution(gender);

    let consumed = 0;
    mealKeys.forEach((key) => {
      if (!mealsStateObj[key]) return;
      const mealObj = mergedDay?.[key];
      const kcal = mealObj?.kcal
        ? Number(mealObj.kcal)
        : Math.round(dayKcal * (dist[key] || 0.2));
      consumed += kcal;
    });

    const normalizedExtras = Number(extrasKcal) || 0;
    consumed += Math.max(0, Math.round(normalizedExtras));

    return consumed;
  };

  useEffect(() => {
    setWaterInfo((prev) => ({ ...prev, goal: weeklyWaterGoal || prev.goal || 2400 }));
  }, [weeklyWaterGoal]);

  useEffect(() => {
    Animated.timing(summaryAnim, {
      toValue: 1,
      duration: 550,
      delay: 150,
      useNativeDriver: true,
    }).start();
  }, [summaryAnim]);

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
        language,
        startDate: user?.startDate
      });

      const cheat = await getCheatMeal(currentDay);
      setCheatMeal(cheat);
      setCheatAiNote(cheat?.note || '');
      setCheatEstimatedByAI(Boolean(cheat?.estimatedByAI));
      setCheatForm((prev) => ({
        ...prev,
        mealKey: cheat?.mealKey || prev.mealKey,
        description: cheat?.description || '',
        portion: cheat?.portion || '',
        kcal: cheat?.kcalEstimate ? String(cheat.kcalEstimate) : '',
      }));
      setCheatConflict(await findCheatInWeek(currentDay));
      setCheatExpanded(false);

      if (cheat?.mealKey) {
        const cheatEntry = {
          ...(merged?.[cheat.mealKey] || {}),
          nombre: language === 'en' ? 'Cheat meal' : 'Cheat meal',
          descripcion: cheat.description || merged?.[cheat.mealKey]?.descripcion || '',
          qty: cheat.portion || merged?.[cheat.mealKey]?.qty || '',
          kcal: cheat.kcalEstimate ? Number(cheat.kcalEstimate) : merged?.[cheat.mealKey]?.kcal,
          isCheat: true,
          estimatedByAI: Boolean(cheat?.estimatedByAI),
        };
        merged[cheat.mealKey] = cheatEntry;
      }

      const planKcal = merged.kcal || baseDay.kcal || 1600;
      const dynamicGoal = calculateDynamicDailyKcal({
        baseKcal: planKcal,
        gender,
        metrics,
        cheatKcal: cheat?.kcalEstimate || 0
      });

      const calState = await getCalorieState(
        currentDay,
        dynamicGoal
      );

      const mealsState = {
        ...defaultMealState,
        ...(calState.meals || {})
      };
      setMealStates(mealsState);

      const goal = calState.goal || dynamicGoal;
      const normalizedGoal = goal !== dynamicGoal ? dynamicGoal : goal;

      if (normalizedGoal !== calState.goal) {
        await saveCalorieState(currentDay, { ...calState, goal: normalizedGoal });
      }

      setCalorieGoal(normalizedGoal);

      const extrasKcal = storedExtras.reduce((sum, item) => sum + (Number(item.kcalEstimate) || 0), 0);
      const consumed = computeConsumedFromDay(merged, mealsState, normalizedGoal, extrasKcal);
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

      // extras de IA del plan
      const extractedExtras = collectExtrasFromAI(stored);
      setAiExtras(extractedExtras);
      setExtrasExpanded(false);

      // extras reales del usuario
      const storedExtras = await getDayExtras(currentDay);
      setExtraIntakes(storedExtras);

      // set final day
      setDayData({ ...merged, planKcal, dynamicKcal: dynamicGoal });
    } catch (error) {
      console.error('Error loading day data:', error);
    }
  }, [currentDay, derivedPlan, language, weeklyWaterGoal, user?.startDate, gender, metrics]);

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
    const extrasKcal = extraIntakes.reduce((sum, item) => sum + (Number(item.kcalEstimate) || 0), 0);
    if (dayData) {
      const consumed = computeConsumedFromDay(dayData, updatedMeals, calorieGoal, extrasKcal);
      setCaloriesConsumed(consumed);
    } else {
      const consumed = calculateConsumedCalories(updatedMeals, calorieGoal, gender, extrasKcal);
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

  const handleManualMeal = (mealKey) => {
    navigation.navigate('ManualMeal', {
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
      const cheat = await getCheatMeal(currentDay);
      const planKcal = baseDay.kcal || 1600;
      const dayKcal = calculateDynamicDailyKcal({
        baseKcal: planKcal,
        gender,
        metrics,
        cheatKcal: cheat?.kcalEstimate || 0
      });

      const dist = getMealDistribution(gender);

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
        kcal: planKcal,
        dynamicKcal: dayKcal,
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
      const endIdx = Math.min(safeWeek * 7, totalDays);
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
        gender,
        metrics,
        waterGoal: weeklyWaterGoal,
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDayData();
    setRefreshing(false);
  };

  const runCheatAiEstimation = useCallback(
    async (silent = false) => {
      if (!hasAiCheat) return null;

      if (!cheatForm.description.trim()) {
        if (!silent) {
          Alert.alert(
            language === 'en' ? 'Add a description' : 'Agrega una descripción',
            language === 'en'
              ? 'Tell us what you will eat so we can rebalance the day.'
              : 'Cuéntanos qué vas a comer para reequilibrar el día.'
          );
        }
        return null;
      }

      setCheatEstimating(true);
      try {
        const estimate = await aiService.estimateCheatCalories({
          mealKey: cheatForm.mealKey,
          description: cheatForm.description.trim(),
          portion: cheatForm.portion.trim(),
          language,
          credentials: apiCredentials,
          dayKcal: calorieGoal,
          consumedKcal: caloriesConsumed,
        });

        if (estimate?.kcalEstimate) {
          setCheatForm((prev) => ({ ...prev, kcal: String(estimate.kcalEstimate) }));
          setCheatAiNote(estimate.note || '');
          setCheatEstimatedByAI(true);
          if (!silent) {
            Alert.alert(
              language === 'en' ? 'Calories estimated' : 'Calorías estimadas',
              language === 'en'
                ? `We estimated ~${estimate.kcalEstimate} kcal for this cheat.`
                : `Estimamos ~${estimate.kcalEstimate} kcal para este cheat.`
            );
          }
        }

        return estimate;
      } catch (error) {
        console.error('Error estimating cheat kcal:', error);
        if (!silent) {
          Alert.alert(
            language === 'en' ? 'Could not estimate' : 'No se pudo estimar',
            language === 'en'
              ? 'Try again or enter the calories manually.'
              : 'Intenta otra vez o ingresa las calorías manualmente.'
          );
        }
        return null;
      } finally {
        setCheatEstimating(false);
      }
    },
    [
      apiCredentials,
      caloriesConsumed,
      calorieGoal,
      cheatForm.description,
      cheatForm.mealKey,
      cheatForm.portion,
      hasAiCheat,
      language,
    ]
  );

  const runExtraAiEstimation = useCallback(async () => {
    if (!apiCredentials?.user || !apiCredentials?.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to estimate calories.'
          : 'Agrega tus credenciales de Grok en ajustes para estimar calorías.'
      );
      return null;
    }

    if (!extraForm.description.trim()) {
      Alert.alert(
        language === 'en' ? 'Add what you ate' : 'Agrega lo que comiste',
        language === 'en'
          ? 'Describe your extra snack so we can estimate it.'
          : 'Describe el extra para poder estimarlo.'
      );
      return null;
    }

    setExtraEstimating(true);
    try {
      const estimate = await aiService.estimateExtraCalories({
        description: extraForm.description.trim(),
        portion: extraForm.portion.trim(),
        language,
        credentials: apiCredentials,
        dayKcal: calorieGoal,
        consumedKcal: caloriesConsumed,
      });

      if (estimate?.kcalEstimate) {
        setExtraForm((prev) => ({ ...prev, kcal: String(estimate.kcalEstimate), note: estimate.note || '' }));
        Alert.alert(
          language === 'en' ? 'Calories estimated' : 'Calorías estimadas',
          language === 'en'
            ? `We estimated ~${estimate.kcalEstimate} kcal for this extra.`
            : `Estimamos ~${estimate.kcalEstimate} kcal para este extra.`
        );
      }

      return estimate;
    } catch (error) {
      console.error('Error estimating extra kcal:', error);
      Alert.alert(
        language === 'en' ? 'Could not estimate' : 'No se pudo estimar',
        language === 'en'
          ? 'Try again or enter the calories manually.'
          : 'Intenta de nuevo o ingresa las calorías manualmente.'
      );
      return null;
    } finally {
      setExtraEstimating(false);
    }
  }, [apiCredentials, language, extraForm.description, extraForm.portion, calorieGoal, caloriesConsumed]);

  const handleSaveExtra = useCallback(async () => {
    const kcalNumber = Number(extraForm.kcal);
    if (!extraForm.description.trim()) {
      Alert.alert(
        language === 'en' ? 'Add what you ate' : 'Agrega lo que comiste',
        language === 'en'
          ? 'Tell us what you ate between meals.'
          : 'Cuéntanos qué comiste entre comidas.'
      );
      return;
    }

    if (!Number.isFinite(kcalNumber) || kcalNumber <= 0) {
      const aiResult = await runExtraAiEstimation();
      if (!aiResult?.kcalEstimate) return;
    }

    const payload = {
      id: `${Date.now()}`,
      description: extraForm.description.trim(),
      portion: extraForm.portion.trim(),
      kcalEstimate: Number(extraForm.kcal) || 0,
      note: extraForm.note || '',
      estimatedByAI: Boolean(extraForm.note),
    };

    const updated = [...extraIntakes, payload];
    setExtraIntakes(updated);
    await saveDayExtras(currentDay, updated);

    const extrasKcal = updated.reduce((sum, item) => sum + (Number(item.kcalEstimate) || 0), 0);
    const consumed = computeConsumedFromDay(dayData || derivedPlan[currentDay], mealStates, calorieGoal, extrasKcal);
    setCaloriesConsumed(consumed);
    setExtraForm({ description: '', portion: '', kcal: '', note: '' });
  }, [
    extraForm,
    runExtraAiEstimation,
    extraIntakes,
    currentDay,
    mealStates,
    calorieGoal,
    dayData,
    derivedPlan,
    language,
  ]);

  const handleRemoveExtra = useCallback(
    async (id) => {
      const filtered = extraIntakes.filter((item) => item.id !== id);
      setExtraIntakes(filtered);
      await saveDayExtras(currentDay, filtered);
      const extrasKcal = filtered.reduce((sum, item) => sum + (Number(item.kcalEstimate) || 0), 0);
      const consumed = computeConsumedFromDay(dayData || derivedPlan[currentDay], mealStates, calorieGoal, extrasKcal);
      setCaloriesConsumed(consumed);
    },
    [extraIntakes, currentDay, dayData, derivedPlan, mealStates, calorieGoal]
  );

  const handleSaveCheat = useCallback(async () => {
    let kcalNumber = Number(cheatForm.kcal);
    let note = cheatAiNote;
    const estimatedByAI = cheatEstimatedByAI || (hasAiCheat && Boolean(note));

    if (!cheatForm.description.trim()) {
      Alert.alert(
        language === 'en' ? 'Add a description' : 'Agrega una descripción',
        language === 'en'
          ? 'Tell us what you will eat so we can rebalance the day.'
          : 'Cuéntanos qué vas a comer para reequilibrar el día.'
      );
      return;
    }

    if (hasAiCheat && (!Number.isFinite(kcalNumber) || kcalNumber <= 0)) {
      const estimate = await runCheatAiEstimation(true);
      if (estimate?.kcalEstimate) {
        kcalNumber = estimate.kcalEstimate;
        note = estimate.note || note;
      }
    }

    if (!Number.isFinite(kcalNumber) || kcalNumber <= 0) {
      Alert.alert(
        language === 'en' ? 'Add calories' : 'Agrega calorías',
        language === 'en'
          ? 'Estimate the calories of your cheat so we can balance the plan.'
          : 'Estima las calorías de tu cheat para balancear el plan.'
      );
      return;
    }

    const payload = {
      ...cheatForm,
      kcalEstimate: Math.round(kcalNumber),
      description: cheatForm.description.trim(),
      portion: cheatForm.portion.trim(),
      estimatedByAI,
      note,
    };

    await saveCheatMeal(currentDay, payload);
    await loadDayData();
    setCheatExpanded(false);

    Alert.alert(
      language === 'en' ? 'Cheat saved' : 'Cheat guardado',
      language === 'en'
        ? 'We rebalanced your day with the new cheat.'
        : 'Reequilibramos tu día con el nuevo cheat.'
    );
  }, [
    cheatAiNote,
    cheatEstimatedByAI,
    cheatForm,
    currentDay,
    hasAiCheat,
    language,
    loadDayData,
    runCheatAiEstimation,
  ]);

  const handleClearCheat = useCallback(async () => {
    await clearCheatMeal(currentDay);
    setCheatForm((prev) => ({ ...prev, description: '', portion: '', kcal: '' }));
    setCheatAiNote('');
    setCheatEstimatedByAI(false);
    setCheatExpanded(false);
    await loadDayData();
  }, [currentDay, loadDayData]);

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
      const dist = getMealDistribution(gender);
      return Math.round(dayKcal * (dist[mealKey] || 0.2));
    };

    return [
      {
        key: 'desayuno',
        title: language === 'en' ? 'Breakfast' : 'Desayuno',
        icon: '🍳',
        data: dayData.desayuno,
        isCheat: cheatMeal?.mealKey === 'desayuno',
        cheatSummary: cheatMeal?.mealKey === 'desayuno' ? cheatMeal?.description : '',
        cheatPortion: cheatMeal?.mealKey === 'desayuno' ? cheatMeal?.portion : '',
        isCompleted: mealStates.desayuno,
        onToggle: () => handleToggleMeal('desayuno'),
        onGenerateAI: () => handleGenerateAI('desayuno'),
        onManualLog: () => handleManualMeal('desayuno'),
        showAIButton: true,
        isAI: isAi(dayData.desayuno),
        kcal: getKcal(dayData.desayuno, 'desayuno')
      },
      {
        key: 'snackAM',
        title: language === 'en' ? 'Snack AM' : 'Snack AM',
        icon: '⏰',
        data: dayData.snackAM,
        isCheat: cheatMeal?.mealKey === 'snackAM',
        cheatSummary: cheatMeal?.mealKey === 'snackAM' ? cheatMeal?.description : '',
        cheatPortion: cheatMeal?.mealKey === 'snackAM' ? cheatMeal?.portion : '',
        isCompleted: mealStates.snackAM,
        onToggle: () => handleToggleMeal('snackAM'),
        onManualLog: () => handleManualMeal('snackAM'),
        showAIButton: false,
        isAI: isAi(dayData.snackAM),
        kcal: getKcal(dayData.snackAM, 'snackAM')
      },
      {
        key: 'almuerzo',
        title: language === 'en' ? 'Lunch' : 'Almuerzo',
        icon: '🥗',
        data: dayData.almuerzo,
        isCheat: cheatMeal?.mealKey === 'almuerzo',
        cheatSummary: cheatMeal?.mealKey === 'almuerzo' ? cheatMeal?.description : '',
        cheatPortion: cheatMeal?.mealKey === 'almuerzo' ? cheatMeal?.portion : '',
        isCompleted: mealStates.almuerzo,
        onToggle: () => handleToggleMeal('almuerzo'),
        onGenerateAI: () => handleGenerateAI('almuerzo'),
        onManualLog: () => handleManualMeal('almuerzo'),
        showAIButton: true,
        isAI: isAi(dayData.almuerzo),
        kcal: getKcal(dayData.almuerzo, 'almuerzo')
      },
      {
        key: 'snackPM',
        title: language === 'en' ? 'Snack PM' : 'Snack PM',
        icon: '🥜',
        data: dayData.snackPM,
        isCheat: cheatMeal?.mealKey === 'snackPM',
        cheatSummary: cheatMeal?.mealKey === 'snackPM' ? cheatMeal?.description : '',
        cheatPortion: cheatMeal?.mealKey === 'snackPM' ? cheatMeal?.portion : '',
        isCompleted: mealStates.snackPM,
        onToggle: () => handleToggleMeal('snackPM'),
        onManualLog: () => handleManualMeal('snackPM'),
        showAIButton: false,
        isAI: isAi(dayData.snackPM),
        kcal: getKcal(dayData.snackPM, 'snackPM')
      },
      {
        key: 'cena',
        title: language === 'en' ? 'Dinner' : 'Cena',
        icon: '🍖',
        data: dayData.cena,
        isCheat: cheatMeal?.mealKey === 'cena',
        cheatSummary: cheatMeal?.mealKey === 'cena' ? cheatMeal?.description : '',
        cheatPortion: cheatMeal?.mealKey === 'cena' ? cheatMeal?.portion : '',
        isCompleted: mealStates.cena,
        onToggle: () => handleToggleMeal('cena'),
        onGenerateAI: () => handleGenerateAI('cena'),
        onManualLog: () => handleManualMeal('cena'),
        showAIButton: true,
        isAI: isAi(dayData.cena),
        kcal: getKcal(dayData.cena, 'cena')
      }
    ];
  }, [calorieGoal, cheatMeal, dayData, gender, mealStates, language]);

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
  const hasAiCheat = Boolean(apiCredentials.user && apiCredentials.pass);
  const mealToggleTrack = {
    false: theme.mode === 'dark' ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.3)',
    true: theme.colors.primary
  };
  const mealToggleThumbOn = theme.colors.onPrimary;
  const mealToggleThumbOff = theme.colors.card;

  const cheatLabel = cheatMeal
    ? `${meals.find((m) => m.key === cheatMeal.mealKey)?.title || cheatMeal.mealKey} · ${
        cheatMeal.kcalEstimate || '--'
      } kcal${cheatMeal?.portion ? ` · ${cheatMeal.portion}` : ''}`
    : language === 'en'
    ? 'Plan your weekly cheat and we balance the day.'
    : 'Agenda tu cheat semanal y balanceamos el día.';
  const cheatDescription = cheatMeal?.description || '';
  const cheatOrigin = cheatMeal
    ? cheatMeal.estimatedByAI
      ? language === 'en'
        ? 'AI kcal'
        : 'Kcal IA'
      : language === 'en'
      ? 'Manual kcal'
      : 'Calorías manuales'
    : null;

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

      <Animated.View
        style={{
          opacity: summaryAnim,
          transform: [{ translateY: summaryTranslate }],
        }}
      >
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
              <Text style={styles.bannerStatValue}>{(dayData.dynamicKcal || calorieGoal || dayData.kcal)} kcal</Text>
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
      </Animated.View>

    <Card style={styles.tipCard}>
      <LinearGradient
        colors={
          theme.mode === 'dark'
            ? ['rgba(14,165,233,0.22)', 'rgba(8,47,73,0.9)']
            : ['rgba(56,189,248,0.18)', 'rgba(191,219,254,0.22)']
        }
        style={styles.tipGradient}
      >
        <View style={styles.tipMessage}>
          <View style={styles.tipIconWrap}>
            <Text style={styles.tipIcon}>💡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipLabel}>
              {language === 'en' ? 'Daily reminder' : 'Recordatorio del día'}
            </Text>
            <Text style={styles.tipText} numberOfLines={2}>
              {tip}
            </Text>
            {motivation ? (
              <View style={styles.tipBadge}>
                <Text style={styles.tipBadgeText}>{motivation}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>
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

      <Card style={styles.extraCard} outlined>
        <View style={styles.extraHeaderRow}>
          <View style={styles.extraHeaderText}>
            <Text style={styles.sectionTitleSm}>
              {language === 'en' ? 'Extras fuera de plan' : 'Extras fuera del plan'}
            </Text>
            <Text style={styles.extraHint}>
              {language === 'en'
                ? 'Usa esto para snacks o proteína extra entre meals. Se suman a tus calorías.'
                : 'Úsalo para snacks o proteína extra entre meals. Se suman a tus calorías.'}
            </Text>
          </View>
          {extraIntakes.length ? (
            <View style={styles.extraCountPill}>
              <Text style={styles.extraCountText}>
                {extraIntakes.reduce((sum, item) => sum + (Number(item.kcalEstimate) || 0), 0)} kcal
              </Text>
            </View>
          ) : null}
        </View>

        <TextInput
          style={styles.extraInput}
          placeholder={language === 'en' ? '¿Qué comiste?' : '¿Qué comiste?'}
          placeholderTextColor={theme.colors.textMuted}
          value={extraForm.description}
          onChangeText={(text) => setExtraForm((prev) => ({ ...prev, description: text }))}
          multiline
        />

        <TextInput
          style={[styles.extraInput, styles.extraInputAlt]}
          placeholder={language === 'en' ? 'Porción / cantidad' : 'Porción / cantidad'}
          placeholderTextColor={theme.colors.textMuted}
          value={extraForm.portion}
          onChangeText={(text) => setExtraForm((prev) => ({ ...prev, portion: text }))}
        />

        <View style={styles.extraKcalRow}>
          <Text style={styles.extraKcalLabel}>{language === 'en' ? 'Kcal estimadas' : 'Kcal estimadas'}</Text>
          <TextInput
            style={styles.extraKcalInput}
            keyboardType="numeric"
            value={extraForm.kcal}
            onChangeText={(text) => setExtraForm((prev) => ({ ...prev, kcal: text }))}
            placeholder="120"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>

        <View style={styles.extraActionsRow}>
          <Button
            label={extraEstimating ? (language === 'en' ? 'Estimating...' : 'Estimando...') : 'IA kcal'}
            onPress={runExtraAiEstimation}
            style={[styles.extraButton, extraEstimating && styles.extraButtonDisabled]}
            disabled={extraEstimating}
          />
          <Button label={language === 'en' ? 'Guardar extra' : 'Guardar extra'} onPress={handleSaveExtra} style={styles.extraButton} />
        </View>

        {extraIntakes.length ? (
          <View style={styles.extraList}>
            {extraIntakes.map((item) => (
              <View key={item.id} style={styles.extraItemRow}>
                <View style={styles.extraItemText}>
                  <Text style={styles.extraItemTitle}>{item.description}</Text>
                  {item.portion ? <Text style={styles.extraItemMeta}>{item.portion}</Text> : null}
                  {item.note ? <Text style={styles.extraItemNote}>{item.note}</Text> : null}
                </View>
                <View style={styles.extraItemActions}>
                  <Text style={styles.extraItemKcal}>{item.kcalEstimate} kcal</Text>
                  <TouchableOpacity onPress={() => handleRemoveExtra(item.id)} style={styles.extraItemRemove}>
                    <Text style={styles.extraItemRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {aiExtras.length ? (
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
                {extrasExpanded ? '−' : `+${aiExtras.length}`}
              </Text>
            </View>
          </TouchableOpacity>
          {extrasExpanded ? (
            <View style={styles.extrasList}>
              {aiExtras.map((item, index) => (
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
            <React.Fragment key={meal.key}>
              <View
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
                      {meal.isCheat ? (
                        <Text style={styles.mealCheatPill}>Cheat</Text>
                      ) : null}
                      {meal.isAI ? (
                        <Text style={styles.mealAiPill}>
                          IA
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.mealKcal}>
                      {meal.kcal
                        ? `${meal.kcal} kcal`
                        : language === 'en'
                        ? 'No kcal'
                        : 'Sin kcal'}
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
                {meal.isCheat && (meal.cheatSummary || meal.cheatPortion) ? (
                  <View style={styles.mealCheatNoteRow}>
                    {meal.cheatPortion ? (
                      <Text style={styles.mealCheatPortion}>{meal.cheatPortion}</Text>
                    ) : null}
                    {meal.cheatSummary ? (
                      <Text style={styles.mealCheatText} numberOfLines={2}>
                        {meal.cheatSummary}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.mealActions}>
                  <View style={styles.mealActionButtons}>
                    <TouchableOpacity
                      style={styles.mealManualButton}
                      onPress={meal.onManualLog}
                    >
                      <Text style={styles.mealManualText}>
                        {language === 'en' ? 'Log manually' : 'Registrar manual'}
                      </Text>
                    </TouchableOpacity>
                    {meal.showAIButton ? (
                      <TouchableOpacity
                        style={styles.mealAIButton}
                        onPress={meal.onGenerateAI}
                      >
                        <Text style={styles.mealAIText}>
                          {language === 'en' ? 'AI for this' : 'IA para esto'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
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
              {meal.key === 'cena' ? (
                <Card style={styles.aiActionsCard}>
                  <View style={styles.aiActionsHeader}>
                    <Text style={styles.sectionTitle}>
                      🤖 {language === 'en' ? 'AI actions' : 'Acciones IA'}
                    </Text>
                    <Text style={styles.aiActionsHint}>
                      {language === 'en'
                        ? 'Review or regenerate your meals'
                        : 'Revisa o regenera tus comidas'}
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
                          ? 'Generate meals with AI'
                          : 'Generar comidas con IA'
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
              ) : null}
            </React.Fragment>
          ))}
        </View>
      </View>

      <Card style={styles.cheatCard}>
        <View style={styles.cheatHeaderRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.sectionTitle}>🍕 {language === 'en' ? 'Cheat meal' : 'Cheat meal'}</Text>
            <Text style={styles.cheatLabel}>{cheatLabel}</Text>
            <Text style={styles.cheatHint} numberOfLines={2}>
              {cheatDescription
                ? cheatDescription
                : language === 'en'
                ? 'Reserve 1 cheat this week. We rebalance kcal for that meal.'
                : 'Reserva 1 cheat esta semana. Rebalanceamos las kcal de esa comida.'}
            </Text>
            {cheatConflict && cheatConflict.dayIndex !== currentDay ? (
              <Text style={styles.cheatWarning}>
                {language === 'en'
                  ? `Already planned on day ${cheatConflict.dayIndex + 1}.`
                  : `Ya programado en el día ${cheatConflict.dayIndex + 1}.`}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => setCheatExpanded((prev) => !prev)}
            style={[styles.cheatBadgeButton, cheatExpanded && styles.cheatBadgeButtonActive]}
          >
            <Text style={styles.cheatBadgeButtonText}>
              {cheatExpanded
                ? language === 'en'
                  ? 'Close'
                  : 'Cerrar'
                : cheatMeal
                ? language === 'en'
                  ? 'Edit'
                  : 'Editar'
                : language === 'en'
                ? 'Add'
                : 'Agregar'}
            </Text>
          </TouchableOpacity>
        </View>

        {cheatMeal ? (
          <View style={styles.cheatStatusRow}>
            <Text style={styles.cheatPill}>{language === 'en' ? 'Active cheat' : 'Cheat activo'}</Text>
            {cheatOrigin ? <Text style={styles.cheatMeta}>{cheatOrigin}</Text> : null}
          </View>
        ) : null}

        {cheatExpanded ? (
          <View style={styles.cheatFormArea}>
            <Text style={styles.cheatSubLabel}>
              {language === 'en'
                ? 'Which meal do you want to replace?'
                : '¿Qué comida quieres reemplazar?'}
            </Text>
            <View style={styles.cheatChips}>
              {meals.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.cheatChip, cheatForm.mealKey === m.key && styles.cheatChipActive]}
                  onPress={() => setCheatForm((prev) => ({ ...prev, mealKey: m.key }))}
                >
                  <Text style={[styles.cheatChipText, cheatForm.mealKey === m.key && styles.cheatChipTextActive]}>
                    {m.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.cheatInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder={language === 'en' ? 'What will you eat?' : '¿Qué vas a comer?'}
              placeholderTextColor={theme.colors.textMuted}
              value={cheatForm.description}
              onChangeText={(text) => setCheatForm((prev) => ({ ...prev, description: text }))}
              multiline
            />

            <TextInput
              style={[styles.cheatInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder={language === 'en' ? 'Portion or quantity' : 'Porción o cantidad'}
              placeholderTextColor={theme.colors.textMuted}
              value={cheatForm.portion}
              onChangeText={(text) => setCheatForm((prev) => ({ ...prev, portion: text }))}
            />

            <View style={styles.cheatKcalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cheatKcalLabel}>
                  {language === 'en' ? 'Estimated kcal' : 'Kcal estimadas'}
                </Text>
                <TextInput
                  style={[styles.cheatKcalInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
                  keyboardType="numeric"
                  value={cheatForm.kcal}
                  onChangeText={(text) => setCheatForm((prev) => ({ ...prev, kcal: text }))}
                  placeholder="450"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
              {hasAiCheat ? (
                <TouchableOpacity
                  style={[styles.cheatSmallButton, cheatEstimating && styles.cheatSmallButtonDisabled]}
                  onPress={() => runCheatAiEstimation(false)}
                  disabled={cheatEstimating}
                >
                  <Text style={styles.cheatSmallButtonText}>
                    {cheatEstimating
                      ? language === 'en'
                        ? 'Estimating…'
                        : 'Estimando…'
                      : language === 'en'
                      ? 'AI estimate'
                      : 'Estimación IA'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.cheatManualBox}>
                  <Text style={styles.cheatManualText}>
                    {language === 'en'
                      ? 'Enter the calories manually'
                      : 'Ingresa las calorías manualmente'}
                  </Text>
                </View>
              )}
            </View>

            {cheatAiNote ? <Text style={styles.cheatNote}>{cheatAiNote}</Text> : null}

            {cheatConflict && cheatConflict.dayIndex !== currentDay ? (
              <Text style={styles.cheatWarning}>
                {language === 'en'
                  ? `Already planned on day ${cheatConflict.dayIndex + 1}.`
                  : `Ya programado en el día ${cheatConflict.dayIndex + 1}.`}
              </Text>
            ) : null}

            <View style={styles.cheatActions}>
              <TouchableOpacity style={styles.cheatButton} onPress={handleSaveCheat}>
                <Text style={styles.cheatButtonText}>
                  {cheatMeal
                    ? language === 'en'
                      ? 'Update cheat'
                      : 'Actualizar cheat'
                    : language === 'en'
                    ? 'Save cheat'
                    : 'Guardar cheat'}
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
                ? 'We replace that meal and add ~60% of the cheat kcal into your goal.'
                : 'Reemplazamos esa comida y sumamos ~60% de las kcal del cheat a tu meta.'}
            </Text>
          </View>
        ) : null}
      </Card>

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
          showFullDayReview ? (
            <View style={styles.reviewList}>
              {dayReview.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>{item.label}</Text>
                  <Text style={styles.reviewText}>{item.text}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.reviewCollapsed}>
              {language === 'en'
                ? 'Tap “Show” to open today’s full AI review.'
                : 'Toca “Mostrar” para abrir la revisión completa de hoy.'}
            </Text>
          )
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
                <View key={`${item}-${index}`} style={styles.weekItemBox}>
                  <Text style={styles.weekItem}>{item}</Text>
                </View>
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
      paddingBottom: 140,
      gap: theme.spacing.lg
    },
    stickyWrapper: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      backgroundColor: theme.colors.bg
    },
    topNavCard: {
      backgroundColor: withAlpha(theme.colors.glassBg, 0.9),
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    topSeparator: {
      height: 1,
      backgroundColor: withAlpha(theme.colors.glassBorder, 0.6),
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
      shadowColor: theme.colors.glow,
      shadowOpacity: 0.35,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
      elevation: 10
    },
    bannerToggle: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(15,23,42,0.35)'
    },
    bannerToggleActive: {
      backgroundColor: withAlpha(theme.colors.success, 0.3)
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
      gap: theme.spacing.lg
    },
    bannerStat: {
      flex: 1,
      gap: theme.spacing.xs
    },
    bannerStatLabel: {
      ...theme.typography.caption,
      color: 'rgba(226,232,240,0.85)'
    },
    bannerStatValue: {
      ...theme.typography.h1,
      color: 'rgba(248,250,252,0.98)'
    },
    bannerMacros: {
      flexDirection: 'row',
      gap: theme.spacing.sm
    },
    bannerMacroChip: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 12,
      elevation: 6
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
      gap: theme.spacing.md,
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md
    },
    statCard: {
      flex: 1,
      backgroundColor: withAlpha(theme.colors.glassBg, 0.9),
      borderRadius: theme.radius.lg,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      letterSpacing: 0.2
    },
    statValue: {
      ...theme.typography.h2,
      color: theme.colors.text,
      fontWeight: '800'
    },
    statHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 2
    },
    cheatCard: {
      marginHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm
    },
    cheatHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm
    },
    cheatLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 2
    },
    cheatHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      lineHeight: 18
    },
    cheatBadgeButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft
    },
    cheatBadgeButtonActive: {
      backgroundColor: theme.colors.primarySoft,
      borderColor: theme.colors.primary
    },
    cheatBadgeButtonText: {
      ...theme.typography.caption,
      color: theme.colors.text,
      fontWeight: '700'
    },
    cheatStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs
    },
    cheatPill: {
      ...theme.typography.caption,
      backgroundColor: withAlpha(theme.colors.accent, 0.18),
      color: theme.colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      fontWeight: '700',
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.accent, 0.5)
    },
    cheatMeta: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    cheatChips: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      flexWrap: 'wrap'
    },
    cheatChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft
    },
    cheatChipActive: {
      backgroundColor: theme.colors.primarySoft,
      borderColor: theme.colors.primary
    },
    cheatChipText: {
      ...theme.typography.caption,
      color: theme.colors.text
    },
    cheatChipTextActive: {
      color: theme.colors.primary,
      fontWeight: '700'
    },
    cheatInput: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      minHeight: 52,
      backgroundColor: theme.colors.cardSoft
    },
    cheatFormArea: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm
    },
    cheatSubLabel: {
      ...theme.typography.caption,
      color: theme.colors.text,
      fontWeight: '700'
    },
    cheatKcalRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.sm
    },
    cheatKcalLabel: {
      ...theme.typography.caption,
      color: theme.colors.text
    },
    cheatKcalInput: {
      minWidth: 96,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.cardSoft,
      textAlign: 'center'
    },
    cheatSmallButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      minWidth: 120,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch'
    },
    cheatSmallButtonDisabled: {
      opacity: 0.7
    },
    cheatSmallButtonText: {
      ...theme.typography.caption,
      color: theme.colors.onPrimary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.3
    },
    cheatManualBox: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      flex: 1,
      marginLeft: theme.spacing.sm
    },
    cheatManualText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    cheatWarning: {
      ...theme.typography.caption,
      color: theme.colors.warning
    },
    cheatActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      flexWrap: 'wrap'
    },
    cheatButton: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      borderRadius: theme.radius.md,
      alignItems: 'center'
    },
    cheatButtonText: {
      ...theme.typography.button,
      color: theme.colors.onPrimary,
      fontWeight: '700'
    },
    cheatGhost: {
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    cheatGhostText: {
      color: theme.colors.text
    },
    cheatNote: {
      ...theme.typography.caption,
      color: theme.colors.text,
      fontStyle: 'italic'
    },
    cheatFootnote: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      lineHeight: 18
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
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.xs,
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
      marginTop: theme.spacing.sm
    },
    aiActionsHeader: {
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    aiActionsHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      lineHeight: 18
    },
    aiButtons: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs
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
      marginHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? 'rgba(56,189,248,0.3)' : 'rgba(56,189,248,0.22)'
    },
    tipGradient: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg
    },
    tipMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md
    },
    tipIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.mode === 'dark' ? 'rgba(14,165,233,0.25)' : 'rgba(14,165,233,0.18)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    tipIcon: {
      fontSize: 24
    },
    tipLabel: {
      ...theme.typography.caption,
      color: theme.mode === 'dark' ? 'rgba(224,242,254,0.85)' : 'rgba(8,47,73,0.7)',
      textTransform: 'uppercase',
      letterSpacing: 0.8
    },
    tipText: {
      ...theme.typography.body,
      color: theme.mode === 'dark' ? '#f8fafc' : theme.colors.text,
      fontWeight: '600'
    },
    tipBadge: {
      marginTop: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: withAlpha(theme.colors.success, theme.mode === 'dark' ? 0.28 : 0.18)
    },
    tipBadgeText: {
      ...theme.typography.caption,
      color: theme.colors.success,
      fontWeight: '600'
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
      overflow: 'hidden',
      marginBottom: theme.spacing.sm,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.full
    },
    waterButtons: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    waterButton: {
      flex: 1,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing.sm,
      backgroundColor: `${theme.colors.accent}1f`,
      borderWidth: 1,
      borderColor: `${theme.colors.accent}40`,
      alignItems: 'center'
    },
    waterButtonText: {
      ...theme.typography.bodySmall,
      color: theme.colors.accent,
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
    extraCard: {
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg,
      borderColor: `${theme.colors.primary}40`,
    },
    extraHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    extraHeaderText: {
      flex: 1,
      gap: 4,
    },
    extraHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    extraCountPill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      backgroundColor: `${theme.colors.primary}15`,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}50`,
    },
    extraCountText: {
      ...theme.typography.bodySmall,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    extraInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      minHeight: 52,
      color: theme.colors.text,
      backgroundColor: theme.colors.cardSoft,
    },
    extraInputAlt: {
      minHeight: 44,
    },
    extraKcalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    extraKcalLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
    },
    extraKcalInput: {
      width: 90,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      paddingVertical: 6,
      paddingHorizontal: 10,
      color: theme.colors.text,
      backgroundColor: theme.colors.cardSoft,
      textAlign: 'center',
    },
    extraActionsRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    extraButton: {
      flex: 1,
    },
    extraButtonDisabled: {
      opacity: 0.7,
    },
    extraList: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    extraItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.cardSoft,
    },
    extraItemText: {
      flex: 1,
      gap: 2,
    },
    extraItemTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '700',
    },
    extraItemMeta: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    extraItemNote: {
      ...theme.typography.caption,
      color: theme.colors.primary,
    },
    extraItemActions: {
      alignItems: 'flex-end',
      gap: 6,
    },
    extraItemKcal: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '700',
    },
    extraItemRemove: {
      padding: 6,
    },
    extraItemRemoveText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
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
      backgroundColor: `${theme.colors.accent}20`,
      borderWidth: 1,
      borderColor: `${theme.colors.accent}60`,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8
    },
    extrasCountText: {
      ...theme.typography.bodySmall,
      color: theme.colors.accent,
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
      borderColor: withAlpha(theme.colors.border, 0.6)
    },
    mealCardDone: {
      borderColor: withAlpha(theme.colors.success, 0.55),
      backgroundColor: withAlpha(theme.colors.success, 0.08)
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
      backgroundColor: withAlpha(theme.colors.primary, 0.16),
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
      backgroundColor: `${theme.colors.accent}26`,
      color: theme.colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999
    },
    mealCheatPill: {
      ...theme.typography.caption,
      backgroundColor: 'rgba(248,113,113,0.12)',
      color: theme.colors.warning,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      fontWeight: '700'
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
    mealCheatNoteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    mealCheatPortion: {
      ...theme.typography.caption,
      color: theme.colors.text,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mealCheatText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      flex: 1,
      lineHeight: 16,
    },
    mealActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm
    },
    mealActionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    mealManualButton: {
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 }
    },
    mealManualText: {
      ...theme.typography.caption,
      color: theme.colors.text,
      fontWeight: '700'
    },
    mealAIButton: {
      backgroundColor: `${theme.colors.accent}26`,
      borderWidth: 1,
      borderColor: `${theme.colors.accent}50`,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999
    },
    mealAIText: {
      ...theme.typography.caption,
      color: theme.colors.accent,
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
    reviewCollapsed: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      fontStyle: 'italic'
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
    weekItemBox: {
      backgroundColor: `${theme.colors.accent}12`,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      borderWidth: 1,
      borderColor: `${theme.colors.accent}40`
    },
    weekItem: {
      ...theme.typography.bodySmall,
      color: theme.colors.text
    },
    completeButton: {
      backgroundColor: withAlpha(theme.colors.success, 0.25),
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.lg
    },
    completeButtonDone: {
      backgroundColor: withAlpha(theme.colors.success, 0.45)
    },
    completeButtonText: {
      ...theme.typography.body,
      color: '#fff',
      fontWeight: '600'
    }
  });

export default HomeScreen;

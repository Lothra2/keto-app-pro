import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import {
  getProgressData,
  saveProgressData,
  getCompletedDaysCount,
  getWaterState,
  getCalorieState
} from '../../storage/storage';
import {
  estimateBodyFat,
  calculateBMR,
  calculateBMI,
  getBMICategory,
  calculateConsumedCalories
} from '../../utils/calculations';
import storage, { KEYS } from '../../storage/storage';
import MultiMetricChart from '../../components/progress/MultiMetricChart';
import { getDayDisplayName, getDayTag } from '../../utils/labels';

const ProgressScreen = () => {
  const {
    theme: themeMode,
    language,
    derivedPlan,
    gender,
    progressVersion
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [completedDays, setCompletedDays] = useState(0);
  const [showBaseDataModal, setShowBaseDataModal] = useState(false);
  
  const [height, setHeight] = useState('');
  const [startWeight, setStartWeight] = useState('');
  const [age, setAge] = useState('');
  const [hasBaseData, setHasBaseData] = useState(false);

  const [bodyFat, setBodyFat] = useState(null);
  const [bmr, setBmr] = useState(null);
  const [bmi, setBmi] = useState(null);
  const [bmiCategory, setBmiCategory] = useState(null);

  const [progressByDay, setProgressByDay] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);

  const [dayForm, setDayForm] = useState({
    peso: '',
    cintura: '',
    energia: '',
    exkcal: '',
    notas: ''
  });

  const [hydration, setHydration] = useState({ daysWithWater: 0, totalMl: 0 });
  const [exerciseSummary, setExerciseSummary] = useState({ daysLogged: 0, totalKcal: 0 });

  const planLength = derivedPlan.length;
  const heroGradientColors = theme.mode === 'dark'
    ? ['rgba(15,118,110,0.85)', 'rgba(15,23,42,0.95)']
    : ['rgba(20,184,166,0.92)', theme.colors.primary];

  const averageWater = useMemo(() => {
    if (!planLength || !hydration.totalMl) return null;
    return Math.round(hydration.totalMl / planLength);
  }, [hydration.totalMl, planLength]);

  const heroStats = useMemo(() => {
    const stats = [];
    const totalDays = planLength || 0;
    const completedValue = totalDays ? `${completedDays}` : '0';
    const completedCaption = totalDays
      ? language === 'en'
        ? `of ${totalDays} days`
        : `de ${totalDays} días`
      : language === 'en'
      ? 'Log your first day'
      : 'Registra tu primer día';

    stats.push({
      key: 'progress',
      label: language === 'en' ? 'Completed' : 'Completados',
      value: completedValue,
      caption: completedCaption
    });

    if (bodyFat) {
      stats.push({
        key: 'bodyFat',
        label: language === 'en' ? 'Body fat' : '% grasa',
        value: `${Number(bodyFat).toFixed(1)}%`,
        caption: language === 'en' ? 'Estimated today' : 'Estimado actual'
      });
    } else if (bmi) {
      stats.push({
        key: 'bmi',
        label: 'BMI',
        value: Number(bmi).toFixed(1),
        caption: bmiCategory || (language === 'en' ? 'Body mass index' : 'Índice de masa')
      });
    } else if (hasBaseData && startWeight) {
      stats.push({
        key: 'startWeight',
        label: language === 'en' ? 'Start weight' : 'Peso inicial',
        value: `${startWeight} kg`,
        caption: language === 'en' ? 'Baseline' : 'Desde inicio'
      });
    } else {
      stats.push({
        key: 'hydrationDays',
        label: language === 'en' ? 'Hydration' : 'Hidratación',
        value: `${hydration.daysWithWater}`,
        caption: language === 'en' ? 'Days on target' : 'Días en meta'
      });
    }

    if (exerciseSummary.totalKcal) {
      stats.push({
        key: 'burn',
        label: language === 'en' ? 'Workout burn' : 'Calorías entreno',
        value: `${exerciseSummary.totalKcal} kcal`,
        caption: language === 'en' ? 'Total logged' : 'Total registradas'
      });
    } else if (averageWater) {
      stats.push({
        key: 'avgWater',
        label: language === 'en' ? 'Avg water' : 'Agua promedio',
        value: `${averageWater} ml`,
        caption: language === 'en' ? 'per day' : 'por día'
      });
    } else if (bmr) {
      stats.push({
        key: 'bmr',
        label: 'BMR',
        value: `${Math.round(bmr)} kcal`,
        caption: language === 'en' ? 'Resting burn' : 'Quema en reposo'
      });
    } else {
      const adherence = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;
      stats.push({
        key: 'consistency',
        label: language === 'en' ? 'Consistency' : 'Consistencia',
        value: `${Math.max(0, adherence)}%`,
        caption: language === 'en' ? 'of plan logged' : 'del plan registrado'
      });
    }

    return stats.slice(0, 3);
  }, [
    averageWater,
    bmi,
    bmiCategory,
    bodyFat,
    bmr,
    completedDays,
    exerciseSummary.totalKcal,
    hasBaseData,
    hydration.daysWithWater,
    language,
    planLength,
    startWeight
  ]);
  const heroTitle = language === 'en' ? '📈 Progress overview' : '📈 Resumen de progreso';
  const heroSubtitle = language === 'en'
    ? 'Keep logging your check-ins to unlock more insights.'
    : 'Sigue registrando tus avances para desbloquear más insights.';

  const calculateStats = useCallback(
    (h, w, a) => {
      const heightNumber = Number(h);
      const weightNumber = Number(w);
      const ageNumber = Number(a);

      if (!heightNumber || !weightNumber || !ageNumber) {
        setBodyFat(null);
        setBmr(null);
        setBmi(null);
        setBmiCategory(null);
        return;
      }

      const bf = estimateBodyFat(heightNumber, weightNumber, ageNumber, gender);
      const bmrVal = calculateBMR(heightNumber, weightNumber, ageNumber, gender !== 'female');
      const bmiVal = calculateBMI(heightNumber, weightNumber);
      const category = getBMICategory(bmiVal, language);

      setBodyFat(bf);
      setBmr(bmrVal);
      setBmi(bmiVal);
      setBmiCategory(category);
    },
    [gender, language]
  );

  const loadAllProgress = useCallback(async (baseMetrics = {}) => {
    const data = [];
    const baseHeight = Number(baseMetrics.height || height);
    const baseAge = Number(baseMetrics.age || age);
    let daysWithExercise = 0;
    let totalExerciseKcal = 0;

    for (let i = 0; i < derivedPlan.length; i++) {
      const dayProgress = await getProgressData(i);
      const water = await getWaterState(i);
      const calorieState = await getCalorieState(i, derivedPlan[i]?.kcal || 1600);
      const hasProgress = Object.keys(dayProgress).length > 0;
      const hasWater = water.ml > 0;
      const mealsState = calorieState.meals || {};
      const consumedCalories = calculateConsumedCalories(mealsState, calorieState.goal || derivedPlan[i]?.kcal || 1600);
      const hasCalories = consumedCalories > 0;

      if (!hasProgress && !hasWater && !hasCalories) {
        continue;
      }

      const pesoNumber = dayProgress.peso ? Number(dayProgress.peso) : null;
      const energiaNumber = dayProgress.energia ? Number(dayProgress.energia) : null;
      const computedBodyFat =
        baseHeight && baseAge && pesoNumber
          ? estimateBodyFat(baseHeight, pesoNumber, baseAge, gender)
          : null;
      const burnedKcal = dayProgress.exkcal ? Number(dayProgress.exkcal) : 0;

      if (burnedKcal > 0) {
        daysWithExercise += 1;
        totalExerciseKcal += burnedKcal;
      }

      data.push({
        dayIndex: i,
        displayName: getDayDisplayName({ label: derivedPlan[i]?.dia, index: i, language }),
        ...dayProgress,
        pesoNumber,
        energiaNumber,
        bodyFat: computedBodyFat,
        water: water.ml,
        waterGoal: water.goal,
        calGoal: calorieState.goal || derivedPlan[i]?.kcal || 1600,
        calConsumed: consumedCalories,
        burnedKcal
      });
    }

    setProgressByDay(data);
    setExerciseSummary({
      daysLogged: daysWithExercise,
      totalKcal: Math.round(totalExerciseKcal)
    });
  }, [age, derivedPlan, gender, height, language]);

  const hydrationStats = useCallback(async () => {
    let daysWithWater = 0;
    let totalMl = 0;

    for (let i = 0; i < derivedPlan.length; i++) {
      const water = await getWaterState(i);
      totalMl += water.ml;
      if (water.ml >= water.goal * 0.8) {
        daysWithWater++;
      }
    }

    return { daysWithWater, totalMl };
  }, [derivedPlan]);

  useEffect(() => {
    let isActive = true;
    hydrationStats().then((summary) => {
      if (isActive) {
        setHydration(summary);
      }
    });

    return () => {
      isActive = false;
    };
  }, [hydrationStats, progressVersion]);

  const loadData = useCallback(async () => {
    const completed = await getCompletedDaysCount(derivedPlan.length);
    setCompletedDays(completed);

    const h = await storage.get(KEYS.HEIGHT, '');
    const w = await storage.get(KEYS.START_WEIGHT, '');
    const a = await storage.get(KEYS.AGE, '');

    if (h && w && a) {
      setHeight(h);
      setStartWeight(w);
      setAge(a);
      setHasBaseData(true);
      calculateStats(h, w, a);
    }

    await loadAllProgress({ height: h, age: a });
    const hydraStats = await hydrationStats();
    setHydration(hydraStats);
  }, [derivedPlan.length, loadAllProgress, hydrationStats, calculateStats, progressVersion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSaveBaseData = async () => {
    if (height && startWeight && age) {
      await storage.set(KEYS.HEIGHT, height);
      await storage.set(KEYS.START_WEIGHT, startWeight);
      await storage.set(KEYS.AGE, age);
      
      setHasBaseData(true);
      calculateStats(height, startWeight, age);
      setShowBaseDataModal(false);
    }
  };

  const handleOpenDayModal = (dayIndex) => {
    setSelectedDay(dayIndex);
    loadDayData(dayIndex);
    setShowDayModal(true);
  };

  const loadDayData = async (dayIndex) => {
    const data = await getProgressData(dayIndex);
    setDayForm({
      peso: data.peso || '',
      cintura: data.cintura || '',
      energia: data.energia || '',
      exkcal: data.exkcal || '',
      notas: data.notas || ''
    });
  };

  const handleSaveDayProgress = async () => {
    if (selectedDay !== null) {
      await saveProgressData(selectedDay, dayForm);
      setShowDayModal(false);
      await loadAllProgress({ height, age });

      if (height && startWeight && age) {
        calculateStats(height, startWeight, age);
      }
    }
  };

  const baseHeightNumber = Number(height);
  const baseAgeNumber = Number(age);

  const initialBodyFat = useMemo(() => {
    if (!startWeight || !baseHeightNumber || !baseAgeNumber) {
      return null;
    }

    return estimateBodyFat(baseHeightNumber, Number(startWeight), baseAgeNumber, gender);
  }, [startWeight, baseHeightNumber, baseAgeNumber, gender]);

  const chartPoints = useMemo(() => {
    const points = [];

    if (startWeight) {
      points.push({
        label: language === 'en' ? 'Start' : 'Inicio',
        weight: Number(startWeight),
        energy: null,
        bodyFat: initialBodyFat
      });
    }

    progressByDay.forEach((entry) => {
      const label = getDayTag(entry.dayIndex, language);
      points.push({
        label,
        displayName: entry.displayName || getDayDisplayName({
          label: derivedPlan[entry.dayIndex]?.dia,
          index: entry.dayIndex,
          language
        }),
        weight:
          entry.pesoNumber !== null && entry.pesoNumber !== undefined
            ? entry.pesoNumber
            : entry.peso
            ? Number(entry.peso)
            : null,
        energy:
          entry.energiaNumber !== null && entry.energiaNumber !== undefined
            ? entry.energiaNumber
            : entry.energia
            ? Number(entry.energia)
            : null,
        bodyFat: entry.bodyFat !== null && entry.bodyFat !== undefined ? entry.bodyFat : null
      });
    });

    return points.filter(
      (point) => point.weight !== null || point.energy !== null || point.bodyFat !== null
    );
  }, [progressByDay, startWeight, language, initialBodyFat, derivedPlan]);

  const metricConfig = useMemo(
    () => [
      {
        key: 'weight',
        label: language === 'en' ? 'Weight (kg)' : 'Peso (kg)',
        color: theme.colors.primary,
        formatter: (value) => `${value.toFixed(1)} kg`,
        chartType: 'bar'
      },
      {
        key: 'bodyFat',
        label: language === 'en' ? 'Body fat %' : '% de grasa',
        color: '#f97316',
        formatter: (value) => `${value.toFixed(1)} %`
      },
      {
        key: 'energy',
        label: language === 'en' ? 'Energy (1-10)' : 'Energía (1-10)',
        color: '#a855f7',
        formatter: (value) => `${value.toFixed(1)}/10`
      }
    ],
    [language, theme.colors.primary]
  );

  const hydrationHistory = useMemo(
    () =>
      progressByDay
        .map((entry) => ({
          label: getDayTag(entry.dayIndex, language),
          water: entry.water || 0,
          goal: entry.waterGoal || 2400
        }))
        .filter((item) => item.water > 0),
    [progressByDay, language]
  );

  const exerciseHistory = useMemo(() => {
    return progressByDay
      .filter((entry) => entry.burnedKcal && entry.burnedKcal > 0)
      .map((entry) => ({
        label: getDayTag(entry.dayIndex, language),
        kcal: Math.round(entry.burnedKcal),
        name:
          entry.displayName ||
          getDayDisplayName({
            label: derivedPlan[entry.dayIndex]?.dia,
            index: entry.dayIndex,
            language
          })
      }));
  }, [progressByDay, language, derivedPlan]);

  const exerciseHistory = useMemo(() => {
    return progressByDay
      .filter((entry) => entry.burnedKcal && entry.burnedKcal > 0)
      .map((entry) => ({
        label: getDayTag(entry.dayIndex, language),
        kcal: Math.round(entry.burnedKcal),
        name:
          entry.displayName ||
          getDayDisplayName({
            label: derivedPlan[entry.dayIndex]?.dia,
            index: entry.dayIndex,
            language
          })
      }));
  }, [progressByDay, language, derivedPlan]);

  const calorieHistory = useMemo(
    () =>
      progressByDay
        .filter((entry) => entry.calGoal)
        .map((entry) => {
          const goal = entry.calGoal || derivedPlan[entry.dayIndex]?.kcal || 1600;
          const consumed = entry.calConsumed || 0;
          return {
            label: getDayTag(entry.dayIndex, language),
            name: entry.displayName || getDayDisplayName({
              label: derivedPlan[entry.dayIndex]?.dia,
              index: entry.dayIndex,
              language
            }),
            goal,
            consumed,
            percent: goal ? Math.round((consumed / goal) * 100) : 0
          };
        }),
    [progressByDay, language, derivedPlan]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={heroGradientColors}
        style={styles.heroCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
        </View>
        <View style={styles.heroStatsRow}>
          {heroStats.map((stat) => (
            <View key={stat.key} style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stat.value}</Text>
              <Text style={styles.heroStatLabel}>{stat.label}</Text>
              {stat.caption ? (
                <Text style={styles.heroStatCaption}>{stat.caption}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Base Data */}
      {hasBaseData ? (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>
                {language === 'en' ? 'Base data' : 'Datos base'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {language === 'en'
                  ? 'Your plan calculations always respect these values.'
                  : 'Tus cálculos del plan siempre usan estos valores base.'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sectionAction}
              onPress={() => setShowBaseDataModal(true)}
            >
              <Text style={styles.sectionActionText}>
                {language === 'en' ? 'Edit' : 'Editar'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Height' : 'Estatura'}</Text>
              <Text style={styles.statValue}>{height} cm</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Start' : 'Peso Inicial'}</Text>
              <Text style={styles.statValue}>{startWeight} kg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Age' : 'Edad'}</Text>
              <Text style={styles.statValue}>{age}</Text>
            </View>
          </View>
          
          {bodyFat && (
            <View style={styles.calculatedStats}>
              <Text style={styles.calculatedStat}>
                {language === 'en' ? 'Body Fat' : '% Grasa'}: {bodyFat}%
              </Text>
              <Text style={styles.calculatedStat}>BMR: {bmr} kcal/día</Text>
              <Text style={styles.calculatedStat}>BMI: {bmi} ({bmiCategory})</Text>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addBaseDataButton}
          onPress={() => setShowBaseDataModal(true)}
        >
          <Text style={styles.addBaseDataText}>
            {language === 'en' 
              ? '+ Add base data (height, weight, age)'
              : '+ Agregar datos base (estatura, peso, edad)'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Gráfica de progreso */}
      {chartPoints.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? 'Wellness trends' : 'Tendencias de bienestar'}
          </Text>
          <MultiMetricChart
            data={chartPoints}
            metrics={metricConfig}
            theme={theme}
            language={language}
          />
          <Text style={styles.chartCaption}>
            {language === 'en'
              ? 'Each line is scaled to its own range so you can quickly spot trends in weight, body fat and energy.'
              : 'Cada línea se escala a su propio rango para resaltar tendencias de peso, % de grasa y energía.'}
          </Text>
        </View>
      )}

      {/* Hydration */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {language === 'en' ? '💧 Hydration' : '💧 Hidratación'}
        </Text>
        <Text style={styles.statText}>
          {language === 'en' 
            ? `Days with goal: ${hydration.daysWithWater} / ${derivedPlan.length}`
            : `Días con meta: ${hydration.daysWithWater} / ${derivedPlan.length}`}
        </Text>
        <Text style={styles.statText}>
          {language === 'en'
            ? `Total water: ${hydration.totalMl} ml`
            : `Agua total: ${hydration.totalMl} ml`}
        </Text>
      </View>

      {hydrationHistory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? 'Daily hydration trend' : 'Tendencia de hidratación diaria'}
          </Text>
          <View style={styles.hydrationBars}>
            {hydrationHistory.map((item) => {
              const percent = Math.min(100, Math.round((item.water / item.goal) * 100));
              return (
                <View key={item.label} style={styles.hydrationBarItem}>
                  <View style={styles.hydrationBarTrack}>
                    <View
                      style={[
                        styles.hydrationBarFill,
                        {
                          height: `${Math.max(8, percent)}%`,
                          backgroundColor:
                            percent >= 100
                              ? 'rgba(34,197,94,0.75)'
                              : 'rgba(56,189,248,0.75)'
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.hydrationLabel}>{item.label}</Text>
                  <Text style={styles.hydrationValue}>{item.water} ml</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {exerciseSummary.daysLogged > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? '🔥 Activity impact' : '🔥 Impacto de actividad'}
          </Text>
          <Text style={styles.statText}>
            {language === 'en'
              ? `${exerciseSummary.daysLogged} active days logged`
              : `${exerciseSummary.daysLogged} días con actividad registrada`}
          </Text>
          <Text style={styles.statText}>
            {language === 'en'
              ? `${exerciseSummary.totalKcal} kcal burned in total`
              : `${exerciseSummary.totalKcal} kcal quemadas en total`}
          </Text>
          {exerciseSummary.daysLogged ? (
            <Text style={styles.statHighlight}>
              {language === 'en'
                ? `${Math.round(exerciseSummary.totalKcal / exerciseSummary.daysLogged)} kcal average on active days`
                : `${Math.round(exerciseSummary.totalKcal / exerciseSummary.daysLogged)} kcal promedio en días activos`}
            </Text>
          ) : null}
        </View>
      )}

      {exerciseHistory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? 'Daily workout burn' : 'Quema diaria de entreno'}
          </Text>
          <View style={styles.exerciseBars}>
            {(() => {
              const maxBurn = Math.max(...exerciseHistory.map((item) => item.kcal), 1);
              return exerciseHistory.map((item) => {
                const heightPercent = Math.max(10, Math.round((item.kcal / maxBurn) * 100));
                return (
                  <View key={item.label} style={styles.exerciseBarItem}>
                    <View style={styles.exerciseBarTrack}>
                      <View
                        style={[
                          styles.exerciseBarFill,
                          {
                            height: `${heightPercent}%`
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.exerciseLabel}>{item.label}</Text>
                    <Text style={styles.exerciseValue}>{item.kcal} kcal</Text>
                  </View>
                );
              });
            })()}
          </View>
          <Text style={styles.exerciseCaption}>
            {language === 'en'
              ? 'Log your training calories to compare effort across the week.'
              : 'Registra las calorías de tus entrenos para comparar el esfuerzo en la semana.'}
          </Text>
        </View>
      )}

      {calorieHistory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? 'Calorie adherence trend' : 'Tendencia de calorías'}
        </Text>
        <View style={styles.calorieList}>
          {calorieHistory.map((item) => {
            const clampedPercent = Math.min(140, Math.max(item.percent, 0));
            const withinTarget = item.percent >= 90 && item.percent <= 110;
            const below = item.percent < 90;
            const statusText = withinTarget
              ? language === 'en'
                ? 'On target'
                : 'En meta'
              : below
              ? language === 'en'
                ? 'Below target'
                : 'Bajo la meta'
              : language === 'en'
              ? 'Over target'
              : 'Sobre la meta';
            const fillColor = withinTarget
              ? 'rgba(34,197,94,0.7)'
              : below
              ? 'rgba(56,189,248,0.75)'
              : 'rgba(248,113,113,0.8)';

            return (
              <View key={item.label} style={styles.calorieRow}>
                <View style={styles.calorieHeader}>
                  <Text style={styles.calorieLabel}>{item.name || item.label}</Text>
                  <Text style={styles.calorieMeta}>
                    {item.consumed} / {item.goal} kcal
                  </Text>
                </View>
                <View style={styles.calorieBarTrack}>
                  <View
                    style={[
                      styles.calorieBarFill,
                      {
                        width: `${clampedPercent}%`,
                        backgroundColor: fillColor
                      }
                    ]}
                  />
                  <View style={styles.calorieTargetMarker} />
                </View>
                <Text style={styles.calorieStatus}>{statusText}</Text>
              </View>
            );
          })}
        </View>
      </View>
    )}

    {/* Daily Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Daily Progress' : 'Progreso Diario'}
        </Text>
        {derivedPlan.map((day, index) => {
          const hasData = progressByDay.find(p => p.dayIndex === index);
          const dayName = getDayDisplayName({ label: day.dia, index, language });
          const weightValue = hasData
            ? typeof hasData.pesoNumber === 'number' && !Number.isNaN(hasData.pesoNumber)
              ? hasData.pesoNumber
              : hasData.peso
              ? Number(hasData.peso)
              : null
            : null;
          const energyValue = hasData
            ? typeof hasData.energiaNumber === 'number' && !Number.isNaN(hasData.energiaNumber)
              ? hasData.energiaNumber
              : hasData.energia
              ? Number(hasData.energia)
              : null
            : null;
          const bodyFatValue =
            hasData && typeof hasData.bodyFat === 'number' ? hasData.bodyFat : null;
          const waterValue = hasData && typeof hasData.water === 'number' ? hasData.water : null;
          const calorieValue = hasData && typeof hasData.calConsumed === 'number' ? hasData.calConsumed : null;
          const calorieGoal = hasData && typeof hasData.calGoal === 'number' ? hasData.calGoal : null;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayCard, hasData && styles.dayCardWithData]}
              onPress={() => handleOpenDayModal(index)}
            >
              <Text style={styles.dayTitle}>{dayName}</Text>
              {hasData ? (
                <View style={styles.dayMetricsRow}>
                  {weightValue !== null && !Number.isNaN(weightValue) ? (
                    <Text style={styles.dayMetric}>⚖️ {weightValue.toFixed(1)} kg</Text>
                  ) : null}
                  {bodyFatValue !== null && !Number.isNaN(bodyFatValue) ? (
                    <Text style={styles.dayMetric}>🔥 {bodyFatValue.toFixed(1)} %</Text>
                  ) : null}
                  {energyValue !== null && !Number.isNaN(energyValue) ? (
                    <Text style={styles.dayMetric}>⚡ {energyValue.toFixed(1)}/10</Text>
                  ) : null}
                  {waterValue ? (
                    <Text style={styles.dayMetric}>💧 {waterValue} ml</Text>
                  ) : null}
                  {calorieValue && calorieGoal ? (
                    <Text style={styles.dayMetric}>
                      🍽️ {calorieValue}/{calorieGoal}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.dayDataEmpty}>
                  {language === 'en' ? 'Tap to add data' : 'Toca para agregar'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modals */}
      <Modal visible={showBaseDataModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {language === 'en' ? 'Base Data' : 'Datos Base'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Height (cm)' : 'Estatura (cm)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={height}
              onChangeText={setHeight}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Weight (kg)' : 'Peso (kg)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={startWeight}
              onChangeText={setStartWeight}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Age' : 'Edad'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowBaseDataModal(false)}
              >
                <Text style={styles.modalButtonText}>
                  {language === 'en' ? 'Cancel' : 'Cancelar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveBaseData}>
                <Text style={styles.modalButtonText}>
                  {language === 'en' ? 'Save' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedDay !== null && derivedPlan[selectedDay]?.dia}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Weight (kg)' : 'Peso (kg)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={dayForm.peso}
              onChangeText={(text) => setDayForm({...dayForm, peso: text})}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Waist (cm)' : 'Cintura (cm)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={dayForm.cintura}
              onChangeText={(text) => setDayForm({...dayForm, cintura: text})}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Energy (1-10)' : 'Energía (1-10)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={dayForm.energia}
              onChangeText={(text) => setDayForm({...dayForm, energia: text})}
            />
            <TextInput
              style={styles.input}
              placeholder={
                language === 'en'
                  ? 'Workout calories burned'
                  : 'Kcal quemadas en ejercicio'
              }
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={dayForm.exkcal}
              onChangeText={(text) => setDayForm({...dayForm, exkcal: text})}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={language === 'en' ? 'Notes' : 'Notas'}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
              value={dayForm.notas}
              onChangeText={(text) => setDayForm({...dayForm, notas: text})}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowDayModal(false)}
              >
                <Text style={styles.modalButtonText}>
                  {language === 'en' ? 'Cancel' : 'Cancelar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveDayProgress}>
                <Text style={styles.modalButtonText}>
                  {language === 'en' ? 'Save' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const getStyles = (theme) => {
  const borderColor = theme.mode === 'dark' ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)';
  const baseCardShadow = {
    shadowColor: theme.mode === 'dark' ? '#000' : '#0f172a',
    shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: theme.mode === 'dark' ? 8 : 5
  };
  const heroShadow = {
    shadowColor: theme.mode === 'dark' ? '#000' : '#0f172a',
    shadowOpacity: theme.mode === 'dark' ? 0.45 : 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: theme.mode === 'dark' ? 10 : 7
  };
  const heroStatBg = theme.mode === 'dark' ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.18)';
  const sectionActionBg = theme.mode === 'dark' ? 'rgba(15,118,110,0.35)' : theme.colors.primarySoft;
  const sectionActionText = theme.mode === 'dark' ? '#d1fae5' : theme.colors.primary;
  const calculatedBg = theme.mode === 'dark' ? 'rgba(15,118,110,0.12)' : 'rgba(20,184,166,0.12)';
  const trackBg = theme.colors.bgSoft;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl
    },
    heroCard: {
      borderRadius: theme.radius.xl,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
      overflow: 'hidden',
      ...heroShadow
    },
    heroHeader: {
      gap: theme.spacing.sm
    },
    heroTitle: {
      ...theme.typography.h1,
      color: '#f8fafc'
    },
    heroSubtitle: {
      ...theme.typography.body,
      color: 'rgba(248,250,252,0.8)',
      maxWidth: '90%'
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg
    },
    heroStat: {
      flex: 1,
      backgroundColor: heroStatBg,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md
    },
    heroStatValue: {
      fontSize: 22,
      fontWeight: '700',
      color: '#f8fafc'
    },
    heroStatLabel: {
      ...theme.typography.caption,
      color: 'rgba(248,250,252,0.85)',
      textTransform: 'uppercase',
      letterSpacing: 0.6
    },
    heroStatCaption: {
      ...theme.typography.bodySmall,
      color: 'rgba(248,250,252,0.75)',
      marginTop: 4
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor,
      ...baseCardShadow
    },
    cardTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
      fontSize: 19
    },
    cardSubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md
    },
    statItem: {
      flex: 1,
      alignItems: 'flex-start',
      backgroundColor: trackBg,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginBottom: 4,
      textTransform: 'uppercase'
    },
    statValue: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '700'
    },
    calculatedStats: {
      backgroundColor: calculatedBg,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.sm,
      gap: 6
    },
    calculatedStat: {
      ...theme.typography.bodySmall,
      color: theme.colors.text
    },
    statText: {
      ...theme.typography.body,
      color: theme.colors.text,
      marginBottom: 4
    },
    statHighlight: {
      ...theme.typography.bodySmall,
      color: theme.colors.primary,
      fontWeight: '700'
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md
    },
    sectionAction: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 8,
      backgroundColor: sectionActionBg,
      borderRadius: theme.radius.full
    },
    sectionActionText: {
      ...theme.typography.bodySmall,
      color: sectionActionText,
      fontWeight: '600'
    },
    addBaseDataButton: {
      backgroundColor: theme.colors.card,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      alignItems: 'center',
      marginBottom: theme.spacing.lg
    },
    addBaseDataText: {
      ...theme.typography.body,
      color: theme.colors.primary,
      fontWeight: '600',
      textAlign: 'center'
    },
    chartCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor,
      ...baseCardShadow
    },
    chartCaption: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginTop: theme.spacing.sm
    },
    section: {
      marginTop: theme.spacing.lg
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm
    },
    hydrationBars: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md
    },
    hydrationBarItem: {
      flex: 1,
      alignItems: 'center'
    },
    hydrationBarTrack: {
      width: '100%',
      height: 120,
      borderRadius: theme.radius.md,
      backgroundColor: trackBg,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      borderWidth: 1,
      borderColor
    },
    hydrationBarFill: {
      width: '100%',
      borderRadius: theme.radius.md
    },
    hydrationLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 6
    },
    hydrationValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '600'
    },
    exerciseBars: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md
    },
    exerciseBarItem: {
      flex: 1,
      alignItems: 'center'
    },
    exerciseBarTrack: {
      width: '100%',
      height: 140,
      borderRadius: theme.radius.md,
      backgroundColor: trackBg,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      borderWidth: 1,
      borderColor
    },
    exerciseBarFill: {
      width: '100%',
      borderRadius: theme.radius.md,
      backgroundColor: 'rgba(239,68,68,0.8)'
    },
    exerciseLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 6
    },
    exerciseValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '600'
    },
    exerciseCaption: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.sm
    },
    calorieList: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.md
    },
    calorieRow: {
      gap: 8,
      backgroundColor: trackBg,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md
    },
    calorieHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    calorieLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    calorieMeta: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    calorieBarTrack: {
      height: 10,
      borderRadius: theme.radius.full,
      backgroundColor: trackBg,
      overflow: 'hidden',
      marginTop: 6,
      position: 'relative'
    },
    calorieBarFill: {
      height: '100%',
      borderRadius: theme.radius.full
    },
    calorieTargetMarker: {
      position: 'absolute',
      left: '100%',
      marginLeft: -1,
      top: -4,
      width: 2,
      height: 18,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.full
    },
    calorieStatus: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    dayCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor
    },
    dayCardWithData: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.mode === 'dark' ? 'rgba(15,118,110,0.18)' : 'rgba(15,118,110,0.08)'
    },
    dayTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
      marginBottom: 6
    },
    dayMetricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    dayMetric: {
      ...theme.typography.caption,
      color: theme.colors.text,
      backgroundColor: trackBg,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: theme.radius.full
    },
    dayDataEmpty: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      fontStyle: 'italic'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: theme.spacing.lg
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg
    },
    modalTitle: {
      ...theme.typography.h2,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      textAlign: 'center'
    },
    input: {
      backgroundColor: trackBg,
      borderWidth: 1,
      borderColor,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      ...theme.typography.body
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top'
    },
    modalButtons: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md
    },
    modalButton: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      alignItems: 'center'
    },
    modalButtonSecondary: {
      backgroundColor: trackBg
    },
    modalButtonText: {
      ...theme.typography.body,
      color: '#fff',
      fontWeight: '600'
    }
  });
};

export default ProgressScreen;

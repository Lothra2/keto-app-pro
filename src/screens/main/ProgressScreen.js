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

  const calculateStats = useCallback(
    (h, w, a) => {
      const bf = estimateBodyFat(h, w, a, gender);
      const bmrVal = calculateBMR(h, w, a, gender !== 'female');
      const bmiVal = calculateBMI(h, w);
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
        calConsumed: consumedCalories
      });
    }

    setProgressByDay(data);
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

      if (dayForm.peso && height && age) {
        calculateStats(height, dayForm.peso, age);
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
        formatter: (value) => `${value.toFixed(1)} kg`
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
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'en' ? '📈 Progress' : '📈 Progreso'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'en' 
            ? `${completedDays} of ${derivedPlan.length} days completed`
            : `${completedDays} de ${derivedPlan.length} días completados`}
        </Text>
      </View>

      {/* Base Data */}
      {hasBaseData ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? 'Base Data' : 'Datos Base'}
          </Text>
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
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setShowBaseDataModal(true)}
          >
            <Text style={styles.editButtonText}>{language === 'en' ? 'Edit' : 'Editar'}</Text>
          </TouchableOpacity>
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

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 100
  },
  header: {
    marginBottom: theme.spacing.lg
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: 4
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted
  },
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  cardTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 4
  },
  statValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600'
  },
  calculatedStats: {
    backgroundColor: theme.colors.bgSoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    gap: 4
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
  editButton: {
    backgroundColor: theme.colors.bgSoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm
  },
  editButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600'
  },
  addBaseDataButton: {
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  addBaseDataText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: '600'
  },
  chartCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  chartCaption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.sm
  },
  section: {
    marginTop: theme.spacing.md
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm
  },
  dayCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  dayCardWithData: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(15,118,110,0.05)'
  },
  dayTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 4
  },
  dayMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  dayMetric: {
    ...theme.typography.caption,
    color: theme.colors.text,
    backgroundColor: theme.colors.bgSoft,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.full,
    overflow: 'hidden'
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
    backgroundColor: theme.colors.bgSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
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
    backgroundColor: theme.colors.bgSoft
  },
  modalButtonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600'
  },
  calorieList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md
  },
  calorieRow: {
    gap: 6
  },
  calorieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  calorieLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600'
  },
  calorieMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted
  },
  calorieBarTrack: {
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgSoft,
    overflow: 'hidden',
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
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.border
  },
  calorieStatus: {
    ...theme.typography.caption,
    color: theme.colors.textMuted
  },
  hydrationBars: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-start',
    flexWrap: 'wrap'
  },
  hydrationBarItem: {
    alignItems: 'center',
    width: 56
  },
  hydrationBarTrack: {
    width: 22,
    height: 120,
    borderRadius: 999,
    backgroundColor: theme.colors.bgSoft,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 6
  },
  hydrationBarFill: {
    width: '100%',
    borderRadius: 999
  },
  hydrationLabel: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '600'
  },
  hydrationValue: {
    ...theme.typography.caption,
    color: theme.colors.textMuted
  }
});

export default ProgressScreen;

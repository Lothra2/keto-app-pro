import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useApp } from '../../context/AppContext'
import { getTheme } from '../../theme'
import {
  getProgressData,
  saveProgressData,
  getCompletedDaysCount,
  getWaterState,
  getCalorieState
} from '../../storage/storage'
import {
  estimateBodyFat,
  calculateBMR,
  calculateBMI,
  getBMICategory,
  calculateConsumedCalories,
  calculateTDEE
} from '../../utils/calculations'
import storage, { KEYS } from '../../storage/storage'
import MultiMetricChart from '../../components/progress/MultiMetricChart'
import { getDayDisplayName, getDayTag } from '../../utils/labels'
import { syncUserBaseOverrides } from '../../storage/storage'
import { toOneDecimal, toIntOrNull, toNumberOrNull } from '../../utils/validation'
import ScreenBanner from '../../components/shared/ScreenBanner'

const USER_HEIGHT_KEY = 'USER_HEIGHT_OVERRIDE'
const USER_WEIGHT_KEY = 'USER_WEIGHT_OVERRIDE'
const USER_AGE_KEY = 'USER_AGE_OVERRIDE'

const ProgressScreen = () => {
  const {
    theme: themeMode,
    language,
    derivedPlan,
    gender,
    metrics
  } = useApp()

  const theme = getTheme(themeMode)
  const styles = getStyles(theme)

  const [completedDays, setCompletedDays] = useState(0)

  const [showBaseDataModal, setShowBaseDataModal] = useState(false)
  const [baseDataLoaded, setBaseDataLoaded] = useState(false)

  const [height, setHeight] = useState('')
  const [startWeight, setStartWeight] = useState('')
  const [age, setAge] = useState('')
  const [hasBaseData, setHasBaseData] = useState(false)

  const [bodyFat, setBodyFat] = useState(null)
  const [bmr, setBmr] = useState(null)
  const [bmi, setBmi] = useState(null)
  const [bmiCategory, setBmiCategory] = useState(null)
  const [recommendedCalories, setRecommendedCalories] = useState(null)

  const [progressByDay, setProgressByDay] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [showDayModal, setShowDayModal] = useState(false)

  const [dayForm, setDayForm] = useState({
    peso: '',
    cintura: '',
    energia: '',
    exkcal: '',
    notas: ''
  })

  const [hydration, setHydration] = useState({ daysWithWater: 0, totalMl: 0 })
  const [exerciseSummary, setExerciseSummary] = useState({ daysLogged: 0, totalKcal: 0 })

  const [selectedMetricKey, setSelectedMetricKey] = useState('weight')
  const [selectedTracker, setSelectedTracker] = useState('water') // water | workout | calories

  const calculateStats = useCallback(
    (h, w, a) => {
      const heightNumber = toNumberOrNull(h)
      const weightNumber = toNumberOrNull(w)
      const ageNumber = toNumberOrNull(a)

      if (!heightNumber || !weightNumber || !ageNumber) {
        setBodyFat(null)
        setBmr(null)
        setBmi(null)
        setBmiCategory(null)
        setRecommendedCalories(null)
        return
      }

      const bf = estimateBodyFat(heightNumber, weightNumber, ageNumber, gender)
      const bmrVal = calculateBMR(heightNumber, weightNumber, ageNumber, gender !== 'female')
      const bmiVal = calculateBMI(heightNumber, weightNumber)
      const category = getBMICategory(bmiVal, language)
      const intensityLevel = metrics?.workoutIntensity || 'medium'
      const activityMap = { soft: 'light', medium: 'moderate', hard: 'active' }
      const activityLevel = activityMap[intensityLevel] || 'light'
      const tdee = bmrVal ? calculateTDEE(bmrVal, activityLevel) : null
      const recommended = tdee ? Math.round(tdee * 0.85) : null

      setBodyFat(bf)
      setBmr(bmrVal)
      setBmi(bmiVal)
      setBmiCategory(category)
      setRecommendedCalories(recommended)
    },
    [gender, language, metrics?.workoutIntensity]
  )

  const loadAllProgress = useCallback(
    async (baseMetrics = {}) => {
      const data = []
      const baseHeight = toNumberOrNull(baseMetrics.height ?? height)
      const baseAge = toNumberOrNull(baseMetrics.age ?? age)
      let daysWithExercise = 0
      let totalExerciseKcal = 0

      for (let i = 0; i < derivedPlan.length; i++) {
        const dayProgress = await getProgressData(i)
        const water = await getWaterState(i)
        const calorieState = await getCalorieState(i, derivedPlan[i]?.kcal || 1600)
        const hasProgress = Object.keys(dayProgress).length > 0
        const hasWater = water.ml > 0
        const mealsState = calorieState.meals || {}
        const consumedCalories = calculateConsumedCalories(
          mealsState,
          calorieState.goal || derivedPlan[i]?.kcal || 1600
        )
        const hasCalories = consumedCalories > 0

        if (!hasProgress && !hasWater && !hasCalories) {
          continue
        }

        const pesoNumber = dayProgress.peso !== undefined && dayProgress.peso !== null
          ? toNumberOrNull(dayProgress.peso)
          : null
        const energiaNumber = dayProgress.energia !== undefined && dayProgress.energia !== null
          ? toNumberOrNull(dayProgress.energia)
          : null
        const computedBodyFat =
          baseHeight && baseAge && pesoNumber !== null
            ? estimateBodyFat(baseHeight, pesoNumber, baseAge, gender)
            : null
        const burnedKcal = dayProgress.exkcal ? Number(dayProgress.exkcal) : 0

        if (burnedKcal > 0) {
          daysWithExercise += 1
          totalExerciseKcal += burnedKcal
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
        })
      }

      setProgressByDay(data)
      setExerciseSummary({
        daysLogged: daysWithExercise,
        totalKcal: Math.round(totalExerciseKcal)
      })
    },
    [age, derivedPlan, gender, height, language]
  )

  const hydrationStats = useCallback(
    async () => {
      let daysWithWater = 0
      let totalMl = 0

      for (let i = 0; i < derivedPlan.length; i++) {
        const water = await getWaterState(i)
        totalMl += water.ml
        if (water.ml >= water.goal * 0.8) {
          daysWithWater++
        }
      }

      return { daysWithWater, totalMl }
    },
    [derivedPlan]
  )

  // 1) cargar base data solo una vez
  const loadBaseDataOnce = useCallback(async () => {
    const oH = await storage.get(USER_HEIGHT_KEY, '')
    const oW = await storage.get(USER_WEIGHT_KEY, '')
    const oA = await storage.get(USER_AGE_KEY, '')

    if (oH || oW || oA) {
      setHeight(oH || '')
      setStartWeight(oW || '')
      setAge(oA || '')
      setHasBaseData(Boolean(oH && oW && oA))
      if (oH && oW && oA) {
        calculateStats(oH, oW, oA)
      }
      setBaseDataLoaded(true)
      return
    }

    const h = await storage.get(KEYS.HEIGHT, '')
    const w = await storage.get(KEYS.START_WEIGHT, '')
    const a = await storage.get(KEYS.AGE, '')

    if (h) await storage.set(USER_HEIGHT_KEY, h)
    if (w) await storage.set(USER_WEIGHT_KEY, w)
    if (a) await storage.set(USER_AGE_KEY, a)

    setHeight(h)
    setStartWeight(w)
    setAge(a)
    setHasBaseData(Boolean(h && w && a))
    if (h && w && a) {
      calculateStats(h, w, a)
    }
    setBaseDataLoaded(true)
  }, [calculateStats])

  useEffect(() => {
    loadBaseDataOnce()
  }, [loadBaseDataOnce])

  // 2) cargar progreso cuando la pantalla esté activa
  const loadProgressOnly = useCallback(async () => {
    const completed = await getCompletedDaysCount(derivedPlan.length)
    setCompletedDays(completed)

    await loadAllProgress({ height, age })
    const hydraStats = await hydrationStats()
    setHydration(hydraStats)
  }, [derivedPlan.length, loadAllProgress, hydrationStats, height, age])

  useFocusEffect(
    useCallback(() => {
      if (!baseDataLoaded) return
      loadProgressOnly()
    }, [loadProgressOnly, baseDataLoaded])
  )

  const handleSaveBaseData = async () => {
    if (height && startWeight && age) {
      const hNum = toNumberOrNull(height)
      const wNum1d = toOneDecimal(startWeight)
      const aNum = toIntOrNull(age)

      await storage.set(USER_HEIGHT_KEY, hNum ?? height)
      await storage.set(USER_WEIGHT_KEY, wNum1d ?? startWeight)
      await storage.set(USER_AGE_KEY, aNum ?? age)

      await syncUserBaseOverrides()

      setHasBaseData(true)
      calculateStats(hNum ?? height, wNum1d ?? startWeight, aNum ?? age)

      // Normalizar lo que se ve en los inputs
      if (hNum !== null) setHeight(String(hNum))
      if (wNum1d !== null) setStartWeight(String(wNum1d))
      if (aNum !== null) setAge(String(aNum))

      await loadAllProgress({ height: hNum ?? height, age: aNum ?? age })
      const hydraStats = await hydrationStats()
      setHydration(hydraStats)

      setShowBaseDataModal(false)
    }
  }

  const handleOpenDayModal = (dayIndex) => {
    setSelectedDay(dayIndex)
    loadDayData(dayIndex)
    setShowDayModal(true)
  }

  const loadDayData = async (dayIndex) => {
    const data = await getProgressData(dayIndex)
    setDayForm({
      peso: data.peso !== undefined && data.peso !== null ? String(data.peso) : '',
      cintura: data.cintura !== undefined && data.cintura !== null ? String(data.cintura) : '',
      energia: data.energia !== undefined && data.energia !== null ? String(data.energia) : '',
      exkcal: data.exkcal !== undefined && data.exkcal !== null ? String(data.exkcal) : '',
      notas: data.notas || ''
    })
  }

  const handleSaveDayProgress = async () => {
    if (selectedDay !== null) {
      const pesoNum = toOneDecimal(dayForm.peso)
      const cinturaNum = toIntOrNull(dayForm.cintura)
      const energiaNum = toIntOrNull(dayForm.energia)
      const energiaClampedNum = energiaNum === null ? null : Math.min(10, Math.max(1, energiaNum))
      const exkcalNum = toIntOrNull(dayForm.exkcal)

      const normalized = {
        peso: pesoNum,
        cintura: cinturaNum,
        energia: energiaClampedNum,
        exkcal: exkcalNum,
        notas: dayForm.notas || ''
      }

      await saveProgressData(selectedDay, normalized)
      setShowDayModal(false)
      await loadAllProgress({ height, age })

      if (height && startWeight && age) {
        calculateStats(height, startWeight, age)
      }
    }
  }

  const baseHeightNumber = toNumberOrNull(height)
  const baseAgeNumber = toNumberOrNull(age)

  const initialBodyFat = useMemo(() => {
    const startW = toNumberOrNull(startWeight)
    if (startW === null || !baseHeightNumber || !baseAgeNumber) {
      return null
    }
    return estimateBodyFat(baseHeightNumber, startW, baseAgeNumber, gender)
  }, [startWeight, baseHeightNumber, baseAgeNumber, gender])

  const chartPoints = useMemo(() => {
    const points = []
    const startW = toNumberOrNull(startWeight)

    if (startW !== null) {
      points.push({
        label: language === 'en' ? 'Start' : 'Inicio',
        weight: startW,
        energy: null,
        bodyFat: initialBodyFat
      })
    }

    progressByDay.forEach((entry) => {
      const label = getDayTag(entry.dayIndex, language)
      points.push({
        label,
        displayName:
          entry.displayName ||
          getDayDisplayName({
            label: derivedPlan[entry.dayIndex]?.dia,
            index: entry.dayIndex,
            language
          }),
        weight:
          entry.pesoNumber !== null && entry.pesoNumber !== undefined
            ? entry.pesoNumber
            : entry.peso !== undefined && entry.peso !== null
            ? toNumberOrNull(entry.peso)
            : null,
        energy:
          entry.energiaNumber !== null && entry.energiaNumber !== undefined
            ? entry.energiaNumber
            : entry.energia !== undefined && entry.energia !== null
            ? toNumberOrNull(entry.energia)
            : null,
        bodyFat:
          entry.bodyFat !== null && entry.bodyFat !== undefined ? entry.bodyFat : null
      })
    })

    return points.filter(
      (point) => point.weight !== null || point.energy !== null || point.bodyFat !== null
    )
  }, [progressByDay, startWeight, language, initialBodyFat, derivedPlan])

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
  )

  const selectedMetric =
    metricConfig.find((m) => m.key === selectedMetricKey) || metricConfig[0]

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
  )

  const exerciseHistory = useMemo(() => {
    return progressByDay
      .filter((entry) => entry.burnedKcal && entry.burnedKcal > 0)
      .map((entry) => ({
        label: getDayTag(entry.dayIndex, language),
        kcal: Math.round(entry.burnedKcal)
      }))
  }, [progressByDay, language])

  const calorieHistory = useMemo(
    () =>
      progressByDay
        .filter((entry) => entry.calGoal)
        .map((itemEntry) => {
          const goal = itemEntry.calGoal || derivedPlan[itemEntry.dayIndex]?.kcal || 1600
          const consumed = itemEntry.calConsumed || 0
          return {
            label: getDayTag(itemEntry.dayIndex, language),
            goal,
            consumed,
            percent: goal ? Math.round((consumed / goal) * 100) : 0
          }
        }),
    [progressByDay, language, derivedPlan]
  )

  const maxCalPercent = calorieHistory.length
    ? Math.max(...calorieHistory.map((item) => Math.min(140, Math.max(item.percent, 0))), 1)
    : 1

  const daysInPlan = derivedPlan.length || 1
  const waterSummary = `${hydration.daysWithWater}/${daysInPlan}`
  const workoutSummary = `${exerciseSummary.daysLogged}/${daysInPlan}`
  const adherenceDays = calorieHistory.filter(
    (item) => item.percent >= 90 && item.percent <= 110
  ).length
  const adherenceSummary = `${adherenceDays}/${calorieHistory.length || daysInPlan}`

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenBanner
        theme={theme}
        icon="📈"
        title={language === 'en' ? 'Progress' : 'Progreso'}
        subtitle={
          language === 'en'
            ? `${completedDays} of ${derivedPlan.length} days completed`
            : `${completedDays} de ${derivedPlan.length} días completados`
        }
        description={
          language === 'en'
            ? 'Log your metrics to watch trends and stay accountable.'
            : 'Registra tus métricas para ver tendencias y mantener el enfoque.'
        }
        badge={
          `${Math.min(100, Math.round((completedDays / Math.max(derivedPlan.length || 1, 1)) * 100))}%`
        }
        badgeTone="info"
        style={styles.banner}
        footnote={
          language === 'en'
            ? 'Tap a day to edit weight, energy and notes.'
            : 'Toca un día para editar peso, energía y notas.'
        }
      >
        <View style={styles.bannerStatsRow}>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatLabel}>
              {language === 'en' ? 'Water days' : 'Días con agua'}
            </Text>
            <Text style={styles.bannerStatValue}>{waterSummary}</Text>
          </View>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatLabel}>
              {language === 'en' ? 'Workouts' : 'Entrenos'}
            </Text>
            <Text style={styles.bannerStatValue}>{workoutSummary}</Text>
          </View>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatLabel}>
              {language === 'en' ? 'Calorie adherence' : 'Adherencia calorías'}
            </Text>
            <Text style={styles.bannerStatValue}>{adherenceSummary}</Text>
          </View>
        </View>
      </ScreenBanner>

      {/* Base Data */}
      {hasBaseData ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? 'Base Data' : 'Datos Base'}
          </Text>
          <View style={styles.statsRowCompact}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Height' : 'Estatura'}</Text>
              <Text style={styles.statValue}>{height} cm</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Start' : 'Peso Inicial'}</Text>
              <Text style={styles.statValue}>
                {toOneDecimal(startWeight) ?? startWeight} kg
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Age' : 'Edad'}</Text>
              <Text style={styles.statValue}>{age}</Text>
            </View>
          </View>

          {(bodyFat || bmr || recommendedCalories || bmi) && (
            <View style={styles.calculatedStats}>
              {bodyFat ? (
                <Text style={styles.calculatedStat}>
                  {language === 'en' ? 'Body Fat' : '% Grasa'}: {bodyFat}%
                </Text>
              ) : null}
              {bmr ? (
                <Text style={styles.calculatedStat}>
                  BMR: {bmr} kcal/{language === 'en' ? 'day' : 'día'}
                </Text>
              ) : null}
              {recommendedCalories ? (
                <Text style={styles.calculatedStat}>
                  {language === 'en'
                    ? 'Recommended kcal/day'
                    : 'Calorías recomendadas/día'}: {recommendedCalories}
                </Text>
              ) : null}
              {bmi ? (
                <Text style={styles.calculatedStat}>
                  BMI: {bmi} {bmiCategory ? `(${bmiCategory})` : ''}
                </Text>
              ) : null}
            </View>
          )}

          <TouchableOpacity style={styles.editButton} onPress={() => setShowBaseDataModal(true)}>
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

      {/* Daily Progress arriba */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Daily Progress' : 'Progreso Diario'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayScroll}
        >
          {derivedPlan.map((day, index) => {
            const hasData = progressByDay.find((p) => p.dayIndex === index)
            const dayName = getDayDisplayName({ label: day.dia, index, language })
            const calorieValue =
              hasData && typeof hasData.calConsumed === 'number' ? hasData.calConsumed : 0
            const calorieGoal =
              hasData && typeof hasData.calGoal === 'number' ? hasData.calGoal : 0
            const percent =
              calorieGoal > 0 ? Math.min(100, Math.round((calorieValue / calorieGoal) * 100)) : 0

            return (
              <TouchableOpacity
                key={index}
                style={[styles.dayChip, hasData && styles.dayChipActive]}
                onPress={() => handleOpenDayModal(index)}
              >
                <Text style={styles.dayChipTitle}>{dayName}</Text>
                <View style={styles.dayChipBarTrack}>
                  <View style={[styles.dayChipBarFill, { width: `${percent}%` }]} />
                </View>
                {hasData ? (
                  <View style={styles.dayChipBottom}>
                    {hasData.peso || hasData.pesoNumber ? (
                      <Text style={styles.dayChipMetricSmall}>
                        ⚖️{' '}
                        {hasData.pesoNumber
                          ? hasData.pesoNumber.toFixed(1)
                          : Number(hasData.peso).toFixed(1)}
                      </Text>
                    ) : null}
                    {hasData.energia || hasData.energiaNumber ? (
                      <Text style={styles.dayChipMetricSmall}>
                        ⚡{' '}
                        {hasData.energiaNumber
                          ? hasData.energiaNumber.toFixed(1)
                          : Number(hasData.energia).toFixed(1)}
                      </Text>
                    ) : null}
                    {calorieGoal ? (
                      <Text style={styles.dayChipMetricSmall}>
                        🍽️ {calorieValue}/{calorieGoal}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.dayChipEmpty}>
                    {language === 'en' ? 'Tap to add' : 'Toca para agregar'}
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Gráfica principal */}
      {chartPoints.length > 0 && (
        <View style={styles.chartCard}>
          <View style={styles.metricSelector}>
            {metricConfig.map((metric) => (
              <TouchableOpacity
                key={metric.key}
                style={[
                  styles.metricButton,
                  selectedMetricKey === metric.key && styles.metricButtonActive
                ]}
                onPress={() => setSelectedMetricKey(metric.key)}
              >
                <Text
                  style={[
                    styles.metricButtonText,
                    selectedMetricKey === metric.key && styles.metricButtonTextActive
                  ]}
                >
                  {metric.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <MultiMetricChart
            data={chartPoints}
            metrics={[selectedMetric]}
            theme={theme}
            language={language}
            showValueBadges
          />
          <Text style={styles.chartCaption}>
            {language === 'en'
              ? 'Track one metric at a time for a cleaner view.'
              : 'Mira una métrica a la vez para verlo más claro.'}
          </Text>
        </View>
      )}

      {/* Daily trackers con tabs */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {language === 'en' ? 'Daily trackers' : 'Seguimiento diario'}
        </Text>
        <View style={styles.trackerSummaryRow}>
          <Text style={styles.trackerSummaryText}>
            💧 {language === 'en' ? 'Water' : 'Agua'}: {waterSummary}
          </Text>
          <Text style={styles.trackerSummaryText}>
            🔥 {language === 'en' ? 'Workout' : 'Entreno'}: {workoutSummary}
          </Text>
          <Text style={styles.trackerSummaryText}>
            🍽️ {language === 'en' ? 'Adherence' : 'Adherencia'}: {adherenceSummary}
          </Text>
        </View>
        <View style={styles.trackerTabs}>
          <TouchableOpacity
            style={[styles.trackerTab, selectedTracker === 'water' && styles.trackerTabActive]}
            onPress={() => setSelectedTracker('water')}
          >
            <Text
              style={[
                styles.trackerTabText,
                selectedTracker === 'water' && styles.trackerTabTextActive
              ]}
            >
              {language === 'en' ? 'Water' : 'Agua'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.trackerTab, selectedTracker === 'workout' && styles.trackerTabActive]}
            onPress={() => setSelectedTracker('workout')}
          >
            <Text
              style={[
                styles.trackerTabText,
                selectedTracker === 'workout' && styles.trackerTabTextActive
              ]}
            >
              {language === 'en' ? 'Workout' : 'Entreno'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.trackerTab, selectedTracker === 'calories' && styles.trackerTabActive]}
            onPress={() => setSelectedTracker('calories')}
          >
            <Text
              style={[
                styles.trackerTabText,
                selectedTracker === 'calories' && styles.trackerTabTextActive
              ]}
            >
              {language === 'en' ? 'Adherence' : 'Adherencia'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* agua */}
        {selectedTracker === 'water' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalBars}
          >
            {hydrationHistory.map((item) => {
              const percent = Math.min(100, Math.round((item.water / item.goal) * 100))
              return (
                <View key={item.label} style={styles.trackerBarItem}>
                  <View style={styles.trackerBarTrack}>
                    <View
                      style={[
                        styles.trackerBarFill,
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
                  <Text style={styles.trackerLabel}>{item.label}</Text>
                  <Text style={styles.trackerValue}>{item.water} ml</Text>
                </View>
              )
            })}
            {hydrationHistory.length === 0 && (
              <Text style={styles.emptyTrackerText}>
                {language === 'en' ? 'No water logged yet' : 'Aún no registras agua'}
              </Text>
            )}
          </ScrollView>
        )}

        {/* entreno */}
        {selectedTracker === 'workout' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalBars}
          >
            {(() => {
              const maxBurn = exerciseHistory.length
                ? Math.max(...exerciseHistory.map((e) => e.kcal), 1)
                : 1
              return exerciseHistory.map((item) => {
                const percent = Math.max(8, Math.round((item.kcal / maxBurn) * 100))
                return (
                  <View key={item.label} style={styles.trackerBarItem}>
                    <View style={styles.trackerBarTrack}>
                      <View
                        style={[
                          styles.trackerBarFill,
                          {
                            height: `${percent}%`,
                            backgroundColor: 'rgba(239,68,68,0.8)'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.trackerLabel}>{item.label}</Text>
                    <Text style={styles.trackerValue}>{item.kcal} kcal</Text>
                  </View>
                )
              })
            })()}
            {exerciseHistory.length === 0 && (
              <Text style={styles.emptyTrackerText}>
                {language === 'en' ? 'No workouts logged yet' : 'Aún no registras entrenos'}
              </Text>
            )}
          </ScrollView>
        )}

        {/* adherencia en % */}
        {selectedTracker === 'calories' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalBars}
          >
            {calorieHistory.map((item) => {
              const clampedPercent = Math.min(140, Math.max(item.percent, 0))
              const heightPercent = Math.max(
                8,
                Math.round((clampedPercent / maxCalPercent) * 100)
              )
              const withinTarget = item.percent >= 90 && item.percent <= 110
              const below = item.percent < 90
              const barColor = withinTarget
                ? 'rgba(34,197,94,0.75)'
                : below
                ? 'rgba(56,189,248,0.75)'
                : 'rgba(248,113,113,0.8)'

              return (
                <View key={item.label} style={styles.trackerBarItem}>
                  <View style={styles.trackerBarTrack}>
                    <View
                      style={[
                        styles.trackerBarFill,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: barColor
                        }
                      ]}
                    />
                    <View style={styles.calorieTargetMarker} />
                  </View>
                  <Text style={styles.trackerLabel}>{item.label}</Text>
                  <Text style={styles.trackerValue}>{item.percent}%</Text>
                </View>
              )
            })}
            {calorieHistory.length === 0 && (
              <Text style={styles.emptyTrackerText}>
                {language === 'en' ? 'No calories logged yet' : 'Aún no registras calorías'}
              </Text>
            )}
          </ScrollView>
        )}
      </View>

      {/* Modal base data */}
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
              keyboardType="decimal-pad"
              value={height}
              onChangeText={(text) => setHeight(text)}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Weight (kg)' : 'Peso (kg)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              value={startWeight}
              onChangeText={(text) => setStartWeight(text)}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Age' : 'Edad'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              value={age}
              onChangeText={(text) => setAge(text)}
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

      {/* Modal día */}
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
              keyboardType="decimal-pad"
              value={dayForm.peso}
              onChangeText={(text) => setDayForm({ ...dayForm, peso: text })}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Waist (cm)' : 'Cintura (cm)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              value={dayForm.cintura}
              onChangeText={(text) => setDayForm({ ...dayForm, cintura: text })}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Energy (1-10)' : 'Energía (1-10)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              value={dayForm.energia}
              onChangeText={(text) => {
                setDayForm({ ...dayForm, energia: text })
              }}
            />
            <TextInput
              style={styles.input}
              placeholder={
                language === 'en'
                  ? 'Workout calories burned'
                  : 'Kcal quemadas en ejercicio'
              }
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              value={dayForm.exkcal}
              onChangeText={(text) => setDayForm({ ...dayForm, exkcal: text })}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={language === 'en' ? 'Notes' : 'Notas'}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
              value={dayForm.notas}
              onChangeText={(text) => setDayForm({ ...dayForm, notas: text })}
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
  )
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: 100
    },
    banner: {
      marginBottom: theme.spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6
    },
    bannerStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
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
      ...theme.typography.body,
      color: 'rgba(248,250,252,0.95)',
      fontWeight: '600'
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
    statsRowCompact: {
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
    section: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm
    },
    dayScroll: {
      gap: 10,
      paddingVertical: 2
    },
    dayChip: {
      width: 150,
      backgroundColor: theme.colors.bgSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      borderWidth: 1,
      borderColor: 'transparent',
      marginRight: 10
    },
    dayChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: 'rgba(15,118,110,0.08)'
    },
    dayChipTitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '600',
      marginBottom: 6
    },
    dayChipBarTrack: {
      height: 5,
      backgroundColor: theme.colors.bg,
      borderRadius: 999,
      marginBottom: 6,
      overflow: 'hidden'
    },
    dayChipBarFill: {
      height: '100%',
      backgroundColor: theme.colors.primary
    },
    dayChipBottom: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6
    },
    dayChipMetricSmall: {
      ...theme.typography.caption,
      color: theme.colors.text
    },
    dayChipEmpty: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      fontStyle: 'italic'
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
    metricSelector: {
      flexDirection: 'row',
      backgroundColor: theme.colors.bgSoft,
      borderRadius: 999,
      padding: 4,
      marginBottom: theme.spacing.sm
    },
    metricButton: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 999,
      alignItems: 'center'
    },
    metricButtonActive: {
      backgroundColor: theme.colors.card
    },
    metricButtonText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    metricButtonTextActive: {
      color: theme.colors.text,
      fontWeight: '600'
    },
    trackerSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6
    },
    trackerSummaryText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    trackerTabs: {
      flexDirection: 'row',
      backgroundColor: theme.colors.bgSoft,
      borderRadius: 999,
      padding: 4,
      marginBottom: theme.spacing.sm
    },
    trackerTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 4,
      borderRadius: 999
    },
    trackerTabActive: {
      backgroundColor: theme.colors.card
    },
    trackerTabText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    trackerTabTextActive: {
      color: theme.colors.text,
      fontWeight: '600'
    },
    horizontalBars: {
      gap: 12,
      paddingRight: 4
    },
    trackerBarItem: {
      alignItems: 'center',
      width: 56
    },
    trackerBarTrack: {
      width: 22,
      height: 120,
      borderRadius: 999,
      backgroundColor: theme.colors.bgSoft,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 6,
      position: 'relative'
    },
    trackerBarFill: {
      width: '100%',
      borderRadius: 999
    },
    trackerLabel: {
      ...theme.typography.caption,
      color: theme.colors.text,
      fontWeight: '600'
    },
    trackerValue: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    calorieTargetMarker: {
      position: 'absolute',
      top: 0,
      height: 2,
      width: '100%',
      backgroundColor: theme.colors.border
    },
    emptyTrackerText: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginVertical: 8
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
    }
  })

export default ProgressScreen

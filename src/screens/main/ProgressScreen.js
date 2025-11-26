import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { differenceInCalendarDays, isValid, startOfDay } from 'date-fns'
import { useFocusEffect } from '@react-navigation/native'
import { useApp } from '../../context/AppContext'
import { getTheme } from '../../theme'
import { withAlpha } from '../../theme/utils'
import {
  getProgressData,
  saveProgressData,
  getCompletedDaysCount,
  getWaterState,
  getCalorieState,
  getDayData,
  getCheatMeal
} from '../../storage/storage'
import {
  estimateBodyFat,
  calculateBMR,
  calculateBMI,
  getBMICategory,
  calculateDynamicDailyKcal,
  calculateTDEE,
  getMealDistribution
} from '../../utils/calculations'
import storage, { KEYS } from '../../storage/storage'
import MultiMetricChart from '../../components/progress/MultiMetricChart'
import { getDayDisplayName, getDayTag } from '../../utils/labels'
import { syncUserBaseOverrides } from '../../storage/storage'
import { toOneDecimal, toIntOrNull, toNumberOrNull } from '../../utils/validation'
import ScreenBanner from '../../components/shared/ScreenBanner'
import Button from '../../components/shared/Button'
import Card from '../../components/shared/Card'
import { exportProgressPdf } from '../../utils/pdf'
import aiService from '../../api/aiService'
import { mergePlanDay } from '../../utils/plan'

const USER_HEIGHT_KEY = 'USER_HEIGHT_OVERRIDE'
const USER_WEIGHT_KEY = 'USER_WEIGHT_OVERRIDE'
const USER_AGE_KEY = 'USER_AGE_OVERRIDE'

const ProgressScreen = () => {
  const {
    theme: themeMode,
    language,
    derivedPlan,
    gender,
    metrics,
    user,
    apiCredentials
  } = useApp()

  const theme = getTheme(themeMode)
  const styles = getStyles(theme)

  const safePlan = useMemo(
    () => (Array.isArray(derivedPlan) ? derivedPlan : []),
    [derivedPlan]
  )

  const planLength = useMemo(
    () => (Array.isArray(safePlan) ? safePlan.length : 0),
    [safePlan]
  )

  const daysElapsed = useMemo(() => {
    if (!planLength) return 0

    if (user?.startDate) {
      const start = startOfDay(new Date(user.startDate))
      const today = startOfDay(new Date())

      if (isValid(start) && isValid(today)) {
        const diff = differenceInCalendarDays(today, start)
        const elapsed = diff + 1
        return Math.min(planLength, Math.max(0, elapsed))
      }
    }

    return Math.min(planLength, Math.max(completedDays, 0))
  }, [completedDays, planLength, user?.startDate])

  const userWaterGoal = useMemo(
    () => {
      const parsed = Number(metrics?.waterGoal)
      return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 2400
    },
    [metrics?.waterGoal]
  )

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
  const [showBaseDetails, setShowBaseDetails] = useState(false)

  const [progressByDay, setProgressByDay] = useState([])
  const safeProgress = useMemo(
    () => (Array.isArray(progressByDay) ? progressByDay : []),
    [progressByDay]
  )
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
  const [exportingPdf, setExportingPdf] = useState(false)
  const [showPdfWeekModal, setShowPdfWeekModal] = useState(false)
  const [aiInsight, setAiInsight] = useState('')
  const [aiInsightLoading, setAiInsightLoading] = useState(false)
  const [showAiInsight, setShowAiInsight] = useState(false)

  const parsedAiInsight = useMemo(
    () =>
      aiInsight
        ? aiInsight
            .split(/\n+/)
            .map((line) => line.replace(/\*+/g, '').trim())
            .filter(Boolean)
        : [],
    [aiInsight]
  )

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
      const recommended = tdee ? Math.max(1200, Math.round(tdee * 0.85)) : null

      setBodyFat(bf)
      setBmr(bmrVal)
      setBmi(bmiVal)
      setBmiCategory(category)
      setRecommendedCalories(recommended)
    },
    [gender, language, metrics?.workoutIntensity]
  )

  const computeConsumedFromDay = useCallback(
    (day, mealsState, fallbackGoal) => {
      const mealKeys = ['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena']
      const dayKcal =
        Number(day?.kcal || day?.dynamicKcal || day?.planKcal) || fallbackGoal
      const dist = getMealDistribution(gender)

      return mealKeys.reduce((sum, key) => {
        if (!mealsState?.[key]) return sum

        const mealObj = day?.[key]
        const kcal = mealObj?.kcal
          ? Number(mealObj.kcal)
          : Math.round(dayKcal * (dist[key] || 0.2))

        return sum + (Number.isFinite(kcal) ? kcal : 0)
      }, 0)
    },
    [gender]
  )

  const loadAllProgress = useCallback(
    async (baseMetrics = {}) => {
      const plan = Array.isArray(safePlan) ? safePlan : []
      const data = []
      const baseHeight = toNumberOrNull(baseMetrics.height ?? height)
      const baseAge = toNumberOrNull(baseMetrics.age ?? age)
      let daysWithExercise = 0
      let totalExerciseKcal = 0
      const limit = Math.min(plan.length, Math.max(daysElapsed, 0) || 0)

      for (let i = 0; i < limit; i++) {
        const dayProgress = await getProgressData(i)
        const water = await getWaterState(i, userWaterGoal)
        const storedDay = await getDayData(i)
        const baseDay = plan[i] || {}
        const mergedDay = mergePlanDay(baseDay, storedDay || {})
        const cheat = await getCheatMeal(i)

        if (cheat?.mealKey) {
          mergedDay[cheat.mealKey] = {
            ...(mergedDay?.[cheat.mealKey] || {}),
            nombre: language === 'en' ? 'Cheat meal' : 'Cheat meal',
            descripcion: cheat.description || mergedDay?.[cheat.mealKey]?.descripcion || '',
            qty: cheat.portion || mergedDay?.[cheat.mealKey]?.qty || '',
            kcal: cheat.kcalEstimate
              ? Number(cheat.kcalEstimate)
              : mergedDay?.[cheat.mealKey]?.kcal,
            estimatedByAI: Boolean(cheat?.estimatedByAI),
            isCheat: true
          }
        }
        const dayPlanKcal =
          mergedDay?.dynamicKcal || mergedDay?.planKcal || mergedDay?.kcal || baseDay?.kcal || 1600
        const dynamicGoal = calculateDynamicDailyKcal({
          baseKcal: dayPlanKcal,
          gender,
          metrics,
          cheatKcal: cheat?.kcalEstimate || storedDay?.cheatKcal || 0
        })
        const calorieState = await getCalorieState(i, dynamicGoal)
        const hasProgress = Object.keys(dayProgress).length > 0
        const hasWater = water.ml > 0
        const mealsState = {
          desayuno: false,
          snackAM: false,
          almuerzo: false,
          snackPM: false,
          cena: false,
          ...(calorieState.meals || {})
        }
        const mealKeys = ['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena']
        const normalizedGoal =
          calorieState.goal && calorieState.goal !== dynamicGoal
            ? dynamicGoal
            : calorieState.goal || dynamicGoal
        const consumedCalories = computeConsumedFromDay(
          mergedDay,
          mealsState,
          normalizedGoal
        )
        const totalMeals = mealKeys.length
        const completedMeals = mealKeys.filter((key) => mealsState[key]).length
        const hasCalories = consumedCalories > 0

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
          displayName: getDayDisplayName({
            label: safePlan[i]?.dia,
            index: i,
            language,
            startDate: user?.startDate
          }),
          ...dayProgress,
          pesoNumber,
          energiaNumber,
          bodyFat: computedBodyFat,
          water: water.ml,
          waterGoal: water.goal,
          calGoal: normalizedGoal,
          calConsumed: consumedCalories,
          mealCompletion: totalMeals ? Math.round((completedMeals / totalMeals) * 100) : 0,
          mealsCompleted: completedMeals,
          totalMeals,
          burnedKcal
        })
      }

      setProgressByDay(data)
      setExerciseSummary({
        daysLogged: daysWithExercise,
        totalKcal: Math.round(totalExerciseKcal)
      })
    },
    [age, safePlan, gender, height, language, userWaterGoal, user?.startDate, daysElapsed]
  )

  const hydrationStats = useCallback(
    async () => {
      let daysWithWater = 0
      let totalMl = 0

      const totalDays = Number.isFinite(daysElapsed) ? daysElapsed : 0

      for (let i = 0; i < totalDays; i++) {
        const water = await getWaterState(i, userWaterGoal)
        totalMl += water.ml
        if (water.ml >= water.goal * 0.8) {
          daysWithWater++
        }
      }

      return { daysWithWater, totalMl }
    },
    [daysElapsed, userWaterGoal]
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
    const completed = await getCompletedDaysCount(planLength)
    setCompletedDays(completed)

    await loadAllProgress({ height, age })
    const hydraStats = await hydrationStats()
    setHydration(hydraStats)
  }, [planLength, loadAllProgress, hydrationStats, height, age, userWaterGoal])

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

    safeProgress.forEach((entry) => {
      const label = getDayTag(entry.dayIndex, language, user?.startDate)
      points.push({
        label,
          displayName:
          entry.displayName ||
          getDayDisplayName({
            label: safePlan[entry.dayIndex]?.dia,
            index: entry.dayIndex,
            language,
            startDate: user?.startDate
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
  }, [safeProgress, startWeight, language, initialBodyFat, safePlan, user?.startDate])

  const progressToDate = useMemo(
    () => safeProgress.filter((entry) => entry.dayIndex < daysElapsed),
    [safeProgress, daysElapsed]
  )

  const weeksInPlan = useMemo(() => Math.max(1, Math.ceil((planLength || 0) / 7)), [planLength])

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
        color: theme.colors.warning,
        formatter: (value) => `${value.toFixed(1)} %`
      },
      {
        key: 'energy',
        label: language === 'en' ? 'Energy (1-10)' : 'Energía (1-10)',
        color: theme.colors.accent,
        formatter: (value) => `${value.toFixed(1)}/10`
      }
    ],
    [language, theme.colors.accent, theme.colors.primary, theme.colors.warning]
  )

  const handleShareProgressPdf = useCallback(
    async ({ scope, weekNumber }) => {
      if (exportingPdf) return

      setExportingPdf(true)

      try {
        await exportProgressPdf({
          language,
          weekNumber: weekNumber || 1,
          scope,
          entries: safeProgress,
          derivedPlan: safePlan,
          hydrationStats: hydration,
          exerciseSummary,
          baseStats: { height, startWeight, age },
          metricsSummary: { bodyFat, bmr, recommendedCalories, bmi, bmiCategory },
          chartPoints,
          startDate: user?.startDate
        })
      } catch (error) {
        console.error('Progress PDF export error', error)
        Alert.alert(
          language === 'en' ? 'PDF error' : 'Error al exportar PDF',
          language === 'en'
            ? 'We could not build the progress PDF. Try again later.'
            : 'No pudimos generar el PDF de progreso. Intenta más tarde.'
        )
      } finally {
        setExportingPdf(false)
        setShowPdfWeekModal(false)
      }
    },
    [
      exportingPdf,
      language,
      safeProgress,
      safePlan,
      hydration,
      exerciseSummary,
      height,
      startWeight,
      age,
      bodyFat,
      bmr,
      recommendedCalories,
      bmi,
      bmiCategory,
      chartPoints,
      user?.startDate
    ]
  )

  const handleGenerateAiInsight = useCallback(async () => {
    if (aiInsightLoading) return

    if (!apiCredentials?.user || !apiCredentials?.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your AI credentials in Settings to request insights.'
          : 'Agrega tus credenciales en Ajustes para pedir ideas a la IA.'
      )
      return
    }

    setAiInsightLoading(true)

    const totalTracked = Array.isArray(calorieHistory)
      ? calorieHistory.length
      : 0

    const summaryPayload = {
      hydration: { daysWithWater: hydration.daysWithWater, avgMl: avgWaterMl },
      workouts: {
        daysLogged: exerciseSummary.daysLogged,
        avgKcal: avgWorkoutKcal,
        maxWorkout,
      },
      calories: {
        adherenceDays,
        totalTracked: totalTracked || daysInPlan,
      },
      weight: { start: startWeightNumber, latest: lastWeightNumber, delta: weightDelta },
    }

    try {
      const res = await aiService.chat({
        prompt:
          (language === 'en'
            ? 'Create a short, motivating review of this week. Highlight one win, one risk, and one precise next action.'
            : 'Crea un breve resumen motivador de esta semana. Destaca un logro, un riesgo y una acción precisa para mejorar.') +
          `\nData: ${JSON.stringify(summaryPayload)}`,
        language,
        credentials: apiCredentials,
        context: { domain: 'keto-progress', focus: 'analytics' },
      })

      setAiInsight(res?.text || '')
      setShowAiInsight(true)
    } catch (error) {
      console.error('AI insight error', error)
      Alert.alert(
        language === 'en' ? 'AI unavailable' : 'IA no disponible',
        language === 'en'
          ? 'We could not fetch the insight right now.'
          : 'No pudimos obtener el insight en este momento.'
      )
    } finally {
      setAiInsightLoading(false)
    }
  }, [
    aiInsightLoading,
    apiCredentials,
    language,
    hydration.daysWithWater,
    avgWaterMl,
    exerciseSummary.daysLogged,
    avgWorkoutKcal,
    maxWorkout,
    adherenceDays,
    calorieHistory,
    daysInPlan,
    startWeightNumber,
    lastWeightNumber,
    weightDelta,
  ])


  const selectedMetric =
    metricConfig.find((m) => m.key === selectedMetricKey) || metricConfig[0]

  const hydrationHistory = useMemo(
    () =>
      progressToDate.map((entry) => ({
        label: getDayTag(entry.dayIndex, language, user?.startDate),
        water: entry.water || 0,
        goal: entry.waterGoal || 2400
      })),
    [progressToDate, language, user?.startDate]
  )

  const exerciseHistory = useMemo(() => {
    return progressToDate.map((entry) => ({
      label: getDayTag(entry.dayIndex, language, user?.startDate),
      kcal: Math.max(0, Math.round(entry.burnedKcal || 0))
    }))
  }, [progressToDate, language, user?.startDate])

  const calorieHistory = useMemo(
    () =>
      progressToDate
        .filter((entry) => entry.calGoal)
        .map((itemEntry) => {
          const goal = itemEntry.calGoal || safePlan[itemEntry.dayIndex]?.kcal || 1600
          const consumed = itemEntry.calConsumed || 0
          return {
            label: getDayTag(itemEntry.dayIndex, language, user?.startDate),
            goal,
            consumed,
            percent: goal ? Math.round((consumed / goal) * 100) : 0
          }
        }),
    [progressToDate, language, safePlan, user?.startDate]
  )

  const maxCalPercent = calorieHistory.length
    ? Math.max(...calorieHistory.map((item) => Math.min(140, Math.max(item.percent, 0))), 1)
    : 1

  const trackedDays = Math.max(daysElapsed, 0)
  const daysInPlan = Math.max(trackedDays, 1)
  const waterSummary = `${hydration.daysWithWater}/${trackedDays || 1}`
  const workoutSummary = `${exerciseSummary.daysLogged}/${trackedDays || 1}`
  const adherenceDays = progressToDate.filter(
    (item) => item.totalMeals > 0 && item.mealsCompleted >= item.totalMeals
  ).length
  const adherenceSummary = `${adherenceDays}/${Math.max(trackedDays, 1)}`

  const avgWaterMl = Math.round(hydration.totalMl / daysInPlan)
  const avgWorkoutKcal = Math.round(exerciseSummary.totalKcal / daysInPlan)
  const startWeightNumber = toNumberOrNull(startWeight)
  const lastWeightEntry = [...safeProgress]
    .reverse()
    .find((entry) => toNumberOrNull(entry.peso ?? entry.pesoNumber) !== null)
  const lastWeightNumber = toNumberOrNull(lastWeightEntry?.peso ?? lastWeightEntry?.pesoNumber)
  const weightDelta =
    startWeightNumber !== null && lastWeightNumber !== null
      ? Math.round((lastWeightNumber - startWeightNumber) * 10) / 10
      : null
  const maxWorkout = exerciseHistory.length
    ? Math.max(...exerciseHistory.map((item) => item.kcal || 0), 0)
    : 0
  const consistencyScore = Math.round(
    (adherenceDays / Math.max(trackedDays, 1)) * 40 +
      (hydration.daysWithWater / daysInPlan) * 30 +
      (exerciseSummary.daysLogged / daysInPlan) * 30
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenBanner
        theme={theme}
        icon="📈"
        title={language === 'en' ? 'Progress' : 'Progreso'}
        subtitle={
          language === 'en'
            ? `${completedDays} of ${planLength} days completed`
            : `${completedDays} de ${planLength} días completados`
        }
        description={
          language === 'en'
            ? 'Log your metrics to watch trends and stay accountable.'
            : 'Registra tus métricas para ver tendencias y mantener el enfoque.'
        }
        badge={
          `${Math.min(100, Math.round((completedDays / Math.max(planLength || 1, 1)) * 100))}%`
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

      <LinearGradient
        colors={[withAlpha(theme.colors.primary, 0.35), withAlpha(theme.colors.accent || theme.colors.primary, 0.25)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroTitle}>{language === 'en' ? 'Premium analytics' : 'Analítica premium'}</Text>
        <Text style={styles.heroSubtitle}>
          {language === 'en'
            ? 'A calmer, glassy surface for your charts plus quick chips for hydration, workouts, and adherence.'
            : 'Superficie suave tipo cristal para tus gráficas y chips rápidos de agua, entrenos y adherencia.'}
        </Text>
        <View style={styles.heroRow}>
          <View style={[styles.heroChip, styles.heroChipPrimary]}>
            <Text style={styles.heroChipLabel}>{language === 'en' ? 'Hydration' : 'Hidratación'}</Text>
            <Text style={styles.heroChipValue}>{waterSummary}</Text>
          </View>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipLabel}>{language === 'en' ? 'Workouts' : 'Entrenos'}</Text>
            <Text style={styles.heroChipValue}>{workoutSummary}</Text>
          </View>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipLabel}>{language === 'en' ? 'Adherence' : 'Adherencia'}</Text>
            <Text style={styles.heroChipValue}>{adherenceSummary}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.metricStrip}>
        <View style={[styles.metricCard, styles.metricPrimary]}>
          <Text style={styles.metricLabel}>{language === 'en' ? 'Weight trend' : 'Tendencia de peso'}</Text>
          <Text style={styles.metricValue}>
            {typeof weightDelta === 'number' ? `${weightDelta > 0 ? '+' : ''}${toOneDecimal(weightDelta)} kg` : '—'}
          </Text>
          <Text style={styles.metricHint}>
            {language === 'en' ? 'From start to latest' : 'Del inicio al último registro'}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{language === 'en' ? 'Hydration avg' : 'Promedio de agua'}</Text>
          <Text style={styles.metricValue}>{avgWaterMl ? `${Math.round(avgWaterMl)} ml` : '—'}</Text>
          <Text style={styles.metricHint}>
            {language === 'en' ? 'Logged across the plan' : 'Registrado a lo largo del plan'}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{language === 'en' ? 'Workout burn' : 'Quema en entrenos'}</Text>
          <Text style={styles.metricValue}>{avgWorkoutKcal ? `${Math.round(avgWorkoutKcal)} kcal` : '—'}</Text>
          <Text style={styles.metricHint}>
            {language === 'en' ? 'Average kcal per session' : 'Kcal promedio por sesión'}
          </Text>
        </View>
      </View>

      <View style={styles.progressHighlights}>
        <View style={[styles.progressHighlightCard, styles.progressPrimary]}>
          <Text style={styles.progressHighlightLabel}>{language === 'en' ? 'Current pace' : 'Ritmo actual'}</Text>
          <Text style={styles.progressHighlightValue}>{daysElapsed || 0}d</Text>
          <Text style={styles.progressHighlightHint}>
            {language === 'en' ? 'Days since you started' : 'Días desde que iniciaste'}
          </Text>
        </View>
        <View style={styles.progressHighlightCard}>
          <Text style={styles.progressHighlightLabel}>{language === 'en' ? 'BMI' : 'IMC'}</Text>
          <Text style={styles.progressHighlightValue}>{bmi ? bmi.toFixed(1) : '—'}</Text>
          <Text style={styles.progressHighlightHint}>{bmiCategory || (language === 'en' ? 'Add weight' : 'Agrega peso')}</Text>
        </View>
        <View style={styles.progressHighlightCard}>
          <Text style={styles.progressHighlightLabel}>{language === 'en' ? 'Target kcal' : 'Kcal objetivo'}</Text>
          <Text style={styles.progressHighlightValue}>
            {recommendedCalories ? `${recommendedCalories}` : '—'}
          </Text>
          <Text style={styles.progressHighlightHint}>
            {language === 'en' ? 'Auto-adjusted by intensity' : 'Ajustado por intensidad'}
          </Text>
        </View>
      </View>

      {/* Base Data */}
      {hasBaseData ? (
        <View style={[styles.card, styles.baseDataCard]}>
          <View style={styles.baseHeader}>
            <View>
              <Text style={styles.cardTitle}>
                {language === 'en' ? 'Base Data' : 'Datos Base'}
              </Text>
              <Text style={styles.baseHint}>
                {language === 'en'
                  ? 'Height, weight and age drive BMI, BMR and your daily kcal.'
                  : 'Estatura, peso y edad nutren el IMC, la TMB y tus kcal diarias.'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editPill}
              onPress={() => setShowBaseDataModal(true)}
              activeOpacity={0.9}
            >
              <Text style={styles.editPillText}>{language === 'en' ? 'Edit' : 'Editar'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.baseChipsRow}>
            {height ? (
              <View style={styles.baseChip}>
                <Text style={styles.baseChipLabel}>{language === 'en' ? 'Height' : 'Estatura'}</Text>
                <Text style={styles.baseChipValue}>{height} cm</Text>
              </View>
            ) : null}
            {startWeight ? (
              <View style={styles.baseChip}>
                <Text style={styles.baseChipLabel}>{language === 'en' ? 'Start' : 'Peso inicial'}</Text>
                <Text style={styles.baseChipValue}>
                  {toOneDecimal(startWeight) ?? startWeight} kg
                </Text>
              </View>
            ) : null}
            {age ? (
              <View style={styles.baseChip}>
                <Text style={styles.baseChipLabel}>{language === 'en' ? 'Age' : 'Edad'}</Text>
                <Text style={styles.baseChipValue}>{age}</Text>
              </View>
            ) : null}
            {recommendedCalories ? (
              <View style={[styles.baseChip, styles.baseChipAccent]}>
                <Text style={styles.baseChipLabel}>
                  {language === 'en' ? 'Target kcal' : 'Kcal objetivo'}
                </Text>
                <Text style={styles.baseChipValue}>{recommendedCalories}</Text>
              </View>
            ) : null}
          </View>

          {(bodyFat || bmr || recommendedCalories || bmi) ? (
            <TouchableOpacity
              style={styles.expandToggle}
              onPress={() => setShowBaseDetails((prev) => !prev)}
              activeOpacity={0.9}
            >
              <Text style={styles.expandToggleText}>
                {showBaseDetails
                  ? language === 'en'
                    ? 'Hide full stats'
                    : 'Ocultar detalles'
                  : language === 'en'
                  ? 'Show full stats & edit'
                  : 'Ver detalles y editar'}
              </Text>
              <Text style={styles.expandToggleIcon}>{showBaseDetails ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          ) : null}

          {showBaseDetails && (bodyFat || bmr || recommendedCalories || bmi) ? (
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
              <TouchableOpacity
                style={[styles.editButton, styles.editOutline]}
                onPress={() => setShowBaseDataModal(true)}
              >
                <Text style={styles.editButtonText}>
                  {language === 'en' ? 'Update base data' : 'Actualizar datos base'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
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

        <Card tone="info" style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <View style={styles.analyticsHeaderText}>
              <Text style={styles.sectionTitle}>
                🤖 {language === 'en' ? 'AI weekly analysis' : 'Análisis semanal IA'}
              </Text>
              <Text style={styles.analyticsLead}>
                {language === 'en'
                  ? 'One distilled summary for hydration, workouts and adherence each week.'
                  : 'Un resumen curado de hidratación, entrenos y adherencia por semana.'}
              </Text>
            </View>
            <View style={styles.scoreBadge}>
              <View style={styles.scoreBadgeIcon}>
                <Text style={styles.scoreBadgeIconText}>✓</Text>
              </View>
              <View>
                <Text style={styles.scoreLabel}>{language === 'en' ? 'Consistency' : 'Constancia'}</Text>
                <Text style={styles.scoreText}>{consistencyScore}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.aiRow}>
            <Button
              title={language === 'en' ? 'AI weekly insight' : 'Insight semanal IA'}
              onPress={handleGenerateAiInsight}
              loading={aiInsightLoading}
              variant="secondary"
              style={styles.aiButton}
            />
            {parsedAiInsight.length ? (
              <View style={styles.aiInsightPanel}>
                <View style={styles.aiInsightHeader}>
                  <Text style={styles.aiInsightTitle}>
                    {language === 'en' ? 'AI weekly insight' : 'Insight semanal IA'}
                  </Text>
                  <TouchableOpacity
                    style={styles.aiToggle}
                    onPress={() => setShowAiInsight((prev) => !prev)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.aiToggleIcon}>{showAiInsight ? '▲' : '▼'}</Text>
                    <Text style={styles.aiToggleText}>
                      {showAiInsight
                        ? language === 'en'
                          ? 'Hide insight'
                          : 'Ocultar insight'
                        : language === 'en'
                        ? 'Show insight'
                        : 'Mostrar insight'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {showAiInsight ? (
                  <View style={styles.aiInsightBox}>
                    {parsedAiInsight.map((line, index) => (
                      <Text key={`${line}-${index}`} style={styles.aiInsightText}>
                        {line.startsWith('•') ? line : `• ${line}`}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </Card>

        {/* Daily Progress arriba */}
        <Card style={styles.pdfCard}>
          <Text style={styles.sectionTitle}>
            📄 {language === 'en' ? 'Progress reports' : 'Reportes de progreso'}
          </Text>
          <Text style={styles.pdfHint}>
            {language === 'en'
              ? 'Export your progress with all metrics, either by week or for the full program.'
              : 'Exporta tu progreso con todas las métricas, por semana o de todo el programa.'}
          </Text>
          <View style={styles.pdfButtonsRow}>
            <Button
              title={language === 'en' ? 'Weekly PDF' : 'PDF semanal'}
              onPress={() => setShowPdfWeekModal(true)}
              disabled={exportingPdf}
              style={styles.pdfButton}
            />
            <Button
              title={language === 'en' ? 'Full plan PDF' : 'PDF del plan completo'}
              variant="secondary"
              onPress={() =>
                handleShareProgressPdf({ scope: 'plan', weekNumber: weeksInPlan })
              }
              disabled={exportingPdf}
              style={styles.pdfButton}
            />
          </View>
          <Text style={styles.pdfFootnote}>
            {exportingPdf
              ? language === 'en'
              ? 'Preparing PDF…'
              : 'Preparando PDF…'
            : language === 'en'
            ? 'Includes weight, body fat, hydration and workout data.'
            : 'Incluye peso, grasa, hidratación y entrenos.'}
        </Text>
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Daily Progress' : 'Progreso Diario'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayScroll}
        >
          {safePlan.map((day, index) => {
            const hasData = safeProgress.find((p) => p.dayIndex === index)
            const dayName = getDayDisplayName({
              label: day.dia,
              index,
              language,
              startDate: user?.startDate
            })
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
      <Modal visible={showPdfWeekModal} transparent animationType="fade">
        <View style={styles.pdfModalOverlay}>
          <View style={[styles.pdfModalCard, { backgroundColor: theme.colors.card }]}>
            <Text style={styles.pdfModalTitle}>
              {language === 'en' ? 'Select a week' : 'Selecciona una semana'}
            </Text>
            <View style={styles.pdfModalList}>
              {Array.from({ length: weeksInPlan }).map((_, index) => {
                const weekNumber = index + 1
                return (
                  <TouchableOpacity
                    key={weekNumber}
                    style={styles.pdfModalOption}
                    onPress={() => handleShareProgressPdf({ scope: 'week', weekNumber })}
                    disabled={exportingPdf}
                  >
                    <Text style={styles.pdfModalOptionText}>
                      {language === 'en' ? `Week ${weekNumber}` : `Semana ${weekNumber}`}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <TouchableOpacity
              style={[styles.pdfModalOption, styles.pdfModalClose]}
              onPress={() => setShowPdfWeekModal(false)}
              disabled={exportingPdf}
            >
              <Text style={styles.pdfModalCloseText}>
                {language === 'en' ? 'Close' : 'Cerrar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              {selectedDay !== null && safePlan[selectedDay]?.dia}
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
    metricStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    metricCard: {
      flex: 1,
      minWidth: '30%',
      backgroundColor: withAlpha(theme.colors.card, 0.82),
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.border, 0.65),
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    metricPrimary: {
      backgroundColor: withAlpha(theme.colors.primary, 0.14),
      borderColor: withAlpha(theme.colors.primary, 0.45),
    },
    metricLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    metricValue: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '800',
    },
    metricHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    progressHighlights: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      flexWrap: 'wrap',
      marginBottom: theme.spacing.lg
    },
    progressHighlightCard: {
      flex: 1,
      minWidth: '30%',
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3
    },
    progressPrimary: {
      backgroundColor: `${theme.colors.primary}16`,
      borderColor: `${theme.colors.primary}55`
    },
    progressHighlightLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginBottom: 2
    },
    progressHighlightValue: {
      ...theme.typography.h2,
      color: theme.colors.text,
      fontWeight: '800'
    },
    progressHighlightHint: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      marginTop: 2
    },
    bannerStat: {
      flex: 1,
      gap: 4
    },
    bannerStatLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    bannerStatValue: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '700'
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
    baseDataCard: {
      borderRadius: theme.radius.lg,
      borderColor: withAlpha(theme.colors.accent, 0.3),
      backgroundColor: withAlpha(theme.colors.card, 0.92),
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 4,
    },
    baseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    baseHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    baseChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    baseChip: {
      borderRadius: theme.radius.full,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: withAlpha(theme.colors.border, 0.4),
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.border, 0.65),
    },
    baseChipAccent: {
      backgroundColor: withAlpha(theme.colors.accent, 0.16),
      borderColor: withAlpha(theme.colors.accent, 0.5),
    },
    baseChipLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      letterSpacing: 0.3,
    },
    baseChipValue: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '700',
    },
    expandToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: theme.radius.full,
      backgroundColor: withAlpha(theme.colors.cardSoft, 0.7),
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.border, 0.7),
    },
    expandToggleText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '700',
    },
    expandToggleIcon: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '700',
      marginLeft: theme.spacing.sm,
    },
    calculatedStats: {
      backgroundColor: `${theme.colors.accent}10`,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      gap: 8,
      borderWidth: 1,
      borderColor: `${theme.colors.accent}40`
    },
    calculatedStat: {
      ...theme.typography.bodySmall,
      color: theme.colors.text
    },
    editButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
      alignItems: 'center',
      marginTop: theme.spacing.sm
    },
    editOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.accent, 0.7),
    },
    editButtonText: {
      ...theme.typography.bodySmall,
      color: theme.colors.onPrimary,
      fontWeight: '700'
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
    analyticsCard: {
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    analyticsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      flexWrap: 'wrap',
      marginBottom: theme.spacing.xs,
    },
    analyticsHeaderText: {
      flex: 1,
      gap: 4,
    },
    analyticsLead: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },
    scoreBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.cardSoft,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minWidth: 140,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    scoreBadgeIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.primary,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    scoreBadgeIconText: {
      ...theme.typography.body,
      color: theme.colors.primary,
      fontWeight: '800',
      lineHeight: 18,
    },
    scoreText: {
      ...theme.typography.h3,
      color: theme.colors.text,
      fontWeight: '800',
      lineHeight: 28,
    },
    scoreLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    aiRow: {
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
      alignItems: 'stretch',
      flexDirection: 'column'
    },
    aiButton: {
      alignSelf: 'flex-start',
    },
    aiInsightPanel: {
      gap: theme.spacing.sm,
      alignSelf: 'stretch',
      flex: 1,
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    aiInsightHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    aiInsightTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '700',
      flex: 1
    },
    aiToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.cardSoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    aiToggleIcon: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    aiToggleText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    aiInsightBox: {
      backgroundColor: theme.colors.bgSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    aiInsightText: {
      ...theme.typography.body,
      color: theme.colors.text,
      lineHeight: 20,
    },
    pdfCard: {
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm
    },
    pdfHint: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      marginBottom: 2,
    },
    pdfButtonsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      flexWrap: 'wrap'
    },
    pdfButton: {
      flex: 1
    },
    pdfFootnote: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: 2,
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
    pdfModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.65)',
      justifyContent: 'center',
      padding: theme.spacing.lg
    },
    pdfModalCard: {
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    pdfModalTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
      textAlign: 'center'
    },
    pdfModalList: {
      gap: theme.spacing.sm
    },
    pdfModalOption: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.bgSoft,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    pdfModalOptionText: {
      ...theme.typography.body,
      color: theme.colors.text,
      textAlign: 'center'
    },
    pdfModalClose: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border
    },
    pdfModalCloseText: {
      ...theme.typography.body,
      color: theme.colors.text,
      textAlign: 'center',
      fontWeight: '600'
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
    color: theme.colors.onPrimary,
    fontWeight: '600'
  }
})

export default ProgressScreen

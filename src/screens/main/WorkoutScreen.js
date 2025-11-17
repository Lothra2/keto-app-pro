import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native'
import { useApp } from '../../context/AppContext'
import { getTheme } from '../../theme'
import { getWorkoutData, saveWorkoutData } from '../../storage/storage'
import aiService from '../../api/aiService'
import WorkoutCard from '../../components/workout/WorkoutCard'
import Button from '../../components/shared/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { getWorkoutForDay } from '../../data/workouts'
import Card from '../../components/shared/Card'
import ScreenBanner from '../../components/shared/ScreenBanner'
import { exportWorkoutPlanPdf } from '../../utils/pdf'
import { getDayDisplayName } from '../../utils/labels'

const WorkoutScreen = ({ route, navigation }) => {
  const { dayIndex, weekNumber, focusDay } = route.params || {}
  const {
    theme: themeMode,
    language,
    currentDay,
    apiCredentials,
    metrics,
    derivedPlan,
    setCurrentDay,
    updateSettings,
    user
  } = useApp()

  const theme = getTheme(themeMode)
  const styles = getStyles(theme)

  const [workout, setWorkout] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState(null)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [detailExercise, setDetailExercise] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  const intensities = ['soft', 'medium', 'hard']
  const intensityLabels = {
    soft: language === 'en' ? 'Light' : 'Suave',
    medium: language === 'en' ? 'Medium' : 'Media',
    hard: language === 'en' ? 'Intense' : 'Intensa'
  }
  const selectedIntensity = metrics.workoutIntensity || 'medium'

  const totalDays = derivedPlan.length || 14
  const clampDay = day => Math.min(Math.max(day ?? 0, 0), Math.max(totalDays - 1, 0))

  // 1. calculamos el día inicial una sola vez
  const initialDay = clampDay(
    typeof focusDay === 'number'
      ? focusDay
      : typeof dayIndex === 'number'
      ? dayIndex
      : currentDay
  )

  const [activeDay, setActiveDay] = useState(initialDay)
  const safeActiveDay = clampDay(activeDay)
  const week = weekNumber || Math.floor(safeActiveDay / 7) + 1

  // 2. si cambian los params desde otra pantalla, lo aplicamos,
  // pero también lo guardamos en contexto una sola vez
  useEffect(() => {
    if (typeof focusDay === 'number' || typeof dayIndex === 'number') {
      const incoming = typeof focusDay === 'number' ? focusDay : dayIndex
      const clamped = clampDay(incoming)
      setActiveDay(clamped)
      setCurrentDay(clamped)
    }
  }, [focusDay, dayIndex, totalDays, setCurrentDay])

  // 3. si el contexto cambia por otra pantalla (por ejemplo Menú) lo traemos,
  // pero no escribimos otra vez en el contexto
  useEffect(() => {
    if (typeof currentDay === 'number') {
      const clamped = clampDay(currentDay)
      if (clamped !== safeActiveDay) {
        setActiveDay(clamped)
      }
    }
  }, [currentDay, safeActiveDay, totalDays])

  // 4. este era el que hacía ruido: actualizar los params cada vez
  // quítalo. Si lo necesitas, hazlo solo al montar.
  // useEffect(() => {
  //   navigation.setParams({ focusDay: safeActiveDay, weekNumber: week })
  // }, [navigation, safeActiveDay, week])

  useEffect(() => {
    loadWorkout(safeActiveDay)
  }, [safeActiveDay])

  const loadWorkout = async day => {
    const saved = await getWorkoutData(day)
    setWorkout(Array.isArray(saved) ? saved : [])
  }

  const handleGenerateWorkout = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      alert(
        language === 'en'
          ? 'Add your AI credentials in settings to use this feature.'
          : 'Agrega tus credenciales de IA en ajustes para usar esta función.'
      )
      return
    }

    setLoading(true)
    setLoadingType('day')
    setLoadingMessage(language === 'en' ? 'Creating your workout…' : 'Creando tu entreno…')
    try {
      const exercises = await aiService.generateWorkout({
        dayIndex: safeActiveDay,
        weekNumber: week,
        intensity: selectedIntensity,
        language,
        credentials: apiCredentials,
        userStats: {
          height: metrics.height || 170,
          weight: metrics.startWeight || 75,
          age: metrics.age || 30
        }
      })

      setWorkout(exercises)
      await saveWorkoutData(safeActiveDay, exercises)
    } catch (error) {
      console.error('Error generating workout:', error)
      alert(language === 'en' ? 'Error generating workout' : 'Error generando entreno')
    } finally {
      setLoading(false)
      setLoadingType(null)
      setLoadingMessage('')
    }
  }

  const handleGenerateWeek = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      alert(
        language === 'en'
          ? 'Add your AI credentials in settings to use this feature.'
          : 'Agrega tus credenciales de IA en ajustes para usar esta función.'
      )
      return
    }

    setLoading(true)
    setLoadingType('week')
    const startOfWeek = Math.floor(safeActiveDay / 7) * 7
    const endOfWeek = Math.min(startOfWeek + 7, totalDays)
    try {
      for (let day = startOfWeek; day < endOfWeek; day += 1) {
        const step = day - startOfWeek + 1
        setLoadingMessage(
          language === 'en'
            ? `Generating day ${step} of ${endOfWeek - startOfWeek}`
            : `Generando día ${step} de ${endOfWeek - startOfWeek}`
        )
        const exercises = await aiService.generateWorkout({
          dayIndex: day,
          weekNumber: Math.floor(day / 7) + 1,
          intensity: selectedIntensity,
          language,
          credentials: apiCredentials,
          userStats: {
            height: metrics.height || 170,
            weight: metrics.startWeight || 75,
            age: metrics.age || 30
          }
        })
        await saveWorkoutData(day, exercises)
        if (day === safeActiveDay) {
          setWorkout(exercises)
        }
      }
    } catch (error) {
      console.error('Error generating weekly workout:', error)
      alert(language === 'en' ? 'Error generating weekly plan' : 'Error generando plan semanal')
    } finally {
      setLoadingMessage('')
      setLoading(false)
      setLoadingType(null)
      await loadWorkout(safeActiveDay)
    }
  }

  const handleExportWorkoutPdf = useCallback(async () => {
    if (exportingPdf) return

    setExportingPdf(true)

    try {
      const startOfWeek = Math.floor(safeActiveDay / 7) * 7
      const endOfWeek = Math.min(startOfWeek + 7, totalDays)
      const weekIndex = Math.floor(startOfWeek / 7) + 1
      const daysPayload = []
      let weeklyFocus = ''

      for (let day = startOfWeek; day < endOfWeek; day += 1) {
        const planDay = derivedPlan[day] || {}
        const label =
          getDayDisplayName({
            label: planDay.dia,
            index: day,
            language,
            startDate: user?.startDate
          }) ||
          (language === 'en' ? `Day ${day + 1}` : `Día ${day + 1}`)
        const saved = await getWorkoutData(day)
        const exercises = Array.isArray(saved) ? saved : []
        const reference = getWorkoutForDay(language, Math.floor(day / 7) + 1, day % 7)

        if (!weeklyFocus && reference?.focus) {
          weeklyFocus = reference.focus
        }

        daysPayload.push({
          title: label,
          focus: reference?.focus || '',
          exercises,
          summary: !exercises.length ? reference?.today : '',
          duration:
            exercises.length > 0
              ? `${exercises.length} ${language === 'en' ? 'exercises' : 'ejercicios'}`
              : undefined
        })
      }

      if (!daysPayload.length) {
        throw new Error('No workouts to export')
      }

      await exportWorkoutPlanPdf({
        weekNumber: weekIndex,
        language,
        days: daysPayload,
        intensityLabel: `${language === 'en' ? 'Intensity' : 'Intensidad'}: ${intensityLabel}`,
        focus: weeklyFocus || localPlan.focus
      })
    } catch (error) {
      console.error('Workout PDF export error', error)
      Alert.alert(
        language === 'en' ? 'PDF error' : 'Error al exportar PDF',
        language === 'en'
          ? 'We could not build the workout PDF. Try again later.'
          : 'No pudimos generar el PDF de entrenos. Intenta más tarde.'
      )
    } finally {
      setExportingPdf(false)
    }
  }, [
    exportingPdf,
    safeActiveDay,
    totalDays,
    derivedPlan,
    language,
    intensityLabel,
    localPlan
  ])

  const handleExercisePress = exercise => {
    if (!exercise) return
    setDetailExercise(exercise)
  }

  const closeExerciseDetail = () => setDetailExercise(null)

  const localPlan = useMemo(() => {
    const plan = getWorkoutForDay(language, week, safeActiveDay % 7)

    if (plan) {
      return {
        ...plan,
        focus: plan.focus || '',
        today: plan.today || '',
        days: Array.isArray(plan.days) ? plan.days : []
      }
    }

    return { focus: '', today: '', days: [] }
  }, [language, week, safeActiveDay])

  const referenceExercises = useMemo(() => {
    if (!localPlan || !Array.isArray(localPlan.days)) return []
    const todayIndex = safeActiveDay % localPlan.days.length
    return localPlan.days.map((item, index) => ({
      nombre: item,
      descripcion:
        index === todayIndex
          ? language === 'en'
            ? 'Suggested focus for today'
            : 'Enfoque sugerido para hoy'
          : '',
      notas:
        index === todayIndex
          ? language === 'en'
            ? 'Finish with light stretching and deep breathing.'
            : 'Termina con estiramientos suaves y respiración profunda.'
          : ''
    }))
  }, [localPlan, safeActiveDay, language])

  const dayDisplayName =
    getDayDisplayName({
      label: derivedPlan[safeActiveDay]?.dia,
      index: safeActiveDay,
      language,
      startDate: user?.startDate
    }) || (language === 'en' ? `Day ${safeActiveDay + 1}` : `Día ${safeActiveDay + 1}`)
  const weekLabel = language === 'en' ? `Week ${week}` : `Semana ${week}`
  const intensityLabel = intensityLabels[selectedIntensity] || intensityLabels.medium

  const handleChangeDay = direction => {
    const next = clampDay(safeActiveDay + direction)
    if (next !== safeActiveDay) {
      setActiveDay(next)
      setCurrentDay(next) // aquí sí actualizamos contexto porque es acción del usuario
    }
  }

  const detailSections = useMemo(() => {
    if (!detailExercise) return []

    const sections = []
    const defaultHowTo =
      language === 'en'
        ? 'Focus on controlled reps, stable core and smooth breathing.'
        : 'Enfócate en repeticiones controladas, core estable y respiración fluida.'
    const description = detailExercise.descripcion || detailExercise.detalle || defaultHowTo

    sections.push({
      label: language === 'en' ? 'How to perform' : 'Cómo hacerlo',
      value: description
    })

    if (detailExercise.series) {
      sections.push({
        label: language === 'en' ? 'Series / time' : 'Series / tiempo',
        value: detailExercise.series
      })
    }

    const restMessage =
      detailExercise.descanso ||
      (language === 'en'
        ? 'Rest 30-45 seconds between sets.'
        : 'Descansa 30-45 segundos entre series.')

    sections.push({
      label: language === 'en' ? 'Rest' : 'Descanso',
      value: restMessage
    })

    if (detailExercise.notas) {
      sections.push({
        label: language === 'en' ? 'Coach notes' : 'Notas del coach',
        value: detailExercise.notas
      })
    }

    const intensityName = intensityLabels[selectedIntensity] || intensityLabels.medium
    const intensityTip =
      language === 'en'
        ? `Keep the effort at a ${intensityName.toLowerCase()} pace and finish with deep breathing.`
        : `Mantén el esfuerzo a un ritmo ${intensityName.toLowerCase()} y termina con respiración profunda.`

    sections.push({
      label: language === 'en' ? 'Intensity tip' : 'Tip de intensidad',
      value: intensityTip
    })

    return sections
  }, [detailExercise, language, selectedIntensity])

  return (
    <View style={styles.container}>
      <ScreenBanner
        theme={theme}
        icon="🏋️"
        title={language === 'en' ? 'Workouts' : 'Entrenos'}
        subtitle={`${weekLabel} · ${dayDisplayName}`}
        description={
          language === 'en'
            ? `Intensity: ${intensityLabel}`
            : `Intensidad: ${intensityLabel}`
        }
        badge={`${language === 'en' ? 'Plan days' : 'Días plan'} ${totalDays}`}
        badgeTone="info"
        rightSlot={
          <View style={styles.bannerControls}>
            <TouchableOpacity
              onPress={() => handleChangeDay(-1)}
              style={[styles.bannerControlButton, safeActiveDay === 0 && styles.bannerControlButtonDisabled]}
              disabled={safeActiveDay === 0}
            >
              <Text style={styles.bannerControlText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.bannerControlBadge}>{dayDisplayName}</Text>
            <TouchableOpacity
              onPress={() => handleChangeDay(1)}
              style={[
                styles.bannerControlButton,
                safeActiveDay >= totalDays - 1 && styles.bannerControlButtonDisabled
              ]}
              disabled={safeActiveDay >= totalDays - 1}
            >
              <Text style={styles.bannerControlText}>+</Text>
            </TouchableOpacity>
          </View>
        }
        footnote={
          language === 'en'
            ? 'Generate routines with AI or follow the base guide.'
            : 'Genera rutinas con IA o sigue la guía base.'
        }
        style={styles.banner}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.focusCard}>
          <View style={styles.focusHeader}>
            <Text style={styles.sectionTitle}>
              {language === 'en' ? 'Weekly focus' : 'Foco semanal'}
            </Text>
            <View style={styles.focusBadge}>
              <Text style={styles.focusBadgeText}>{weekLabel}</Text>
            </View>
          </View>
          <Text style={styles.focusDescription}>{localPlan.focus}</Text>
          <View style={styles.focusTodayRow}>
            <Text style={styles.focusTodayLabel}>
              {language === 'en' ? "Today's highlight" : 'Enfoque de hoy'}
            </Text>
            <Text style={styles.focusTodayValue}>{localPlan.today}</Text>
          </View>
        </Card>

        <Card style={styles.intensityCard}>
          <View style={styles.intensityHeader}>
            <Text style={styles.sectionSubtitle}>
              {language === 'en' ? 'Preferred intensity' : 'Intensidad preferida'}
            </Text>
            <Text style={styles.intensityBadge}>{intensityLabel}</Text>
          </View>
          <View style={styles.intensityRow}>
            {intensities.map(value => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.intensityChip,
                  selectedIntensity === value && styles.intensityChipActive
                ]}
                onPress={() => updateSettings('workout-intensity', value)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.intensityChipText,
                    selectedIntensity === value && styles.intensityChipTextActive
                  ]}
                >
                  {intensityLabels[value]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <View style={styles.generateSection}>
          <Button
            title={
              language === 'en' ? 'Generate workout for today 🤖' : 'Generar entreno de hoy 🤖'
            }
            onPress={handleGenerateWorkout}
            loading={loading && loadingType === 'day'}
            disabled={loading && loadingType !== 'day'}
            style={styles.generateButton}
          />
          <Button
            title={
              language === 'en' ? 'Generate full week plan 📅' : 'Generar plan semanal 📅'
            }
            onPress={handleGenerateWeek}
            variant='secondary'
            loading={loading && loadingType === 'week'}
            disabled={loading && loadingType !== 'week'}
            style={styles.generateButton}
          />
          {loadingMessage
            ? loadingType === 'week'
              ? <LoadingSpinner label={loadingMessage} />
              : <Text style={styles.loadingHint}>{loadingMessage}</Text>
            : null}
        </View>

        <Card style={styles.pdfCard}>
          <View style={styles.pdfHeader}>
            <Text style={styles.sectionTitle}>
              📄 {language === 'en' ? 'Weekly workouts PDF' : 'PDF semanal de entrenos'}
            </Text>
            <Text style={styles.pdfHint}>
              {language === 'en'
                ? 'Share the full routine for this week, including AI exercises.'
                : 'Comparte la rutina completa de la semana, con los ejercicios IA.'}
            </Text>
          </View>
          <Button
            title={language === 'en' ? 'Share workouts PDF' : 'Compartir PDF de entrenos'}
            onPress={handleExportWorkoutPdf}
            loading={exportingPdf}
            disabled={exportingPdf}
            style={styles.pdfButton}
          />
        </Card>

        <WorkoutCard
          title={language === 'en' ? 'AI workout' : 'Entreno IA'}
          focus={`${weekLabel} · ${dayDisplayName}`}
          exercises={workout}
          onExercisePress={handleExercisePress}
          collapsible
          initiallyCollapsed={false}
          collapsedHint={
            language === 'en'
              ? 'Tap to open the AI routine.'
              : 'Toca para abrir la rutina IA.'
          }
        />

        {referenceExercises.length
          ? (
            <WorkoutCard
              title={language === 'en' ? 'Local reference' : 'Referencia local'}
              focus={localPlan.focus}
              exercises={referenceExercises}
              collapsible
              initiallyCollapsed
              collapsedHint={
                language === 'en'
                  ? 'Tap to open the reference plan.'
                  : 'Toca para abrir el plan de referencia.'
              }
              onExercisePress={handleExercisePress}
            />
            )
          : null}

        {!workout.length && !loading
          ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {language === 'en'
                  ? 'No workout yet. Generate one with AI!'
                  : 'Sin entreno aún. ¡Genera uno con IA!'}
              </Text>
            </View>
            )
          : null}
      </ScrollView>

      <Modal
        visible={Boolean(detailExercise)}
        transparent
        animationType='fade'
        onRequestClose={closeExerciseDetail}
      >
        <View style={styles.detailOverlay}>
          <View style={[styles.detailCard, { backgroundColor: theme.colors.card }]}>
            <Text style={styles.detailTitle}>
              {detailExercise?.nombre ||
                detailExercise?.name ||
                (language === 'en' ? 'Exercise' : 'Ejercicio')}
            </Text>
            {detailSections.map((item, index) => (
              <View key={`${item.label}-${index}`} style={styles.detailSection}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.detailCloseButton} onPress={closeExerciseDetail}>
              <Text style={styles.detailCloseText}>{language === 'en' ? 'Close' : 'Cerrar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const getStyles = theme => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg
  },
  banner: {
    margin: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  bannerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  bannerControlButton: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(15,23,42,0.28)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bannerControlButtonDisabled: {
    opacity: 0.35
  },
  bannerControlText: {
    color: 'rgba(248,250,252,0.95)',
    fontSize: 18,
    fontWeight: '700'
  },
  bannerControlBadge: {
    ...theme.typography.body,
    color: 'rgba(248,250,252,0.95)',
    backgroundColor: 'rgba(15,23,42,0.2)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    fontWeight: '600'
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.lg
  },
  focusCard: {
    gap: theme.spacing.sm
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text
  },
  focusBadge: {
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full
  },
  focusBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600'
  },
  focusDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted
  },
  focusTodayRow: {
    marginTop: theme.spacing.sm,
    gap: 4
  },
  focusTodayLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted
  },
  focusTodayValue: {
    ...theme.typography.body,
    color: theme.colors.text
  },
  intensityCard: {
    gap: theme.spacing.md
  },
  intensityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  intensityBadge: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full
  },
  intensityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  intensityChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md
  },
  intensityChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  intensityChipText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  intensityChipTextActive: {
    color: '#fff',
    fontWeight: '600'
  },
  generateSection: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg
  },
  generateButton: {
    width: '100%'
  },
  pdfCard: {
    gap: theme.spacing.sm
  },
  pdfHeader: {
    gap: 4
  },
  pdfHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted
  },
  pdfButton: {
    alignSelf: 'flex-start'
  },
  loadingHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center'
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md
  },
  detailTitle: {
    ...theme.typography.h2,
    color: theme.colors.text
  },
  detailSection: {
    gap: 4
  },
  detailLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase'
  },
  detailValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    lineHeight: 20
  },
  detailCloseButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary
  },
  detailCloseText: {
    ...theme.typography.caption,
    color: '#fff',
    fontWeight: '600'
  }
})

export default WorkoutScreen

import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native'
import { useApp } from '../../context/AppContext'
import { getTheme } from '../../theme'
import Button from '../../components/shared/Button'
import Card from '../../components/shared/Card'
import MealCard from '../../components/meals/MealCard'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import {
  getDayData,
  saveDayData,
  getCalorieState,
  saveCalorieState
} from '../../storage/storage'
import aiService from '../../api/aiService'
import {
  getDailyTip,
  getLocalMealTip,
  getMotivationalMessage
} from '../../data/tips'

const mealPercents = {
  desayuno: 0.25,
  snackAM: 0.1,
  almuerzo: 0.35,
  snackPM: 0.1,
  cena: 0.2
}

const MealGeneratorModal = ({ route, navigation }) => {
  const { dayIndex = 0, mealKey, mode = 'meal' } = route.params || {}
  const {
    derivedPlan,
    theme: themeMode,
    language,
    foodPrefs,
    apiCredentials,
    user
  } = useApp()

  const theme = getTheme(themeMode)
  const styles = getStyles(theme)

  const baseDay = derivedPlan[dayIndex] || {}
  const [storedDay, setStoredDay] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [calorieState, setCalorieState] = useState(null)

  const isFullDay = mode === 'full-day'

  const titles = useMemo(
    () => ({
      meal: language === 'en' ? 'Generate meal with AI' : 'Generar comida con IA',
      'full-day': language === 'en' ? 'Generate full day with AI' : 'Generar día completo con IA'
    }),
    [language]
  )

  useEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  useEffect(() => {
    loadDay()
  }, [dayIndex])

  const loadDay = async () => {
    const stored = await getDayData(dayIndex)
    const calState = await getCalorieState(dayIndex, baseDay.kcal || 1600)
    setCalorieState(calState)
    setStoredDay(stored)
  }

  const buildExistingMeals = () => {
    const keys = ['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena']
    const names = []
    keys.forEach((k) => {
      const fromStored = storedDay?.[k]?.nombre
      const fromBase = baseDay?.[k]?.nombre
      if (fromStored) names.push(fromStored)
      else if (fromBase) names.push(fromBase)
    })
    return names
  }

  // ahora vamos a mirar hasta 7 días hacia atrás
  const buildRecentMealsForFullDay = async (currentIndex) => {
    const collected = []
    const lookback = []
    for (let i = 1; i <= 7; i += 1) {
      if (currentIndex - i >= 0) {
        lookback.push(currentIndex - i)
      }
    }

    for (const idx of lookback) {
      // eslint-disable-next-line no-await-in-loop
      const d = await getDayData(idx)
      if (d) {
        ;['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena'].forEach((k) => {
          const name = d[k]?.nombre
          if (name) collected.push(name)
        })
      }
    }

    // también el día que estamos editando si ya tenía algo
    ;['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena'].forEach((k) => {
      const name = baseDay?.[k]?.nombre
      if (name) collected.push(name)
    })

    return collected
  }

  const handleGenerate = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to use AI.'
          : 'Agrega tus credenciales de Grok en ajustes para usar la IA.'
      )
      return
    }

    setLoading(true)

    try {
      if (isFullDay) {
        const recentMeals = await buildRecentMealsForFullDay(dayIndex)
        const payload = await aiService.generateFullDay({
          dayIndex,
          kcal: baseDay.kcal || 1600,
          language,
          preferences: foodPrefs,
          credentials: apiCredentials,
          username: user.name || 'user',
          recentMeals
        })
        setResult(payload)
      } else if (mealKey) {
        const mealTarget = Math.round(
          (baseDay.kcal || 1600) * (mealPercents[mealKey] || 0.3)
        )
        const existingMeals = buildExistingMeals()
        const payload = await aiService.generateMeal({
          mealType: mealKey,
          kcal: mealTarget,
          language,
          preferences: foodPrefs,
          credentials: apiCredentials,
          existingMeals
        })
        setResult(payload)
      }
    } catch (error) {
      console.error(error)
      Alert.alert(
        language === 'en' ? 'AI error' : 'Error con IA',
        language === 'en'
          ? 'We could not generate data. Try again later.'
          : 'No pudimos generar datos. Intenta más tarde.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!result) return

    const baseData = storedDay ? { ...storedDay } : {}
    let updated = baseData

    if (isFullDay) {
      updated = { ...baseData, ...result, isAI: true }
      await saveCalorieState(dayIndex, {
        ...(calorieState || {}),
        goal: result.kcal || baseDay.kcal || 1600
      })
    } else if (mealKey) {
      updated = {
        ...baseData,
        [mealKey]: result
      }
    }

    await saveDayData(dayIndex, updated)
    navigation.goBack()
  }

  const localTip = mealKey ? getLocalMealTip(mealKey) : getDailyTip(language, dayIndex)
  const motivation = getMotivationalMessage(language, dayIndex)

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{titles[isFullDay ? 'full-day' : 'meal']}</Text>
        <Button
          title={language === 'en' ? 'Close' : 'Cerrar'}
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 {language === 'en' ? 'Tip' : 'Tip'}</Text>
          <Text style={styles.tipText}>{localTip}</Text>
        </Card>

        <Card style={styles.tipCard}>
          <Text style={styles.tipTitle}>💪 {language === 'en' ? 'Motivation' : 'Motivación'}</Text>
          <Text style={styles.tipText}>{motivation}</Text>
        </Card>

        {!isFullDay && mealKey ? (
          <MealCard
            title={mealKey}
            icon="🍽"
            mealData={result || storedDay?.[mealKey] || baseDay[mealKey]}
            showAIButton={false}
            readOnly
          />
        ) : null}

        {isFullDay && (result || baseDay) ? (
          <Card style={styles.dayCard}>
            <Text style={styles.dayTitle}>
              {language === 'en' ? `Day ${dayIndex + 1}` : `Día ${dayIndex + 1}`}
            </Text>
            <Text style={styles.daySubtitle}>
              {(result?.kcal || baseDay.kcal || 1600)} kcal ·{' '}
              {result?.macros?.carbs || baseDay.macros?.carbs} C ·{' '}
              {result?.macros?.prot || baseDay.macros?.prot} P ·{' '}
              {result?.macros?.fat || baseDay.macros?.fat} G
            </Text>
            {['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena'].map((key) => {
              const meal = (result && result[key]) || baseDay[key]
              if (!meal) return null
              return (
                <View key={key} style={styles.mealRow}>
                  <Text style={styles.mealKey}>{key.toUpperCase()}</Text>
                  <Text style={styles.mealName}>{meal.nombre || ''}</Text>
                  {meal.qty ? <Text style={styles.mealQty}>{meal.qty}</Text> : null}
                </View>
              )
            })}
          </Card>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <LoadingSpinner
              label={language === 'en' ? 'Asking AI…' : 'Consultando IA…'}
            />
          </View>
        ) : (
          <Button
            title={language === 'en' ? 'Generate with AI 🤖' : 'Generar con IA 🤖'}
            onPress={handleGenerate}
            style={styles.generateButton}
          />
        )}

        {result ? (
          <Button
            title={language === 'en' ? 'Save and close' : 'Guardar y cerrar'}
            onPress={handleSave}
            variant="secondary"
            style={styles.saveButton}
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1
    },
    header: {
      paddingTop: theme.spacing.xl + 16,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text
    },
    closeButton: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md
    },
    tipCard: {
      gap: theme.spacing.xs
    },
    tipTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    tipText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    dayCard: {
      gap: theme.spacing.sm
    },
    dayTitle: {
      ...theme.typography.h3,
      color: theme.colors.text
    },
    daySubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    mealRow: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.sm
    },
    mealKey: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    mealName: {
      ...theme.typography.body,
      color: theme.colors.text
    },
    mealQty: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    loadingBox: {
      marginTop: theme.spacing.lg
    },
    generateButton: {
      marginTop: theme.spacing.md
    },
    saveButton: {
      marginTop: theme.spacing.sm
    }
  })

export default MealGeneratorModal

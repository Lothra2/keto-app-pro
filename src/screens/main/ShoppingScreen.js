import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native'
import { useApp } from '../../context/AppContext'
import { getTheme } from '../../theme'
import { getDayData, getShoppingList, saveShoppingList } from '../../storage/storage'
import aiService from '../../api/aiService'
import { mergePlanDay, buildWeekAiPayload } from '../../utils/plan'
import { stripMarkdownHeadings } from '../../utils/labels'

const ShoppingScreen = () => {
  const {
    theme: themeMode,
    language,
    currentWeek,
    foodPrefs,
    apiCredentials,
    derivedPlan
  } = useApp()

  const theme = getTheme(themeMode)
  const styles = getStyles(theme)

  const [aiList, setAiList] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // misma lógica de parseo, pero reusable
  const parseAiList = useCallback(
    (text) => {
      if (!text) return []

      const cleanedText = stripMarkdownHeadings(text).replace(/\*/g, '')
      const lines = cleanedText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const sections = []
      let current = null

      const pushSection = (title) => {
        current = { title, items: [] }
        sections.push(current)
      }

      lines.forEach((line) => {
        const headingMatch = line.match(/^([^•]+):$/)
        if (headingMatch) {
          pushSection(headingMatch[1])
          return
        }

        if (line.startsWith('•')) {
          const cleaned = line.replace(/^•\s*/, '').trim()
          if (!current) {
            pushSection(language === 'en' ? 'Items' : 'Artículos')
          }
          current.items.push(cleaned)
          return
        }

        if (!current) {
          pushSection(language === 'en' ? 'Notes' : 'Notas')
        }
        current.items.push(line)
      })

      return sections.filter((section) => section.items.length)
    },
    [language]
  )

  // aiSections derivado de aiList
  const aiSections = useMemo(() => {
    return parseAiList(aiList)
  }, [aiList, parseAiList])

  useEffect(() => {
    loadSavedList()
  }, [currentWeek])

  const loadSavedList = async () => {
    const saved = await getShoppingList(currentWeek)
    if (saved) {
      setAiList(saved)
      setLastUpdated(new Date().toISOString())
    } else {
      setAiList('')
      setLastUpdated(null)
    }
  }

  const handleGenerateAIList = async () => {
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
      const startIdx = (currentWeek - 1) * 7
      const endIdx = Math.min(currentWeek * 7, derivedPlan.length)
      const days = []

      for (let index = startIdx; index < endIdx; index++) {
        const base = derivedPlan[index]
        const stored = await getDayData(index)
        days.push(mergePlanDay(base, stored || {}))
      }

      const payload = buildWeekAiPayload(days)

      const list = await aiService.generateShoppingList({
        weekNumber: currentWeek,
        days: payload,
        language,
        credentials: apiCredentials,
        foodPrefs // ahora sí mandamos gustos/no gustos
      })

      setAiList(list)
      await saveShoppingList(currentWeek, list)
      setLastUpdated(new Date().toISOString())
    } catch (error) {
      console.error('Error generando lista:', error)
      Alert.alert(
        language === 'en' ? 'AI error' : 'Error con IA',
        language === 'en'
          ? 'We could not generate the list. Try later.'
          : 'No pudimos generar la lista. Intenta más tarde.'
      )
    } finally {
      setLoading(false)
    }
  }

  const baseList =
    language === 'en'
      ? [
          { cat: 'Proteins', items: 'Eggs, chicken, salmon, shrimp, beef, greek yogurt' },
          { cat: 'Veggies', items: 'Broccoli, cauliflower, cherry tomato, rocket, avocado, mushrooms' },
          { cat: 'Healthy fats', items: 'Butter, olive oil, heavy cream, feta cheese' },
          { cat: 'Snacks', items: 'Cashews, nuts, chia, shredded coconut' },
          { cat: 'Others', items: 'Sugar-free coffee, pink salt, lemon' }
        ]
      : [
          { cat: 'Proteínas', items: 'Huevos, pollo, salmón, camarones, carne de res, yogur griego' },
          { cat: 'Verduras', items: 'Brócoli, coliflor, tomate cherry, rúcula/rocket, aguacate, champiñón' },
          { cat: 'Grasas buenas', items: 'Mantequilla, aceite de oliva, crema de leche, queso feta' },
          { cat: 'Snacks', items: 'Marañones, nueces, chía, coco rallado' },
          { cat: 'Otros', items: 'Café sin azúcar, sal rosada, limón' }
        ]

  const prettyDate = lastUpdated ? new Date(lastUpdated).toLocaleString() : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenBanner
        theme={theme}
        icon="🛒"
        title={language === 'en' ? 'Shopping List' : 'Lista de compras'}
        subtitle={language === 'en' ? `Week ${currentWeek}` : `Semana ${currentWeek}`}
        description={
          language === 'en'
            ? 'Base groceries plus AI suggestions for your keto plan.'
            : 'Compras base más sugerencias IA para tu plan keto.'
        }
        badge={
          prettyDate
            ? language === 'en'
              ? 'AI list ready'
              : 'Lista IA lista'
            : language === 'en'
            ? 'Pending list'
            : 'Lista pendiente'
        }
        badgeTone={prettyDate ? 'success' : 'warning'}
        footnote={
          prettyDate
            ? `${language === 'en' ? 'Updated on' : 'Actualizada'} ${prettyDate}`
            : language === 'en'
            ? 'Generate it with one tap to save time at the store.'
            : 'Genérala con un toque para ahorrar tiempo en la tienda.'
        }
        style={styles.banner}
      />

      {/* card acción */}
      <View style={styles.actionCard}>
        <Text style={styles.actionTitle}>
          {language === 'en'
            ? 'Generate your shopping list from this week plan'
            : 'Genera tu lista desde el plan de esta semana'}
        </Text>
        <Text style={styles.actionText}>
          {language === 'en'
            ? 'We read your meals and give you grouped items.'
            : 'Leemos tus comidas y te damos los ítems agrupados.'}
        </Text>

        <TouchableOpacity
          style={[styles.aiButton, loading && { opacity: 0.6 }]}
          onPress={handleGenerateAIList}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.aiButtonText}>
              {language === 'en' ? 'Generate AI list 🤖' : 'Generar lista IA 🤖'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* resultado IA */}
      <View style={styles.aiListBox}>
        <View style={styles.aiHeaderRow}>
          <Text style={styles.aiListTitle}>
            {language === 'en' ? 'AI Shopping List' : 'Lista IA'}
          </Text>
          {aiList ? (
            <Text style={styles.aiChip}>
              {language === 'en' ? 'Ready' : 'Lista'}
            </Text>
          ) : (
            <Text style={[styles.aiChip, styles.aiChipEmpty]}>
              {language === 'en' ? 'Empty' : 'Vacía'}
            </Text>
          )}
        </View>

        {aiList ? (
          aiSections && aiSections.length ? (
            <View style={styles.aiListSections}>
              {aiSections.map((section, sectionIndex) => (
                <View key={`${section.title}-${sectionIndex}`} style={styles.aiListSection}>
                  <Text style={styles.aiListSectionTitle}>{section.title}</Text>
                  {section.items.map((item, itemIndex) => (
                    <View key={`${item}-${itemIndex}`} style={styles.aiListItem}>
                      <Text style={styles.aiListBullet}>•</Text>
                      <Text style={styles.aiListItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.aiListText}>{aiList}</Text>
          )
        ) : (
          <Text style={styles.emptyText}>
            {language === 'en'
              ? 'You don’t have an AI list yet. Tap the button above.'
              : 'Aún no tienes una lista de IA. Toca el botón de arriba.'}
          </Text>
        )}
      </View>

      {/* base */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {language === 'en' ? 'Base shopping list' : 'Lista base de compras'}
          </Text>
          <Text style={styles.sectionHint}>
            {language === 'en' ? 'Keto friendly' : 'Apta keto'}
          </Text>
        </View>

        {baseList.map((item, index) => (
          <View key={index} style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>{item.cat}</Text>
            <Text style={styles.categoryItems}>{item.items}</Text>
          </View>
        ))}
      </View>
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
      paddingBottom: 140,
      gap: theme.spacing.lg
    },
    banner: {
      marginBottom: theme.spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6
    },
    actionCard: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md
    },
    actionTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
      marginBottom: 4
    },
    actionText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.sm
    },
    aiButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.sm,
      paddingVertical: 10,
      alignItems: 'center'
    },
    aiButtonText: {
      ...theme.typography.body,
      color: '#fff',
      fontWeight: '600'
    },
    aiListBox: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md
    },
    aiHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm
    },
    aiListTitle: {
      ...theme.typography.h3,
      color: theme.colors.text
    },
    aiChip: {
      backgroundColor: 'rgba(34,197,94,0.15)',
      color: '#fff',
      fontSize: 11,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden'
    },
    aiChipEmpty: {
      backgroundColor: 'rgba(226,232,240,0.05)',
      color: theme.colors.textMuted
    },
    aiListSections: {
      gap: theme.spacing.md
    },
    aiListSection: {
      gap: theme.spacing.xs
    },
    aiListSectionTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    aiListItem: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'flex-start'
    },
    aiListBullet: {
      color: theme.colors.primary,
      fontSize: 14,
      lineHeight: 18
    },
    aiListItemText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      flex: 1,
      lineHeight: 18
    },
    aiListText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text
    },
    emptyText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    section: {
      gap: theme.spacing.sm
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.colors.text
    },
    sectionHint: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    categoryCard: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md
    },
    categoryTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
      marginBottom: 4
    },
    categoryItems: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      lineHeight: 18
    }
  })

export default ShoppingScreen

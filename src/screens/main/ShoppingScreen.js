import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { getDayData, getShoppingList, saveShoppingList } from '../../storage/storage';
import aiService from '../../api/aiService';
import { mergePlanDay, buildWeekAiPayload } from '../../utils/plan';
import { stripMarkdownHeadings } from '../../utils/labels';

const ShoppingScreen = () => {
  const {
    theme: themeMode,
    language,
    currentWeek,
    foodPrefs,
    apiCredentials,
    derivedPlan
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [aiList, setAiList] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiSections, setAiSections] = useState([]);

  const parseAiList = useCallback((text) => {
    if (!text) return [];

    const cleanedText = stripMarkdownHeadings(text).replace(/\*/g, '');
    const lines = cleanedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const sections = [];
    let current = null;

    const pushSection = (title) => {
      current = { title, items: [] };
      sections.push(current);
    };

    lines.forEach((line) => {
      const headingMatch = line.match(/^([^•]+):$/);
      if (headingMatch) {
        pushSection(headingMatch[1]);
        return;
      }

      if (line.startsWith('•')) {
        const cleaned = line.replace(/^•\s*/, '').trim();
        if (!current) {
          pushSection(language === 'en' ? 'Items' : 'Artículos');
        }
        current.items.push(cleaned);
        return;
      }

      if (!current) {
        pushSection(language === 'en' ? 'Notes' : 'Notas');
      }
      current.items.push(line);
    });

    return sections.filter((section) => section.items.length);
  }, [language]);

  useEffect(() => {
    loadSavedList();
  }, [currentWeek]);

  useEffect(() => {
    if (aiList) {
      setAiSections(parseAiList(aiList));
    } else {
      setAiSections([]);
    }
  }, [aiList, parseAiList]);

  const loadSavedList = async () => {
    const saved = await getShoppingList(currentWeek);
    if (saved) {
      setAiList(saved);
      setAiSections(parseAiList(saved));
    }
  };

  const handleGenerateAIList = async () => {
    if (!apiCredentials.user || !apiCredentials.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to use AI.'
          : 'Agrega tus credenciales de Grok en ajustes para usar la IA.'
      );
      return;
    }

    setLoading(true);
    try {
      const startIdx = (currentWeek - 1) * 7;
      const endIdx = Math.min(currentWeek * 7, derivedPlan.length);
      const days = [];

      for (let index = startIdx; index < endIdx; index++) {
        const base = derivedPlan[index];
        const stored = await getDayData(index);
        days.push(mergePlanDay(base, stored || {}));
      }

      const payload = buildWeekAiPayload(days);
      const list = await aiService.generateShoppingList({
        weekNumber: currentWeek,
        days: payload,
        language,
        credentials: apiCredentials
      });

      setAiList(list);
      setAiSections(parseAiList(list));
      await saveShoppingList(currentWeek, list);
    } catch (error) {
      console.error('Error generando lista:', error);
      Alert.alert(
        language === 'en' ? 'AI error' : 'Error con IA',
        language === 'en'
          ? 'We could not generate the list. Try later.'
          : 'No pudimos generar la lista. Intenta más tarde.'
      );
    } finally {
      setLoading(false);
    }
  };

  const baseList = language === 'en'
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
      ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'en' ? '🛒 Shopping List' : '🛒 Lista de Compras'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'en' ? `Week ${currentWeek}` : `Semana ${currentWeek}`}
        </Text>
      </View>

      {/* AI Generate Button */}
      <TouchableOpacity
        style={styles.aiButton}
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

      {/* AI Generated List */}
      {aiList ? (
        <View style={styles.aiListBox}>
          <Text style={styles.aiListTitle}>
            {language === 'en' ? 'AI Shopping List' : 'Lista IA'}
          </Text>
          {aiSections.length ? (
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
          )}
        </View>
      ) : null}

      {/* Base List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Base Shopping List' : 'Lista base de compras'}
        </Text>
        {baseList.map((item, index) => (
          <View key={index} style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>{item.cat}</Text>
            <Text style={styles.categoryItems}>{item.items}</Text>
          </View>
        ))}
      </View>
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
  aiButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.lg
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
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg
  },
  aiListTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm
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
    alignItems: 'flex-start',
    gap: 8
  },
  aiListBullet: {
    color: theme.colors.primary,
    fontSize: 12,
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
    color: theme.colors.text,
    lineHeight: 20
  },
  section: {
    marginBottom: theme.spacing.lg
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md
  },
  categoryCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
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
});

export default ShoppingScreen;
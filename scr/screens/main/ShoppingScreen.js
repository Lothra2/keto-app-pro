import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import { getShoppingList, saveShoppingList } from '../../storage/storage';
import aiService from '../../api/aiService';

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

  useEffect(() => {
    loadSavedList();
  }, [currentWeek]);

  const loadSavedList = async () => {
    const saved = await getShoppingList(currentWeek);
    if (saved) {
      setAiList(saved);
    }
  };

  const handleGenerateAIList = async () => {
    setLoading(true);
    try {
      // Aquí implementarías la lógica para generar lista con IA
      // Similar a tu función improveShoppingWithAI
      const startIdx = (currentWeek - 1) * 7;
      const endIdx = Math.min(currentWeek * 7, derivedPlan.length);

      // Placeholder - implementa según tu lógica
      const list = `Generando lista para semana ${currentWeek}...\n\nProteínas:\n- Pollo 1kg\n- Salmón 500g\n- Huevos 1 docena\n\nVegetales:\n- Brócoli 500g\n- Aguacate 4 unidades`;

      setAiList(list);
      await saveShoppingList(currentWeek, list);
    } catch (error) {
      console.error('Error generando lista:', error);
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
          <Text style={styles.aiListText}>{aiList}</Text>
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
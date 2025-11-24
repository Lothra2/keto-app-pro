import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import {
  getCalorieState,
  getDayData,
  saveCalorieState,
  saveDayData,
} from '../../storage/storage';
import aiService from '../../api/aiService';
import { calculateDynamicDailyKcal, getMealDistribution } from '../../utils/calculations';

const defaultMealState = {
  desayuno: false,
  snackAM: false,
  almuerzo: false,
  snackPM: false,
  cena: false,
};

const ManualMealModal = ({ route, navigation }) => {
  const { dayIndex = 0, mealKey } = route.params || {};
  const { derivedPlan, theme: themeMode, language, apiCredentials, gender, metrics } = useApp();
  const theme = getTheme(themeMode);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const baseDay = derivedPlan?.[dayIndex] || {};
  const [storedDay, setStoredDay] = useState(null);
  const [calorieState, setCalorieState] = useState(null);
  const [description, setDescription] = useState('');
  const [portion, setPortion] = useState('');
  const [kcal, setKcal] = useState('');
  const [note, setNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [estimatedByAI, setEstimatedByAI] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [dayIndex, mealKey]);

  const loadData = useCallback(async () => {
    const stored = await getDayData(dayIndex);
    const calState = await getCalorieState(dayIndex, baseDay.kcal || 1600);

    setStoredDay(stored || {});
    setCalorieState(calState);

    const existing = stored?.[mealKey] || baseDay?.[mealKey];
    setDescription(existing?.descripcion || existing?.qty || '');
    setPortion(existing?.portion || '');
    setKcal(existing?.kcal ? String(existing.kcal) : '');
    setNote(existing?.note || '');
    setEstimatedByAI(Boolean(existing?.estimatedByAI));
  }, [baseDay, dayIndex, mealKey]);

  const computeConsumedFromDay = useCallback(
    (day, mealsState, fallbackGoal) => {
      const mealKeys = ['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena'];
      const dayKcal = day?.dynamicKcal || day?.planKcal || day?.kcal || fallbackGoal;
      const dist = getMealDistribution(gender);

      return mealKeys.reduce((sum, key) => {
        if (!mealsState[key]) return sum;
        const mealObj = day?.[key];
        const mealKcal = mealObj?.kcal
          ? Number(mealObj.kcal)
          : Math.round(dayKcal * (dist[key] || 0.2));
        return sum + mealKcal;
      }, 0);
    },
    [gender]
  );

  const handleEstimate = useCallback(async () => {
    if (!description.trim()) {
      Alert.alert(
        language === 'en' ? 'Add a description' : 'Agrega una descripción',
        language === 'en'
          ? 'Tell us what you ate so we can estimate calories.'
          : 'Cuéntanos qué comiste para estimar las calorías.'
      );
      return;
    }

    if (!apiCredentials.user || !apiCredentials.pass) {
      Alert.alert(
        language === 'en' ? 'Missing credentials' : 'Faltan credenciales',
        language === 'en'
          ? 'Add your Grok credentials in settings to ask AI for calories.'
          : 'Agrega tus credenciales de Grok en ajustes para pedir kcal a la IA.'
      );
      return;
    }

    setAiLoading(true);
    try {
      const dayKcal = calculateDynamicDailyKcal({
        baseKcal: baseDay.kcal || storedDay?.kcal || 1600,
        gender,
        metrics,
        cheatKcal: storedDay?.cheatKcal || 0,
      });
      const consumed = computeConsumedFromDay(storedDay || baseDay, calorieState?.meals || defaultMealState, dayKcal);
      const estimate = await aiService.estimateMealCalories({
        mealKey,
        description: description.trim(),
        portion: portion.trim(),
        language,
        credentials: apiCredentials,
        dayKcal,
        consumedKcal: consumed,
      });

      if (estimate?.kcalEstimate) {
        setKcal(String(estimate.kcalEstimate));
        setNote(estimate.note || '');
        setEstimatedByAI(true);
      }
    } catch (error) {
      console.error('Error estimating meal kcal:', error);
      Alert.alert(
        language === 'en' ? 'AI error' : 'Error con IA',
        language === 'en'
          ? 'We could not estimate calories. Try again or enter them manually.'
          : 'No pudimos estimar las calorías. Intenta otra vez o ingrésalas manualmente.'
      );
    } finally {
      setAiLoading(false);
    }
  }, [
    apiCredentials,
    baseDay,
    calorieState?.meals,
    computeConsumedFromDay,
    description,
    gender,
    language,
    mealKey,
    metrics,
    portion,
    storedDay,
  ]);

  const handleSave = useCallback(async () => {
    const cleanDescription = description.trim();
    const parsedKcal = Number(kcal);

    if (!cleanDescription) {
      Alert.alert(
        language === 'en' ? 'Add what you ate' : 'Agrega qué comiste',
        language === 'en'
          ? 'Describe the meal so we can store it.'
          : 'Describe la comida para guardarla.'
      );
      return;
    }

    if (!Number.isFinite(parsedKcal) || parsedKcal <= 0) {
      Alert.alert(
        language === 'en' ? 'Calories needed' : 'Faltan calorías',
        language === 'en'
          ? 'Add the estimated calories (manually or with AI).'
          : 'Agrega las calorías estimadas (manual o IA).'
      );
      return;
    }

    setSaving(true);
    try {
      const baseData = storedDay ? { ...storedDay } : {};
      const goal = calculateDynamicDailyKcal({
        baseKcal: baseDay.kcal || baseData.kcal || 1600,
        gender,
        metrics,
        cheatKcal: baseData.cheatKcal || 0,
      });

      baseData[mealKey] = {
        ...(baseData[mealKey] || baseDay?.[mealKey] || {}),
        nombre:
          baseData[mealKey]?.nombre ||
          baseDay?.[mealKey]?.nombre ||
          (language === 'en' ? 'Manual meal' : 'Comida manual'),
        qty: cleanDescription,
        descripcion: cleanDescription,
        portion: portion.trim(),
        kcal: Math.round(parsedKcal),
        estimatedByAI,
        note,
        source: 'manual',
        fromAI: false,
        isAI: false,
      };

      const newMealsState = {
        ...(calorieState?.meals || defaultMealState),
        [mealKey]: true,
      };

      await saveDayData(dayIndex, baseData);
      await saveCalorieState(dayIndex, {
        ...(calorieState || {}),
        goal,
        meals: newMealsState,
      });

      Alert.alert(
        language === 'en' ? 'Meal saved' : 'Comida guardada',
        language === 'en'
          ? 'We updated this meal and your calories for the day.'
          : 'Actualizamos esta comida y tus calorías del día.'
      );
      navigation.goBack();
    } catch (error) {
      console.error('Error saving manual meal:', error);
      Alert.alert(
        language === 'en' ? 'Save error' : 'Error al guardar',
        language === 'en' ? 'Could not save the meal. Try again.' : 'No pudimos guardar la comida. Intenta nuevamente.'
      );
    } finally {
      setSaving(false);
    }
  }, [
    baseDay,
    calorieState,
    dayIndex,
    description,
    estimatedByAI,
    gender,
    kcal,
    language,
    mealKey,
    metrics,
    navigation,
    note,
    portion,
    storedDay,
  ]);

  const mealTitles = {
    desayuno: language === 'en' ? 'Breakfast' : 'Desayuno',
    snackAM: language === 'en' ? 'Snack AM' : 'Snack AM',
    almuerzo: language === 'en' ? 'Lunch' : 'Almuerzo',
    snackPM: language === 'en' ? 'Snack PM' : 'Snack PM',
    cena: language === 'en' ? 'Dinner' : 'Cena',
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'en' ? 'Manual meal log' : 'Registro manual de comida'}
        </Text>
        <Button
          title={language === 'en' ? 'Close' : 'Cerrar'}
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <Text style={styles.label}>{mealTitles[mealKey] || mealKey}</Text>
          <Text style={styles.hint}>
            {language === 'en'
              ? 'Describe what you actually ate. We will update this meal and your calories.'
              : 'Describe lo que comiste. Actualizaremos esta comida y tus calorías.'}
          </Text>

          <TextInput
            style={[styles.input, styles.textarea, { borderColor: theme.colors.border }]}
            placeholder={language === 'en' ? 'Food, ingredients, swaps…' : 'Comida, ingredientes, cambios…'}
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TextInput
            style={[styles.input, { borderColor: theme.colors.border }]}
            placeholder={language === 'en' ? 'Portion or amount (optional)' : 'Porción o cantidad (opcional)'}
            placeholderTextColor={theme.colors.textMuted}
            value={portion}
            onChangeText={setPortion}
          />

          <View style={styles.kcalRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>{language === 'en' ? 'Estimated kcal' : 'Kcal estimadas'}</Text>
              <TextInput
                style={[styles.input, styles.kcalInput, { borderColor: theme.colors.border }]}
                keyboardType="numeric"
                placeholder="420"
                placeholderTextColor={theme.colors.textMuted}
                value={kcal}
                onChangeText={setKcal}
              />
            </View>
            <Button
              title={aiLoading ? (language === 'en' ? 'Estimating…' : 'Estimando…') : language === 'en' ? 'Ask AI' : 'Pedir a IA'}
              onPress={aiLoading ? undefined : handleEstimate}
              disabled={aiLoading}
              variant="secondary"
              style={styles.aiButton}
            />
          </View>

          {note ? <Text style={styles.note}>{note}</Text> : null}

          <View style={styles.actions}>
            <Button
              title={saving ? (language === 'en' ? 'Saving…' : 'Guardando…') : language === 'en' ? 'Save meal' : 'Guardar comida'}
              onPress={saving ? undefined : handleSave}
              disabled={saving}
              style={styles.saveButton}
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    closeButton: {
      minWidth: 96,
    },
    scroll: {
      flex: 1,
    },
    card: {
      marginHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '700',
    },
    hint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },
    input: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 10,
      backgroundColor: theme.colors.cardSoft,
      color: theme.colors.text,
      ...theme.typography.bodySmall,
    },
    textarea: {
      minHeight: 90,
      textAlignVertical: 'top',
    },
    subLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    kcalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    kcalInput: {
      marginTop: 4,
    },
    aiButton: {
      minWidth: 120,
      alignSelf: 'flex-end',
    },
    actions: {
      marginTop: theme.spacing.sm,
    },
    saveButton: {
      width: '100%',
    },
    note: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.bgSoft,
      padding: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });

export default ManualMealModal;

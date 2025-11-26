import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import {
  getCalorieState,
  getCheatMeal,
  getDayData,
  saveCalorieState,
  saveDayData,
} from '../../storage/storage';
import aiService from '../../api/aiService';
import { calculateDynamicDailyKcal, getMealDistribution } from '../../utils/calculations';
import { mergePlanDay } from '../../utils/plan';

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
  const [activeDay, setActiveDay] = useState(baseDay);
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
    const cheat = await getCheatMeal(dayIndex);
    const calState = await getCalorieState(dayIndex, baseDay.kcal || stored?.kcal || 1600);

    setStoredDay(stored || {});
    setCalorieState(calState);

    const mergedDay = mergePlanDay(baseDay, stored || {});

    if (cheat?.mealKey) {
      mergedDay[cheat.mealKey] = {
        ...(mergedDay?.[cheat.mealKey] || {}),
        nombre: language === 'en' ? 'Cheat meal' : 'Cheat meal',
        descripcion: cheat.description || mergedDay?.[cheat.mealKey]?.descripcion || '',
        qty: cheat.portion || mergedDay?.[cheat.mealKey]?.qty || '',
        portion: cheat.portion || mergedDay?.[cheat.mealKey]?.portion || '',
        kcal: cheat.kcalEstimate ? Number(cheat.kcalEstimate) : mergedDay?.[cheat.mealKey]?.kcal,
        estimatedByAI: Boolean(cheat?.estimatedByAI),
        note: cheat.note || mergedDay?.[cheat.mealKey]?.note || '',
        isCheat: true,
      };
    }

    setActiveDay(mergedDay);

    const existing = mergedDay?.[mealKey] || {};
    setDescription(existing?.descripcion || existing?.qty || '');
    setPortion(existing?.portion || existing?.qty || '');
    setKcal(existing?.kcal ? String(existing.kcal) : '');
    setNote(existing?.note || '');
    setEstimatedByAI(Boolean(existing?.estimatedByAI));
  }, [baseDay, dayIndex, language, mealKey]);

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
        baseKcal: activeDay?.kcal || baseDay.kcal || storedDay?.kcal || 1600,
        gender,
        metrics,
        cheatKcal: storedDay?.cheatKcal || 0,
      });
      const consumed = computeConsumedFromDay(
        activeDay || storedDay || baseDay,
        calorieState?.meals || defaultMealState,
        dayKcal
      );
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
    activeDay,
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
      const goal =
        activeDay?.kcal ||
        baseDay?.kcal ||
        baseData.kcal ||
        calorieState?.goal ||
        calculateDynamicDailyKcal({ baseKcal: 1600, gender, metrics, cheatKcal: baseData.cheatKcal || 0 });

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
        isManual: true,
        manual: true,
        manualEntry: true,
        manualSource: 'manual',
        entryType: 'manual',
        logSource: 'manual',
        source: 'manual',
        manualKcal: Math.round(parsedKcal),
        fromAI: false,
        isAI: false,
        createdBy: 'cliente_manual',
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <View style={styles.section}>
            <Text style={styles.label}>{mealTitles[mealKey] || mealKey}</Text>
            <Text style={styles.hint}>
              {language === 'en'
                ? 'Describe what you actually ate. We will update this meal and your calories.'
                : 'Describe lo que comiste. Actualizaremos esta comida y tus calorías.'}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <TextInput
              style={[styles.input, styles.textarea, { borderColor: theme.colors.border }]}
              placeholder={language === 'en' ? 'Food, ingredients, swaps…' : 'Comida, ingredientes, cambios…'}
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View style={[styles.fieldGroup, styles.portionGroup]}>
            <TextInput
              style={[styles.input, { borderColor: theme.colors.border }]}
              placeholder={language === 'en' ? 'Portion or amount (optional)' : 'Porción o cantidad (opcional)'}
              placeholderTextColor={theme.colors.textMuted}
              value={portion}
              onChangeText={setPortion}
            />
          </View>

          <View style={[styles.kcalPanel, styles.fieldGroup]}>
            <View style={[styles.section, styles.kcalRow]}>
              <View style={styles.kcalColumn}>
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
          </View>

          {note ? (
            <View style={styles.noteBox}>
              <Text style={styles.note}>{note}</Text>
            </View>
          ) : null}

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
    scrollContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      paddingTop: theme.spacing.md,
      gap: theme.spacing.xl,
    },
    card: {
      marginHorizontal: theme.spacing.lg,
      gap: theme.spacing.xl,
      padding: theme.spacing.lg,
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
    section: {
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    fieldGroup: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    portionGroup: {
      paddingTop: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
    },
    subLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginBottom: 4,
    },
    kcalPanel: {
      backgroundColor: theme.colors.cardSoft,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      shadowColor: '#000',
      shadowOpacity: theme.mode === 'dark' ? 0.08 : 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    kcalRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: theme.spacing.sm,
    },
    kcalColumn: {
      flex: 1,
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    kcalInput: {
      marginTop: 2,
      paddingVertical: theme.spacing.sm + 2,
    },
    aiButton: {
      minWidth: 150,
      minHeight: 54,
      alignSelf: 'stretch',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      shadowColor: '#000',
      shadowOpacity: theme.mode === 'dark' ? 0.12 : 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    actions: {
      marginTop: theme.spacing.md,
    },
    saveButton: {
      width: '100%',
    },
    noteBox: {
      backgroundColor: theme.colors.bgSoft,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
    },
    note: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },
  });

export default ManualMealModal;

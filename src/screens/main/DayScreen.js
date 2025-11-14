import React, { useState, useEffect } from 'react';
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
import MealList from '../../components/meals/MealList';
import CalorieBar from '../../components/meals/CalorieBar';
import WeekSelector from '../../components/progress/WeekSelector';
import DayPills from '../../components/progress/DayPills';
import {
  getDayData,
  saveMealCompletion,
  getCalorieState,
  getWaterState,
  addWater,
  resetWater,
  isDayCompleted,
  setDayCompleted
} from '../../storage/storage';
import { calculateConsumedCalories } from '../../utils/calculations';
import { getDayDisplayName } from '../../utils/labels';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const DayScreen = ({ navigation }) => {
  const {
    theme: themeMode,
    language,
    currentDay,
    setCurrentDay,
    currentWeek,
    setCurrentWeek,
    derivedPlan,
    notifyProgressUpdate,
    metrics
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [dayData, setDayData] = useState(null);
  const [mealStates, setMealStates] = useState({});
  const [calorieInfo, setCalorieInfo] = useState({ consumed: 0, goal: 1600 });
  const baseWaterGoal = metrics?.waterGoal ? Number(metrics.waterGoal) : 2400;
  const [waterInfo, setWaterInfo] = useState({ ml: 0, goal: baseWaterGoal });
  const [isDone, setIsDone] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    loadDayData();
  }, [currentDay, language, baseWaterGoal]);

  useEffect(() => {
    setWaterInfo((prev) => ({ ...prev, goal: baseWaterGoal }));
  }, [baseWaterGoal]);

  const loadDayData = async () => {
    const baseDay = derivedPlan[currentDay];
    const stored = await getDayData(currentDay);
    
    const merged = {
      ...baseDay,
      ...stored
    };

    merged.dia = getDayDisplayName({
      label: merged.dia || baseDay?.dia,
      index: currentDay,
      language
    });
    
    setDayData(merged);

    const calState = await getCalorieState(currentDay, baseDay.kcal);
    const mealsState = calState.meals || {
      desayuno: false,
      snackAM: false,
      almuerzo: false,
      snackPM: false,
      cena: false
    };
    setMealStates(mealsState);

    const consumed = calculateConsumedCalories(mealsState, calState.goal);
    setCalorieInfo({ consumed, goal: calState.goal });

    const water = await getWaterState(currentDay, baseWaterGoal);
    setWaterInfo(water);

    const done = await isDayCompleted(currentDay);
    setIsDone(done);
  };

  const handleToggleMeal = async (mealKey) => {
    const newState = !mealStates[mealKey];
    setMealStates(prev => ({ ...prev, [mealKey]: newState }));
    await saveMealCompletion(currentDay, mealKey, newState);

    const newConsumed = calculateConsumedCalories({ ...mealStates, [mealKey]: newState }, calorieInfo.goal);
    setCalorieInfo(prev => ({ ...prev, consumed: newConsumed }));
  };

  const handleAddWater = async (ml) => {
    await addWater(currentDay, ml, baseWaterGoal);
    const water = await getWaterState(currentDay, baseWaterGoal);
    setWaterInfo(water);
    notifyProgressUpdate();
  };

  const handleResetWater = async () => {
    await resetWater(currentDay, baseWaterGoal);
    const water = await getWaterState(currentDay, baseWaterGoal);
    setWaterInfo(water);
    notifyProgressUpdate();
  };

  const handleToggleDayComplete = async () => {
    await setDayCompleted(currentDay, !isDone);
    setIsDone(!isDone);
    notifyProgressUpdate();
  };

  const handleWeekChange = (week) => {
    setCurrentWeek(week);
    const firstDayOfWeek = (week - 1) * 7;
    setCurrentDay(firstDayOfWeek);
  };

  const handleExportWeekPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);

    const escapeHtml = (value = '') =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const parseLines = (value = '') =>
      value
        .split(/\r?\n|•|,/g)
        .map((item) => item.trim())
        .filter(Boolean);

    try {
      const startIndex = (currentWeek - 1) * 7;
      const endIndex = Math.min(currentWeek * 7, derivedPlan.length);
      const dayBlocks = [];

      const mealConfig = [
        { key: 'desayuno', labelEn: 'Breakfast', labelEs: 'Desayuno' },
        { key: 'snackAM', labelEn: 'Snack AM', labelEs: 'Snack AM' },
        { key: 'almuerzo', labelEn: 'Lunch', labelEs: 'Almuerzo' },
        { key: 'snackPM', labelEn: 'Snack PM', labelEs: 'Snack PM' },
        { key: 'cena', labelEn: 'Dinner', labelEs: 'Cena' }
      ];

      for (let index = startIndex; index < endIndex; index += 1) {
        const base = derivedPlan[index] || {};
        const override = await getDayData(index);
        const merged = { ...base, ...override };

        const dayTitle = getDayDisplayName({
          label: merged.dia || base?.dia,
          index,
          language
        });

        const macros = merged.macros || base.macros || {};
        const macroLine = `C ${macros.carbs || '--'} · P ${macros.prot || '--'} · G ${macros.fat || '--'}`;

        const meals = mealConfig.map((config) => {
          const mealData = override?.[config.key] || base?.[config.key] || {};
          const ingredients = parseLines(mealData?.qty || '');
          const note = mealData?.note || mealData?.descripcion || '';

          return {
            title: language === 'en' ? config.labelEn : config.labelEs,
            name: mealData?.nombre || '',
            ingredients,
            note
          };
        });

        dayBlocks.push({
          title: dayTitle,
          kcal: merged.kcal || base.kcal || 0,
          macros: macroLine,
          meals
        });
      }

      const daysHtml = dayBlocks
        .map((day) => {
          const mealHtml = day.meals
            .map((meal) => {
              const listHtml = meal.ingredients.length
                ? `<ul class="ingredients">${meal.ingredients
                    .map((item) => `<li>${escapeHtml(item)}</li>`)
                    .join('')}</ul>`
                : '';

              const noteHtml = meal.note
                ? `<p class="note">${escapeHtml(meal.note)}</p>`
                : '';

              const nameHtml = meal.name
                ? `<p class="meal-name">${escapeHtml(meal.name)}</p>`
                : '';

              return `
                <div class="meal">
                  <h3 class="meal-title">${escapeHtml(meal.title)}</h3>
                  ${nameHtml}
                  ${listHtml}
                  ${noteHtml}
                </div>
              `;
            })
            .join('');

          return `
            <section class="day-card">
              <h2 class="day-title">${escapeHtml(day.title)}</h2>
              <div class="day-meta">
                <span>${escapeHtml(String(day.kcal))} kcal</span>
                <span>${escapeHtml(day.macros)}</span>
              </div>
              ${mealHtml}
            </section>
          `;
        })
        .join('');

      const subtitle = language === 'en'
        ? 'Weekly keto meals, macros and notes'
        : 'Comidas keto semanales, macros y notas';

      const html = `
        <!DOCTYPE html>
        <html lang="${language}">
          <head>
            <meta charset="utf-8" />
            <title>${language === 'en' ? 'Weekly keto plan' : 'Plan keto semanal'}</title>
            <style>
              body {
                font-family: 'Helvetica Neue', Arial, sans-serif;
                margin: 0;
                padding: 32px;
                background: #f8fafc;
                color: #0f172a;
              }
              .week-header {
                text-align: center;
                margin-bottom: 32px;
              }
              .week-header h1 {
                margin: 0;
                font-size: 28px;
                letter-spacing: -0.5px;
              }
              .week-header p {
                margin: 8px 0 0;
                color: #475569;
                font-size: 14px;
              }
              .day-card {
                background: #ffffff;
                border-radius: 18px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
                border: 1px solid rgba(15, 23, 42, 0.08);
              }
              .day-title {
                margin: 0;
                font-size: 20px;
              }
              .day-meta {
                margin: 6px 0 16px;
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
                color: #64748b;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .meal {
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid rgba(15, 23, 42, 0.08);
              }
              .meal:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
              }
              .meal-title {
                margin: 0;
                font-size: 15px;
                color: #0f172a;
              }
              .meal-name {
                margin: 4px 0;
                font-size: 14px;
                color: #0f172a;
              }
              .ingredients {
                margin: 6px 0 0 16px;
                padding: 0;
                color: #0f172a;
                font-size: 13px;
              }
              .ingredients li {
                margin-bottom: 4px;
              }
              .note {
                margin: 6px 0 0;
                color: #475569;
                font-size: 12px;
                font-style: italic;
              }
            </style>
          </head>
          <body>
            <div class="week-header">
              <h1>${language === 'en' ? 'Week' : 'Semana'} ${currentWeek}</h1>
              <p>${escapeHtml(subtitle)}</p>
              <p style="margin-top:6px;font-size:12px;color:#64748b;">
                ${language === 'en'
                  ? `Hydration goal: ${baseWaterGoal} ml`
                  : `Meta de hidratación: ${baseWaterGoal} ml`}
              </p>
            </div>
            ${daysHtml}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: language === 'en' ? 'Share weekly PDF' : 'Compartir PDF semanal',
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert(
          language === 'en' ? 'PDF ready' : 'PDF listo',
          language === 'en' ? `Saved to ${uri}` : `Guardado en ${uri}`
        );
      }
    } catch (error) {
      console.error('PDF export error', error);
      Alert.alert(
        language === 'en' ? 'Could not export' : 'No se pudo exportar',
        language === 'en'
          ? 'Try again in a few seconds.'
          : 'Intenta nuevamente en unos segundos.'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  if (!dayData) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const waterPercent = Math.min(100, Math.round((waterInfo.ml / waterInfo.goal) * 100));

  const meals = [
    {
      key: 'desayuno',
      title: language === 'en' ? 'Breakfast' : 'Desayuno',
      icon: '🍳',
      data: dayData.desayuno,
      isCompleted: mealStates.desayuno,
      onToggle: () => handleToggleMeal('desayuno')
    },
    {
      key: 'snackAM',
      title: language === 'en' ? 'Snack AM' : 'Snack AM',
      icon: '⏰',
      data: dayData.snackAM,
      isCompleted: mealStates.snackAM,
      onToggle: () => handleToggleMeal('snackAM')
    },
    {
      key: 'almuerzo',
      title: language === 'en' ? 'Lunch' : 'Almuerzo',
      icon: '🥗',
      data: dayData.almuerzo,
      isCompleted: mealStates.almuerzo,
      onToggle: () => handleToggleMeal('almuerzo')
    },
    {
      key: 'snackPM',
      title: language === 'en' ? 'Snack PM' : 'Snack PM',
      icon: '🥜',
      data: dayData.snackPM,
      isCompleted: mealStates.snackPM,
      onToggle: () => handleToggleMeal('snackPM')
    },
    {
      key: 'cena',
      title: language === 'en' ? 'Dinner' : 'Cena',
      icon: '🍖',
      data: dayData.cena,
      isCompleted: mealStates.cena,
      onToggle: () => handleToggleMeal('cena')
    }
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Week Selector */}
        <WeekSelector 
          currentWeek={currentWeek} 
          onWeekChange={handleWeekChange} 
        />

        {/* Day Pills */}
        <DayPills
          week={currentWeek}
          currentDay={currentDay}
          onDaySelect={setCurrentDay}
          derivedPlan={derivedPlan}
        />

        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={[styles.toolButton, exportingPdf && styles.toolButtonDisabled]}
            onPress={handleExportWeekPdf}
            activeOpacity={0.85}
            disabled={exportingPdf}
          >
            {exportingPdf ? (
              <ActivityIndicator color={theme.colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.toolButtonText}>
                📄 {language === 'en' ? 'Share weekly PDF' : 'Compartir PDF semanal'}
              </Text>
            )}
          </TouchableOpacity>
          <Text style={styles.toolHint}>
            {language === 'en'
              ? 'Includes meals, macros and notes for each day.'
              : 'Incluye comidas, macros y notas de cada día.'}
          </Text>
        </View>

        {/* Day Header */}
        <View style={styles.header}>
          <Text style={styles.dayTitle}>{dayData.dia}</Text>
          <Text style={styles.calories}>{dayData.kcal} kcal</Text>
          <View style={styles.macros}>
            <Text style={styles.macroText}>C {dayData.macros?.carbs}</Text>
            <Text style={styles.macroText}>P {dayData.macros?.prot}</Text>
            <Text style={styles.macroText}>G {dayData.macros?.fat}</Text>
          </View>
        </View>

        {/* Calorie Bar */}
        <CalorieBar consumed={calorieInfo.consumed} goal={calorieInfo.goal} />

        {/* Water */}
        <View style={styles.waterBox}>
          <View style={styles.waterHead}>
            <Text style={styles.waterText}>
              💧 {language === 'en' ? 'Water today' : 'Agua de hoy'}
            </Text>
            <Text style={styles.waterValue}>
              {waterInfo.ml} / {waterInfo.goal} ml
            </Text>
          </View>
          <View style={styles.progressLine}>
            <View style={[styles.progressFill, { width: `${waterPercent}%` }]} />
          </View>
          <View style={styles.waterActions}>
            <TouchableOpacity style={styles.waterButton} onPress={() => handleAddWater(250)}>
              <Text style={styles.waterButtonText}>+250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waterButton} onPress={() => handleAddWater(500)}>
              <Text style={styles.waterButtonText}>+500ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.waterButton, styles.waterButtonGhost]} onPress={handleResetWater}>
              <Text style={[styles.waterButtonText, styles.waterButtonTextGhost]}>
                {language === 'en' ? 'Reset' : 'Reiniciar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Meals */}
        <View style={styles.mealsSection}>
          <MealList meals={meals} />
        </View>

        {/* Complete Day Button */}
        <TouchableOpacity
          style={[styles.completeButton, isDone && styles.completeButtonDone]}
          onPress={handleToggleDayComplete}
        >
          <Text style={styles.completeButtonText}>
            {isDone 
              ? (language === 'en' ? '✓ Day completed' : '✓ Día completado')
              : (language === 'en' ? 'Mark day ✓' : 'Marcar día ✓')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 100
  },
  header: {
    marginBottom: theme.spacing.lg
  },
  toolsRow: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs
  },
  toolButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    shadowColor: '#0f766e',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  toolButtonDisabled: {
    opacity: 0.6
  },
  toolButtonText: {
    ...theme.typography.body,
    color: theme.colors.onPrimary,
    fontWeight: '600'
  },
  toolHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center'
  },
  dayTitle: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs
  },
  calories: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: theme.spacing.sm
  },
  macros: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  macroText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.cardSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm
  },
  progressLine: {
    height: 6,
    backgroundColor: theme.colors.bgSoft,
    borderRadius: theme.radius.full,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full
  },
  waterBox: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  waterHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm
  },
  waterText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600'
  },
  waterValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  waterActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm
  },
  waterButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    alignItems: 'center',
    shadowColor: '#0f766e',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  waterButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  waterButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.onPrimary,
    fontWeight: '600'
  },
  waterButtonTextGhost: {
    color: theme.colors.text
  },
  mealsSection: {
    marginBottom: theme.spacing.lg
  },
  completeButton: {
    backgroundColor: 'rgba(34,197,94,0.3)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center'
  },
  completeButtonDone: {
    backgroundColor: 'rgba(34,197,94,0.6)'
  },
  completeButtonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600'
  }
});

export default DayScreen;

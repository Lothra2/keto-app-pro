export const MEAL_KEYS = ['desayuno', 'snackAM', 'almuerzo', 'snackPM', 'cena'];

export const MEAL_KCAL_SPLIT = {
  desayuno: 0.3,
  snackAM: 0.1,
  almuerzo: 0.3,
  snackPM: 0.1,
  cena: 0.2
};

export const mergePlanDay = (baseDay = {}, storedDay = {}) => {
  const merged = { ...baseDay };

  if (storedDay && typeof storedDay === 'object') {
    Object.assign(merged, storedDay);
  }

  MEAL_KEYS.forEach((key) => {
    const baseMeal = baseDay?.[key] || {};
    const storedMeal = storedDay?.[key] || {};

    if (Object.keys(baseMeal).length || Object.keys(storedMeal).length) {
      merged[key] = { ...baseMeal, ...storedMeal };
    }
  });

  if (!merged.dia && baseDay?.dia) {
    merged.dia = baseDay.dia;
  }

  if (!merged.macros && baseDay?.macros) {
    merged.macros = baseDay.macros;
  }

  if (!merged.kcal && baseDay?.kcal) {
    merged.kcal = baseDay.kcal;
  }

  return merged;
};

export const buildWeekAiPayload = (days = []) =>
  days.map((day) => ({
    name: day.dia || '',
    breakfast: day.desayuno ? day.desayuno.qty || day.desayuno.nombre || '' : '',
    snackAM: day.snackAM ? day.snackAM.qty || day.snackAM.nombre || '' : '',
    lunch: day.almuerzo ? day.almuerzo.qty || day.almuerzo.nombre || '' : '',
    snackPM: day.snackPM ? day.snackPM.qty || day.snackPM.nombre || '' : '',
    dinner: day.cena ? day.cena.qty || day.cena.nombre || '' : ''
  }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_PREFIX, KEYS, DYNAMIC_KEYS } from './constants';

class Storage {
  // Obtener un valor
  async get(key, defaultValue = null) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return defaultValue;
    }
  }

  // Guardar un valor
  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, String(value));
      return true;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return false;
    }
  }

  // Obtener y parsear JSON
  async getJSON(key, defaultValue = null) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value !== null ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error(`Error getting JSON ${key}:`, error);
      return defaultValue;
    }
  }

  // Guardar JSON
  async setJSON(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error setting JSON ${key}:`, error);
      return false;
    }
  }

  // Eliminar un valor
  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      return false;
    }
  }

  // Limpiar todo
  async clear() {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  }

  // Obtener todas las keys
  async getAllKeys() {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  }

  // Eliminar todas las keys del proyecto
  async clearAppData() {
    try {
      const keys = await this.getAllKeys();
      const ketoKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX));
      await AsyncStorage.multiRemove(ketoKeys);
      return true;
    } catch (error) {
      console.error('Error clearing app data:', error);
      return false;
    }
  }
}

// Funciones específicas para la app

// Guardar/obtener datos del día con IA
export async function getDayData(dayIndex) {
  const storage = new Storage();
  return await storage.getJSON(DYNAMIC_KEYS.AI_DAY + dayIndex, null);
}

export async function saveDayData(dayIndex, dayData) {
  const storage = new Storage();
  return await storage.setJSON(DYNAMIC_KEYS.AI_DAY + dayIndex, dayData);
}

// Guardar/obtener workout del día
export async function getWorkoutData(dayIndex) {
  const storage = new Storage();
  return await storage.getJSON(DYNAMIC_KEYS.AI_WORKOUT + dayIndex, null);
}

export async function saveWorkoutData(dayIndex, workout) {
  const storage = new Storage();
  return await storage.setJSON(DYNAMIC_KEYS.AI_WORKOUT + dayIndex, workout);
}

// Revisión del día por IA
export async function getDayReview(dayIndex) {
  const storage = new Storage();
  const raw = await storage.get(DYNAMIC_KEYS.AI_REVIEW + dayIndex, null);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return raw;
  }
}

export async function saveDayReview(dayIndex, review) {
  const storage = new Storage();
  const value = typeof review === 'string' ? review : JSON.stringify(review);
  return await storage.set(DYNAMIC_KEYS.AI_REVIEW + dayIndex, value);
}

// Calorías del día
export async function getCalorieState(dayIndex, defaultGoal = 1600) {
  const storage = new Storage();
  const data = await storage.getJSON(DYNAMIC_KEYS.CAL + dayIndex, null);
  
  if (data) {
    data.goal = data.goal || defaultGoal;
    return data;
  }
  
  return {
    goal: defaultGoal,
    meals: {
      desayuno: false,
      snackAM: false,
      almuerzo: false,
      snackPM: false,
      cena: false
    }
  };
}

export async function saveCalorieState(dayIndex, state) {
  const storage = new Storage();
  return await storage.setJSON(DYNAMIC_KEYS.CAL + dayIndex, state);
}

export async function getCheatMeal(dayIndex) {
  const storage = new Storage();
  return await storage.getJSON(DYNAMIC_KEYS.CHEAT + dayIndex, null);
}

export async function saveCheatMeal(dayIndex, cheatData) {
  const storage = new Storage();
  return await storage.setJSON(DYNAMIC_KEYS.CHEAT + dayIndex, cheatData);
}

export async function clearCheatMeal(dayIndex) {
  const storage = new Storage();
  return await storage.remove(DYNAMIC_KEYS.CHEAT + dayIndex);
}

export async function getExtraIntakes(dayIndex) {
  const storage = new Storage();
  return (await storage.getJSON(DYNAMIC_KEYS.EXTRAS + dayIndex, [])) || [];
}

export async function saveExtraIntakes(dayIndex, extras) {
  const storage = new Storage();
  return await storage.setJSON(DYNAMIC_KEYS.EXTRAS + dayIndex, extras || []);
}

export async function findCheatInWeek(dayIndex, weekLength = 7) {
  const start = Math.floor(dayIndex / weekLength) * weekLength;
  const end = start + weekLength;
  for (let i = start; i < end; i += 1) {
    if (i === dayIndex) continue;
    const stored = await getCheatMeal(i);
    if (stored && stored.mealKey) {
      return { dayIndex: i, data: stored };
    }
  }
  return null;
}

// Marcar comida como completada
export async function saveMealCompletion(dayIndex, mealKey, completed) {
  const state = await getCalorieState(dayIndex);
  state.meals[mealKey] = completed;
  return await saveCalorieState(dayIndex, state);
}

// Agua del día
export async function getWaterState(dayIndex, defaultGoal = 2400) {
  const storage = new Storage();
  const fallbackProvided = arguments.length >= 2;
  const parsedFallback = Number(defaultGoal);
  const normalizedFallback = Number.isFinite(parsedFallback) && parsedFallback > 0
    ? Math.round(parsedFallback)
    : 2400;
  const targetFallback = fallbackProvided ? normalizedFallback : normalizedFallback || 2400;
  const data = await storage.getJSON(DYNAMIC_KEYS.WATER + dayIndex, null);

  if (data) {
    const storedGoal = Number(data.goal);
    const hasValidStoredGoal = Number.isFinite(storedGoal) && storedGoal > 0;
    const ml = Number(data.ml) || 0;

    let goal = hasValidStoredGoal ? Math.round(storedGoal) : targetFallback;
    let shouldPersist = false;

    if (!hasValidStoredGoal) {
      goal = targetFallback;
      shouldPersist = true;
    }

    if (fallbackProvided && goal !== targetFallback) {
      goal = targetFallback;
      shouldPersist = true;
    }

    if (shouldPersist) {
      const updated = { goal, ml };
      await storage.setJSON(DYNAMIC_KEYS.WATER + dayIndex, updated);
      return updated;
    }

    return { goal, ml };
  }

  const initialGoal = fallbackProvided ? targetFallback : 2400;
  const initial = { goal: initialGoal, ml: 0 };
  await storage.setJSON(DYNAMIC_KEYS.WATER + dayIndex, initial);
  return initial;
}

export async function saveWaterState(dayIndex, state) {
  const storage = new Storage();
  return await storage.setJSON(DYNAMIC_KEYS.WATER + dayIndex, state);
}

export async function addWater(dayIndex, ml, defaultGoal = 2400) {
  const fallbackGoal = Number(defaultGoal) || 2400;
  const state = await getWaterState(dayIndex, fallbackGoal);
  const goal = Number(state.goal) || fallbackGoal;
  const currentMl = Number(state.ml) || 0;
  const updated = {
    goal,
    ml: Math.max(0, currentMl + ml)
  };
  return await saveWaterState(dayIndex, updated);
}

export async function resetWater(dayIndex, goal = 2400) {
  const storage = new Storage();
  const numericGoal = Number(goal) || 2400;
  const state = { goal: numericGoal, ml: 0 };
  await storage.setJSON(DYNAMIC_KEYS.WATER + dayIndex, state);
  return state;
}

export async function syncWaterGoalAcrossPlan(totalDays, newGoal) {
  const normalizedGoal = Number(newGoal);
  if (!Number.isFinite(normalizedGoal) || normalizedGoal <= 0 || !totalDays) {
    return;
  }

  const roundedGoal = Math.round(normalizedGoal);
  const tasks = [];

  for (let i = 0; i < totalDays; i++) {
    tasks.push(getWaterState(i, roundedGoal));
  }

  await Promise.all(tasks);
}

// Progreso del día
export async function getProgressData(dayIndex) {
  const storage = new Storage();
  return await storage.getJSON(DYNAMIC_KEYS.PROGRESS + dayIndex, {});
}

export async function saveProgressData(dayIndex, data) {
  const storage = new Storage();
  return await storage.setJSON(DYNAMIC_KEYS.PROGRESS + dayIndex, data);
}

// Día completado
export async function isDayCompleted(dayIndex) {
  const storage = new Storage();
  const value = await storage.get(DYNAMIC_KEYS.DONE + dayIndex);
  return value === '1';
}

export async function setDayCompleted(dayIndex, completed) {
  const storage = new Storage();
  return await storage.set(DYNAMIC_KEYS.DONE + dayIndex, completed ? '1' : '0');
}

// Contar días completados
export async function getCompletedDaysCount(totalDays) {
  let count = 0;
  for (let i = 0; i < totalDays; i++) {
    if (await isDayCompleted(i)) {
      count++;
    }
  }
  return count;
}

// Revisión semanal IA
export async function getWeekReview(weekNumber) {
  const storage = new Storage();
  return await storage.get(DYNAMIC_KEYS.AI_WEEK + weekNumber, null);
}

export async function saveWeekReview(weekNumber, review) {
  const storage = new Storage();
  return await storage.set(DYNAMIC_KEYS.AI_WEEK + weekNumber, review);
}

// Lista de compras IA
export async function getShoppingList(weekNumber) {
  const storage = new Storage();
  return await storage.get(DYNAMIC_KEYS.AI_SHOPPING + weekNumber, null);
}

export async function saveShoppingList(weekNumber, list) {
  const storage = new Storage();
  return await storage.set(DYNAMIC_KEYS.AI_SHOPPING + weekNumber, list);
}

export default new Storage();

export { KEYS, DYNAMIC_KEYS } from './constants';

// Sincronizar overrides con datos globales (solo si cambian)
export async function syncUserBaseOverrides() {
  const height = await AsyncStorage.getItem('USER_HEIGHT_OVERRIDE');
  const weight = await AsyncStorage.getItem('USER_WEIGHT_OVERRIDE');
  const age = await AsyncStorage.getItem('USER_AGE_OVERRIDE');

  if (height) await AsyncStorage.setItem(KEYS.HEIGHT, height);
  if (weight) await AsyncStorage.setItem(KEYS.START_WEIGHT, weight);
  if (age) await AsyncStorage.setItem(KEYS.AGE, age);

  return true;
}

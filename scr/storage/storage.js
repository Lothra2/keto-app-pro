import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'keto14-rick-';

// Keys de storage
export const KEYS = {
  NAME: PREFIX + 'name',
  THEME: PREFIX + 'theme',
  START_DATE: PREFIX + 'start-date',
  PLAN_WEEKS: PREFIX + 'plan-weeks',
  DAILY_VIEW: PREFIX + 'daily-view',
  PRIMARY_COLOR: PREFIX + 'primary-color',
  HEIGHT: PREFIX + 'height-cm',
  START_WEIGHT: PREFIX + 'start-weight',
  AGE: PREFIX + 'age',
  LANG: PREFIX + 'lang',
  LIKE_FOODS: PREFIX + 'like-foods',
  DISLIKE_FOODS: PREFIX + 'dislike-foods',
  API_USER: PREFIX + 'api-user',
  API_PASS: PREFIX + 'api-pass',
  GENDER: PREFIX + 'gender',
  WORKOUT_INTENSITY: PREFIX + 'workout-intensity',
  WATER_GOAL: PREFIX + 'water-goal',
  SELECTED_DAY: PREFIX + 'sel-day',
  SELECTED_WEEK: PREFIX + 'sel-week'
};

// Prefijos dinámicos
export const DYNAMIC_KEYS = {
  AI_DAY: PREFIX + 'ai-day-',
  AI_WORKOUT: PREFIX + 'ai-workout-',
  AI_WEEK: PREFIX + 'ai-week-',
  CAL: PREFIX + 'cal-',
  PROGRESS: PREFIX + 'prog-',
  WATER: PREFIX + 'water-',
  DONE: PREFIX + 'done-',
  BADGE: PREFIX + 'badge-',
  AI_SHOPPING: PREFIX + 'ai-shopping-'
};

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
      const ketoKeys = keys.filter(k => k.startsWith(PREFIX));
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

// Marcar comida como completada
export async function saveMealCompletion(dayIndex, mealKey, completed) {
  const state = await getCalorieState(dayIndex);
  state.meals[mealKey] = completed;
  return await saveCalorieState(dayIndex, state);
}

// Agua del día
export async function getWaterState(dayIndex, defaultGoal = 2400) {
  const storage = new Storage();
  const data = await storage.getJSON(DYNAMIC_KEYS.WATER + dayIndex, null);
  
  if (data) {
    return {
      goal: data.goal || defaultGoal,
      ml: data.ml || 0
    };
  }
  
  return {
    goal: defaultGoal,
    ml: 0
  };
}

export async function saveWaterState(dayIndex, state) {
  const storage = new Storage();
  return await storage.setJSON(DYNAMIC_KEYS.WATER + dayIndex, state);
}

export async function addWater(dayIndex, ml) {
  const state = await getWaterState(dayIndex);
  state.ml = Math.max(0, state.ml + ml);
  return await saveWaterState(dayIndex, state);
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

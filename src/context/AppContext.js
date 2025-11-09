import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import storage, { KEYS } from '../storage/storage';
import { buildPlan } from '../utils/calculations';
import { useThemeContext } from './ThemeContext';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Estado principal
  const [user, setUser] = useState({ name: '', startDate: null });
  const [currentDay, setCurrentDay] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [planWeeks, setPlanWeeks] = useState(2);
  const [gender, setGender] = useState('male');
  const [language, setLanguage] = useState('es');
  const [loading, setLoading] = useState(true);

  // Plan derivado
  const [derivedPlan, setDerivedPlan] = useState([]);

  // Preferencias IA
  const [foodPrefs, setFoodPrefs] = useState({ like: '', dislike: '' });
  const [apiCredentials, setApiCredentials] = useState({ user: '', pass: '' });
  const [metrics, setMetrics] = useState({
    height: '',
    startWeight: '',
    age: '',
    waterGoal: 2400,
    workoutIntensity: 'medium'
  });

  const { mode: themeMode, setMode: setThemeMode } = useThemeContext();

  // Cargar datos al iniciar
  useEffect(() => {
    loadInitialData();
  }, []);

  // Reconstruir plan cuando cambian semanas o género
  useEffect(() => {
    const plan = buildPlan(planWeeks, gender);
    setDerivedPlan(plan);
  }, [planWeeks, gender]);

  const loadInitialData = async () => {
    try {
      const keysToLoad = [
        KEYS.NAME,
        KEYS.START_DATE,
        KEYS.PLAN_WEEKS,
        KEYS.GENDER,
        KEYS.LANG,
        KEYS.THEME,
        KEYS.LIKE_FOODS,
        KEYS.DISLIKE_FOODS,
        KEYS.API_USER,
        KEYS.API_PASS,
        KEYS.HEIGHT,
        KEYS.START_WEIGHT,
        KEYS.AGE,
        KEYS.WATER_GOAL,
        KEYS.WORKOUT_INTENSITY
      ];

      const entries = await AsyncStorage.multiGet(keysToLoad);
      const values = Object.fromEntries(entries);

      const savedName = values[KEYS.NAME];
      const savedStartDate = values[KEYS.START_DATE];
      const savedWeeks = values[KEYS.PLAN_WEEKS];
      const savedGender = values[KEYS.GENDER];
      const savedLang = values[KEYS.LANG];
      const savedTheme = values[KEYS.THEME];
      const savedLike = values[KEYS.LIKE_FOODS];
      const savedDislike = values[KEYS.DISLIKE_FOODS];
      const savedApiUser = values[KEYS.API_USER];
      const savedApiPass = values[KEYS.API_PASS];
      const savedHeight = values[KEYS.HEIGHT];
      const savedWeight = values[KEYS.START_WEIGHT];
      const savedAge = values[KEYS.AGE];
      const savedWaterGoal = values[KEYS.WATER_GOAL];
      const savedIntensity = values[KEYS.WORKOUT_INTENSITY];

      if (savedName) setUser(prev => ({ ...prev, name: savedName }));
      if (savedStartDate) setUser(prev => ({ ...prev, startDate: savedStartDate }));
      const weeksValue = savedWeeks ? Number(savedWeeks) : planWeeks;
      if (savedWeeks) setPlanWeeks(weeksValue);
      const genderValue = savedGender || gender;
      if (savedGender) setGender(savedGender);
      if (savedLang) setLanguage(savedLang);
      if (savedTheme) setThemeMode(savedTheme);
      if (savedLike || savedDislike) {
        setFoodPrefs({ like: savedLike || '', dislike: savedDislike || '' });
      }
      if (savedApiUser || savedApiPass) {
        setApiCredentials({ user: savedApiUser || '', pass: savedApiPass || '' });
      }

      setMetrics(prev => ({
        ...prev,
        height: savedHeight || prev.height,
        startWeight: savedWeight || prev.startWeight,
        age: savedAge || prev.age,
        waterGoal: savedWaterGoal ? Number(savedWaterGoal) : prev.waterGoal,
        workoutIntensity: savedIntensity || prev.workoutIntensity
      }));

      const plan = buildPlan(weeksValue, genderValue);
      setDerivedPlan(plan);

      // Calcular día actual si hay fecha de inicio
      if (savedStartDate) {
        const dayIndex = calculateCurrentDay(savedStartDate, plan.length);
        setCurrentDay(dayIndex);
        setCurrentWeek(Math.floor(dayIndex / 7) + 1);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentDay = (startDate, planLength = derivedPlan.length) => {
    const start = new Date(startDate);
    const today = new Date();
    const diffMs = today - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 0;
    const maxIndex = Math.max(planLength - 1, 0);
    if (diffDays > maxIndex) return maxIndex;
    return diffDays;
  };

  const updateUser = async (updates) => {
    setUser(prev => ({ ...prev, ...updates }));
    if (updates.name !== undefined) await storage.set(KEYS.NAME, updates.name || '');
    if (updates.startDate !== undefined) await storage.set(KEYS.START_DATE, updates.startDate || '');
  };

  const updateSettings = async (key, value) => {
    const settingsMap = {
      'plan-weeks': KEYS.PLAN_WEEKS,
      gender: KEYS.GENDER,
      lang: KEYS.LANG,
      theme: KEYS.THEME,
      'water-goal': KEYS.WATER_GOAL,
      'workout-intensity': KEYS.WORKOUT_INTENSITY
    };

    const storageKey = settingsMap[key];
    if (storageKey) {
      await storage.set(storageKey, value);
    }

    switch (key) {
      case 'plan-weeks':
        setPlanWeeks(Number(value));
        break;
      case 'gender':
        setGender(value);
        break;
      case 'lang':
        setLanguage(value);
        break;
      case 'theme':
        setThemeMode(value);
        break;
      case 'water-goal':
        setMetrics(prev => ({ ...prev, waterGoal: Number(value) || prev.waterGoal }));
        break;
      case 'workout-intensity':
        setMetrics(prev => ({ ...prev, workoutIntensity: value || prev.workoutIntensity }));
        break;
    }
  };

  const updateFoodPrefs = async (like, dislike) => {
    setFoodPrefs({ like, dislike });
    await storage.set(KEYS.LIKE_FOODS, like);
    await storage.set(KEYS.DISLIKE_FOODS, dislike);
  };

  const updateApiCredentials = async (user, pass) => {
    setApiCredentials({ user, pass });
    await storage.set(KEYS.API_USER, user);
    await storage.set(KEYS.API_PASS, pass);
  };

  const updateMetrics = async (updates) => {
    setMetrics(prev => ({ ...prev, ...updates }));

    if (updates.height !== undefined) {
      await storage.set(KEYS.HEIGHT, updates.height);
    }
    if (updates.startWeight !== undefined) {
      await storage.set(KEYS.START_WEIGHT, updates.startWeight);
    }
    if (updates.age !== undefined) {
      await storage.set(KEYS.AGE, updates.age);
    }
    if (updates.waterGoal !== undefined) {
      await storage.set(KEYS.WATER_GOAL, updates.waterGoal);
    }
    if (updates.workoutIntensity !== undefined) {
      await storage.set(KEYS.WORKOUT_INTENSITY, updates.workoutIntensity);
    }
  };

  const resetApp = async () => {
    try {
      await storage.clearAppData();

      // Reset state
      setUser({ name: '', startDate: null });
      setCurrentDay(0);
      setCurrentWeek(1);
      setPlanWeeks(2);
      setGender('male');
      setLanguage('es');
      setThemeMode('dark');
      setFoodPrefs({ like: '', dislike: '' });
      setApiCredentials({ user: '', pass: '' });
      setMetrics({ height: '', startWeight: '', age: '', waterGoal: 2400, workoutIntensity: 'medium' });
    } catch (error) {
      console.error('Error reseteando app:', error);
    }
  };

  const value = {
    user,
    currentDay,
    currentWeek,
    planWeeks,
    gender,
    language,
    theme: themeMode,
    derivedPlan,
    foodPrefs,
    apiCredentials,
    metrics,
    loading,
    setCurrentDay,
    setCurrentWeek,
    updateUser,
    updateSettings,
    updateFoodPrefs,
    updateApiCredentials,
    updateMetrics,
    resetApp
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;

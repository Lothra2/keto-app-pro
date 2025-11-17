import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import storage, { KEYS, syncWaterGoalAcrossPlan } from '../storage/storage';
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
  const [currentDay, setCurrentDayState] = useState(0);
  const [currentWeek, setCurrentWeekState] = useState(1);
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
  const [progressVersion, setProgressVersion] = useState(0);
  const [isOnboarded, setIsOnboarded] = useState(false);

  const { mode: themeMode, setMode: setThemeMode } = useThemeContext();

  // Cargar datos al iniciar
  useEffect(() => {
    loadInitialData();
  }, []);

  // Reconstruir plan cuando cambian semanas o género
  useEffect(() => {
    const plan = buildPlan(planWeeks, gender, language);
    setDerivedPlan(plan);
  }, [planWeeks, gender, language]);

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
        KEYS.WORKOUT_INTENSITY,
        KEYS.SELECTED_DAY,
        KEYS.SELECTED_WEEK
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

      const plan = buildPlan(weeksValue, genderValue, savedLang || language);
      setDerivedPlan(plan);

      const savedSelectedDay = values[KEYS.SELECTED_DAY];
      const savedSelectedWeek = values[KEYS.SELECTED_WEEK];

      let initialDay = 0;
      if (savedSelectedDay !== undefined && savedSelectedDay !== null) {
        const parsedDay = Number(savedSelectedDay);
        if (!Number.isNaN(parsedDay)) {
          initialDay = Math.min(Math.max(parsedDay, 0), Math.max(plan.length - 1, 0));
        }
      } else if (savedStartDate) {
        initialDay = calculateCurrentDay(savedStartDate, plan.length);
      }

      let initialWeek = 1;
      if (savedSelectedWeek !== undefined && savedSelectedWeek !== null) {
        const parsedWeek = Number(savedSelectedWeek);
        if (!Number.isNaN(parsedWeek)) {
          initialWeek = parsedWeek;
        }
      } else {
        initialWeek = Math.floor(initialDay / 7) + 1;
      }

      initialWeek = Math.min(Math.max(initialWeek, 1), weeksValue);

      setCurrentDayState(initialDay);
      setCurrentWeekState(initialWeek);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasName = Boolean(user?.name?.trim());
    const { height: h, startWeight: w, age: a } = metrics || {};
    const hasMetrics = Boolean(h && w && a);
    setIsOnboarded(hasName && hasMetrics);
  }, [user, metrics]);

  const calculateCurrentDay = (
    startDate,
    planLength = Array.isArray(derivedPlan) ? derivedPlan.length : 0
  ) => {
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
    if (updates.startDate !== undefined) {
      await storage.set(KEYS.START_DATE, updates.startDate || '');

      if (updates.startDate) {
        const updatedDay = calculateCurrentDay(updates.startDate)
        const updatedWeek = Math.min(Math.floor(updatedDay / 7) + 1, planWeeks)
        setCurrentDayState(updatedDay)
        setCurrentWeekState(updatedWeek)
        storage.set(KEYS.SELECTED_DAY, updatedDay)
        storage.set(KEYS.SELECTED_WEEK, updatedWeek)
      }
    }
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
    let valueToPersist = value;

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
        {
          const numericGoal = Number(value);
          if (!Number.isFinite(numericGoal) || numericGoal <= 0) {
            return;
          }
          const normalizedGoal = Math.round(numericGoal);
          valueToPersist = normalizedGoal;
          setMetrics(prev => ({ ...prev, waterGoal: normalizedGoal }));
          if (derivedPlan.length > 0) {
            await syncWaterGoalAcrossPlan(derivedPlan.length, normalizedGoal);
          }
        }
        break;
      case 'workout-intensity':
        setMetrics(prev => ({ ...prev, workoutIntensity: value || prev.workoutIntensity }));
        break;
    }

    if (storageKey && valueToPersist !== undefined) {
      await storage.set(storageKey, valueToPersist);
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
    const sanitizedUpdates = { ...updates };

    if (updates.waterGoal !== undefined) {
      const numericGoal = Number(updates.waterGoal);
      if (Number.isFinite(numericGoal) && numericGoal > 0) {
        sanitizedUpdates.waterGoal = Math.round(numericGoal);
      } else {
        delete sanitizedUpdates.waterGoal;
      }
    }

    setMetrics(prev => ({ ...prev, ...sanitizedUpdates }));

    if (sanitizedUpdates.height !== undefined) {
      await storage.set(KEYS.HEIGHT, sanitizedUpdates.height);
    }
    if (sanitizedUpdates.startWeight !== undefined) {
      await storage.set(KEYS.START_WEIGHT, sanitizedUpdates.startWeight);
    }
    if (sanitizedUpdates.age !== undefined) {
      await storage.set(KEYS.AGE, sanitizedUpdates.age);
    }
    if (sanitizedUpdates.waterGoal !== undefined) {
      await storage.set(KEYS.WATER_GOAL, sanitizedUpdates.waterGoal);
      if (derivedPlan.length > 0) {
        await syncWaterGoalAcrossPlan(derivedPlan.length, sanitizedUpdates.waterGoal);
      }
    }
    if (sanitizedUpdates.workoutIntensity !== undefined) {
      await storage.set(KEYS.WORKOUT_INTENSITY, sanitizedUpdates.workoutIntensity);
    }
  };

  const notifyProgressUpdate = () => {
    setProgressVersion(prev => prev + 1);
  };

  const completeOnboarding = () => {
    setIsOnboarded(true);
  };

  const updateCurrentDay = (dayIndex) => {
    const maxIndex = Math.max(derivedPlan.length - 1, 0);
    const clamped = Math.min(Math.max(dayIndex, 0), maxIndex);
    setCurrentDayState(clamped);
    storage.set(KEYS.SELECTED_DAY, clamped);

    const computedWeek = Math.floor(clamped / 7) + 1;
    setCurrentWeekState(computedWeek);
    storage.set(KEYS.SELECTED_WEEK, computedWeek);
  };

  const updateCurrentWeek = (weekNumber) => {
    const totalWeeks = Math.max(Math.ceil(derivedPlan.length / 7), 1);
    const clamped = Math.min(Math.max(weekNumber, 1), totalWeeks);
    setCurrentWeekState(clamped);
    storage.set(KEYS.SELECTED_WEEK, clamped);
  };

  const resetApp = async () => {
    try {
      await storage.clearAppData();

      // Reset state
      setUser({ name: '', startDate: null });
      setCurrentDayState(0);
      setCurrentWeekState(1);
      setPlanWeeks(2);
      setGender('male');
      setLanguage('es');
      setThemeMode('dark');
      setFoodPrefs({ like: '', dislike: '' });
      setApiCredentials({ user: '', pass: '' });
      setMetrics({ height: '', startWeight: '', age: '', waterGoal: 2400, workoutIntensity: 'medium' });
      setProgressVersion(0);
      setIsOnboarded(false);
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
    progressVersion,
    isOnboarded,
    loading,
    setCurrentDay: updateCurrentDay,
    setCurrentWeek: updateCurrentWeek,
    updateUser,
    updateSettings,
    updateFoodPrefs,
    updateApiCredentials,
    updateMetrics,
    notifyProgressUpdate,
    completeOnboarding,
    resetApp
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;

import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { basePlan } from '../data/basePlan';
import { buildPlan } from '../utils/calculations';

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
  const [theme, setTheme] = useState('dark');
  const [loading, setLoading] = useState(true);
  
  // Plan derivado
  const [derivedPlan, setDerivedPlan] = useState([]);
  
  // Preferencias IA
  const [foodPrefs, setFoodPrefs] = useState({ like: '', dislike: '' });
  const [apiCredentials, setApiCredentials] = useState({ user: '', pass: '' });

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
      const [
        savedName,
        savedStartDate,
        savedWeeks,
        savedGender,
        savedLang,
        savedTheme,
        savedLike,
        savedDislike,
        savedApiUser,
        savedApiPass
      ] = await Promise.all([
        AsyncStorage.getItem('keto-name'),
        AsyncStorage.getItem('keto-start-date'),
        AsyncStorage.getItem('keto-plan-weeks'),
        AsyncStorage.getItem('keto-gender'),
        AsyncStorage.getItem('keto-lang'),
        AsyncStorage.getItem('keto-theme'),
        AsyncStorage.getItem('keto-like-foods'),
        AsyncStorage.getItem('keto-dislike-foods'),
        AsyncStorage.getItem('keto-api-user'),
        AsyncStorage.getItem('keto-api-pass')
      ]);

      if (savedName) setUser(prev => ({ ...prev, name: savedName }));
      if (savedStartDate) setUser(prev => ({ ...prev, startDate: savedStartDate }));
      if (savedWeeks) setPlanWeeks(Number(savedWeeks));
      if (savedGender) setGender(savedGender);
      if (savedLang) setLanguage(savedLang);
      if (savedTheme) setTheme(savedTheme);
      if (savedLike || savedDislike) {
        setFoodPrefs({ like: savedLike || '', dislike: savedDislike || '' });
      }
      if (savedApiUser || savedApiPass) {
        setApiCredentials({ user: savedApiUser || '', pass: savedApiPass || '' });
      }

      // Calcular día actual si hay fecha de inicio
      if (savedStartDate) {
        const dayIndex = calculateCurrentDay(savedStartDate);
        setCurrentDay(dayIndex);
        setCurrentWeek(Math.floor(dayIndex / 7) + 1);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentDay = (startDate) => {
    const start = new Date(startDate);
    const today = new Date();
    const diffMs = today - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 0;
    if (diffDays > derivedPlan.length - 1) return derivedPlan.length - 1;
    return diffDays;
  };

  const updateUser = async (updates) => {
    setUser(prev => ({ ...prev, ...updates }));
    if (updates.name) await AsyncStorage.setItem('keto-name', updates.name);
    if (updates.startDate) await AsyncStorage.setItem('keto-start-date', updates.startDate);
  };

  const updateSettings = async (key, value) => {
    const storageKey = `keto-${key}`;
    await AsyncStorage.setItem(storageKey, String(value));
    
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
        setTheme(value);
        break;
    }
  };

  const updateFoodPrefs = async (like, dislike) => {
    setFoodPrefs({ like, dislike });
    await AsyncStorage.setItem('keto-like-foods', like);
    await AsyncStorage.setItem('keto-dislike-foods', dislike);
  };

  const updateApiCredentials = async (user, pass) => {
    setApiCredentials({ user, pass });
    await AsyncStorage.setItem('keto-api-user', user);
    await AsyncStorage.setItem('keto-api-pass', pass);
  };

  const resetApp = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ketoKeys = keys.filter(k => k.startsWith('keto-'));
      await AsyncStorage.multiRemove(ketoKeys);
      
      // Reset state
      setUser({ name: '', startDate: null });
      setCurrentDay(0);
      setCurrentWeek(1);
      setPlanWeeks(2);
      setGender('male');
      setLanguage('es');
      setTheme('dark');
      setFoodPrefs({ like: '', dislike: '' });
      setApiCredentials({ user: '', pass: '' });
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
    theme,
    derivedPlan,
    foodPrefs,
    apiCredentials,
    loading,
    setCurrentDay,
    setCurrentWeek,
    updateUser,
    updateSettings,
    updateFoodPrefs,
    updateApiCredentials,
    resetApp
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;

import { basePlan } from '../data/basePlan';
import { basePlanEn } from '../data/basePlanEn';
import { MEAL_KCAL_SPLIT_MAP } from './plan';

/**
 * Construir plan extendido (2, 3 o 4 semanas)
 */
export function buildPlan(weeks = 2, gender = 'male', language = 'es') {
  const totalDays = weeks * 7;
  const plan = [];

  const template = language === 'en' ? basePlanEn : basePlan;

  for (let i = 0; i < totalDays; i++) {
    const baseDay = template[i % template.length];
    const dayCopy = JSON.parse(JSON.stringify(baseDay));

    // Actualizar nombre del día
    dayCopy.dia = language === 'en' ? `Day ${i + 1}` : `Día ${i + 1}`;

    // Ajuste de calorías por género
    if (gender === 'female') {
      dayCopy.kcal = Math.round((dayCopy.kcal || 1600) * 0.9);
    } else {
      dayCopy.kcal = dayCopy.kcal || 1600;
    }
    
    plan.push(dayCopy);
  }

  return plan;
}

/**
 * Estimar porcentaje de grasa corporal (fórmula aproximada)
 */
export function estimateBodyFat(heightCm, weightKg, age, gender = 'male') {
  if (!heightCm || !weightKg || !age) return null;

  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  const a = Number(age);

  if (!h || !w || !a) return null;

  const bmi = w / (h * h);
  const sex = gender === 'female' ? 0 : 1;
  
  let bf = 1.2 * bmi + 0.23 * a - 10.8 * sex - 5.4;

  // Límites razonables
  if (bf < 6) bf = 6;
  if (bf > 50) bf = 50;

  return parseFloat(bf.toFixed(1));
}

/**
 * Calcular TMB (Tasa Metabólica Basal) - Fórmula Mifflin-St Jeor
 */
export function calculateBMR(heightCm, weightKg, age, isMale = true) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  const a = Number(age);

  if (!h || !w || !a) return null;

  // BMR = 10 * peso(kg) + 6.25 * altura(cm) - 5 * edad + s
  // s = +5 para hombres, -161 para mujeres
  const base = 10 * w + 6.25 * h - 5 * a + (isMale ? 5 : -161);

  return Math.round(base);
}

/**
 * Calcular gasto calórico total (TDEE) según nivel de actividad
 */
export function calculateTDEE(bmr, activityLevel = 'sedentary') {
  const multipliers = {
    sedentary: 1.2,      // Poco o ningún ejercicio
    light: 1.375,        // Ejercicio ligero 1-3 días/semana
    moderate: 1.55,      // Ejercicio moderado 3-5 días/semana
    active: 1.725,       // Ejercicio intenso 6-7 días/semana
    veryActive: 1.9      // Ejercicio muy intenso, trabajo físico
  };

  const multiplier = multipliers[activityLevel] || 1.2;
  return Math.round(bmr * multiplier);
}

/**
 * Calcular calorías consumidas según comidas marcadas
 */
export function calculateConsumedCalories(mealStates, goalKcal = 1600) {
  let consumed = 0;

  Object.keys(mealStates).forEach(mealKey => {
    if (mealStates[mealKey]) {
      consumed += Math.round(goalKcal * (MEAL_KCAL_SPLIT_MAP[mealKey] || 0));
    }
  });

  return consumed;
}

/**
 * Calcular macros dinámicos según calorías consumidas
 */
export function calculateDynamicMacros(baseMacros, consumed, goal) {
  const baseCarb = parseFloat(baseMacros.carbs) || 0;
  const baseProt = parseFloat(baseMacros.prot) || 0;
  const baseFat = parseFloat(baseMacros.fat) || 0;

  const factor = goal > 0 ? consumed / goal : 0;

  return {
    carbs: `${Math.round(baseCarb * factor)}% / ${Math.round(baseCarb)}%`,
    prot: `${Math.round(baseProt * factor)}% / ${Math.round(baseProt)}%`,
    fat: `${Math.round(baseFat * factor)}% / ${Math.round(baseFat)}%`
  };
}

/**
 * Calcular peso ideal aproximado (fórmula Devine)
 */
export function calculateIdealWeight(heightCm, gender = 'male') {
  const h = Number(heightCm);
  if (!h || h < 100) return null;

  const heightInches = h / 2.54;
  
  // Fórmula Devine:
  // Hombres: 50 kg + 2.3 kg por cada pulgada sobre 5 pies
  // Mujeres: 45.5 kg + 2.3 kg por cada pulgada sobre 5 pies
  const base = gender === 'female' ? 45.5 : 50;
  const fiveFeetInches = 60; // 5 pies = 60 pulgadas
  
  if (heightInches <= fiveFeetInches) {
    return Math.round(base);
  }

  const extraInches = heightInches - fiveFeetInches;
  const idealWeight = base + (2.3 * extraInches);

  return Math.round(idealWeight);
}

/**
 * Calcular IMC (Índice de Masa Corporal)
 */
export function calculateBMI(heightCm, weightKg) {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);

  if (!h || !w) return null;

  const bmi = w / (h * h);
  return parseFloat(bmi.toFixed(1));
}

/**
 * Obtener categoría de IMC
 */
export function getBMICategory(bmi, language = 'es') {
  if (!bmi) return null;

  const categories = {
    es: {
      underweight: 'Bajo peso',
      normal: 'Normal',
      overweight: 'Sobrepeso',
      obese: 'Obesidad'
    },
    en: {
      underweight: 'Underweight',
      normal: 'Normal',
      overweight: 'Overweight',
      obese: 'Obese'
    }
  };

  const lang = categories[language] || categories.es;

  if (bmi < 18.5) return lang.underweight;
  if (bmi < 25) return lang.normal;
  if (bmi < 30) return lang.overweight;
  return lang.obese;
}

/**
 * Calcular déficit calórico necesario para perder peso
 */
export function calculateDeficitForWeightLoss(currentWeight, targetWeight, weeks = 4) {
  const weightDiff = currentWeight - targetWeight;
  
  // 1 kg de grasa ≈ 7700 kcal
  const totalCalorieDeficit = weightDiff * 7700;
  const days = weeks * 7;
  const dailyDeficit = Math.round(totalCalorieDeficit / days);

  return {
    totalDeficit: Math.round(totalCalorieDeficit),
    dailyDeficit,
    weeksNeeded: weeks,
    isHealthy: dailyDeficit <= 1000 // Déficit > 1000 kcal/día no es saludable
  };
}

/**
 * Estimar calorías quemadas por actividad física
 */
export function estimateExerciseCalories(weightKg, minutes, intensity = 'moderate') {
  const w = Number(weightKg);
  const m = Number(minutes);

  if (!w || !m) return 0;

  // MET (Metabolic Equivalent of Task)
  const metValues = {
    light: 3.5,      // Caminar lento, yoga
    moderate: 5.5,   // Caminar rápido, peso corporal
    high: 8.0,       // Correr, HIIT
    veryHigh: 10.0   // Sprints, deportes intensos
  };

  const met = metValues[intensity] || 5.5;
  
  // Calorías = MET * peso(kg) * tiempo(h)
  const hours = m / 60;
  const calories = met * w * hours;

  return Math.round(calories);
}

/**
 * Calcular hidratación recomendada
 */
export function calculateWaterGoal(weightKg, activityLevel = 'moderate') {
  const w = Number(weightKg);
  if (!w) return 2400;

  // Base: 35 ml por kg de peso
  let baseWater = w * 35;

  // Ajuste por actividad
  const activityMultiplier = {
    sedentary: 1.0,
    light: 1.1,
    moderate: 1.2,
    active: 1.3,
    veryActive: 1.4
  };

  const multiplier = activityMultiplier[activityLevel] || 1.2;
  const recommendedWater = Math.round(baseWater * multiplier);

  // Límites razonables (1500-4000 ml)
  if (recommendedWater < 1500) return 1500;
  if (recommendedWater > 4000) return 4000;

  return recommendedWater;
}

/**
 * Calcular progreso de peso
 */
export function calculateWeightProgress(startWeight, currentWeight, goalWeight) {
  const totalToLose = startWeight - goalWeight;
  const lostSoFar = startWeight - currentWeight;
  
  if (totalToLose <= 0) {
    return {
      percentage: 0,
      lost: 0,
      remaining: 0
    };
  }

  const percentage = Math.round((lostSoFar / totalToLose) * 100);

  return {
    percentage: Math.max(0, Math.min(100, percentage)),
    lost: parseFloat(lostSoFar.toFixed(1)),
    remaining: parseFloat((totalToLose - lostSoFar).toFixed(1))
  };
}

export default {
  buildPlan,
  estimateBodyFat,
  calculateBMR,
  calculateTDEE,
  calculateConsumedCalories,
  calculateDynamicMacros,
  calculateIdealWeight,
  calculateBMI,
  getBMICategory,
  calculateDeficitForWeightLoss,
  estimateExerciseCalories,
  calculateWaterGoal,
  calculateWeightProgress
};

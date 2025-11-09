const localizedWorkouts = {
  1: {
    focusES: 'Base de movilidad + caminar',
    focusEN: 'Mobility + walking base',
    days: [
      'Caminar 30 min ritmo cómodo',
      'Movilidad cadera + hombros 12 min',
      'Descanso activo: 15 min estiramientos',
      'Caminar 30 min + plancha 3 x 30 s',
      'Fuerza peso corporal 20 min',
      'Caminar 25-30 min',
      'Respiración profunda 5 min + estiramientos'
    ]
  },
  2: {
    focusES: 'Más cardio y fuerza ligera',
    focusEN: 'More cardio and light strength',
    days: [
      'Caminar 35 min',
      'Pierna peso corporal 20 min',
      'Caminar 20 min + core 3 x 15',
      'Caminar 35 min',
      'Torso 20 min',
      'Movilidad 10 min',
      'Descanso activo 15 min'
    ]
  },
  3: {
    focusES: 'Frecuencia alta y core',
    focusEN: 'Higher frequency + core',
    days: [
      'Caminar rápido 30 min',
      'Core 15 min',
      'Fuerza full body ligera',
      'Caminar 30-35 min',
      'Subir escaleras 10-12 min',
      'Movilidad 10 min',
      'Descanso activo'
    ]
  },
  4: {
    focusES: 'Consolidación y fuerza completa',
    focusEN: 'Consolidation + full strength',
    days: [
      'Caminar 40 min',
      'Fuerza completa 25 min',
      'Core + movilidad 15 min',
      'Caminar 35 min',
      'Fuerza tren inferior 20 min',
      'Caminar 25 min',
      'Respiración + estiramientos 10 min'
    ]
  }
};

export const getWorkoutForDay = (language = 'es', weekNumber = 1, dayIndex = 0) => {
  const workout = localizedWorkouts[weekNumber] || localizedWorkouts[1];
  const focus = language === 'en' ? workout.focusEN : workout.focusES;
  const days = Array.isArray(workout.days) ? workout.days : [];
  const today = days[dayIndex % days.length] || days[0] || '';

  return {
    focus,
    today,
    days
  };
};

export default localizedWorkouts;

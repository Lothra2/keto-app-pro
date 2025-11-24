export const dailyTips = {
  es: [
    '🥤 Toma agua con un poco de sal.',
    '🥑 Si tienes hambre sube grasa.',
    '🍳 Dos huevos extra están bien.',
    '📸 Foto día 1 y día final.',
    '🧴 Puedes cambiar mantequilla por aceite.'
  ],
  en: [
    '🥤 Remember to drink water with a pinch of salt.',
    '🥑 If you feel hungry, increase fats.',
    '🍳 Two extra eggs are fine.',
    '📸 Take a picture on day 1 and last day.',
    '🧴 You can swap butter for olive oil.'
  ]
};

export const motivationalMessages = {
  es: [
    'Vas un día a la vez. Manténlo simple.',
    'Tu yo de mañana te va a agradecer esto.',
    'No tiene que ser perfecto, solo consistente.',
    'Comiste bien, ahora hidrátate 💧.',
    'Moverte 20 min hoy ya es ganancia.',
    'Esto ya parece rutina, sigue así.',
    'Casi cierras la semana 👏.',
    'Nueva semana, mismas metas.',
    'Tu cuerpo ya está respondiendo.',
    'No subestimes los snacks limpios.',
    'Buen ritmo, no lo sueltes.',
    'Tómate 5 min de estiramientos.',
    'Ya casi terminas el plan.',
    'Cierra con foto y peso 😉'
  ],
  en: [
    'One day at a time. Keep it simple.',
    'Your future you will love this.',
    'It doesn’t need to be perfect, just consistent.',
    'You ate clean, now hydrate 💧.',
    'Move 20 min today, that’s enough.',
    'This is becoming a routine.',
    'Almost closing the week 👏.',
    'New week, same goals.',
    'Your body is responding already.',
    'Clean snacks matter.',
    'Nice pace, keep it.',
    'Take 5 min for stretches.',
    'You’re close to the finish.',
    'Close with photo and weight 😉'
  ]
};

export const localSmartTips = {
  desayuno: {
    es: 'Tip: ya tienes un desayuno base, úsalo y guarda IA para el día completo 😉',
    en: 'Tip: you already have a base breakfast, save AI for the full day 😉'
  },
  almuerzo: {
    es: 'Tip: puedes usar el almuerzo base y solo cambiar proteína.',
    en: 'Tip: keep the base lunch and just swap the protein.'
  },
  cena: {
    es: 'Tip: si solo quieres variar la cena, prueba el swap manual antes de usar IA.',
    en: 'Tip: if you only want to change dinner, try the manual swap before using AI.'
  }
};

const getListByLanguage = (collection, language = 'es') => {
  const list = collection[language] || collection.es;
  return Array.isArray(list) ? list : [];
};

export const getDailyTip = (language = 'es', dayIndex = 0) => {
  const list = getListByLanguage(dailyTips, language);
  if (!list.length) return '';
  return list[dayIndex % list.length];
};

export const getMotivationalMessage = (language = 'es', dayIndex = 0) => {
  const list = getListByLanguage(motivationalMessages, language);
  if (!list.length) return '';
  return list[Math.min(dayIndex, list.length - 1)];
};

export const getLocalMealTip = (mealKey, language = 'es') => {
  const tip = localSmartTips[mealKey];
  if (!tip) return '';
  if (typeof tip === 'string') return tip;
  return tip[language] || tip.es || '';
};

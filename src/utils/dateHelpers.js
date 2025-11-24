/**
 * Calcular el día actual del plan basado en la fecha de inicio
 */
export function calculateCurrentDay(startDate, totalDays) {
  if (!startDate) return 0;
  
  const start = new Date(startDate);
  const today = new Date();
  const diffMs = today - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 0;
  if (diffDays >= totalDays) return totalDays - 1;
  return diffDays;
}

/**
 * Formatear fecha a string legible
 */
export function formatDate(date, language = 'es') {
  if (!date) return '';
  
  const d = new Date(date);
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  return d.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', options);
}

/**
 * Obtener fecha de hoy en formato YYYY-MM-DD
 */
export function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Calcular días restantes del plan
 */
export function getDaysRemaining(startDate, totalDays) {
  const currentDay = calculateCurrentDay(startDate, totalDays);
  return Math.max(0, totalDays - currentDay - 1);
}

/**
 * Verificar si una fecha es hoy
 */
export function isToday(date) {
  const today = new Date();
  const d = new Date(date);
  
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
}

/**
 * Obtener semana actual del plan
 */
export function getCurrentWeek(startDate, totalDays) {
  const currentDay = calculateCurrentDay(startDate, totalDays);
  return Math.floor(currentDay / 7) + 1;
}

export default {
  calculateCurrentDay,
  formatDate,
  getTodayString,
  getDaysRemaining,
  isToday,
  getCurrentWeek
};
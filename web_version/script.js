// ====== CONSTANTES DE STORAGE ======
const LS_PREFIX = "keto14-rick-";
const LS_NAME = LS_PREFIX + "name";
const LS_THEME = LS_PREFIX + "theme";
const LS_START = LS_PREFIX + "start-date";
const LS_PLAN_WEEKS = LS_PREFIX + "plan-weeks";
const LS_DAILY_VIEW = LS_PREFIX + "daily-view";
const LS_PRIMARY = LS_PREFIX + "primary-color";
const LS_HEIGHT = LS_PREFIX + "height-cm";
const LS_START_WEIGHT = LS_PREFIX + "start-weight";
const LS_AGE = LS_PREFIX + "age";
const LS_LANG = LS_PREFIX + "lang";
const LS_LIKE = LS_PREFIX + "like-foods";
const LS_DISLIKE = LS_PREFIX + "dislike-foods";
const LS_API_USER = LS_PREFIX + "api-user";
const LS_API_PASS = LS_PREFIX + "api-pass";
const LS_AI_DAY_PREFIX = LS_PREFIX + "ai-day-"; // guardar día IA
const LS_GENDER = LS_PREFIX + "gender"; // masculino/femenino
const LS_AI_WORKOUT = LS_PREFIX + "ai-workout-"; // guardar entreno IA por día
const LS_AI_WEEK_PREFIX = LS_PREFIX + "ai-week-"; // guardar revisión IA por semana
const LS_CAL_PREFIX = LS_PREFIX + "cal-";
const LS_PROGRESS_PREFIX = LS_PREFIX + "prog-";
const LS_SELECTED_DAY = LS_PREFIX + "sel-day"; // recordar día seleccionado
const LS_SELECTED_WEEK = LS_PREFIX + "sel-week"; // recordar semana seleccionada
const LS_WORKOUT_INTENSITY = LS_PREFIX + "workout-intensity"; // ligera/moderada/alta
const LS_AI_SHOPPING = LS_PREFIX + "ai-shopping-"; // lista de compras IA por semana


// agua
const LS_WATER_PREFIX = LS_PREFIX + "water-";
const LS_WATER_GOAL = LS_PREFIX + "water-goal";

// gamificación básica
const LS_BADGE_PREFIX = LS_PREFIX + "badge-";

const GROK_PROXY = "/.netlify/functions/grok";

let weightChart = null;
let exerciseChart = null;
let derivedPlan = [];
let currentWeeks = 2;
let dailyView = 0;
let appLang = "es";

// ====== TOAST ======
const toastEl = document.getElementById("appToast");
let toastTimer = null;
function showToast(msg, duration = 1800) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hideToast(), duration);
}
function hideToast() {
  if (!toastEl) return;
  toastEl.classList.remove("show");
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}
if (toastEl) toastEl.addEventListener("click", hideToast);
document.addEventListener("scroll", () => hideToast(), true);

// ====== PLAN BASE (14 DÍAS) ======
const basePlan = [
  {dia:"Día 1",kcal:1650,macros:{carbs:"7%",prot:"25%",fat:"68%"},desayuno:{nombre:"Huevos con aguacate y feta",qty:"2 huevos, 1/2 aguacate, 30 g feta, 5 g mantequilla"},snackAM:{nombre:"Yogur griego con marañones",qty:"120 g yogur, 20 g marañones"},almuerzo:{nombre:"Salmón con brócoli",qty:"150 g salmón, 120 g brócoli, 10 g mantequilla"},snackPM:{nombre:"Feta con tomate cherry",qty:"30 g feta, 4 tomates"},cena:{nombre:"Bife de res con rocket y aguacate",qty:"160 g res, 40 g rocket, 1/2 aguacate"}},
  {dia:"Día 2",kcal:1600,macros:{carbs:"8%",prot:"24%",fat:"68%"},desayuno:{nombre:"Omelette feta y tomate",qty:"2-3 huevos, 30 g feta, 40 g tomate"},snackAM:{nombre:"Marañones y café",qty:"20 g marañones"},almuerzo:{nombre:"Pollo a la parrilla con rocket",qty:"150 g pollo, 50 g rocket, 1/2 aguacate"},snackPM:{nombre:"Yogur con coco",qty:"120 g yogur, 10 g coco"},cena:{nombre:"Camarones al ajillo con coliflor",qty:"140 g camarón, 120 g coliflor"}},
  {dia:"Día 3",kcal:1580,macros:{carbs:"6%",prot:"26%",fat:"68%"},desayuno:{nombre:"Yogur con nueces y chía",qty:"150 g yogur, 15 g nueces, 5 g chía"},snackAM:{nombre:"Feta y aguacate",qty:"25 g feta, 30 g aguacate"},almuerzo:{nombre:"Hamburguesa sin pan con rocket",qty:"150 g carne, 50 g rocket, 4 tomates"},snackPM:{nombre:"Marañones",qty:"20 g"},cena:{nombre:"Salmón con brócoli y mantequilla",qty:"150 g salmón, 120 g brócoli, 5 g mantequilla"}},
  {dia:"Día 4",kcal:1620,macros:{carbs:"7%",prot:"24%",fat:"69%"},desayuno:{nombre:"Huevos cocidos con aguacate",qty:"2 huevos, 1/2 aguacate"},snackAM:{nombre:"Yogur y marañones",qty:"120 g yogur, 20 g marañones"},almuerzo:{nombre:"Pollo en crema con champiñón y brócoli",qty:"150 g pollo, 60 g champiñón, 100 g brócoli, 20 ml crema"},snackPM:{nombre:"Feta con rocket",qty:"30 g feta, 20 g rocket"},cena:{nombre:"Carne roja con rocket y tomate seco",qty:"160 g carne, 40 g rocket, 15 g tomate seco"}},
  {dia:"Día 5",kcal:1590,macros:{carbs:"8%",prot:"25%",fat:"67%"},desayuno:{nombre:"Omelette con feta y champiñones",qty:"2-3 huevos, 30 g feta, 50 g champiñón"},snackAM:{nombre:"Café con crema + marañones",qty:"café + 10 ml crema + 15 g marañones"},almuerzo:{nombre:"Ensalada keto de pollo",qty:"140 g pollo, 1/2 aguacate, 40 g tomate, 40 g rocket"},snackPM:{nombre:"Yogur con coco",qty:"120 g yogur, 10 g coco"},cena:{nombre:"Camarones con puré de coliflor",qty:"140 g camarón, 120 g coliflor, 10 g mantequilla"}},
  {dia:"Día 6",kcal:1600,macros:{carbs:"7%",prot:"25%",fat:"68%"},desayuno:{nombre:"Yogur con chía y nueces",qty:"150 g yogur, 5 g chía, 15 g nueces"},snackAM:{nombre:"Feta y aguacate",qty:"25 g feta, 30 g aguacate"},almuerzo:{nombre:"Bife con ensalada y feta",qty:"160 g res, 40 g hojas verdes, 20 g feta"},snackPM:{nombre:"Marañones",qty:"20 g"},cena:{nombre:"Pollo al horno con brócoli gratinado",qty:"150 g pollo, 100 g brócoli, 20 g queso"}},
  {dia:"Día 7",kcal:1580,macros:{carbs:"7%",prot:"24%",fat:"69%"},desayuno:{nombre:"Huevos revueltos con mantequilla y aguacate",qty:"2 huevos, 1/2 aguacate, 5 g mantequilla"},snackAM:{nombre:"Yogur + chía",qty:"120 g yogur, 5 g chía"},almuerzo:{nombre:"Ensalada de salmón con rocket y feta",qty:"140 g salmón, 40 g rocket, 20 g feta"},snackPM:{nombre:"Feta con tomate",qty:"30 g feta, 4 tomates"},cena:{nombre:"Filete de res con brócoli",qty:"160 g res, 100 g brócoli, 5 g mantequilla"}},
  {dia:"Día 8",kcal:1600,macros:{carbs:"7%",prot:"25%",fat:"68%"},desayuno:{nombre:"Omelette 3 huevos con feta y rocket",qty:"3 huevos, 30 g feta, 30 g rocket"},snackAM:{nombre:"Yogur con marañones",qty:"120 g yogur, 20 g marañones"},almuerzo:{nombre:"Pollo salteado con brócoli",qty:"150 g pollo, 100 g brócoli, 5 ml aceite"},snackPM:{nombre:"Feta y aguacate",qty:"25 g feta, 30 g aguacate"},cena:{nombre:"Salmón con mantequilla de ajo",qty:"150 g salmón, 5 g mantequilla"}},
  {dia:"Día 9",kcal:1590,macros:{carbs:"7%",prot:"25%",fat:"68%"},desayuno:{nombre:"Yogur con nueces y coco",qty:"150 g yogur, 10 g coco, 15 g nueces"},snackAM:{nombre:"Feta y tomate",qty:"25 g feta, 4 tomates"},almuerzo:{nombre:"Bife con rocket y aguacate",qty:"160 g res, 40 g rocket, 1/2 aguacate"},snackPM:{nombre:"Marañones o almendras",qty:"20 g"},cena:{nombre:"Camarones con crema y brócoli",qty:"140 g camarón, 100 g brócoli, 20 ml crema"}},
  {dia:"Día 10",kcal:1600,macros:{carbs:"8%",prot:"24%",fat:"68%"},desayuno:{nombre:"Huevos fritos con aguacate",qty:"2 huevos, 1/2 aguacate"},snackAM:{nombre:"Yogur con chía",qty:"120 g yogur, 5 g chía"},almuerzo:{nombre:"Pollo al curry sin arroz con coliflor",qty:"150 g pollo, 100 g coliflor"},snackPM:{nombre:"Feta con rocket",qty:"25 g feta, 20 g rocket"},cena:{nombre:"Salmón con tomate y feta",qty:"150 g salmón, 40 g tomate, 20 g feta"}},
  {dia:"Día 11",kcal:1590,macros:{carbs:"7%",prot:"25%",fat:"68%"},desayuno:{nombre:"Omelette con champiñones y feta",qty:"2-3 huevos, 50 g champiñón, 20 g feta"},snackAM:{nombre:"Marañones",qty:"20 g"},almuerzo:{nombre:"Ensalada de pollo y aguacate",qty:"140 g pollo, 1/2 aguacate, 40 g rocket"},snackPM:{nombre:"Yogur con coco",qty:"120 g yogur, 10 g coco"},cena:{nombre:"Carne roja con puré de coliflor",qty:"160 g carne, 120 g coliflor"}},
  {dia:"Día 12",kcal:1580,macros:{carbs:"7%",prot:"24%",fat:"69%"},desayuno:{nombre:"Yogur con nueces",qty:"150 g yogur, 15 g nueces"},snackAM:{nombre:"Feta y aguacate",qty:"25 g feta, 30 g aguacate"},almuerzo:{nombre:"Camarones al ajillo con ensalada",qty:"140 g camarón, 50 g hojas verdes, 5 ml aceite"},snackPM:{nombre:"Café con crema + marañones",qty:"10 ml crema, 15 g marañones"},cena:{nombre:"Pollo al horno con brócoli y feta",qty:"150 g pollo, 100 g brócoli, 20 g feta"}},
  {dia:"Día 13",kcal:1600,macros:{carbs:"7%",prot:"24%",fat:"69%"},desayuno:{nombre:"Huevos cocidos con aguacate",qty:"2 huevos, 1/2 aguacate"},snackAM:{nombre:"Yogur con coco",qty:"120 g yogur, 10 g coco"},almuerzo:{nombre:"Bife con tomate y rocket",qty:"160 g res, 40 g rocket, 40 g tomate"},snackPM:{nombre:"Feta con nueces",qty:"25 g feta, 10 g nueces"},cena:{nombre:"Salmón con mantequilla y brócoli",qty:"150 g salmón, 100 g brócoli, 5 g mantequilla"}},
  {dia:"Día 14",kcal:1600,macros:{carbs:"7%",prot:"24%",fat:"69%"},desayuno:{nombre:"Omelette feta y rocket",qty:"2-3 huevos, 30 g feta, 30 g rocket"},snackAM:{nombre:"Yogur con chía",qty:"120 g yogur, 5 g chía"},almuerzo:{nombre:"Pollo con aguacate y tomate",qty:"140 g pollo, 1/2 aguacate, 40 g tomate"},snackPM:{nombre:"Marañones o feta",qty:"20 g marañones o 25 g feta"},cena:{nombre:"Filete de res con brócoli y mantequilla",qty:"160 g res, 100 g brócoli, 5 g mantequilla"}}
];

const tipsES = [
  "🥤 Toma agua con un poco de sal.",
  "🥑 Si tienes hambre sube grasa.",
  "🍳 Dos huevos extra están bien.",
  "📸 Foto día 1 y día final.",
  "🧴 Puedes cambiar mantequilla por aceite."
];
const tipsEN = [
  "🥤 Remember to drink water with a pinch of salt.",
  "🥑 If you feel hungry, increase fats.",
  "🍳 Two extra eggs are fine.",
  "📸 Take a picture on day 1 and last day.",
  "🧴 You can swap butter for olive oil."
];

// frases motivacionales por día
const motivationalES = [
  "Vas un día a la vez. Manténlo simple.",
  "Tu yo de mañana te va a agradecer esto.",
  "No tiene que ser perfecto, solo consistente.",
  "Comiste bien, ahora hidrátate 💧.",
  "Moverte 20 min hoy ya es ganancia.",
  "Esto ya parece rutina, sigue así.",
  "Casi cierras la semana 👏.",
  "Nueva semana, mismas metas.",
  "Tu cuerpo ya está respondiendo.",
  "No subestimes los snacks limpios.",
  "Buen ritmo, no lo sueltes.",
  "Tómate 5 min de estiramientos.",
  "Ya casi terminas el plan.",
  "Cierra con foto y peso 😉"
];
const motivationalEN = [
  "One day at a time. Keep it simple.",
  "Your future you will love this.",
  "It doesn’t need to be perfect, just consistent.",
  "You ate clean, now hydrate 💧.",
  "Move 20 min today, that’s enough.",
  "This is becoming a routine.",
  "Almost closing the week 👏.",
  "New week, same goals.",
  "Your body is responding already.",
  "Clean snacks matter.",
  "Nice pace, keep it.",
  "Take 5 min for stretches.",
  "You’re close to the finish.",
  "Close with photo and weight 😉"
];

// tips locales para no gastar IA
const localSmartTips = {
  desayuno: "Tip: ya tienes un desayuno base, úsalo y guarda IA para el día completo 😉",
  almuerzo: "Tip: puedes usar el almuerzo base y solo cambiar proteína.",
  cena: "Tip: si solo quieres variar la cena, prueba el swap manual antes de usar IA."
};

// ====== WORKOUTS LOCALIZADOS ======
const localizedWorkouts = {
  1: {
    focusES: "Base de movilidad + caminar",
    focusEN: "Mobility + walking base",
    days: [
      "Caminar 30 min ritmo cómodo",
      "Movilidad cadera + hombros 12 min",
      "Descanso activo: 15 min estiramientos",
      "Caminar 30 min + plancha 3 x 30 s",
      "Fuerza peso corporal 20 min",
      "Caminar 25-30 min",
      "Respiración profunda 5 min + estiramientos"
    ]
  },
  2: {
    focusES: "Más cardio y fuerza ligera",
    focusEN: "More cardio and light strength",
    days: [
      "Caminar 35 min",
      "Pierna peso corporal 20 min",
      "Caminar 20 min + core 3 x 15",
      "Caminar 35 min",
      "Torso 20 min",
      "Movilidad 10 min",
      "Descanso activo 15 min"
    ]
  },
  3: {
    focusES: "Frecuencia alta y core",
    focusEN: "Higher frequency + core",
    days: [
      "Caminar rápido 30 min",
      "Core 15 min",
      "Fuerza full body ligera",
      "Caminar 30-35 min",
      "Subir escaleras 10-12 min",
      "Movilidad 10 min",
      "Descanso activo"
    ]
  },
  4: {
    focusES: "Consolidación y fuerza completa",
    focusEN: "Consolidation + full strength",
    days: [
      "Caminar 40 min",
      "Fuerza completa 25 min",
      "Core + movilidad 15 min",
      "Caminar 35 min",
      "Fuerza tren inferior 20 min",
      "Caminar 25 min",
      "Respiración + estiramientos 10 min"
    ]
  }
};

function getWorkoutForDay(week, dayIndex) {
  const w = localizedWorkouts[week] || localizedWorkouts[1];
  const today = w.days[dayIndex] || w.days[0];
  return {
    focus: appLang === "en" ? w.focusEN : w.focusES,
    today
  };
}

// ====== BUILD PLAN ======
function buildPlan(weeks, gender = "male") {
  const totalDays = weeks * 7;
  const arr = [];
  for (let i = 0; i < totalDays; i++) {
    const base = basePlan[i % basePlan.length];
    const copy = JSON.parse(JSON.stringify(base));
    copy.dia = "Día " + (i + 1);

    // ajuste simple por género
    if (gender === "female") {
      copy.kcal = Math.round((copy.kcal || 1600) * 0.9);
    } else {
      copy.kcal = copy.kcal || 1600;
    }

    arr.push(copy);
  }
  return arr;
}


// ====== TIPS ======
function setRandomTip(name) {
  const tipBox = document.getElementById("tipBox");
  const source = appLang === "en" ? tipsEN : tipsES;
  const base = source[Math.floor(Math.random() * source.length)];
  tipBox.textContent = name ? base + " " + name + "." : base;
}

// ====== MOTIVACIÓN GLOBAL (sigue existiendo) ======
function showMotivation() {
  const box = document.getElementById("motivation");
  const done = getCompletedCount();
  const total = derivedPlan.length;
  const name = localStorage.getItem(LS_NAME) || "";
  let msg = "";
  if (appLang === "en") {
    if (done === 0) msg = "Starting is the hardest part. You're here " + (name || "");
    else if (done < total / 2) msg = "Good pace " + (name || "") + ". You have " + done + " days done.";
    else if (done < total) msg = "More than half. Keep it up.";
    else msg = "Plan completed. Take a photo and share.";
  } else {
    if (done === 0) msg = "Inicio es lo más difícil. Ya estás aquí " + (name || "");
    else if (done < total / 2) msg = "Buen ritmo " + (name || "") + ". Ya tienes " + done + " días.";
    else if (done < total) msg = "Más de la mitad. Mantén el plan.";
    else msg = "Plan completado. Haz una foto y compártelo.";
  }
  box.textContent = msg;
  box.style.display = "block";
}

// ====== NOMBRE ======
function saveNameFromModal() {
  const n1 = document.getElementById("name1").value.trim();
  if (n1) {
    localStorage.setItem(LS_NAME, n1);
    setHeaderName(n1);
    setRandomTip(n1);
  }
  document.getElementById("nameModal").style.display = "none";
}
function setHeaderName(name) {
  const sub = document.getElementById("subTitle");
  sub.textContent = (appLang === "en" ? "For " : "Para ") + name;
  const settings = document.getElementById("settingsName");
  if (settings) settings.value = name;
}
function applySettingsName() {
  const name = document.getElementById("settingsName").value.trim();
  localStorage.setItem(LS_NAME, name);
  setHeaderName(name);
  setRandomTip(name);
  showToast(appLang === "en" ? "Name updated" : "Nombre actualizado");
}

// ====== FECHA INICIO ======
function askStartDateIfNeeded() {
  const saved = localStorage.getItem(LS_START);
  if (!saved) {
    const today = new Date().toISOString().slice(0,10);
    localStorage.setItem(LS_START, today);
  }
}
function changeStartDate() {
  const val = document.getElementById("startDateInput").value;
  if (val) {
    localStorage.setItem(LS_START, val);
    showToast(appLang === "en" ? "Start date changed" : "Fecha cambiada");
    switchTab("menu");
  }
}
function getCurrentDayIndex() {
  const saved = localStorage.getItem(LS_START);
  if (!saved) return 0;
  const start = new Date(saved);
  const today = new Date();
  const diffMs = today - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 0;
  if (diffDays > derivedPlan.length - 1) return derivedPlan.length - 1;
  return diffDays;
}

// ====== RENDER CONTROLES SEMANAS/DÍAS ======
function renderWeekButtons() {
  const ws = document.getElementById("weekSwitch");
  ws.innerHTML = "";
  for (let w = 1; w <= currentWeeks; w++) {
    const btn = document.createElement("div");
    btn.className = "week-btn" + (w === 1 ? " active" : "");
    btn.dataset.week = w;
    const start = (w - 1) * 7 + 1;
    const end = w * 7;
    btn.innerHTML = `
      <span class="week-title">${appLang === "en" ? "Week " : "Semana "} ${w}</span>
      <span class="week-range">(${start}-${end})</span>
    `;
    ws.appendChild(btn);
  }
  ws.style.display = dailyView ? "none" : "flex";
  document.getElementById("dayFloating").style.display = dailyView ? "none" : "flex";
}
function renderDayPills(week) {
  const wrap = document.getElementById("dayFloating");
  wrap.innerHTML = "";
  const start = (week - 1) * 7;
  const end = Math.min(week * 7, derivedPlan.length);
  for (let i = start; i < end; i++) {
    const pill = document.createElement("div");
    pill.className = "day-pill";
    pill.textContent = derivedPlan[i].dia;
    pill.onclick = () => renderMenuDay(i, week);
    wrap.appendChild(pill);
  }
}

// ====== PROGRESO GLOBAL ======
function getCompletedCount() {
  let count = 0;
  for (let i = 0; i < derivedPlan.length; i++) {
    if (localStorage.getItem(LS_PREFIX + "done-" + i) === "1") count++;
  }
  return count;
}
function updateProgressBar() {
  const count = getCompletedCount();
  document.getElementById("progressText").textContent =
    count + " " + (appLang === "en" ? "of" : "de") + " " + derivedPlan.length + " " + (appLang === "en" ? "days" : "días");
  document.getElementById("progressBar").style.width = (count / derivedPlan.length * 100) + "%";
}

// ====== CALORÍAS POR DÍA ======
function getCalorieState(idx, day) {
  const stored = localStorage.getItem(LS_CAL_PREFIX + idx);
  const baseGoal = day.kcal || 1600;
  if (stored) {
    const parsed = JSON.parse(stored);
    parsed.goal = parsed.goal || baseGoal;
    return parsed;
  }
  return {
    goal: baseGoal,
    meals: {
      desayuno: false,
      snackAM: false,
      almuerzo: false,
      snackPM: false,
      cena: false
    }
  };
}
function saveCalorieState(idx, state) {
  localStorage.setItem(LS_CAL_PREFIX + idx, JSON.stringify(state));
}
const mealPercents = {
  desayuno: 0.25,
  snackAM: 0.1,
  almuerzo: 0.35,
  snackPM: 0.1,
  cena: 0.2
};
function calcConsumedFromState(state, day) {
  const goal = state.goal || day.kcal || 1600;
  let consumed = 0;
  Object.keys(state.meals).forEach(meal => {
    if (state.meals[meal]) {
      consumed += Math.round(goal * (mealPercents[meal] || 0));
    }
  });
  return {consumed, goal};
}
function toggleMealCal(idx, mealKey, week) {
  const day = getDayWithAI(idx);
  const state = getCalorieState(idx, day);
  state.meals[mealKey] = !state.meals[mealKey];
  saveCalorieState(idx, state);
  renderMenuDay(idx, week);
}
window.toggleMealCal = toggleMealCal;

// ====== AGUA POR DÍA ======
function getDailyWaterGoal() {
  const saved = Number(localStorage.getItem(LS_WATER_GOAL));
  return saved && saved > 0 ? saved : 2400;
}
function getWaterState(idx) {
  const stored = localStorage.getItem(LS_WATER_PREFIX + idx);
  const goal = getDailyWaterGoal();
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        goal: parsed.goal || goal,
        ml: parsed.ml || 0
      };
    } catch(e) {}
  }
  return {
    goal,
    ml: 0
  };
}
function saveWaterState(idx, state) {
  localStorage.setItem(LS_WATER_PREFIX + idx, JSON.stringify(state));
}
function addWater(idx, week, amount) {
  const dayWater = getWaterState(idx);
  dayWater.ml = Math.max(0, dayWater.ml + amount);
  saveWaterState(idx, dayWater);
  renderMenuDay(idx, week);
}
window.addWater = addWater;
function resetWater(idx, week) {
  const dayWater = getWaterState(idx);
  dayWater.ml = 0;
  saveWaterState(idx, dayWater);
  renderMenuDay(idx, week);
}
window.resetWater = resetWater;

// ====== OBTENER DÍA CON IA MERGEADO ======
function getDayWithAI(idx) {
  let day = derivedPlan[idx];
  const aiStored = localStorage.getItem(LS_AI_DAY_PREFIX + idx);
  if (aiStored) {
    try {
      const parsed = JSON.parse(aiStored);
      day = Object.assign({}, day, parsed);
    } catch(e) {}
  }
  return day;
}

// ====== MACROS DINÁMICOS SEGÚN COMIDAS MARCADAS ======
function computeDynamicMacros(day, calState) {
  const baseCarb = Number((day.macros.carbs || "0").replace("%","")) || 0;
  const baseProt = Number((day.macros.prot || "0").replace("%","")) || 0;
  const baseFat  = Number((day.macros.fat  || "0").replace("%","")) || 0;
  const calCalc = calcConsumedFromState(calState, day);
  const factor = calCalc.goal ? (calCalc.consumed / calCalc.goal) : 0;
  const carb = Math.round(baseCarb * factor);
  const prot = Math.round(baseProt * factor);
  const fat  = Math.round(baseFat  * factor);
  return {
    carbs: carb + "% / " + baseCarb + "%",
    prot:  prot + "% / " + baseProt + "%",
    fat:   fat + "% / " + baseFat + "%"
  };
}

// ====== EXTRAS IA POR DÍA ======
function extractIngredientsFromQty(qty) {
  if (!qty) return [];
  return qty
    .split(/,|•/g)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => t.replace(/\s+/g, " "));
}
function collectAIExtrasForDay(idx) {
  const extras = [];
  const aiDay = localStorage.getItem(LS_AI_DAY_PREFIX + idx);
  if (!aiDay) return extras;
  try {
    const parsed = JSON.parse(aiDay);
    ["desayuno","snackAM","almuerzo","snackPM","cena"].forEach(m => {
      if (parsed[m] && parsed[m].qty) {
        const ing = extractIngredientsFromQty(parsed[m].qty);
        ing.forEach(x => extras.push(x));
      }
    });
  } catch(e) {}
  return extras;
}
function renderAIExtras(idx) {
  const cont = document.getElementById("ai-extras-" + idx);
  if (!cont) return;
  const extras = collectAIExtrasForDay(idx);
  if (!extras.length) {
    cont.style.display = "none";
    cont.innerHTML = "";
    return;
  }
  cont.style.display = "flex";
  cont.innerHTML = `
    <div class="ai-extras-title">${appLang === "en" ? "AI extras for today" : "Extras IA para hoy"}</div>
    <div class="ai-extras-chips">
      ${extras.map(e => `<span class="ai-chip">+ ${e}</span>`).join("")}
    </div>
  `;
}

// ====== MENSAJE MOTIVACIONAL POR DÍA ======
function getDailyMotivation(idx) {
  const source = appLang === "en" ? motivationalEN : motivationalES;
  return source[idx % source.length];
}

// ====== MENÚ DÍA ======
function renderMenuDay(idx, week) {
  localStorage.setItem(LS_SELECTED_DAY, String(idx));
  localStorage.setItem(LS_SELECTED_WEEK, String(week));

  const menuDays = document.getElementById("menuDays");
  menuDays.innerHTML = "";
  const day = getDayWithAI(idx);
  const done = localStorage.getItem(LS_PREFIX + "done-" + idx) === "1";
  const card = document.createElement("div");
  card.className = "day-card";

  const dayIndexInWeek = (idx % 7);
  const workout = getWorkoutForDay(week, dayIndexInWeek);

  const calState = getCalorieState(idx, day);
  const calCalc = calcConsumedFromState(calState, day);
  const calPercent = Math.min(100, Math.round((calCalc.consumed / calCalc.goal) * 100));
  const dynMacros = computeDynamicMacros(day, calState);

  const water = getWaterState(idx);
  const waterPercent = Math.min(100, Math.round((water.ml / water.goal) * 100));
  const motivationText = getDailyMotivation(idx);

  card.innerHTML = `
    <div class="day-title">
      <h2>${day.dia}</h2>
      <div class="kcal">${day.kcal || 1600} kcal</div>
    </div>
    <div class="day-motivation">
      ${motivationText}
    </div>
    <div class="macros">
      <div class="macro">Carbs ${dynMacros.carbs}</div>
      <div class="macro">${appLang === "en" ? "Protein" : "Prote"} ${dynMacros.prot}</div>
      <div class="macro">${appLang === "en" ? "Fat" : "Grasa"} ${dynMacros.fat}</div>
    </div>
    <div class="calorie-bar">
      <div class="calorie-head">
        ${appLang === "en" ? "Calories today" : "Calorías hoy"}:
        <strong id="cal-val-${idx}">${calCalc.consumed}</strong>/<span>${calCalc.goal}</span> kcal
      </div>
      <div class="calorie-line">
        <span style="width:${calPercent}%" id="cal-bar-${idx}"></span>
      </div>
    </div>
    <div class="hydration-box">
      <div class="hydration-head">
        💧 ${appLang === "en" ? "Water today" : "Agua de hoy"}
        <span>${water.ml} / ${water.goal} ml</span>
      </div>
      <div class="hydration-line">
        <span style="width:${waterPercent}%"></span>
      </div>
      <div class="hydration-actions">
        <button onclick="addWater(${idx}, ${week}, 250)">+250ml</button>
        <button onclick="addWater(${idx}, ${week}, 500)">+500ml</button>
        <button class="ghost" onclick="resetWater(${idx}, ${week})">${appLang === "en" ? "Reset" : "Reiniciar"}</button>
      </div>
    </div>
    <div class="food-grid">
      ${buildMealBlock(idx, week, "desayuno", "🍳 " + (appLang === "en" ? "Breakfast" : "Desayuno"), day.desayuno, calState.meals.desayuno)}
      ${buildMealBlock(idx, week, "snackAM", "⏰ " + (appLang === "en" ? "Snack AM" : "Snack AM"), day.snackAM, calState.meals.snackAM)}
      ${buildMealBlock(idx, week, "almuerzo", "🥗 " + (appLang === "en" ? "Lunch" : "Almuerzo"), day.almuerzo, calState.meals.almuerzo)}
      ${buildMealBlock(idx, week, "snackPM", "🥜 " + (appLang === "en" ? "Snack PM" : "Snack PM"), day.snackPM, calState.meals.snackPM)}
      ${buildMealBlock(idx, week, "cena", "🍖 " + (appLang === "en" ? "Dinner" : "Cena"), day.cena, calState.meals.cena, true)}
    </div>
    <div class="ai-extras-box" id="ai-extras-${idx}" style="display:none"></div>
    <div class="workout-box">
      <strong>${appLang === "en" ? "Weekly focus" : "Foco semanal"}:</strong>
      <p class="small">${workout.focus}</p>
      <strong>${appLang === "en" ? "Today's training" : "Entrenamiento de hoy"}:</strong>
      <p class="small" id="workout-text-${idx}">${workout.today}</p>
      <button class="ia-btn small-btn" onclick="generateWorkoutAI(${idx}, ${week})">${appLang === "en" ? "Workout AI 🏋️" : "Entreno IA 🏋️"}</button>
      <div class="ai-workout-list" id="ai-workout-list-${idx}" style="display:none"></div>
      <button class="ia-btn ghost-btn small-btn" onclick="recalibrateWorkoutAI(${idx}, ${week})">
        ${appLang === "en" ? "Recalibrate 🛠" : "Recalibrar 🛠"}
      </button>
    </div>
    <div class="ai-review-box" id="ai-review-${idx}" style="display:none"></div>
    <div class="day-actions">
      <button class="done-btn ${done ? "done" : ""}" onclick="toggleDone(${idx}, ${week})">
        ${done ? (appLang === "en" ? "✔ Day completed" : "✔ Día completado") : (appLang === "en" ? "Mark day ✔" : "Marcar día ✔")}
      </button>
      <!--
      <button class="ia-btn" onclick="generateFullDayAI(${idx}, ${week})">
        ${appLang === "en" ? "Full day AI 📅" : "Día completo IA 📅"}
      </button>
      -->
      <button class="ia-btn ghost-btn" onclick="reviewDayWithAI(${idx}, ${week})">
        ${appLang === "en" ? "Analyze AI plan 💬" : "Analizar plan IA 💬"}
      </button>
    </div>
  `;
  menuDays.appendChild(card);

  const savedWorkout = localStorage.getItem(LS_AI_WORKOUT + idx);
  if (savedWorkout) {
    try {
      const parsed = JSON.parse(savedWorkout);
      renderWorkoutCardsFromArray(idx, parsed, appLang);
    } catch (e) {}
  }

  renderAIExtras(idx);

  animateCards();
  document.querySelectorAll(".day-pill").forEach((p, i) => {
    const base = (week - 1) * 7;
    p.classList.toggle("active", (i + base) === idx);
  });
}

function buildMealBlock(idx, week, key, title, mealObj, done, isDinner = false) {
  const qty = mealObj && mealObj.qty ? mealObj.qty : "";
  const name = mealObj && mealObj.nombre ? mealObj.nombre : "";
  const note = mealObj && mealObj.note ? mealObj.note : "";

  const canIA = (key === "desayuno" || key === "almuerzo" || key === "cena");

  return `
    <div class="meal ${done ? "meal-done" : ""}" ${isDinner ? 'id="cena-block"' : ""}>
      <div class="meal-title-row">
        <div class="meal-title-left">
          <span class="meal-title-text">${title}</span>
          <span class="meal-qty" ${isDinner ? 'id="cena-qty"' : ""}>${qty}</span>
        </div>
        <div class="meal-actions-right">
          ${canIA ? `<button class="ia-mini-btn" onclick="generateMealAI(${idx}, '${key}', ${week})">IA</button>` : ""}
          <button class="cal-btn" onclick="toggleMealCal(${idx}, '${key}', ${week})">${done ? "✓" : "+"}</button>
        </div>
      </div>
      <div class="meal-name" ${isDinner ? 'id="cena-text"' : ""}>${name}</div>
      ${note ? `<p class="meal-note">${note}</p>` : ""}
    </div>
  `;
}

// ====== TOGGLE DÍA COMPLETO ======
function toggleDone(idx, week) {
  const key = LS_PREFIX + "done-" + idx;
  const cur = localStorage.getItem(key) === "1";
  localStorage.setItem(key, cur ? "0" : "1");
  renderMenuDay(idx, week);
  updateProgressBar();
  showMotivation();
}
window.toggleDone = toggleDone;

// ====== ANALIZADOR RÁPIDO DE COMIDA IA ======
function analyzeAIMeal(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const notes = [];
  if (lower.includes("mantequilla") || lower.includes("crema") || lower.includes("queso") || lower.includes("cheese")) {
    notes.push(appLang === "en" ? "High in dairy, adjust if needed." : "Tiene lácteos, ajusta si quieres.");
  }
  if (lower.includes("frito") || lower.includes("manteca")) {
    notes.push(appLang === "en" ? "Looks heavy, reduce fat." : "Se ve pesado, baja un poco la grasa.");
  }
  if (lower.includes("papa") || lower.includes("arroz") || lower.includes("banana")) {
    notes.push(appLang === "en" ? "Not very keto, swap carb." : "No muy keto, cambia ese carbo.");
  }
  if (!notes.length) return null;
  return notes.join(" ");
}

// helper para parsear JSON devuelto por IA
function safeParseJSON(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// ====== IA: DESAYUNO / ALMUERZO / CENA ======
async function generateMealAI(idx, mealKey, week) {
  const like = localStorage.getItem(LS_LIKE) || "";
  const dislike = localStorage.getItem(LS_DISLIKE) || "";
  const lang = appLang;
  const apiUser = localStorage.getItem(LS_API_USER) || "";
  const apiPass = localStorage.getItem(LS_API_PASS) || "";

  const baseDay = derivedPlan[idx];
  const baseMeal = baseDay[mealKey] || {};
  const baseQty = baseMeal.qty || "";
  const mealPercent = mealPercents[mealKey] || 0;
  const mealKcal = mealPercent ? Math.round((baseDay.kcal || 1600) * mealPercent) : null;

  let existing = JSON.parse(localStorage.getItem(LS_AI_DAY_PREFIX + idx) || "{}");
  let hasMeal = !!existing[mealKey];

  const tip = localSmartTips[mealKey];
  const tipLower = tip ? tip.toLowerCase() : "";
  const userDislikeLower = dislike.toLowerCase();
  const tipConflicts =
    tipLower && userDislikeLower
      ? userDislikeLower.split(",").some(d => d.trim() && tipLower.includes(d.trim()))
      : false;

  if (tip && !hasMeal && !tipConflicts) {
    existing[mealKey] = {
      nombre: (baseMeal.nombre || mealKey.toUpperCase()) + " <span class=\"ia-tag\">IA</span>",
      qty: baseQty + (mealKcal ? ` • ~${mealKcal} kcal` : ""),
      note: tip
    };
    localStorage.setItem(LS_AI_DAY_PREFIX + idx, JSON.stringify(existing));
    renderMenuDay(idx, week);
    showToast(lang === "en" ? "Used local suggestion" : "Usando sugerencia local");
    return;
  }

  let mealNameES = "almuerzo";
  let mealNameEN = "lunch";
  if (mealKey === "desayuno") {
    mealNameES = "desayuno";
    mealNameEN = "breakfast";
  } else if (mealKey === "cena") {
    mealNameES = "cena";
    mealNameEN = "dinner";
  }

  const prompt =
    lang === "en"
      ? `Create 1 keto ${mealNameEN} keeping about ${mealKcal || 450} kcal. Prefer: ${like}. Avoid: ${dislike}. Respond ONLY as JSON with keys: "nombre" (short dish name), "ingredientes" (array of strings like "150 g chicken", "40 g broccoli", "1/2 avocado"), "descripcion" (very short sentence).`
      : `Genera 1 ${mealNameES} keto manteniendo cerca de ${mealKcal || 450} kcal. Prefiere: ${like}. Evita: ${dislike}. Responde SOLO en JSON con las claves: "nombre" (nombre corto del plato), "ingredientes" (array de strings tipo "150 g pollo", "40 g brócoli", "1/2 aguacate"), "descripcion" (frase muy corta).`;

  try {
    const res = await fetch(GROK_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        user: apiUser,
        pass: apiPass,
        mode: mealKey,
        lang
      })
    });

    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || (lang === "en" ? "AI did not respond" : "IA no respondió"));
      return;
    }

    let aiObj = null;

    if (data.structured) {
      aiObj = data.structured;
    } else if (data.text) {
      aiObj = safeParseJSON(data.text.trim());
      if (!aiObj && data.text.includes("{") && data.text.includes("}")) {
        const first = data.text.indexOf("{");
        const last = data.text.lastIndexOf("}");
        aiObj = safeParseJSON(data.text.slice(first, last + 1));
      }
    }

    let aiName = "";
    let aiIngredients = [];
    let aiDesc = "";

    if (aiObj) {
      aiName = aiObj.nombre || aiObj.name || "";
      aiIngredients = Array.isArray(aiObj.ingredientes) ? aiObj.ingredientes : (Array.isArray(aiObj.ingredients) ? aiObj.ingredients : []);
      aiDesc = aiObj.descripcion || aiObj.description || aiObj.desc || "";
    }

    if (!aiName && data.text) {
      let text = (data.text || "").replace(/\*\*/g, "").trim();
      if (text.includes("\n")) text = text.split("\n")[0].trim();
      aiName = text;
    }

    const dairyNote = analyzeAIMeal(aiName + " " + aiIngredients.join(", ") + " " + aiDesc);

    let lineIngredients = "";
    if (aiIngredients.length) {
      lineIngredients = aiIngredients.join(", ");
    } else if (baseQty) {
      lineIngredients = baseQty;
    }

    if (mealKcal) {
      lineIngredients = lineIngredients
        ? `${lineIngredients} • ~${mealKcal} kcal`
        : `~${mealKcal} kcal`;
    }

    const finalName =
      aiName
        ? `${aiName} <span class="ia-tag">IA ${mealNameES}</span>`
        : `${baseMeal.nombre || mealKey.toUpperCase()} <span class="ia-tag">IA ${mealNameES}</span>`;

    existing[mealKey] = {
      nombre: finalName,
      qty: lineIngredients,
      ...(dairyNote ? { note: dairyNote } : aiDesc ? { note: aiDesc } : {})
    };

    localStorage.setItem(LS_AI_DAY_PREFIX + idx, JSON.stringify(existing));
    renderMenuDay(idx, week);
    showToast(lang === "en" ? "AI meal updated" : "Comida IA actualizada");
  } catch (e) {
    console.error(e);
    showToast(appLang === "en" ? "Error calling AI" : "Error llamando a la IA");
  }
}
window.generateMealAI = generateMealAI;



// ====== IA: DÍA COMPLETO ======
async function generateFullDayAI(idx, week) {
  const name = localStorage.getItem(LS_NAME) || "";
  const like = localStorage.getItem(LS_LIKE) || "";
  const dislike = localStorage.getItem(LS_DISLIKE) || "";
  const lang = appLang;
  const apiUser = localStorage.getItem(LS_API_USER) || "";
  const apiPass = localStorage.getItem(LS_API_PASS) || "";
  const baseDay = derivedPlan[idx];

  const payload = {
    mode: "full-day",
    lang,
    user: apiUser,
    pass: apiPass,
    kcal: baseDay.kcal,
    prefs: { like, dislike },
    dayIndex: idx + 1,
    username: name
  };

  try {
    const res = await fetch(GROK_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || (lang === "en" ? "AI error" : "Error de IA"));
      return;
    }

    let structured = null;
    if (data.structured) {
      structured = data.structured;
    } else if (data.text) {
      try {
        structured = JSON.parse(data.text);
      } catch(e) {}
    }

    if (structured) {
      const normalized = {
        dia: baseDay.dia,
        kcal: structured.kcal || baseDay.kcal,
        macros: structured.macros || baseDay.macros,
        desayuno: structured.desayuno || baseDay.desayuno,
        snackAM: structured.snackAM || baseDay.snackAM,
        almuerzo: structured.almuerzo || baseDay.almuerzo,
        snackPM: structured.snackPM || baseDay.snackPM,
        cena: structured.cena || baseDay.cena
      };
      localStorage.setItem(LS_AI_DAY_PREFIX + idx, JSON.stringify(normalized));
      renderMenuDay(idx, week);
      showToast(lang === "en" ? "Full AI day applied" : "Día IA aplicado");
    } else {
      showToast(lang === "en" ? "AI answered but was not structured" : "La IA respondió pero no en formato estructurado");
    }
  } catch (e) {
    console.error(e);
    showToast(lang === "en" ? "Error calling AI" : "Error llamando a la IA");
  }
}
window.generateFullDayAI = generateFullDayAI;

// ====== IA: REVISAR DÍA (card bonita) ======
async function reviewDayWithAI(idx, week) {
  const lang = appLang;
  const apiUser = localStorage.getItem(LS_API_USER) || "";
  const apiPass = localStorage.getItem(LS_API_PASS) || "";
  const day = getDayWithAI(idx);

  const prompt =
    lang === "en"
      ? `You are reviewing a keto day. User has: breakfast "${day.desayuno?.nombre}", lunch "${day.almuerzo?.nombre}", dinner "${day.cena?.nombre}". Calories target: ${day.kcal}. Tell in 3 bullet points: (1) is it too fatty?, (2) is protein ok?, (3) 1 small tip. Keep it short.`
      : `Estás revisando un día keto. El usuario tiene: desayuno "${day.desayuno?.nombre}", almuerzo "${day.almuerzo?.nombre}", cena "${day.cena?.nombre}". Meta calórica: ${day.kcal}. Responde en 3 bullets: (1) si está muy graso, (2) si la proteína está ok, (3) 1 tip corto.`;

  try {
    const res = await fetch(GROK_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "review-day", user: apiUser, pass: apiPass, lang, prompt })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || (lang === "en" ? "AI did not respond" : "IA no respondió"));
      return;
    }

    const reviewBox = document.getElementById("ai-review-" + idx);
    if (reviewBox) {
      const raw = (data.text || "").replace(/\*/g, "").trim();
      let parts = raw.split(/\n| - |\u2022/g).map(t => t.trim()).filter(Boolean);
      parts = parts.slice(0, 3);
      if (!parts.length) {
        parts = [raw];
      }

      reviewBox.innerHTML = `
        <div class="ai-review-title">${lang === "en" ? "AI review of your day" : "Revisión IA de tu día"}</div>
        <div class="ai-review-list">
          ${parts
            .map((txt, i) => {
              const labelsES = ["Grasa", "Proteína", "Tip"];
              const labelsEN = ["Fat", "Protein", "Tip"];
              const label = lang === "en" ? labelsEN[i] || "Note" : labelsES[i] || "Nota";
              const icons = ["🥑","🍗","💬"];
              const icon = icons[i] || "•";
              return `
                <div class="ai-review-item">
                  <div class="ai-review-icon">${icon}</div>
                  <div class="ai-review-content">
                    <h5>${label}</h5>
                    <p>${txt}</p>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
      reviewBox.style.display = "block";
    }

    showToast(lang === "en" ? "Day reviewed" : "Día revisado");
  } catch (e) {
    console.error(e);
    showToast(appLang === "en" ? "Error calling AI" : "Error llamando a la IA");
  }
}
window.reviewDayWithAI = reviewDayWithAI;

// ====== WORKOUT IA ======
function extractJSONSnippet(raw) {
  if (!raw) return null;
  const fence = raw.match(/```(?:json)?([\s\S]*?)```/i);
  if (fence && fence[1]) {
    return fence[1].trim();
  }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return null;
}

function normalizeWorkoutArray(arr, lang) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(it => {
      return {
        nombre: it.nombre || it.name || "",
        series: it.series || it.reps || (lang === "en" ? "3 sets" : "3 series"),
        descripcion: it.descripcion || it.desc || ""
      };
    })
    .filter(it => it.nombre)
    .slice(0, 6);
}

function parseWorkoutTextToClean(raw, lang) {
  const lines = (raw || "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !/aquí tienes|here is/i.test(l))
    .filter(l => !/^```/.test(l));

  return lines.map((l) => ({
    nombre: l.replace(/^\d+[\).\-\s]*/, "").replace(/^\-\s*/, "").replace(/^\{\s*"?/, "").replace(/"?\}\s*$/, ""),
    series: lang === "en" ? "3 sets" : "3 series",
    descripcion: ""
  })).slice(0, 6);
}

function renderWorkoutCardsFromArray(idx, workouts, lang) {
  const box = document.getElementById("ai-workout-list-" + idx);
  if (!box) return;
  if (!Array.isArray(workouts) || workouts.length === 0) {
    box.style.display = "none";
    return;
  }
  box.innerHTML =
    `<p class="small"><strong>${lang === "en" ? "AI workout" : "Entreno IA"}:</strong></p>` +
    `<div class="ai-workout-grid">` +
    workouts
      .map(w => {
        const n = w.nombre || "";
        const s = w.series || "";
        const d = w.descripcion || "";
        return `
          <div class="ai-workout-item">
            <div class="ai-w-name">${n}</div>
            <div class="ai-w-series">${s}</div>
            <div class="ai-w-desc">${d}</div>
          </div>
        `;
      })
      .join("") +
    `</div>`;
  box.style.display = "block";
}

async function generateWorkoutAI(idx, week) {
  const apiUser = localStorage.getItem(LS_API_USER) || "";
  const apiPass = localStorage.getItem(LS_API_PASS) || "";
  const lang = appLang;
  const height = localStorage.getItem(LS_HEIGHT) || "";
  const weight = localStorage.getItem(LS_START_WEIGHT) || "";
  const age = localStorage.getItem(LS_AGE) || "";
  const dayNumber = idx + 1;
  const weekNumber = Math.floor(idx / 7) + 1;

  const intensity = localStorage.getItem(LS_WORKOUT_INTENSITY) || "medium";

  const intensityMap = {
    soft: lang === "en"
      ? "light 20–25 min, mobility, stretching, low impact, bodyweight only, no equipment"
      : "suave 20–25 min, movilidad, estiramientos, bajo impacto, solo peso corporal, sin equipos",
    medium: lang === "en"
      ? "moderate 30–35 min, functional spartan style, bodyweight only, no equipment"
      : "moderado 30–35 min, estilo funcional tipo Sparta, solo peso corporal, sin equipos",
    hard: lang === "en"
      ? "hard 45–50 min, spartan style, high intensity, bodyweight only, no equipment"
      : "intenso 45–50 min, estilo Sparta, alta intensidad, solo peso corporal, sin equipos"
  };

  const prev1 = idx > 0 ? localStorage.getItem(LS_AI_WORKOUT + (idx - 1)) : null;
  const prev2 = idx > 1 ? localStorage.getItem(LS_AI_WORKOUT + (idx - 2)) : null;
  const avoidList = [];

  [prev1, prev2].forEach(p => {
    if (p) {
      try {
        JSON.parse(p).forEach(e => e.nombre && avoidList.push(e.nombre));
      } catch (e) {}
    }
  });

  const prompt =
    lang === "en"
      ? `Return a JSON with field "ejercicios" for day ${dayNumber} (week ${weekNumber}) of a ${intensityMap[intensity]}. This must be a bodyweight-only workout, no equipment, no dumbbells, no bands, no machines, no pull-up bar. Use functional or spartan style moves (squats, lunges, pushups, burpees, mountain climbers, core). User data: height ${height} cm, weight ${weight} kg, age ${age}. Avoid repeating these exercises: ${avoidList.join(", ")}. Each item: {"nombre": short name, "series": "3 x 12" or time, "descripcion": very short tip}. English.`
      : `Devuelve un JSON con campo "ejercicios" para el día ${dayNumber} (semana ${weekNumber}) de un entreno ${intensityMap[intensity]}. Debe ser SOLO con peso corporal, sin equipos, sin mancuernas, sin bandas, sin máquinas, sin barra de dominadas. Usa movimientos funcionales o estilo Sparta (sentadillas, zancadas, flexiones, burpees, escaladores, core). Datos usuario: estatura ${height} cm, peso ${weight} kg, edad ${age}. Evita repetir estos ejercicios: ${avoidList.join(", ")}. Cada ítem: {"nombre": nombre corto, "series": "3 x 12" o tiempo, "descripcion": tip muy corto}. Español.`;

  try {
    const res = await fetch(GROK_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "workout-day", user: apiUser, pass: apiPass, lang, prompt })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || (lang === "en" ? "AI did not respond" : "IA no respondió"));
      return;
    }

    let workouts = [];

    if (data.structured && Array.isArray(data.structured.ejercicios)) {
      workouts = normalizeWorkoutArray(data.structured.ejercicios, lang);
    } else {
      const rawText = data.text || "";
      const snippet = extractJSONSnippet(rawText);
      if (snippet) {
        try {
          const parsed = JSON.parse(snippet);
          if (parsed && Array.isArray(parsed.ejercicios)) {
            workouts = normalizeWorkoutArray(parsed.ejercicios, lang);
          }
        } catch (e) {}
      }
      if (!workouts.length) {
        workouts = parseWorkoutTextToClean(rawText, lang);
      }
    }

    localStorage.setItem(LS_AI_WORKOUT + idx, JSON.stringify(workouts));
    renderWorkoutCardsFromArray(idx, workouts, lang);

    showToast(lang === "en" ? "Workout generated" : "Entreno generado");
  } catch (e) {
    console.error(e);
    showToast(appLang === "en" ? "Error calling AI" : "Error llamando a la IA");
  }
}
window.generateWorkoutAI = generateWorkoutAI;

// ====== IA: RECALIBRAR ENTRENAMIENTO ======
async function recalibrateWorkoutAI(idx, week) {
  const lang = appLang;
  const apiUser = localStorage.getItem(LS_API_USER) || "";
  const apiPass = localStorage.getItem(LS_API_PASS) || "";

  const currentWorkoutRaw = localStorage.getItem(LS_AI_WORKOUT + idx);
  const currentWorkout = currentWorkoutRaw ? JSON.parse(currentWorkoutRaw) : [];

  const prog = JSON.parse(localStorage.getItem(LS_PROGRESS_PREFIX + idx) || "{}");
  const didExerciseKcal = prog.exkcal ? Number(prog.exkcal) : 0;
  const dayDone = localStorage.getItem(LS_PREFIX + "done-" + idx) === "1";

  const dayNumber = idx + 1;
  const weekNumber = Math.floor(idx / 7) + 1;

  let intent = "keep";
  if (!dayDone || didExerciseKcal === 0) intent = "lighter";
  if (didExerciseKcal > 250) intent = "harder";

  const prompt = lang === "en"
    ? `You will receive a bodyweight workout (no equipment). The user ${dayDone ? "completed the day" : "did not complete the day"} and logged ${didExerciseKcal} kcal of exercise. Recalibrate it to be ${intent === "lighter" ? "lighter and shorter (15-20 min)" : intent === "harder" ? "harder (30-40 min)" : "similar"} for day ${dayNumber}, week ${weekNumber}. Return JSON with "ejercicios": [{"nombre":..,"series":..,"descripcion":..}] and keep it functional/spartan style. Here is the current workout: ${JSON.stringify(currentWorkout)}`
    : `Vas a recibir un entreno con peso corporal (sin equipos). El usuario ${dayDone ? "sí completó el día" : "no completó el día"} y registró ${didExerciseKcal} kcal de ejercicio. Recalíbralo para que sea ${intent === "lighter" ? "más suave y corto (15-20 min)" : intent === "harder" ? "más intenso (30-40 min)" : "similar"} para el día ${dayNumber}, semana ${weekNumber}. Devuelve JSON con "ejercicios": [{"nombre":..,"series":..,"descripcion":..}] y estilo funcional/Sparta. Este es el entreno actual: ${JSON.stringify(currentWorkout)}`;

  try {
    const res = await fetch(GROK_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "workout-recalib",
        user: apiUser,
        pass: apiPass,
        lang,
        prompt
      })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || (lang === "en" ? "AI did not respond" : "IA no respondió"));
      return;
    }

    let workouts = [];

    if (data.structured && Array.isArray(data.structured.ejercicios)) {
      workouts = normalizeWorkoutArray(data.structured.ejercicios, lang);
    } else {
      const rawText = data.text || "";
      const snippet = extractJSONSnippet(rawText);
      if (snippet) {
        try {
          const parsed = JSON.parse(snippet);
          if (parsed && Array.isArray(parsed.ejercicios)) {
            workouts = normalizeWorkoutArray(parsed.ejercicios, lang);
          }
        } catch (e) {}
      }
      if (!workouts.length) {
        workouts = parseWorkoutTextToClean(rawText, lang);
      }
    }

    localStorage.setItem(LS_AI_WORKOUT + idx, JSON.stringify(workouts));
    renderWorkoutCardsFromArray(idx, workouts, lang);
    showToast(lang === "en" ? "Workout recalibrated" : "Entreno recalibrado");
  } catch (err) {
    console.error(err);
    showToast(appLang === "en" ? "Error calling AI" : "Error llamando a la IA");
  }
}
window.recalibrateWorkoutAI = recalibrateWorkoutAI;


// ====== GENERAR SEMANA COMPLETA CON IA ======
async function generateWeekWithAI(week) {
  // si no viene la semana desde el botón, uso la que el usuario tiene seleccionada
  const selWeek = typeof week === "number"
    ? week
    : Number(localStorage.getItem(LS_SELECTED_WEEK)) || 1;

  const start = (selWeek - 1) * 7;
  const end = Math.min(selWeek * 7, derivedPlan.length);

  for (let i = start; i < end; i++) {
    // generamos el día completo con IA
    // importante pasar la semana correcta
    await generateFullDayAI(i, selWeek);
  }

  showToast(appLang === "en" ? "Week generated with AI" : "Semana generada con IA");
}
window.generateWeekWithAI = generateWeekWithAI;
// 👇 estos dos son los que te faltaban
window.generateWeekAI = generateWeekWithAI;
window.generateWeekIa = generateWeekWithAI;

// ====== GENERAR ENTRENOS IA DE LA SEMANA ======
async function generateWorkoutWeekAI() {
  const selWeek = Number(localStorage.getItem(LS_SELECTED_WEEK)) || 1;
  const start = (selWeek - 1) * 7;
  const end = Math.min(selWeek * 7, derivedPlan.length);
  for (let i = start; i < end; i++) {
    await generateWorkoutAI(i, selWeek);
  }
  showToast(appLang === "en" ? "AI workouts for the week generated" : "Entrenos IA de la semana listos");
}
window.generateWorkoutWeekAI = generateWorkoutWeekAI;


// ====== RENDERIZAR REVISIÓN SEMANAL GUARDADA ======
function renderStoredWeekReview(week) {
  const box = document.getElementById("aiWeekSummary");
  if (!box) return;
  const saved = localStorage.getItem(LS_AI_WEEK_PREFIX + week);
  if (saved) {
    box.innerHTML = saved;
    box.style.display = "block";
    // 👇 agrega esto
    attachWeekSummaryToggle();
  } else {
    box.innerHTML = "";
    box.style.display = "none";
  }
}

// 
function attachWeekSummaryToggle() {
  const box = document.getElementById("aiWeekSummary");
  if (!box) return;
  const title = box.querySelector(".ai-week-title");
  const body = box.querySelector(".ai-week-body");
  if (!title || !body) return;

  // para que se vea clickeable
  title.style.cursor = "pointer";

  title.onclick = () => {
    const hidden = body.style.display === "none";
    body.style.display = hidden ? "block" : "none";
    // si quieres cambiar el texto del título
    if (hidden) {
      title.textContent = (appLang === "en" ? "AI weekly review" : "Revisión IA de la semana");
    } else {
      title.textContent = (appLang === "en" ? "AI weekly review (mostrar)" : "Revisión IA de la semana (mostrar)");
    }
  };
}


// ====== IA: REVISIÓN SEMANAL (NUEVO) ======
async function reviewWeekWithAI() {
  const lang = appLang;
  const apiUser = localStorage.getItem(LS_API_USER) || "";
  const apiPass = localStorage.getItem(LS_API_PASS) || "";
  const selWeek = Number(localStorage.getItem(LS_SELECTED_WEEK)) || 1;

  const startIdx = (selWeek - 1) * 7;
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const idx = startIdx + i;
    const d = getDayWithAI(idx);
    if (!d) continue;
    weekDays.push({
      name: d.dia || (lang === "en" ? `Day ${idx + 1}` : `Día ${idx + 1}`),
      kcal: d.kcal || 0,
      breakfast: d.desayuno ? d.desayuno.nombre : "",
      lunch: d.almuerzo ? d.almuerzo.nombre : "",
      dinner: d.cena ? d.cena.nombre : ""
    });
  }

  const prompt =
    lang === "en"
      ? `You will receive a 7-day keto plan. Analyze consistency, days that deviated, and 1 recommendation for next week. Return exactly 3 short sections: 1) Consistency, 2) Deviations, 3) Recommendation. Here is the week: ${JSON.stringify(
          weekDays
        )}`
      : `Vas a recibir un plan keto de 7 días. Analiza: 1) qué tan consistente fue, 2) qué días se desviaron, 3) una recomendación para la siguiente semana. Devuélvelo en 3 secciones cortas con título. Semana: ${JSON.stringify(
          weekDays
        )}`;

  try {
    const res = await fetch(GROK_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "review-week",
        user: apiUser,
        pass: apiPass,
        lang,
        prompt
      })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || (lang === "en" ? "AI did not respond" : "IA no respondió"));
      return;
    }

    const box = document.getElementById("aiWeekSummary");
    if (box) {
      const clean = (data.text || "").replace(/\*/g, "").replace(/###\s*/g, "").trim();
      const parts = clean.split(/\n+/).filter(Boolean).slice(0, 4);

      const html = `
        <div class="ai-week-title">${lang === "en" ? "AI weekly review" : "Revisión IA de la semana"}</div>
        <div class="ai-week-body">
          ${parts
            .map((t) => `<div class="ai-week-item">${t}</div>`)
            .join("")}
        </div>
      `;

      box.innerHTML = html;
      box.style.display = "block";
      // 👇 agrega esto aquí
      attachWeekSummaryToggle();
      localStorage.setItem(LS_AI_WEEK_PREFIX + selWeek, html);
    }

    showToast(lang === "en" ? "Week reviewed" : "Semana revisada");
  } catch (err) {
    console.error(err);
    showToast(lang === "en" ? "Error calling AI" : "Error llamando a la IA");
  }
}

window.reviewWeekWithAI = reviewWeekWithAI;

// ====== IA: MOTIVACIÓN DEL DÍA (NUEVO) ======
async function motivateDayWithAI() {
  const lang = appLang;
  const apiUser = localStorage.getItem(LS_API_USER) || "";
  const apiPass = localStorage.getItem(LS_API_PASS) || "";
  const selDay = Number(localStorage.getItem(LS_SELECTED_DAY)) || 0;
  const d = getDayWithAI(selDay);
  const name = localStorage.getItem(LS_NAME) || "";
  const water = getWaterState(selDay);
  const dayDone = localStorage.getItem(LS_PREFIX + "done-" + selDay) === "1";

  const selWeek = Number(localStorage.getItem(LS_SELECTED_WEEK)) || (Math.floor(selDay / 7) + 1);
  const weekReview = localStorage.getItem(LS_AI_WEEK_PREFIX + selWeek) || "";

  const prompt =
    lang === "en"
      ? `You are a short, energetic coach. User name: "${name}". Today is ${d.dia}. Today's main meal: "${d.almuerzo?.nombre || d.cena?.nombre || "keto meal"}". Water today: ${water.ml}/${water.goal} ml. Day completed: ${dayDone}. Last week review (optional): ${weekReview}. Write 1 message in second person, max 40 words, that praises what is done (water or day) and pushes to stay on the keto plan. Mention name ONLY if not empty.`
      : `Eres un coach corto y energético. Nombre: "${name}". Hoy es ${d.dia}. Comida principal de hoy: "${d.almuerzo?.nombre || d.cena?.nombre || "comida keto"}". Agua hoy: ${water.ml}/${water.goal} ml. Día completado: ${dayDone}. Revisión semana pasada (opcional): ${weekReview}. Escribe 1 mensaje en segunda persona, máximo 40 palabras, que celebre lo hecho (agua o día) y empuje a seguir el plan keto. Menciona el nombre SOLO si no está vacío.`;

  try {
    const res = await fetch(GROK_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "motivation-coach",
        user: apiUser,
        pass: apiPass,
        lang,
        prompt
      })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || (lang === "en" ? "AI did not respond" : "IA no respondió"));
      return;
    }
    const motBox = document.getElementById("motivation");
    if (motBox) {
      motBox.textContent = (data.text || "").replace(/\*/g, "").trim();
      motBox.style.display = "block";
    }
    showToast(lang === "en" ? "Motivation ready" : "Motivación lista");
  } catch (err) {
    console.error(err);
    showToast(lang === "en" ? "Error calling AI" : "Error llamando a la IA");
  }
}
window.motivateDayWithAI = motivateDayWithAI;

// ====== COMPRAS ======
function renderCompras() {
  const container = document.getElementById("compras");
  container.innerHTML = "";

  const selWeek = Number(localStorage.getItem(LS_SELECTED_WEEK)) || 1;

  const done = getCompletedCount();
  const dash = document.createElement("div");
  dash.className = "list-row";
  dash.innerHTML = `
    <strong>${appLang === "en" ? "Quick summary" : "Resumen rápido"}</strong>
    <div class="small">
      ${appLang === "en"
        ? `Completed days: ${done} of ${derivedPlan.length}`
        : `Días completados: ${done} de ${derivedPlan.length}`}
    </div>
    <div class="small" style="margin-top:6px;">
      ${appLang === "en"
        ? `Week shown: ${selWeek}`
        : `Semana mostrada: ${selWeek}`}
    </div>
  `;
  container.appendChild(dash);

  const aiRow = document.createElement("div");
  aiRow.className = "list-row";
  aiRow.innerHTML = `
    <strong>${appLang === "en" ? "AI actions" : "Acciones IA"}</strong>
    <p class="small" style="margin-bottom:6px;">
      ${appLang === "en"
        ? "Generate a shopping list using your AI meals and base plan."
        : "Genera una lista de compras usando tus comidas IA y el plan base."}
    </p>
    <button class="save-btn" onclick="improveShoppingWithAI(${selWeek})">
      ${appLang === "en" ? "Generate AI shopping 🛒" : "Generar lista IA 🛒"}
    </button>
  `;
  container.appendChild(aiRow);

  const list = appLang === "en"
    ? [
        { cat: "Proteins", items: "Eggs, chicken, salmon, shrimp, beef, greek yogurt" },
        { cat: "Veggies", items: "Broccoli, cauliflower, cherry tomato, rocket, avocado, mushrooms" },
        { cat: "Healthy fats", items: "Butter, olive oil, heavy cream, feta cheese" },
        { cat: "Snacks", items: "Cashews, nuts, chia, shredded coconut" },
        { cat: "Others", items: "Sugar-free coffee, pink salt, lemon" }
      ]
    : [
        { cat: "Proteínas", items: "Huevos, pollo, salmón, camarones, carne de res, yogur griego" },
        { cat: "Verduras", items: "Brócoli, coliflor, tomate cherry, rúcula/rocket, aguacate, champiñón" },
        { cat: "Grasas buenas", items: "Mantequilla, aceite de oliva, crema de leche, queso feta" },
        { cat: "Snacks", items: "Marañones, nueces, chía, coco rallado" },
        { cat: "Otros", items: "Café sin azúcar, sal rosada, limón" }
      ];

  list.forEach(it => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `<strong>${it.cat}</strong><div class="small">${it.items}</div>`;
    container.appendChild(row);
  });

  const storedShop = localStorage.getItem(LS_AI_SHOPPING + selWeek);
  if (storedShop) {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <strong>${appLang === "en" ? "Saved AI list" : "Lista IA guardada"}</strong>
      <pre class="small" style="white-space:pre-wrap">${storedShop}</pre>
    `;
    container.appendChild(row);
  }

  const aiExtras = [];
  for (let idx = 0; idx < derivedPlan.length; idx++) {
    const aiDay = localStorage.getItem(LS_AI_DAY_PREFIX + idx);
    if (aiDay) {
      try {
        const parsed = JSON.parse(aiDay);
        ["desayuno", "snackAM", "almuerzo", "snackPM", "cena"].forEach(m => {
          if (parsed[m] && parsed[m].qty) {
            const ing = extractIngredientsFromQty(parsed[m].qty);
            ing.forEach(x => aiExtras.push(x));
          }
        });
      } catch (e) {}
    }
  }
  if (aiExtras.length) {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <strong>${appLang === "en" ? "AI extras" : "Extras IA"}</strong>
      <div class="small ai-extras-inline">${aiExtras.join(" • ")}</div>
    `;
    container.appendChild(row);
  }

  animateCards();
}

// ====== IA: MEJORAR LISTA DE COMPRAS ======
async function improveShoppingWithAI() {
  const lang = appLang;
  const apiUser = localStorage.getItem(LS_API_USER) || "";
  const apiPass = localStorage.getItem(LS_API_PASS) || "";

  const selWeek = Number(localStorage.getItem(LS_SELECTED_WEEK)) || 1;
  const startIdx = (selWeek - 1) * 7;
  const endIdx = Math.min(selWeek * 7, derivedPlan.length);

  const weekDays = [];
  for (let i = startIdx; i < endIdx; i++) {
    const d = getDayWithAI(i);
    weekDays.push({
      name: d.dia,
      breakfast: d.desayuno ? d.desayuno.qty || d.desayuno.nombre || "" : "",
      snackAM: d.snackAM ? d.snackAM.qty || d.snackAM.nombre || "" : "",
      lunch: d.almuerzo ? d.almuerzo.qty || d.almuerzo.nombre || "" : "",
      snackPM: d.snackPM ? d.snackPM.qty || d.snackPM.nombre || "" : "",
      dinner: d.cena ? d.cena.qty || d.cena.nombre || "" : ""
    });
  }

  const prompt = lang === "en"
    ? `You will receive 7 keto days with ingredients and quantities. Condense all ingredients into 1 clean shopping list in English, grouped by sections (Protein, Veggies, Dairy/Fats, Pantry/Other). Merge similar items (e.g. "chicken", "chicken breast") and sum quantities approximately. Keep it short. Here is the week: ${JSON.stringify(weekDays)}`
    : `Recibirás 7 días keto con ingredientes y cantidades. Condénsalos en 1 sola lista de compras en español, agrupada por secciones (Proteínas, Verduras, Lácteos/Grasas, Despensa/Otros). Une ítems parecidos (ej. "pollo", "pechuga de pollo") y suma cantidades de forma aproximada. Sé breve. Semana: ${JSON.stringify(weekDays)}`;

  try {
    const res = await fetch(GROK_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "shopping-week",
        user: apiUser,
        pass: apiPass,
        lang,
        prompt
      })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || (lang === "en" ? "AI did not respond" : "IA no respondió"));
      return;
    }

    const container = document.getElementById("compras");
    const aiBoxId = "ai-shopping-box";
    let box = document.getElementById(aiBoxId);
    if (!box) {
      box = document.createElement("div");
      box.id = aiBoxId;
      box.className = "list-row";
      container.appendChild(box);
    }
    const clean = (data.text || "").replace(/\*/g, "").trim();
    box.innerHTML = `
      <strong>${lang === "en" ? "AI shopping list (week " : "Lista IA semana "}${selWeek}):</strong>
      <pre class="small" style="white-space:pre-wrap">${clean}</pre>
    `;
    box.scrollIntoView({behavior:"smooth"});

    localStorage.setItem(LS_AI_SHOPPING + selWeek, clean);

    showToast(lang === "en" ? "AI list ready" : "Lista IA lista");
  } catch (err) {
    console.error(err);
    showToast(appLang === "en" ? "Error calling AI" : "Error llamando a la IA");
  }
}
window.improveShoppingWithAI = improveShoppingWithAI;


// ====== BODY FAT & BMR ======
function estimateBodyFat(heightCm, weightKg, age, gender = "male") {
  if (!heightCm || !weightKg || !age) return null;
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  const a = Number(age);
  if (!h || !w || !a) return null;

  const bmi = w / (h * h);
  const sex = gender === "female" ? 0 : 1;
  let bf = 1.2 * bmi + 0.23 * a - 10.8 * sex - 5.4;

  if (bf < 6) bf = 6;
  if (bf > 50) bf = 50;

  return bf.toFixed(1);
}

function estimateBMR(heightCm, weightKg, age, isMale = true) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  const a = Number(age);
  if (!h || !w || !a) return null;
  const base = 10 * w + 6.25 * h - 5 * a + (isMale ? 5 : -161);
  return Math.round(base);
}

// ====== GAMIFICACIÓN / LOGROS ======
function computeHydrationStats() {
  let daysWithWater = 0;
  let totalMl = 0;
  let totalGoal = 0;
  for (let i = 0; i < derivedPlan.length; i++) {
    const ws = getWaterState(i);
    totalMl += ws.ml;
    totalGoal += ws.goal;
    if (ws.ml >= ws.goal * 0.8) {
      daysWithWater++;
    }
  }
  return {
    daysWithWater,
    totalMl,
    totalGoal
  };
}
function getStreak() {
  let streak = 0;
  for (let i = 0; i < derivedPlan.length; i++) {
    const done = localStorage.getItem(LS_PREFIX + "done-" + i) === "1";
    if (done) streak++;
    else break;
  }
  return streak;
}
function getAchievements() {
  const ach = [];
  const done = getCompletedCount();
  const streak = getStreak();
  const hydra = computeHydrationStats();

  if (done >= 1) ach.push({id:"first-day", label: "🔥 Primer día completado"});
  if (done >= 7) ach.push({id:"week-complete", label: "✅ 7 días dentro del plan"});
  if (streak >= 3) ach.push({id:"streak-3", label: "📆 3 días seguidos"});
  if (hydra.daysWithWater >= 3) ach.push({id:"water-3", label: "💧 3 días hidratado"});
  if (hydra.daysWithWater >= 7) ach.push({id:"water-7", label: "💧 Pro de hidratación (7/7)"});

  return ach;
}

// ====== PROGRESO ======
function renderProgreso() {
  const container = document.getElementById("progreso");
  container.innerHTML = "";

  const heightSaved = localStorage.getItem(LS_HEIGHT) || "";
  const startWeightSaved = localStorage.getItem(LS_START_WEIGHT) || "";
  const ageSaved = localStorage.getItem(LS_AGE) || "";

  const hasBase = heightSaved && startWeightSaved;

  const baseBox = document.createElement("div");
  baseBox.className = "list-row";
  baseBox.innerHTML = `
    <strong>${appLang === "en" ? "Base data" : "Datos base"}</strong>
    <div id="base-form" style="${hasBase ? "display:none" : ""}">
      <p class="small">${appLang === "en" ? "Enter your height, initial weight and age to estimate body fat and BMR." : "Pon tu estatura, tu peso inicial y edad para calcular % de grasa y TMB estimada."}</p>
      <input type="number" id="heightCm" placeholder="${appLang === "en" ? "Height (cm)" : "Estatura (cm)"}" value="${heightSaved}">
      <input type="number" id="startWeight" placeholder="${appLang === "en" ? "Initial weight (kg)" : "Peso inicial (kg)"}" value="${startWeightSaved}">
      <input type="number" id="ageYears" placeholder="${appLang === "en" ? "Age (years)" : "Edad (años)"}" value="${ageSaved}">
      <button class="save-btn" onclick="saveBaseProgress()">${appLang === "en" ? "Save base data" : "Guardar datos base"}</button>
    </div>
    <div id="base-view" style="${hasBase ? "" : "display:none"}">
      <p class="small">${appLang === "en" ? "Saved info:" : "Información guardada:"}</p>
      <div class="base-inline">
        <span id="base-h">${appLang === "en" ? "Height" : "Estatura"}: ${heightSaved} cm</span>
        <span id="base-w">${appLang === "en" ? "Start weight" : "Peso inicial"}: ${startWeightSaved} kg</span>
        ${ageSaved ? `<span id="base-a">${appLang === "en" ? "Age" : "Edad"}: ${ageSaved}</span>` : ""}
      </div>
      <p class="small" id="bfInfo"></p>
      <p class="small" id="bmrInfo"></p>
      <button class="save-btn ghost" onclick="editBaseProgress()">${appLang === "en" ? "Edit" : "Editar"}</button>
    </div>
  `;
  container.appendChild(baseBox);

  const achBox = document.createElement("div");
  achBox.className = "list-row";
  const ach = getAchievements();
  achBox.innerHTML = `
    <strong>${appLang === "en" ? "Achievements" : "Logros"}</strong>
    ${ach.length ? `<ul class="ach-list">${ach.map(a => `<li>${a.label}</li>`).join("")}</ul>` : `<p class="small">${appLang === "en" ? "Complete days, drink water and train to unlock badges." : "Completa días, toma agua y entrena para desbloquear insignias."}</p>`}
  `;
  container.appendChild(achBox);

  const hydra = computeHydrationStats();
  const waterBox = document.createElement("div");
  waterBox.className = "list-row";
  waterBox.innerHTML = `
    <strong>${appLang === "en" ? "Hydration" : "Hidratación"}</strong>
    <p class="small">
      ${appLang === "en" ? "Days with water goal reached: " : "Días con meta de agua: "}
      ${hydra.daysWithWater} / ${derivedPlan.length}
    </p>
    <p class="small">
      ${appLang === "en" ? "Total water logged: " : "Agua registrada: "}
      ${hydra.totalMl} ml
    </p>
  `;
  container.appendChild(waterBox);

  const shareBox = document.createElement("div");
  shareBox.className = "list-row";
  shareBox.innerHTML = `
    <strong>${appLang === "en" ? "Share results" : "Compartir resultados"}</strong>
    <p class="small">${appLang === "en" ? "Create a summary to share." : "Genera un resumen para enviar por WhatsApp o correo."}</p>
    <button class="save-btn" onclick="shareProgress()">${appLang === "en" ? "Share progress" : "Compartir progreso"}</button>
  `;
  container.appendChild(shareBox);

  const canvasWrap = document.createElement("div");
  canvasWrap.style.height = "210px";
  canvasWrap.style.position = "relative";
  const canvas = document.createElement("canvas");
  canvas.id = "weightChart";
  canvas.style.maxWidth = "100%";
  canvasWrap.appendChild(canvas);
  container.appendChild(canvasWrap);

  const canvasWrap2 = document.createElement("div");
  canvasWrap2.style.height = "210px";
  canvasWrap2.style.position = "relative";
  const canvas2 = document.createElement("canvas");
  canvas2.id = "exerciseChart";
  canvas2.style.maxWidth = "100%";
  canvasWrap2.appendChild(canvas2);
  container.appendChild(canvasWrap2);

  const note = document.createElement("div");
  note.className = "list-row";
  note.textContent = appLang === "en" ? "Stored in this browser." : "Se guarda en este navegador.";
  container.appendChild(note);

  derivedPlan.forEach((d, idx) => {
    const saved = JSON.parse(localStorage.getItem(LS_PROGRESS_PREFIX + idx) || "{}");
    const hasData = saved.peso || saved.cintura || saved.energia || saved.notas || saved.exkcal;
    const card = document.createElement("div");
    card.className = "day-card prog-card";
    card.id = `day-${idx}`;

    card.innerHTML = `
      <div class="day-title">
        <h2>${d.dia}</h2>
        <button class="save-btn ghost small-prog-btn" onclick="editarProgreso(${idx})">
          ${hasData ? (appLang === "en" ? "Edit" : "Editar") : (appLang === "en" ? "Add" : "Agregar")}
        </button>
      </div>

      <div class="prog-collapsed" id="prog-collapsed-${idx}">
        ${
          hasData
            ? `<p class="small">${saved.peso ? (appLang === "en" ? `Weight: ${saved.peso} kg` : `Peso: ${saved.peso} kg`) : (appLang === "en" ? "Saved data" : "Datos guardados")}</p>`
            : `<p class="small">${appLang === "en" ? "No data yet" : "Sin datos aún"}</p>`
        }
      </div>

      <div class="prog-form" id="prog-form-${idx}" style="display:none">
        <input type="number" placeholder="${appLang === "en" ? "Weight (kg)" : "Peso (kg)"}" id="peso-${idx}" value="${saved.peso || ""}">
        <input type="number" placeholder="${appLang === "en" ? "Waist (cm)" : "Cintura (cm)"}" id="cintura-${idx}" value="${saved.cintura || ""}">
        <input type="number" placeholder="${appLang === "en" ? "Energy (1-10)" : "Energía (1-10)"}" id="energia-${idx}" value="${saved.energia || ""}">
        <input type="number" placeholder="${appLang === "en" ? "Exercise kcal" : "Calorías ejercicio (kcal)"}" id="exkcal-${idx}" value="${saved.exkcal || ""}">
        <textarea placeholder="${appLang === "en" ? "Notes" : "Notas"}" id="nota-${idx}">${saved.notas || ""}</textarea>
        <button class="save-btn" onclick="saveProgreso(${idx})">${appLang === "en" ? "Save" : "Guardar"}</button>
      </div>

      <div class="prog-resumen" id="prog-resumen-${idx}" style="display:none"></div>
    `;
    container.appendChild(card);
  });

  animateCards();
  drawChart();
  drawExerciseChart();
  updateBodyFatInfo();
  updateBmrInfo();
}

function saveBaseProgress() {
  const h = document.getElementById("heightCm").value;
  const sw = document.getElementById("startWeight").value;
  const age = document.getElementById("ageYears").value;
  if (h) localStorage.setItem(LS_HEIGHT, h);
  if (sw) localStorage.setItem(LS_START_WEIGHT, sw);
  if (age) localStorage.setItem(LS_AGE, age);
  showToast(appLang === "en" ? "Base data saved" : "Datos base guardados");

  const form = document.getElementById("base-form");
  const view = document.getElementById("base-view");
  if (form && view && h && sw) {
    form.style.display = "none";
    view.style.display = "block";
    document.getElementById("base-h").textContent = (appLang === "en" ? "Height" : "Estatura") + ": " + h + " cm";
    document.getElementById("base-w").textContent = (appLang === "en" ? "Start weight" : "Peso inicial") + ": " + sw + " kg";
    if (age) {
      const existingAgeSpan = document.getElementById("base-a");
      if (existingAgeSpan) {
        existingAgeSpan.textContent = (appLang === "en" ? "Age" : "Edad") + ": " + age;
      } else {
        const span = document.createElement("span");
        span.id = "base-a";
        span.textContent = (appLang === "en" ? "Age" : "Edad") + ": " + age;
        view.querySelector(".base-inline").appendChild(span);
      }
    }
  }

  updateBodyFatInfo();
  updateBmrInfo();
  drawChart();
  drawExerciseChart();
}
window.saveBaseProgress = saveBaseProgress;

function editBaseProgress() {
  const form = document.getElementById("base-form");
  const view = document.getElementById("base-view");
  if (form && view) {
    form.style.display = "block";
    view.style.display = "none";
  }
}
window.editBaseProgress = editBaseProgress;

function updateBodyFatInfo() {
  const el = document.getElementById("bfInfo");
  if (!el) return;
  const h = localStorage.getItem(LS_HEIGHT);
  const age = localStorage.getItem(LS_AGE);
  const gender = localStorage.getItem(LS_GENDER) || "male";
  let lastWeight = localStorage.getItem(LS_START_WEIGHT) || "";
  for (let i = derivedPlan.length - 1; i >= 0; i--) {
    const saved = JSON.parse(localStorage.getItem(LS_PROGRESS_PREFIX + i) || "{}");
    if (saved.peso) { lastWeight = saved.peso; break; }
  }
  if (h && lastWeight && age) {
    const bf = estimateBodyFat(h, lastWeight, age, gender);
    if (bf) el.textContent = (appLang === "en" ? "Estimated body fat: " : "Estimación de grasa corporal: ") + bf + " %";
    else el.textContent = "";
  } else {
    el.textContent = "";
  }
}


function updateBmrInfo() {
  const el = document.getElementById("bmrInfo");
  if (!el) return;
  const h = localStorage.getItem(LS_HEIGHT);
  const w = localStorage.getItem(LS_START_WEIGHT);
  const age = localStorage.getItem(LS_AGE);
  if (h && w && age) {
    const gender = localStorage.getItem(LS_GENDER) || "male";
    const bmr = estimateBMR(h, w, age, gender !== "female");
    el.textContent = (appLang === "en"
      ? "Estimated BMR (maintenance): "
      : "TMB estimada (mantenimiento): ") + bmr + " kcal/día";
  } else {
    el.textContent = "";
  }
}

function shareProgress() {
  const name = localStorage.getItem(LS_NAME) || (appLang === "en" ? "My keto progress" : "Mi progreso Keto");
  const done = getCompletedCount();
  const lastIdx = derivedPlan.length - 1;
  let lastPeso = "";
  for (let i = lastIdx; i >= 0; i--) {
    const saved = JSON.parse(localStorage.getItem(LS_PROGRESS_PREFIX + i) || "{}");
    if (saved.peso) { lastPeso = saved.peso; break; }
  }
  const text = appLang === "en"
    ? `${name} is doing the keto plan. Completed days: ${done} of ${derivedPlan.length}${lastPeso ? (". Latest weight: " + lastPeso + " kg.") : "."}`
    : `${name} está haciendo el plan keto. Días completados: ${done} de ${derivedPlan.length}${lastPeso ? (". Peso más reciente: " + lastPeso + " kg.") : "."}`;
  if (navigator.share) {
    navigator.share({ title: appLang === "en" ? "My keto progress" : "Progreso keto", text }).catch(() => {});
  } else {
    showToast(text, 4000);
  }
}
window.shareProgress = shareProgress;

function saveProgreso(idx) {
  const data = {
    peso: document.getElementById("peso-" + idx).value,
    cintura: document.getElementById("cintura-" + idx).value,
    energia: document.getElementById("energia-" + idx).value,
    exkcal: document.getElementById("exkcal-" + idx).value,
    notas: document.getElementById("nota-" + idx).value
  };
  localStorage.setItem(LS_PROGRESS_PREFIX + idx, JSON.stringify(data));
  showToast(appLang === "en" ? "Saved ✅" : "Guardado ✅");
  drawChart();
  drawExerciseChart();
  updateBodyFatInfo();

  const form = document.getElementById("prog-form-" + idx);
  const resumen = document.getElementById("prog-resumen-" + idx);
  if (form && resumen) {
    form.style.display = "none";
    resumen.style.display = "block";
    let html = "";
    if (data.peso) html += (appLang === "en" ? `Weight: ${data.peso} kg` : `Peso: ${data.peso} kg`);
    if (data.cintura) html += (appLang === "en" ? ` | Waist: ${data.cintura} cm` : ` | Cintura: ${data.cintura} cm`);
    if (data.energia) html += (appLang === "en" ? ` | Energy: ${data.energia}` : ` | Energía: ${data.energia}`);
    if (data.exkcal) html += (appLang === "en" ? ` | Ex kcal: ${data.exkcal}` : ` | Ej kcal: ${data.exkcal}`);
    resumen.querySelector("p.small").innerHTML = html;
    const extraNotes = resumen.querySelectorAll("p.small")[1];
    if (extraNotes) extraNotes.remove();
    if (data.notas) {
      const np = document.createElement("p");
      np.className = "small";
      np.textContent = (appLang === "en" ? "Notes: " : "Notas: ") + data.notas;
      resumen.insertBefore(np, resumen.querySelector("button.save-btn"));
    }
  }
}
window.saveProgreso = saveProgreso;

function editarProgreso(idx) {
  const form = document.getElementById("prog-form-" + idx);
  const resumen = document.getElementById("prog-resumen-" + idx);
  const collapsed = document.getElementById("prog-collapsed-" + idx);
  if (form) form.style.display = "block";
  if (resumen) resumen.style.display = "none";
  if (collapsed) collapsed.style.display = "none";
}
window.editarProgreso = editarProgreso;


// ====== TABS ======
function switchTab(target) {
  const sections = ["menu","compras","progreso","ajustes"];
  sections.forEach(id => {
    const el = document.getElementById(id);
    const isTarget = id === target;
    el.style.display = isTarget ? "block" : "none";
    if (id === "progreso" && !isTarget) {
      if (weightChart) { weightChart.destroy(); weightChart = null; }
      if (exerciseChart) { exerciseChart.destroy(); exerciseChart = null; }
      el.innerHTML = "";
    }
  });
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === target));
  document.querySelectorAll(".bottom-btn").forEach(t => t.classList.toggle("active", t.dataset.tab === target));
  hideToast();

  if (target === "menu") {
    let idx = Number(localStorage.getItem(LS_SELECTED_DAY));
    let week = Number(localStorage.getItem(LS_SELECTED_WEEK));
    if (isNaN(idx) || idx < 0 || idx >= derivedPlan.length) {
      idx = getCurrentDayIndex();
    }
    if (isNaN(week) || week < 1) {
      week = Math.floor(idx / 7) + 1;
    }

    localStorage.setItem(LS_SELECTED_WEEK, String(week));

    if (!dailyView) {
      setWeekActive(week);
      renderDayPills(week);
      renderMenuDay(idx, week);
    } else {
      renderMenuDay(idx, week);
    }
    updateProgressBar();
    showMotivation();
  }
  if (target === "compras") renderCompras();
  if (target === "progreso") renderProgreso();
  if (target === "ajustes") {
    const saved = localStorage.getItem(LS_START);
    if (saved) document.getElementById("startDateInput").value = saved;
    document.getElementById("planWeeks").value = currentWeeks;
    document.getElementById("dailyView").value = dailyView;
    const pColor = localStorage.getItem(LS_PRIMARY) || "#0f766e";
    document.getElementById("primaryColor").value = pColor;
    document.getElementById("appLang").value = appLang;
    document.getElementById("likeFoods").value = localStorage.getItem(LS_LIKE) || "";
    document.getElementById("dislikeFoods").value = localStorage.getItem(LS_DISLIKE) || "";
    document.getElementById("apiUser").value = localStorage.getItem(LS_API_USER) || "";
    document.getElementById("apiPass").value = localStorage.getItem(LS_API_PASS) || "";
    document.getElementById("waterGoalInput").value = getDailyWaterGoal();

    const g = localStorage.getItem(LS_GENDER) || "male";
    const gSel = document.getElementById("genderSelect");
    if (gSel) gSel.value = g;
    const wInt = localStorage.getItem(LS_WORKOUT_INTENSITY) || "medium";
    const wSel = document.getElementById("workoutIntensity");
    if (wSel) wSel.value = wInt;
  }

}
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});
document.querySelectorAll(".bottom-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});
document.addEventListener("click", e => {
  const btn = e.target.closest(".week-btn");
  if (btn) {
    document.querySelectorAll(".week-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const week = Number(btn.dataset.week);
    localStorage.setItem(LS_SELECTED_WEEK, String(week));

    renderDayPills(week);

    const firstDayIndex = (week - 1) * 7;
    localStorage.setItem(LS_SELECTED_DAY, String(firstDayIndex));
    renderMenuDay(firstDayIndex, week);
    renderStoredWeekReview(week);
  }
});

// ====== THEME ======
const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem(LS_THEME) || "dark";
document.body.setAttribute("data-theme", savedTheme);
themeToggle.checked = savedTheme === "dark";
themeToggle.addEventListener("change", () => {
  const mode = themeToggle.checked ? "dark" : "light";
  document.body.setAttribute("data-theme", mode);
  localStorage.setItem(LS_THEME, mode);
  if (document.getElementById("progreso").style.display === "block") {
    drawChart();
    drawExerciseChart();
  }
  hideToast();
});

// ====== AJUSTES DINÁMICOS ======
function changeDailyView() {
  const val = Number(document.getElementById("dailyView").value);
  dailyView = val;
  localStorage.setItem(LS_DAILY_VIEW, String(val));
  renderWeekButtons();
  switchTab("menu");
}

function changePrimaryColor() {
  const val = document.getElementById("primaryColor").value;
  document.documentElement.style.setProperty("--primary", val);
  localStorage.setItem(LS_PRIMARY, val);
  showToast(appLang === "en" ? "Color updated" : "Color actualizado");
  if (document.getElementById("progreso").style.display === "block") {
    drawChart();
    drawExerciseChart();
  }
}

function changeGender() {
  const val = document.getElementById("genderSelect").value;
  localStorage.setItem(LS_GENDER, val);

  derivedPlan = buildPlan(currentWeeks, val);

  const idx = getCurrentDayIndex();
  const week = Math.floor(idx / 7) + 1;
  if (!dailyView) {
    setWeekActive(week);
    renderDayPills(week);
  }
  renderMenuDay(idx, week);
  updateProgressBar();
  showToast(appLang === "en" ? "Gender updated" : "Género actualizado");
}
window.changeGender = changeGender;

function changeWorkoutIntensity() {
  const val = document.getElementById("workoutIntensity").value;
  localStorage.setItem(LS_WORKOUT_INTENSITY, val);
  showToast(appLang === "en" ? "Workout intensity updated" : "Intensidad de entreno actualizada");
}
window.changeWorkoutIntensity = changeWorkoutIntensity;

function changePlanWeeks() {
  const val = Number(document.getElementById("planWeeks").value);
  currentWeeks = val;
  localStorage.setItem(LS_PLAN_WEEKS, String(val));
  const g = localStorage.getItem(LS_GENDER) || "male";
  derivedPlan = buildPlan(currentWeeks, g);
  renderWeekButtons();
  const idx = getCurrentDayIndex();
  const week = Math.floor(idx / 7) + 1;
  if (!dailyView) {
    setWeekActive(week);
    renderDayPills(week);
  }
  renderMenuDay(idx, week);
  updateProgressBar();
  showToast(appLang === "en" ? "Plan updated" : "Plan actualizado a " + val + " semanas");
}


function setWeekActive(week) {
  document.querySelectorAll(".week-btn").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.week) === week);
  });
}

function resetAll() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LS_PREFIX)) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  showToast(appLang === "en" ? "All cleared" : "Todo borrado");
  setTimeout(() => location.reload(), 500);
}
window.resetAll = resetAll;

function changeAppLang() {
  const val = document.getElementById("appLang").value;
  appLang = val;
  localStorage.setItem(LS_LANG, val);
  switchTab("menu");
  setRandomTip(localStorage.getItem(LS_NAME) || "");
}
window.changeAppLang = changeAppLang;

function saveFoodPrefs() {
  const like = document.getElementById("likeFoods").value.trim();
  const dislike = document.getElementById("dislikeFoods").value.trim();
  localStorage.setItem(LS_LIKE, like);
  localStorage.setItem(LS_DISLIKE, dislike);
  showToast(appLang === "en" ? "Food preferences saved" : "Preferencias guardadas");
}
window.saveFoodPrefs = saveFoodPrefs;

function saveApiAccess() {
  const u = document.getElementById("apiUser").value.trim();
  const p = document.getElementById("apiPass").value.trim();
  localStorage.setItem(LS_API_USER, u);
  localStorage.setItem(LS_API_PASS, p);
  showToast(appLang === "en" ? "API access saved" : "Acceso API guardado");
}
window.saveApiAccess = saveApiAccess;

function saveWaterGoal() {
  const val = Number(document.getElementById("waterGoalInput").value);
  if (!val || val < 1000) {
    showToast(appLang === "en" ? "Enter a valid amount" : "Pon una cantidad válida");
    return;
  }
  localStorage.setItem(LS_WATER_GOAL, String(val));
  showToast(appLang === "en" ? "Water goal saved" : "Meta de agua guardada");
  const curIdx = Number(localStorage.getItem(LS_SELECTED_DAY)) || getCurrentDayIndex();
  const curWeek = Number(localStorage.getItem(LS_SELECTED_WEEK)) || (Math.floor(curIdx / 7) + 1);
  renderMenuDay(curIdx, curWeek);
}
window.saveWaterGoal = saveWaterGoal;

// ====== ANIMACIONES ======
function animateCards() {
  const items = document.querySelectorAll(".day-card, .list-row");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("show"); });
    }, {threshold: .15});
    items.forEach(i => observer.observe(i));
  } else {
    items.forEach(i => i.classList.add("show"));
  }
}

// ====== CHARTS ======
function getPrimaryColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#0f766e";
}
function drawChart() {
  const ctx = document.getElementById("weightChart");
  if (!ctx || typeof Chart === "undefined") return;

  const startWeight = parseFloat(localStorage.getItem(LS_START_WEIGHT) || "0") || null;
  const height = parseFloat(localStorage.getItem(LS_HEIGHT) || "0") || null;

  const labels = ["Inicio"];
  const weightData = [startWeight];
  const age = localStorage.getItem(LS_AGE);
  const gender = localStorage.getItem(LS_GENDER) || "male";
  const bodyFatData = [(height && startWeight && age) ? parseFloat(estimateBodyFat(height, startWeight, age, gender)) : null];

  for (let idx = 0; idx < derivedPlan.length; idx++) {
    labels.push(derivedPlan[idx].dia);
    const saved = JSON.parse(localStorage.getItem(LS_PROGRESS_PREFIX + idx) || "{}");
    const w = saved.peso ? parseFloat(saved.peso) : null;
    weightData.push(w);
    if (height && w && age) {
      bodyFatData.push(parseFloat(estimateBodyFat(height, w, age, gender)));
    } else {
      bodyFatData.push(null);
    }
  }

  if (weightChart) weightChart.destroy();

  const isDark = document.body.getAttribute("data-theme") === "dark";
  const axisColor = isDark ? "rgba(226,232,240,.8)" : "rgba(15,23,42,.7)";
  const gridColor = isDark ? "rgba(226,232,240,.06)" : "rgba(15,23,42,.05)";
  const fatColor = "#f97316";

  weightChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: appLang === "en" ? "Weight (kg)" : "Peso (kg)",
          data: weightData,
          borderWidth: 2,
          borderColor: getPrimaryColor(),
          backgroundColor: getPrimaryColor(),
          tension: .35,
          pointRadius: 3,
          pointHoverRadius: 4
        },
        {
          label: appLang === "en" ? "Body fat (%) est." : "% Grasa (est.)",
          data: bodyFatData,
          borderWidth: 2,
          borderColor: fatColor,
          backgroundColor: fatColor,
          tension: .35,
          pointRadius: 3,
          borderDash: [4,4],
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: axisColor,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8
          }
        },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: {
          ticks: { color: axisColor, autoSkip: true, maxTicksLimit: 8 },
          grid: { color: gridColor }
        },
        y: {
          beginAtZero: false,
          ticks: { color: axisColor },
          grid: { color: gridColor },
          title: { display: true, text: "kg", color: axisColor, font: { size: 10 } }
        },
        y1: {
          position: "right",
          ticks: { color: axisColor },
          grid: { drawOnChartArea: false },
          title: { display: true, text: appLang === "en" ? "% fat" : "% grasa", color: axisColor, font: { size: 10 } },
          suggestedMin: 5,
          suggestedMax: 45
        }
      }
    }
  });
}

function drawExerciseChart() {
  const ctx = document.getElementById("exerciseChart");
  if (!ctx || typeof Chart === "undefined") return;

  const labels = [];
  const planKcal = [];
  const exerciseKcal = [];
  const energy = [];

  for (let idx = 0; idx < derivedPlan.length; idx++) {
    labels.push(derivedPlan[idx].dia);
    planKcal.push(derivedPlan[idx].kcal || 0);

    const saved = JSON.parse(localStorage.getItem(LS_PROGRESS_PREFIX + idx) || "{}");
    exerciseKcal.push(saved.exkcal ? Number(saved.exkcal) : 0);
    energy.push(saved.energia ? Number(saved.energia) : 0);
  }

  if (exerciseChart) exerciseChart.destroy();

  const isDark = document.body.getAttribute("data-theme") === "dark";
  const axisColor = isDark ? "rgba(226,232,240,.8)" : "rgba(15,23,42,.7)";
  const gridColor = isDark ? "rgba(226,232,240,.06)" : "rgba(15,23,42,.05)";

  exerciseChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: appLang === "en" ? "Plan kcal" : "Kcal plan",
          data: planKcal,
          borderWidth: 1.8,
          borderColor: getPrimaryColor(),
          backgroundColor: getPrimaryColor(),
          tension: .35,
          pointRadius: 2.5
        },
        {
          label: appLang === "en" ? "Exercise kcal" : "Kcal ejercicio",
          data: exerciseKcal,
          borderWidth: 1.8,
          borderColor: "#38bdf8",
          backgroundColor: "#38bdf8",
          tension: .35,
          pointRadius: 2.5
        },
        {
          label: appLang === "en" ? "Energy (1-10)" : "Energía (1-10)",
          data: energy,
          borderWidth: 1.4,
          borderColor: "#f97316",
          backgroundColor: "#f97316",
          tension: .3,
          pointRadius: 2.5,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: axisColor,
            usePointStyle: true,
            boxWidth: 8
          }
        }
      },
      scales: {
        x: {
          ticks: { color: axisColor, autoSkip: true, maxTicksLimit: 8 },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: axisColor },
          grid: { color: gridColor },
          title: { display: true, text: "kcal", color: axisColor, font: { size: 10 } }
        },
        y1: {
          position: "right",
          ticks: { color: axisColor },
          grid: { drawOnChartArea: false },
          title: { display: true, text: appLang === "en" ? "Energy" : "Energía", color: axisColor, font: { size: 10 } },
          suggestedMin: 0,
          suggestedMax: 10
        }
      }
    }
  });
}

// ====== INICIALIZACIÓN ======
function initApp() {
  appLang = localStorage.getItem(LS_LANG) || "es";
  currentWeeks = Number(localStorage.getItem(LS_PLAN_WEEKS)) || 2;
  dailyView = Number(localStorage.getItem(LS_DAILY_VIEW)) || 0;
  const savedGender = localStorage.getItem(LS_GENDER) || "male";

  derivedPlan = buildPlan(currentWeeks, savedGender);
  renderWeekButtons();

  const idx = getCurrentDayIndex();
  const week = Math.floor(idx / 7) + 1;
  if (!dailyView) {
    setWeekActive(week);
    renderDayPills(week);
  }
  renderMenuDay(idx, week);
  renderStoredWeekReview(week);
  updateProgressBar();
  showMotivation();

  const savedName = localStorage.getItem(LS_NAME);
  if (savedName) {
    setHeaderName(savedName);
  } else {
    document.getElementById("nameModal").style.display = "flex";
  }

  const savedColor = localStorage.getItem(LS_PRIMARY);
  if (savedColor) {
    document.documentElement.style.setProperty("--primary", savedColor);
  }

  askStartDateIfNeeded();

  const weekBtn = document.getElementById("aiWeeklyReviewBtn");
  if (weekBtn) {
    weekBtn.addEventListener("click", () => {
      weekBtn.classList.add("is-loading");
      reviewWeekWithAI().finally(() => weekBtn.classList.remove("is-loading"));
    });
  }

  const aiGlobal = document.querySelector(".ai-global-actions");
  if (aiGlobal && !document.getElementById("aiMotivationBtn")) {
    const btn = document.createElement("button");
    btn.id = "aiMotivationBtn";
    btn.className = "ia-btn ghost";
    btn.textContent = "Motivar con IA 💬";
    btn.addEventListener("click", () => {
      btn.classList.add("is-loading");
      motivateDayWithAI().finally(() => btn.classList.remove("is-loading"));
    });
    aiGlobal.appendChild(btn);
  }
  if (aiGlobal && !document.getElementById("aiWorkoutWeekBtn")) {
    const btnW = document.createElement("button");
    btnW.id = "aiWorkoutWeekBtn";
    btnW.className = "ia-btn";
    btnW.textContent = appLang === "en" ? "Week workouts IA 🏋️" : "Semana entrenos IA 🏋️";
    btnW.addEventListener("click", async () => {
      btnW.classList.add("is-loading");
      await generateWorkoutWeekAI();
      btnW.classList.remove("is-loading");
    });
    aiGlobal.appendChild(btnW);
  }
  document.getElementById("splash-screen").classList.add("hide");
}
document.addEventListener("DOMContentLoaded", initApp);



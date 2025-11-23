import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getDayData, getCheatMeal } from '../storage/storage';
import { getDayDisplayName } from './labels';
import { calculateDynamicDailyKcal } from './calculations';

const MEAL_CONFIG = [
  { key: 'desayuno', labelEn: 'Breakfast', labelEs: 'Desayuno' },
  { key: 'snackAM', labelEn: 'Snack AM', labelEs: 'Snack AM' },
  { key: 'almuerzo', labelEn: 'Lunch', labelEs: 'Almuerzo' },
  { key: 'snackPM', labelEn: 'Snack PM', labelEs: 'Snack PM' },
  { key: 'cena', labelEn: 'Dinner', labelEs: 'Cena' }
];

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseLines = (value = '') =>
  value
    .split(/\r?\n|•|,/g)
    .map((item) => item.trim())
    .filter(Boolean);

const sharePdfFile = async ({ html, language = 'es', shareTitle }) => {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  let shared = false;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: shareTitle || (language === 'en' ? 'Share PDF' : 'Compartir PDF'),
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf'
    });
    shared = true;
  }

  return { uri, shared, html };
};

export const exportWeekPlanPdf = async ({
  weekNumber = 1,
  derivedPlan = [],
  language = 'es',
  waterGoal = 2400,
  startDate,
  metrics = {},
  gender = 'male'
}) => {
  const totalDays = Array.isArray(derivedPlan) ? derivedPlan.length : 0;
  const safeWeek = Number.isFinite(Number(weekNumber)) ? Number(weekNumber) : 1;
  const startIndex = Math.max(0, (safeWeek - 1) * 7);
  const endIndex = totalDays > 0 ? Math.min(safeWeek * 7, totalDays) : 0;
  const normalizedWaterGoal = Number(waterGoal) || 2400;
  const cheatSummary = [];

  const avgBaseKcal = derivedPlan
    .slice(startIndex, endIndex)
    .map((d) => Number(d?.kcal) || 0)
    .filter(Boolean)
    .reduce((sum, val, _, arr) => sum + val / arr.length, 0);

  const recommendedKcal = calculateDynamicDailyKcal({
    baseKcal: Math.round(avgBaseKcal || 0) || 1600,
    gender,
    metrics,
    cheatKcal: 0
  });

  const dayBlocks = [];

  if (totalDays === 0 || startIndex >= endIndex) {
    dayBlocks.push({
      title: language === 'en' ? 'No data yet' : 'Sin datos aún',
      kcal: 0,
      macros: language === 'en' ? 'Add your plan to see meals here.' : 'Agrega tu plan para ver las comidas aquí.',
      meals: []
    });
  } else {
    for (let index = startIndex; index < endIndex; index += 1) {
      const base = derivedPlan[index] || {};
      const override = await getDayData(index);
      const cheat = await getCheatMeal(index);
      const merged = { ...base, ...override };

      const dayTitle = getDayDisplayName({
        label: merged.dia || base?.dia,
        index,
        language,
        startDate
      });

      const macros = merged.macros || base.macros || {};
      const macroLine = `C ${macros.carbs || '--'} · P ${macros.prot || '--'} · G ${macros.fat || '--'}`;

      const meals = MEAL_CONFIG.map((config) => {
        const mealData = override?.[config.key] || base?.[config.key] || {};
        const ingredients = parseLines(mealData?.qty || '');
        const note = mealData?.note || mealData?.descripcion || '';

        return {
          title: language === 'en' ? config.labelEn : config.labelEs,
          name: mealData?.nombre || '',
          ingredients,
          note
        };
      });

      if (cheat?.mealKey) {
        cheatSummary.push({ dayTitle, mealKey: cheat.mealKey, description: cheat.description });
      }

      dayBlocks.push({
        title: dayTitle,
        kcal: merged.kcal || base.kcal || 0,
        macros: macroLine,
        meals,
        cheat
      });
    }
  }

  const daysHtml = dayBlocks
    .map((day) => {
      const mealHtml = day.meals
        .map((meal) => {
          const listHtml = meal.ingredients.length
            ? `<ul class="ingredients">${meal.ingredients
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}</ul>`
            : '';

          const noteHtml = meal.note
            ? `<p class="note">${escapeHtml(meal.note)}</p>`
            : '';

          const nameHtml = meal.name
            ? `<p class="meal-name">${escapeHtml(meal.name)}</p>`
            : '';

          return `
            <div class="meal">
              <h3 class="meal-title">${escapeHtml(meal.title)}</h3>
              ${nameHtml}
              ${listHtml}
              ${noteHtml}
            </div>
          `;
        })
        .join('');

      return `
        <section class="day-card">
          <h2 class="day-title">${escapeHtml(day.title)}</h2>
          <div class="day-meta">
            <span>${escapeHtml(String(day.kcal))} kcal</span>
            <span>${escapeHtml(day.macros)}</span>
            ${day.cheat?.mealKey ? `<span class="pill pill-warning">Cheat · ${escapeHtml(day.cheat.mealKey)}</span>` : ''}
          </div>
          ${mealHtml}
        </section>
      `;
    })
    .join('');

  const subtitle = language === 'en'
    ? 'Weekly keto meals, macros and notes'
    : 'Comidas keto semanales, macros y notas';

  const cheatLine = cheatSummary.length
    ? cheatSummary
        .map((item) => `${item.dayTitle} · ${item.mealKey}${item.description ? `: ${item.description}` : ''}`)
        .join(' | ')
    : language === 'en'
    ? 'No cheat meal scheduled this week.'
    : 'Sin cheat meal programado esta semana.';

  const html = `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <meta charset="utf-8" />
        <title>${language === 'en' ? 'Weekly keto plan' : 'Plan keto semanal'}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 32px;
            background: #f8fafc;
            color: #0f172a;
          }
          .week-header {
            text-align: center;
            margin-bottom: 32px;
          }
          .week-header h1 {
            margin: 0;
            font-size: 28px;
            letter-spacing: -0.5px;
          }
          .week-header p {
            margin: 8px 0 0;
            color: #475569;
            font-size: 14px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            margin-top: 16px;
          }
          .meta-card {
            background: #0ea5e9;
            color: #ecfeff;
            border-radius: 14px;
            padding: 12px;
            box-shadow: 0 10px 24px rgba(14, 165, 233, 0.2);
          }
          .meta-card h3 {
            margin: 0 0 4px;
            font-size: 14px;
            letter-spacing: 0.2px;
            text-transform: uppercase;
          }
          .meta-card p {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
          }
          .day-card {
            background: #ffffff;
            border-radius: 18px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
            border: 1px solid rgba(15, 23, 42, 0.08);
          }
          .day-title {
            margin: 0;
            font-size: 20px;
          }
          .day-meta {
            margin: 6px 0 16px;
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            color: #64748b;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .pill {
            padding: 4px 8px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 11px;
          }
          .pill-warning {
            background: rgba(249, 115, 22, 0.15);
            color: #c2410c;
          }
          .meal {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          }
          .meal:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .meal-title {
            margin: 0;
            font-size: 15px;
            color: #0f172a;
          }
          .meal-name {
            margin: 4px 0;
            font-size: 14px;
            color: #0f172a;
          }
          .ingredients {
            margin: 6px 0 0 16px;
            padding: 0;
            color: #0f172a;
            font-size: 13px;
          }
          .ingredients li {
            margin-bottom: 4px;
          }
          .note {
            margin: 6px 0 0;
            color: #475569;
            font-size: 12px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="week-header">
          <h1>${language === 'en' ? 'Week' : 'Semana'} ${safeWeek}</h1>
          <p>${escapeHtml(subtitle)}</p>
          <p style="margin-top:6px;font-size:12px;color:#64748b;">
            ${language === 'en'
              ? `Hydration goal: ${normalizedWaterGoal} ml`
              : `Meta de hidratación: ${normalizedWaterGoal} ml`}
          </p>
          <div class="meta-grid">
            <div class="meta-card">
              <h3>${language === 'en' ? 'Recommended kcal' : 'Kcal sugeridas'}</h3>
              <p>${recommendedKcal} kcal</p>
            </div>
            <div class="meta-card" style="background:#22c55e;box-shadow:0 10px 24px rgba(34,197,94,0.18);">
              <h3>${language === 'en' ? 'Cheat status' : 'Estado cheat'}</h3>
              <p>${escapeHtml(cheatLine)}</p>
            </div>
          </div>
        </div>
        ${daysHtml}
      </body>
    </html>
  `;

  return await sharePdfFile({
    html,
    language,
    shareTitle: language === 'en' ? 'Share weekly PDF' : 'Compartir PDF semanal'
  });
};

export const exportWorkoutPlanPdf = async ({
  weekNumber = 1,
  language = 'es',
  intensityLabel = '',
  days = [],
  focus = ''
}) => {
  const safeWeek = Number.isFinite(Number(weekNumber)) ? Number(weekNumber) : 1;

  const daySections = days.length
    ? days
        .map((day) => {
          const exercises = Array.isArray(day.exercises) ? day.exercises : [];
          const focusLine = day.focus || focus;
          const exerciseHtml = exercises.length
            ? exercises
                .map((exercise) => {
                  const details = [
                    exercise.series && `${language === 'en' ? 'Sets' : 'Series'}: ${exercise.series}`,
                    (exercise.repeticiones || exercise.reps || exercise.rep) &&
                      `${language === 'en' ? 'Reps' : 'Repeticiones'}: ${exercise.repeticiones || exercise.reps || exercise.rep}`,
                    exercise.duracion && `${language === 'en' ? 'Duration' : 'Duración'}: ${exercise.duracion}`,
                    (exercise.descanso || exercise.rest || exercise.pausa) &&
                      `${language === 'en' ? 'Rest' : 'Descanso'}: ${exercise.descanso || exercise.rest || exercise.pausa}`,
                    exercise.tempo && `${language === 'en' ? 'Tempo' : 'Ritmo'}: ${exercise.tempo}`,
                    exercise.descripcion || exercise.detalle,
                    exercise.notas
                  ]
                    .filter(Boolean)
                    .map((detail) => `<li>${escapeHtml(String(detail))}</li>`)
                    .join('');

                  return `
                    <div class="exercise">
                      <div class="exercise-header">
                        <h3>${escapeHtml(exercise.nombre || exercise.name || '')}</h3>
                      </div>
                      ${details ? `<ul class="exercise-meta">${details}</ul>` : ''}
                    </div>
                  `;
                })
                .join('')
            : day.summary
            ? `<p class="reference">${escapeHtml(day.summary)}</p>`
            : `<p class="reference">${escapeHtml(
                language === 'en'
                  ? 'No workout saved yet. Generate it with AI to view the full routine.'
                  : 'Sin entreno guardado. Genera con IA para ver la rutina completa.'
              )}</p>`;

          return `
            <section class="day-card">
              <header class="day-header">
                <div>
                  <h2>${escapeHtml(day.title || '')}</h2>
                  ${focusLine ? `<p class="day-focus">${escapeHtml(focusLine)}</p>` : ''}
                </div>
                ${day.duration ? `<span class="badge">${escapeHtml(day.duration)}</span>` : ''}
              </header>
              ${exerciseHtml}
            </section>
          `;
        })
        .join('')
    : `<section class="day-card empty">${escapeHtml(
        language === 'en' ? 'No workouts logged yet.' : 'Aún no hay entrenos registrados.'
      )}</section>`;

  const subtitle = language === 'en'
    ? 'Weekly calisthenics & cardio plan'
    : 'Plan semanal de calistenia y cardio';

  const html = `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <meta charset="utf-8" />
        <title>${language === 'en' ? 'Weekly workout plan' : 'Plan semanal de entrenos'}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 32px;
            background: #0f172a;
            color: #e2e8f0;
          }
          .week-header {
            text-align: center;
            margin-bottom: 32px;
          }
          .week-header h1 {
            margin: 0;
            font-size: 28px;
            letter-spacing: -0.5px;
          }
          .week-header p {
            margin: 8px 0 0;
            color: rgba(226,232,240,0.75);
            font-size: 14px;
          }
          .meta-strip {
            display: inline-flex;
            padding: 6px 14px;
            border-radius: 999px;
            background: rgba(14,165,233,0.14);
            color: #38bdf8;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 12px;
          }
          .day-card {
            background: rgba(15,23,42,0.82);
            border-radius: 18px;
            padding: 22px;
            margin-bottom: 20px;
            border: 1px solid rgba(226,232,240,0.08);
            box-shadow: 0 14px 30px rgba(2, 132, 199, 0.16);
          }
          .day-card.empty {
            text-align: center;
            font-style: italic;
            color: rgba(226,232,240,0.7);
          }
          .day-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 18px;
            margin-bottom: 18px;
          }
          .day-header h2 {
            margin: 0;
            font-size: 21px;
            color: #f8fafc;
          }
          .day-focus {
            margin: 6px 0 0;
            color: rgba(226,232,240,0.75);
            font-size: 14px;
          }
          .badge {
            align-self: flex-start;
            background: rgba(56,189,248,0.12);
            color: #38bdf8;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          .exercise {
            background: rgba(30,41,59,0.95);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid rgba(71,85,105,0.35);
          }
          .exercise:last-child {
            margin-bottom: 0;
          }
          .exercise-header h3 {
            margin: 0;
            font-size: 16px;
            color: #f8fafc;
          }
          .exercise-meta {
            margin: 10px 0 0 18px;
            padding: 0;
            color: rgba(226,232,240,0.78);
            font-size: 13px;
          }
          .exercise-meta li {
            margin-bottom: 4px;
          }
          .reference {
            margin: 0;
            color: rgba(226,232,240,0.78);
            font-size: 14px;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="week-header">
          <h1>${language === 'en' ? 'Week' : 'Semana'} ${safeWeek}</h1>
          <p>${escapeHtml(subtitle)}</p>
          ${intensityLabel ? `<span class="meta-strip">${escapeHtml(intensityLabel)}</span>` : ''}
        </div>
        ${daySections}
      </body>
    </html>
  `;

  return await sharePdfFile({
    html,
    language,
    shareTitle:
      language === 'en' ? 'Share weekly workout PDF' : 'Compartir PDF semanal de entrenos'
  });
};

export const exportShoppingWeekPdf = async ({
  language = 'es',
  weekNumber = 1,
  sections = [],
  baseSections = []
}) => {
  const safeWeek = Number.isFinite(Number(weekNumber)) ? Number(weekNumber) : 1;

  const renderSection = (title, items) => {
    if (!items || !items.length) return '';
    const list = items
      .map((item) => `<li>${escapeHtml(String(item))}</li>`)
      .join('');
    return `
      <section class="list-card">
        <h2>${escapeHtml(title)}</h2>
        <ul>${list}</ul>
      </section>
    `;
  };

  const aiContent = sections.length
    ? sections
        .map((section) => renderSection(section.title, section.items))
        .join('')
    : `<p class="empty">${escapeHtml(
        language === 'en'
          ? 'Generate your list with AI to see the suggested groceries here.'
          : 'Genera tu lista con IA para ver aquí los ingredientes sugeridos.'
      )}</p>`;

  const baseContent = baseSections.length
    ? baseSections.map((section) => renderSection(section.cat || section.title, section.items.split(','))).join('')
    : '';

  const html = `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <meta charset="utf-8" />
        <title>${language === 'en' ? 'Weekly shopping list' : 'Lista semanal de compras'}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 32px;
            background: #f8fafc;
            color: #0f172a;
          }
          .header {
            text-align: center;
            margin-bottom: 28px;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .header p {
            margin: 6px 0 0;
            color: #475569;
            font-size: 14px;
          }
          .section-title {
            font-size: 18px;
            margin: 28px 0 12px;
            color: #0f172a;
          }
          .list-card {
            background: #ffffff;
            border-radius: 18px;
            padding: 18px;
            margin-bottom: 16px;
            border: 1px solid rgba(148,163,184,0.25);
            box-shadow: 0 12px 24px rgba(15,23,42,0.08);
          }
          .list-card h2 {
            margin: 0 0 10px;
            font-size: 17px;
            color: #0f172a;
          }
          .list-card ul {
            margin: 0;
            padding-left: 20px;
            color: #1f2937;
            font-size: 14px;
            line-height: 1.6;
          }
          .empty {
            text-align: center;
            font-style: italic;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${language === 'en' ? 'Week' : 'Semana'} ${safeWeek}</h1>
          <p>${escapeHtml(
            language === 'en'
              ? 'Base groceries plus your AI generated list.'
              : 'Compras base más la lista generada por IA.'
          )}</p>
        </div>

        <h2 class="section-title">${escapeHtml(
          language === 'en' ? 'AI shopping plan' : 'Lista inteligente IA'
        )}</h2>
        ${aiContent}

        ${baseContent
          ? `<h2 class="section-title">${escapeHtml(
              language === 'en' ? 'Coach essentials' : 'Esenciales del coach'
            )}</h2>${baseContent}`
          : ''}
      </body>
    </html>
  `;

  return await sharePdfFile({
    html,
    language,
    shareTitle: language === 'en' ? 'Share shopping PDF' : 'Compartir PDF de compras'
  });
};

const formatNumber = (value, decimals = 1) => {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return num.toFixed(decimals);
};

const buildTrend = ({ points = [], key, language }) => {
  const filtered = points.filter((point) =>
    point && point[key] !== null && point[key] !== undefined && Number.isFinite(Number(point[key]))
  );

  if (!filtered.length) return '';

  const values = filtered.map((point) => Number(point[key]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const label =
    key === 'weight'
      ? language === 'en'
        ? 'Weight trend'
        : 'Tendencia de peso'
      : key === 'energy'
      ? language === 'en'
        ? 'Energy trend'
        : 'Tendencia de energía'
      : language === 'en'
      ? 'Body fat trend'
      : 'Tendencia de grasa';

  const bars = filtered
    .map((point) => {
      const value = Number(point[key]);
      const height = 30 + Math.round(((value - min) / range) * 70);
      return `
        <div class="trend-point">
          <div class="trend-bar" style="height:${height}px"></div>
          <span class="trend-value">${escapeHtml(formatNumber(value, key === 'energy' ? 0 : 1))}</span>
          <span class="trend-label">${escapeHtml(point.label || '')}</span>
        </div>
      `;
    })
    .join('');

  return `
    <section class="trend-card">
      <h3>${escapeHtml(label)}</h3>
      <div class="trend-chart">${bars}</div>
    </section>
  `;
};

export const exportProgressPdf = async ({
  language = 'es',
  weekNumber = 1,
  scope = 'week',
  entries = [],
  derivedPlan = [],
  hydrationStats = {},
  exerciseSummary = {},
  baseStats = {},
  metricsSummary = {},
  chartPoints = [],
  startDate
}) => {
  const safeWeek = Number.isFinite(Number(weekNumber)) ? Number(weekNumber) : 1;
  const title =
    scope === 'plan'
      ? language === 'en'
        ? 'Full plan progress'
        : 'Progreso de todo el plan'
      : `${language === 'en' ? 'Week' : 'Semana'} ${safeWeek}`;

  const filteredEntries = scope === 'plan'
    ? entries
    : entries.filter((entry) => {
        const weekIdx = Math.floor(entry.dayIndex / 7) + 1;
        return weekIdx === safeWeek;
      });

  const displayEntries = filteredEntries.length ? filteredEntries : entries;

  const dayRows = displayEntries.length
    ? displayEntries
        .map((entry) => {
          const planDay = derivedPlan[entry.dayIndex] || {};
          const label = getDayDisplayName({
            label: planDay.dia,
            index: entry.dayIndex,
            language,
            startDate
          });

          return `
            <tr>
              <td>${escapeHtml(label)}</td>
              <td>${escapeHtml(formatNumber(entry.pesoNumber ?? entry.peso, 1))} kg</td>
              <td>${escapeHtml(
                entry.cintura !== null && entry.cintura !== undefined
                  ? `${entry.cintura} cm`
                  : '--'
              )}</td>
              <td>${escapeHtml(
                formatNumber(entry.bodyFat, 1)
              )} %</td>
              <td>${escapeHtml(
                formatNumber(entry.energiaNumber ?? entry.energia, 0)
              )}/10</td>
              <td>${escapeHtml(
                entry.water && entry.waterGoal
                  ? `${entry.water} / ${entry.waterGoal} ml`
                  : '--'
              )}</td>
              <td>${escapeHtml(
                entry.calConsumed && entry.calGoal
                  ? `${entry.calConsumed} / ${entry.calGoal}`
                  : '--'
              )}</td>
              <td>${escapeHtml(entry.notas || '')}</td>
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="8" class="empty">${escapeHtml(
        language === 'en'
          ? 'Log your progress to see it here.'
          : 'Registra tu progreso para verlo aquí.'
      )}</td></tr>`;

  const avgWeight = displayEntries.length
    ? displayEntries.reduce((sum, entry) => sum + (entry.pesoNumber || 0), 0) /
      Math.max(1, displayEntries.filter((entry) => Number.isFinite(entry.pesoNumber)).length || 1)
    : null;

  const avgEnergy = displayEntries.length
    ? displayEntries.reduce((sum, entry) => sum + (entry.energiaNumber || 0), 0) /
      Math.max(1, displayEntries.filter((entry) => Number.isFinite(entry.energiaNumber)).length || 1)
    : null;

  const avgBodyFat = displayEntries.length
    ? displayEntries.reduce((sum, entry) => sum + (entry.bodyFat || 0), 0) /
      Math.max(1, displayEntries.filter((entry) => Number.isFinite(entry.bodyFat)).length || 1)
    : null;

  const hydrationScope = scope === 'plan'
    ? hydrationStats
    : (() => {
        let daysWithWater = 0;
        let totalMl = 0;
        displayEntries.forEach((entry) => {
          if (entry.waterGoal && entry.water && entry.water >= entry.waterGoal * 0.8) {
            daysWithWater += 1;
          }
          totalMl += entry.water || 0;
        });
        return { daysWithWater, totalMl };
      })();

  const exerciseScope = scope === 'plan'
    ? exerciseSummary
    : (() => {
        let daysLogged = 0;
        let totalKcal = 0;
        displayEntries.forEach((entry) => {
          if (entry.burnedKcal) {
            totalKcal += entry.burnedKcal;
            daysLogged += 1;
          }
        });
        return { daysLogged, totalKcal };
      })();

  const trends = ['weight', 'bodyFat', 'energy']
    .map((key) => buildTrend({ points: chartPoints, key, language }))
    .filter(Boolean)
    .join('');

  const subtitle =
    scope === 'plan'
      ? language === 'en'
        ? 'Complete body transformation overview'
        : 'Resumen completo de tu transformación'
      : language === 'en'
      ? 'Weekly keto & training check-in'
      : 'Chequeo semanal de keto y entrenos';

  const html = `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 32px;
            background: #0f172a;
            color: #e2e8f0;
          }
          .header {
            text-align: center;
            margin-bottom: 32px;
          }
          .header h1 {
            margin: 0;
            font-size: 30px;
            letter-spacing: -0.8px;
          }
          .header p {
            margin: 8px 0 0;
            color: rgba(226,232,240,0.75);
            font-size: 14px;
          }
          .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 18px;
            margin-bottom: 28px;
          }
          .card {
            background: rgba(15,23,42,0.82);
            border-radius: 18px;
            padding: 20px;
            border: 1px solid rgba(226,232,240,0.12);
            box-shadow: 0 16px 32px rgba(14,116,144,0.22);
          }
          .card h3 {
            margin: 0 0 12px;
            font-size: 16px;
            color: #f8fafc;
          }
          .card p {
            margin: 6px 0;
            color: rgba(226,232,240,0.78);
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
          }
          th, td {
            border: 1px solid rgba(148,163,184,0.25);
            padding: 10px;
            font-size: 13px;
            text-align: left;
          }
          th {
            background: rgba(15,23,42,0.92);
            color: #f8fafc;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            font-size: 12px;
          }
          td {
            color: rgba(226,232,240,0.85);
          }
          .empty {
            text-align: center;
            color: rgba(226,232,240,0.65);
          }
          .trend-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 18px;
            margin-top: 12px;
          }
          .trend-card {
            background: rgba(15,23,42,0.82);
            border-radius: 16px;
            padding: 16px;
            border: 1px solid rgba(56,189,248,0.16);
          }
          .trend-card h3 {
            margin: 0 0 12px;
            font-size: 15px;
            color: #38bdf8;
          }
          .trend-chart {
            display: flex;
            gap: 12px;
            align-items: flex-end;
          }
          .trend-point {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
          }
          .trend-bar {
            width: 22px;
            background: linear-gradient(180deg, rgba(56,189,248,0.85), rgba(14,116,144,0.85));
            border-radius: 12px 12px 4px 4px;
          }
          .trend-value {
            font-size: 12px;
            color: #f8fafc;
            font-weight: 600;
          }
          .trend-label {
            font-size: 11px;
            color: rgba(226,232,240,0.7);
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>

        <div class="cards">
          <div class="card">
            <h3>${escapeHtml(language === 'en' ? 'Base data' : 'Datos base')}</h3>
            <p>${escapeHtml(language === 'en' ? 'Height' : 'Estatura')}: ${escapeHtml(
              baseStats.height ? `${baseStats.height} cm` : '--'
            )}</p>
            <p>${escapeHtml(language === 'en' ? 'Start weight' : 'Peso inicial')}: ${escapeHtml(
              baseStats.startWeight ? `${baseStats.startWeight} kg` : '--'
            )}</p>
            <p>${escapeHtml(language === 'en' ? 'Age' : 'Edad')}: ${escapeHtml(
              baseStats.age ? String(baseStats.age) : '--'
            )}</p>
          </div>
          <div class="card">
            <h3>${escapeHtml(language === 'en' ? 'Current metrics' : 'Métricas actuales')}</h3>
            <p>% ${escapeHtml(
              language === 'en' ? 'Body fat' : 'Grasa'
            )}: ${escapeHtml(formatNumber(metricsSummary.bodyFat, 1))}</p>
            <p>BMR: ${escapeHtml(
              metricsSummary.bmr ? `${metricsSummary.bmr} kcal` : '--'
            )}</p>
            <p>${escapeHtml(
              language === 'en' ? 'Recommended kcal' : 'Calorías recomendadas'
            )}: ${escapeHtml(
              metricsSummary.recommendedCalories
                ? `${metricsSummary.recommendedCalories}`
                : '--'
            )}</p>
            <p>${escapeHtml(language === 'en' ? 'BMI' : 'IMC')}: ${escapeHtml(
              metricsSummary.bmi
                ? `${metricsSummary.bmi} ${metricsSummary.bmiCategory ? `(${metricsSummary.bmiCategory})` : ''}`
                : '--'
            )}</p>
          </div>
          <div class="card">
            <h3>${escapeHtml(language === 'en' ? 'Hydration' : 'Hidratación')}</h3>
            <p>${escapeHtml(
              language === 'en' ? 'Days on target' : 'Días en objetivo'
            )}: ${escapeHtml(String(hydrationScope.daysWithWater || 0))}</p>
            <p>${escapeHtml(language === 'en' ? 'Total water' : 'Agua total')}: ${escapeHtml(
              hydrationScope.totalMl ? `${hydrationScope.totalMl} ml` : '0 ml'
            )}</p>
            <p>${escapeHtml(language === 'en' ? 'Avg body fat' : 'Promedio de grasa')}: ${escapeHtml(
              formatNumber(avgBodyFat, 1)
            )} %</p>
          </div>
          <div class="card">
            <h3>${escapeHtml(language === 'en' ? 'Energy & training' : 'Energía y entrenos')}</h3>
            <p>${escapeHtml(language === 'en' ? 'Avg energy' : 'Energía promedio')}: ${escapeHtml(
              formatNumber(avgEnergy, 0)
            )}/10</p>
            <p>${escapeHtml(language === 'en' ? 'Workout days' : 'Días con entreno')}: ${escapeHtml(
              String(exerciseScope.daysLogged || 0)
            )}</p>
            <p>${escapeHtml(language === 'en' ? 'Kcal burned' : 'Kcal quemadas')}: ${escapeHtml(
              exerciseScope.totalKcal ? `${exerciseScope.totalKcal}` : '0'
            )}</p>
            <p>${escapeHtml(language === 'en' ? 'Avg weight' : 'Peso promedio')}: ${escapeHtml(
              formatNumber(avgWeight, 1)
            )} kg</p>
          </div>
        </div>

        ${trends ? `<div class="trend-grid">${trends}</div>` : ''}

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(language === 'en' ? 'Day' : 'Día')}</th>
              <th>${escapeHtml(language === 'en' ? 'Weight' : 'Peso')}</th>
              <th>${escapeHtml(language === 'en' ? 'Waist' : 'Cintura')}</th>
              <th>${escapeHtml(language === 'en' ? 'Body fat' : '% Grasa')}</th>
              <th>${escapeHtml(language === 'en' ? 'Energy' : 'Energía')}</th>
              <th>${escapeHtml(language === 'en' ? 'Water' : 'Agua')}</th>
              <th>${escapeHtml(language === 'en' ? 'Calories' : 'Calorías')}</th>
              <th>${escapeHtml(language === 'en' ? 'Notes' : 'Notas')}</th>
            </tr>
          </thead>
          <tbody>
            ${dayRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  return await sharePdfFile({
    html,
    language,
    shareTitle:
      scope === 'plan'
        ? language === 'en'
          ? 'Share full progress PDF'
          : 'Compartir PDF de progreso total'
        : language === 'en'
        ? 'Share weekly progress PDF'
        : 'Compartir PDF de progreso semanal'
  });
};

export default exportWeekPlanPdf;

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getDayData } from '../storage/storage';
import { getDayDisplayName } from './labels';

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

export const exportWeekPlanPdf = async ({
  weekNumber = 1,
  derivedPlan = [],
  language = 'es',
  waterGoal = 2400
}) => {
  const totalDays = Array.isArray(derivedPlan) ? derivedPlan.length : 0;
  const safeWeek = Number.isFinite(Number(weekNumber)) ? Number(weekNumber) : 1;
  const startIndex = Math.max(0, (safeWeek - 1) * 7);
  const endIndex = totalDays > 0 ? Math.min(safeWeek * 7, totalDays) : 0;
  const normalizedWaterGoal = Number(waterGoal) || 2400;

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
      const merged = { ...base, ...override };

      const dayTitle = getDayDisplayName({
        label: merged.dia || base?.dia,
        index,
        language
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

      dayBlocks.push({
        title: dayTitle,
        kcal: merged.kcal || base.kcal || 0,
        macros: macroLine,
        meals
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
          </div>
          ${mealHtml}
        </section>
      `;
    })
    .join('');

  const subtitle = language === 'en'
    ? 'Weekly keto meals, macros and notes'
    : 'Comidas keto semanales, macros y notas';

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
        </div>
        ${daysHtml}
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  let shared = false;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: language === 'en' ? 'Share weekly PDF' : 'Compartir PDF semanal',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf'
    });
    shared = true;
  }

  return { uri, shared, html };
};

export default exportWeekPlanPdf;

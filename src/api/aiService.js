import axios from 'axios';
import { getApiConfig } from './config';

class AIService {
  constructor() {
    const config = getApiConfig();
    this.client = axios.create(config);
  }

  /**
   * Genera una comida usando IA
   */
  async generateMeal({ mealType, kcal, language, preferences, credentials }) {
    const { like, dislike } = preferences;
    const { user, pass } = credentials;

    const mealNames = {
      desayuno: { es: 'desayuno', en: 'breakfast' },
      almuerzo: { es: 'almuerzo', en: 'lunch' },
      cena: { es: 'cena', en: 'dinner' }
    };

    const mealName = mealNames[mealType]?.[language] || mealType;

    const prompt = language === 'en'
      ? `Create 1 keto ${mealName} keeping about ${kcal} kcal. Prefer: ${like}. Avoid: ${dislike}. Respond ONLY as JSON with keys: "nombre" (short dish name), "ingredientes" (array of strings like "150 g chicken", "40 g broccoli", "1/2 avocado"), "descripcion" (very short sentence).`
      : `Genera 1 ${mealName} keto manteniendo cerca de ${kcal} kcal. Prefiere: ${like}. Evita: ${dislike}. Responde SOLO en JSON con las claves: "nombre" (nombre corto del plato), "ingredientes" (array de strings tipo "150 g pollo", "40 g brócoli", "1/2 aguacate"), "descripcion" (frase muy corta).`;

    try {
      const response = await this.client.post('', {
        prompt,
        user,
        pass,
        mode: mealType,
        lang: language
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'AI did not respond');
      }

      return this.parseMealResponse(response.data);
    } catch (error) {
      console.error('Error generating meal:', error);
      throw error;
    }
  }

  /**
   * Genera un día completo con IA
   */
  async generateFullDay({ dayIndex, kcal, language, preferences, credentials, username }) {
    const { like, dislike } = preferences;
    const { user, pass } = credentials;

    const payload = {
      mode: 'full-day',
      lang: language,
      user,
      pass,
      kcal,
      prefs: { like, dislike },
      dayIndex: dayIndex + 1,
      username
    };

    try {
      const response = await this.client.post('', payload);

      if (!response.data.ok) {
        throw new Error(response.data.error || 'AI did not respond');
      }

      return this.parseFullDayResponse(response.data);
    } catch (error) {
      console.error('Error generating full day:', error);
      throw error;
    }
  }

  /**
   * Genera entreno con IA
   */
  async generateWorkout({
    dayIndex,
    weekNumber,
    intensity,
    language,
    credentials,
    userStats
  }) {
    const { user, pass } = credentials;
    const { height, weight, age } = userStats;

    const intensityMap = {
      soft: language === 'en'
        ? 'light 20-25 min, mobility, stretching, low impact, bodyweight only, no equipment'
        : 'suave 20-25 min, movilidad, estiramientos, bajo impacto, solo peso corporal, sin equipos',
      medium: language === 'en'
        ? 'moderate 30-35 min, functional spartan style, bodyweight only, no equipment'
        : 'moderado 30-35 min, estilo funcional tipo Sparta, solo peso corporal, sin equipos',
      hard: language === 'en'
        ? 'hard 45-50 min, spartan style, high intensity, bodyweight only, no equipment'
        : 'intenso 45-50 min, estilo Sparta, alta intensidad, solo peso corporal, sin equipos'
    };

    const prompt = language === 'en'
      ? `Return a JSON with field "ejercicios" for day ${dayIndex + 1} (week ${weekNumber}) of a ${intensityMap[intensity]}. This must be a bodyweight-only workout, no equipment. User data: height ${height} cm, weight ${weight} kg, age ${age}. Each item: {"nombre": short name, "series": "3 x 12" or time, "descripcion": very short tip}. English.`
      : `Devuelve un JSON con campo "ejercicios" para el día ${dayIndex + 1} (semana ${weekNumber}) de un entreno ${intensityMap[intensity]}. Debe ser SOLO con peso corporal, sin equipos. Datos usuario: estatura ${height} cm, peso ${weight} kg, edad ${age}. Cada ítem: {"nombre": nombre corto, "series": "3 x 12" o tiempo, "descripcion": tip muy corto}. Español.`;

    try {
      const response = await this.client.post('', {
        mode: 'workout-day',
        user,
        pass,
        lang: language,
        prompt
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'AI did not respond');
      }

      return this.parseWorkoutResponse(response.data, language);
    } catch (error) {
      console.error('Error generating workout:', error);
      throw error;
    }
  }

  async generateWeekReview({ weekNumber, days, language, credentials }) {
    const { user, pass } = credentials;
    const safeDays = Array.isArray(days) ? days : [];

    const prompt = language === 'en'
      ? `You will receive a 7-day keto plan. Analyze consistency, days that deviated, and 1 recommendation for next week. Return exactly 3 short sections: 1) Consistency, 2) Deviations, 3) Recommendation. Here is the week: ${JSON.stringify(safeDays)}`
      : `Vas a recibir un plan keto de 7 días. Analiza: 1) qué tan consistente fue, 2) qué días se desviaron, 3) una recomendación para la siguiente semana. Devuélvelo en 3 secciones cortas con título. Semana: ${JSON.stringify(safeDays)}`;

    try {
      const response = await this.client.post('', {
        mode: 'review-week',
        user,
        pass,
        lang: language,
        prompt
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'AI did not respond');
      }

      const raw = (response.data.text || '').replace(/\*/g, '').replace(/###\s*/g, '').trim();
      const items = raw
        .split(/\n+/)
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 4);

      return {
        items,
        raw
      };
    } catch (error) {
      console.error('Error generating week review:', error);
      throw error;
    }
  }

  async generateShoppingList({ weekNumber, days, language, credentials }) {
    const { user, pass } = credentials;
    const safeDays = Array.isArray(days) ? days : [];

    const prompt = language === 'en'
      ? `You will receive 7 keto days with ingredients and quantities. Condense all ingredients into 1 clean shopping list in English, grouped by sections (Protein, Veggies, Dairy/Fats, Pantry/Other). Merge similar items and sum quantities approximately. Keep it short. Here is the week: ${JSON.stringify(safeDays)}`
      : `Recibirás 7 días keto con ingredientes y cantidades. Condénsalos en 1 sola lista de compras en español, agrupada por secciones (Proteínas, Verduras, Lácteos/Grasas, Despensa/Otros). Une ítems parecidos y suma cantidades aproximadas. Sé breve. Semana: ${JSON.stringify(safeDays)}`;

    try {
      const response = await this.client.post('', {
        mode: 'shopping-week',
        user,
        pass,
        lang: language,
        prompt,
        week: weekNumber
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'AI did not respond');
      }

      return (response.data.text || '').replace(/\*/g, '').trim();
    } catch (error) {
      console.error('Error generating shopping list:', error);
      throw error;
    }
  }

  /**
   * Revisa un día con IA
   */
  async reviewDay({ dayData, language, credentials }) {
    const { user, pass } = credentials;

    const prompt = language === 'en'
      ? `You are reviewing a keto day. User has: breakfast "${dayData.desayuno?.nombre}", lunch "${dayData.almuerzo?.nombre}", dinner "${dayData.cena?.nombre}". Calories target: ${dayData.kcal}. Tell in 3 bullet points: (1) is it too fatty?, (2) is protein ok?, (3) 1 small tip. Keep it short.`
      : `Estás revisando un día keto. El usuario tiene: desayuno "${dayData.desayuno?.nombre}", almuerzo "${dayData.almuerzo?.nombre}", cena "${dayData.cena?.nombre}". Meta calórica: ${dayData.kcal}. Responde en 3 bullets: (1) si está muy graso, (2) si la proteína está ok, (3) 1 tip corto.`;

    try {
      const response = await this.client.post('', {
        mode: 'review-day',
        user,
        pass,
        lang: language,
        prompt
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'AI did not respond');
      }

      return this.parseReviewResponse(response.data.text, language);
    } catch (error) {
      console.error('Error reviewing day:', error);
      throw error;
    }
  }

  // Helpers para parsear respuestas
  parseMealResponse(data) {
    let parsed = null;

    if (data.structured) {
      parsed = data.structured;
    } else if (data.text) {
      try {
        parsed = JSON.parse(data.text.trim());
      } catch (e) {
        // Intentar extraer JSON del texto
        const match = data.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (e2) {}
        }
      }
    }

    if (!parsed) {
      throw new Error('Could not parse meal response');
    }

    return {
      nombre: parsed.nombre || parsed.name || '',
      qty: Array.isArray(parsed.ingredientes) 
        ? parsed.ingredientes.join(', ')
        : Array.isArray(parsed.ingredients)
        ? parsed.ingredients.join(', ')
        : '',
      note: parsed.descripcion || parsed.description || parsed.desc || '',
      isAI: true
    };
  }

  parseFullDayResponse(data) {
    let structured = null;

    if (data.structured) {
      structured = data.structured;
    } else if (data.text) {
      try {
        structured = JSON.parse(data.text);
      } catch (e) {}
    }

    if (!structured) {
      throw new Error('Could not parse full day response');
    }

    return {
      kcal: structured.kcal,
      macros: structured.macros,
      desayuno: structured.desayuno,
      snackAM: structured.snackAM,
      almuerzo: structured.almuerzo,
      snackPM: structured.snackPM,
      cena: structured.cena,
      isAI: true
    };
  }

  parseWorkoutResponse(data, language) {
    let workouts = [];

    if (data.structured && Array.isArray(data.structured.ejercicios)) {
      workouts = data.structured.ejercicios;
    } else {
      // Intentar parsear del texto
      const rawText = data.text || '';
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed && Array.isArray(parsed.ejercicios)) {
            workouts = parsed.ejercicios;
          }
        } catch (e) {}
      }
    }

    return workouts.map(w => ({
      nombre: w.nombre || w.name || '',
      series: w.series || w.reps || (language === 'en' ? '3 sets' : '3 series'),
      descripcion: w.descripcion || w.desc || ''
    })).slice(0, 6);
  }

  parseReviewResponse(text, language) {
    const clean = (text || '').replace(/\*/g, '').trim();
    let parts = clean.split(/\n| - |\u2022/g).map(t => t.trim()).filter(Boolean);
    parts = parts.slice(0, 3);

    if (!parts.length) {
      parts = [clean];
    }

    const labels = language === 'en' 
      ? ['Fat', 'Protein', 'Tip']
      : ['Grasa', 'Proteína', 'Tip'];

    return parts.map((txt, i) => ({
      label: labels[i] || (language === 'en' ? 'Note' : 'Nota'),
      text: txt
    }));
  }
}

export default new AIService();

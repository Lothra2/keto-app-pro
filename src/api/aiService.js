import callNetlifyAI from './netlifyClient'
import { stripMarkdownHeadings, sanitizeReviewBullet } from '../utils/labels'

class AIService {
  /**
   * Chat general del Consultor
   * Mantiene credenciales actuales y prueba varios "mode" si el backend no reconoce consultor-chat
   */
  async chat({ prompt, mode = 'auto', language = 'es', credentials, context = {}, history = [] }) {
    const { user, pass } = credentials || {}

    const systemEs =
      'Eres un experto en nutrición keto balanceada y entrenador de calistenia con 20 años de experiencia. Da respuestas claras, accionables y seguras. Puedes proponer planes, recetas y entrenos con peso corporal. Advierte riesgos si aplica. Tono simple y directo.'
    const systemEn =
      'You are an expert in balanced keto nutrition and a calisthenics coach with 20 years of experience. Give clear, actionable and safe advice. You can propose plans, recipes, and bodyweight workouts. Warn about risks when needed. Simple and direct tone.'

    const routedHint =
      language === 'en'
        ? `User mode: ${mode}. Focus your answer on this area.`
        : `Modo del usuario: ${mode}. Enfoca tu respuesta en esa área.`

    const serializedHistory = (history || [])
      .slice(-6)
      .map((msg) => `${msg.role || 'user'}: ${msg.text || ''}`)
      .join('\n')

    const finalPrompt =
      `${language === 'en' ? systemEn : systemEs}\n${routedHint}\n\n` +
      (serializedHistory ? `Recent chat:\n${serializedHistory}\n\n` : '') +
      `User: ${prompt}\n` +
      `Context: ${JSON.stringify(context || {})}`

    // modos de respaldo si el server no acepta consultor-chat
    const candidates = ['consultor-chat', 'chat', 'general', 'free-chat']

    // campos neutros por si tu función valida existencia de claves
    const baseBody = {
      lang: language,
      prompt: finalPrompt,
      kcal: 0,
      prefs: { like: '', dislike: '' }
    }

    let lastErr = null
    for (const tryMode of candidates) {
      try {
        const data = await callNetlifyAI({
          ...baseBody,
          mode: tryMode,
          user,
          pass
        })
        const text = (data?.text || '').trim()
        return {
          text: text || (language === 'en' ? 'Empty response.' : 'Respuesta vacía.'),
          raw: data
        }
      } catch (e) {
        const status = e?.response?.status
        if (status === 401 || status === 400 || status === 404) {
          lastErr = e
          continue
        }
        lastErr = e
        break
      }
    }

    if (lastErr?.response?.status === 401) {
      return {
        text:
          language === 'en'
            ? 'Unauthorized for chat mode. Check allowed modes on your Netlify function.'
            : 'No autorizado para el modo de chat. Revisa los modos permitidos en tu función de Netlify.'
      }
    }

    throw lastErr || new Error('Chat failed')
  }

  /**
   * Genera imagen con IA para el Consultor
   * Prueba varios "mode" comunes: image, image-gen, generate-image
   * Devuelve { imageUrl } o { base64 }
   */
  async generateImage({ prompt, language = 'es', credentials, size = '1024x1024' }) {
    const { user, pass } = credentials || {}

    const system =
      language === 'en'
        ? 'Generate a clean, realistic image aligned with keto, health, or calisthenics. No text overlays. Good lighting.'
        : 'Genera una imagen limpia y realista alineada con keto, salud o calistenia. Sin textos en la imagen. Buena iluminación.'

    const candidates = ['consultor-image', 'image', 'image-gen', 'generate-image']

    let lastErrorMessage = ''

    for (const tryMode of candidates) {
      try {
        const data = await callNetlifyAI({
          mode: tryMode,
          user,
          pass,
          lang: language,
          prompt: `${system}\n\nUser request: ${prompt}\nSize: ${size}`,
          size
        })

        if (data?.imageUrl) return { imageUrl: data.imageUrl, meta: data }
        if (data?.url) return { imageUrl: data.url, meta: data }
        if (data?.images && data.images[0]?.url) return { imageUrl: data.images[0].url, meta: data }
        if (data?.base64 || data?.imageBase64) {
          const b64 = data.imageBase64 || data.base64
          return { base64: b64, meta: data }
        }
      } catch (e) {
        const status = e?.response?.status
        const message = e?.response?.data?.error || e.message || ''

        if (status === 401 || status === 400 || status === 404) {
          lastErrorMessage = message
          continue
        }

        if (!status && message) {
          lastErrorMessage = message
          continue
        }
        throw e
      }
    }

    return {
      error:
        lastErrorMessage ||
        (language === 'en'
          ? 'We could not create the image with the current configuration.'
          : 'No pudimos crear la imagen con la configuración actual.')
    }
  }

  /**
   * Genera una comida usando IA
   */
  async generateMeal({
    mealType,
    kcal,
    language,
    preferences,
    credentials,
    existingMeals = []
  }) {
    const { like, dislike } = preferences || {}
    const { user, pass } = credentials || {}

    const mealNames = {
      desayuno: { es: 'desayuno', en: 'breakfast' },
      almuerzo: { es: 'almuerzo', en: 'lunch' },
      cena: { es: 'cena', en: 'dinner' },
      snackAM: { es: 'snack de la mañana', en: 'morning snack' },
      snackPM: { es: 'snack de la tarde', en: 'afternoon snack' }
    }

    const mealName = mealNames[mealType]?.[language] || mealType
    const usedList = existingMeals.length ? existingMeals.join(', ') : 'ninguna'
    const variationTag = Date.now()

    // lo que más se repite, lo baneamos fuerte
    const hardBannedEs = [
      'yogur griego',
      'yogur griego con nueces',
      'ensalada de pollo',
      'salmón al horno',
      'tortilla de espinaca'
    ]
    const hardBannedEn = [
      'greek yogurt',
      'greek yogurt with nuts',
      'chicken salad',
      'baked salmon',
      'spinach omelette'
    ]

    const snackHintEs =
      'Si es snack, devuelve máximo 2 ítems claros. Ejemplo: "120 g yogur griego, 20 g nueces" o "1 huevo duro, 30 g queso". No devuelvas solo gramos.'
    const snackHintEn =
      'If meal is a snack, return max 2 clear items, e.g. "120 g Greek yogurt, 20 g nuts" or "1 boiled egg, 30 g cheese". Do not return only grams.'

    const lightMealsHintEs =
      'Desayuno y cena deben ser ligeros, fáciles de digerir, máximo 20-25 min de preparación. Evita guisos pesados o porciones muy grandes.'
    const lightMealsHintEn =
      'Breakfast and dinner must stay light and easy to digest, max 20-25 min prep. Avoid heavy stews or oversized portions.'

    const isSnack = mealType === 'snackAM' || mealType === 'snackPM'

    const prompt =
      language === 'en'
        ? `You are a keto nutrition planner.
Create ONE ${mealName} of about ${kcal} kcal.
Meals already used today (do NOT repeat or make something very similar): ${usedList}.
Absolutely avoid repeating these very common keto meals TODAY: ${hardBannedEn.join(', ')}.
Rotate the base: eggs, dairy, meat, canned protein, cold cuts, vegetables. Do NOT always choose dairy or yogurt.
Prefer: ${like || 'none'}. Avoid: ${dislike || 'none'}.
${isSnack ? snackHintEn : lightMealsHintEn}
Randomness seed: ${variationTag}. Make it a bit different from typical outputs.
Respond ONLY as JSON:
{
  "nombre": "short dish name",
  "qty": "ingredients with quantities, comma separated",
  "kcal": ${kcal},
  "descripcion": "short tip about the meal",
  "isAI": true
}`
        : `Eres un planificador de dieta keto.
Genera 1 ${mealName} de unas ${kcal} kcal.
Comidas ya usadas hoy (NO las repitas ni hagas algo muy parecido): ${usedList}.
Evita repetir HOY estas comidas keto típicas: ${hardBannedEs.join(', ')}.
Rota la base: huevos, lácteos, carne, proteína en lata, fiambres, verduras. No elijas siempre lácteos o yogur.
Prefiere: ${like || 'ninguna'}. Evita: ${dislike || 'ninguna'}.
${isSnack ? snackHintEs : lightMealsHintEs}
Semilla aleatoria: ${variationTag}. Hazlo distinto a ejemplos típicos.
Responde SOLO en JSON:
{
  "nombre": "nombre corto del plato",
  "qty": "ingredientes con cantidades, separada por comas",
  "kcal": ${kcal},
  "descripcion": "frase corta con tip de la comida",
  "isAI": true
}`

    try {
      const data = await callNetlifyAI({
        prompt,
        user,
        pass,
        mode: mealType,
        lang: language,
        kcal,
        prefs: { like, dislike }
      })

      return this.parseMealResponse(data, language)
    } catch (error) {
      console.error('Error generating meal:', error)
      throw error
    }
  }

  async estimateCheatCalories({
    mealKey = 'cena',
    description = '',
    portion = '',
    language = 'es',
    credentials,
    dayKcal,
    consumedKcal,
  }) {
    const { user, pass } = credentials || {}
    const normalizeNote = (rawNote) => {
      if (!rawNote) return ''

      const raw = String(rawNote).trim()
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
      const inner = fenced ? fenced[1].trim() : raw

      try {
        const parsed = JSON.parse(inner)
        if (parsed?.note) return String(parsed.note).trim()
      } catch (_) {
        // ignore JSON parsing errors for free-form notes
      }

      return inner.replace(/^json\s*/i, '').trim()
    }
    const mealNames = {
      desayuno: language === 'en' ? 'breakfast' : 'desayuno',
      snackAM: language === 'en' ? 'morning snack' : 'snack de la mañana',
      almuerzo: language === 'en' ? 'lunch' : 'almuerzo',
      snackPM: language === 'en' ? 'afternoon snack' : 'snack de la tarde',
      cena: language === 'en' ? 'dinner' : 'cena',
    }

    const safety =
      language === 'en'
        ? 'Estimate realistic kcal for the described cheat meal and portion. Use typical keto macros, avoid overestimating. Respond ONLY as JSON with fields {"kcal": number, "note": "short reason"}. If data is unclear, give your best realistic guess between 120 and 950 kcal.'
        : 'Estima kcal realistas para el cheat descrito y la porción. Usa macros keto típicos y evita sobreestimar. Responde SOLO en JSON con campos {"kcal": número, "note": "razón breve"}. Si falta info, devuelve tu mejor estimación entre 120 y 950 kcal.'

    const prompt = `${safety}\n\nMeal: ${mealNames[mealKey] || mealKey}.\nDescription: ${description}\nPortion: ${portion || 'sin porción declarada'}.\nPlanned day kcal: ${dayKcal || 'n/d'}.\nMeals already consumed: ${consumedKcal || 0} kcal.`

    const candidates = ['cheat-kcal', 'nutrition-kcal', 'meal-kcal', 'chat']
    let lastErr = null
    for (const mode of candidates) {
      try {
        const data = await callNetlifyAI({
          mode,
          user,
          pass,
          lang: language,
          prompt,
        })

        const raw = data?.text || ''
        try {
          const parsed = JSON.parse(raw)
          const kcal = Number(parsed?.kcal)
          if (Number.isFinite(kcal) && kcal > 0) {
            return { kcalEstimate: Math.round(kcal), note: normalizeNote(parsed?.note || '') }
          }
        } catch (jsonErr) {
          const match = raw.match(/(\d{2,4})/) || []
          const kcal = Number(match[1])
          if (Number.isFinite(kcal) && kcal > 0) {
            return { kcalEstimate: Math.round(kcal), note: normalizeNote(raw) }
          }
          lastErr = jsonErr
          continue
        }
      } catch (error) {
        const status = error?.response?.status
        if (status === 401 || status === 400 || status === 404) {
          lastErr = error
          continue
        }
        lastErr = error
        break
      }
    }

    console.error('Error estimating cheat kcal:', lastErr)
    throw lastErr || new Error('Cheat kcal estimation failed')
  }

  async estimateMealCalories({
    mealKey = 'cena',
    description = '',
    portion = '',
    language = 'es',
    credentials,
    dayKcal,
    consumedKcal,
  }) {
    const { user, pass } = credentials || {}
    const normalizeNote = (rawNote) => {
      if (!rawNote) return ''

      const raw = String(rawNote).trim()
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
      const inner = fenced ? fenced[1].trim() : raw

      try {
        const parsed = JSON.parse(inner)
        if (parsed?.note) return String(parsed.note).trim()
      } catch (_) {
        // ignore JSON parsing errors for free-form notes
      }

      return inner.replace(/^json\s*/i, '').trim()
    }

    const mealNames = {
      desayuno: language === 'en' ? 'breakfast' : 'desayuno',
      snackAM: language === 'en' ? 'morning snack' : 'snack de la mañana',
      almuerzo: language === 'en' ? 'lunch' : 'almuerzo',
      snackPM: language === 'en' ? 'afternoon snack' : 'snack de la tarde',
      cena: language === 'en' ? 'dinner' : 'cena',
    }

    const safety =
      language === 'en'
        ? 'Estimate realistic kcal for this meal based on the description and portion. Keep it keto-friendly and avoid extreme guesses. Reply ONLY as JSON with {"kcal": number, "note": "short reason"}. If unclear, return your best guess between 90 and 1200 kcal.'
        : 'Estima kcal realistas para esta comida según la descripción y la porción. Manténlo keto y evita extremos. Responde SOLO en JSON con {"kcal": número, "note": "razón breve"}. Si no es claro, devuelve tu mejor estimación entre 90 y 1200 kcal.'

    const prompt = `${safety}\n\nMeal: ${mealNames[mealKey] || mealKey}.\nDescription: ${description}\nPortion: ${portion || 'sin porción declarada'}.\nPlanned day kcal: ${dayKcal || 'n/d'}.\nMeals already consumed: ${consumedKcal || 0} kcal.`

    const candidates = ['nutrition-kcal', 'meal-kcal', 'cheat-kcal', 'chat']
    let lastErr = null

    for (const mode of candidates) {
      try {
        const data = await callNetlifyAI({
          mode,
          user,
          pass,
          lang: language,
          prompt,
        })

        const raw = data?.text || ''
        try {
          const parsed = JSON.parse(raw)
          const kcal = Number(parsed?.kcal)
          if (Number.isFinite(kcal) && kcal > 0) {
            return { kcalEstimate: Math.round(kcal), note: normalizeNote(parsed?.note || '') }
          }
        } catch (jsonErr) {
          const match = raw.match(/(\d{2,4})/) || []
          const kcal = Number(match[1])
          if (Number.isFinite(kcal) && kcal > 0) {
            return { kcalEstimate: Math.round(kcal), note: normalizeNote(raw) }
          }
          lastErr = jsonErr
          continue
        }
      } catch (error) {
        const status = error?.response?.status
        if (status === 401 || status === 400 || status === 404) {
          lastErr = error
          continue
        }
        lastErr = error
        break
      }
    }

    console.error('Error estimating meal kcal:', lastErr)
    throw lastErr || new Error('Meal kcal estimation failed')
  }

  /**
   * Genera un día completo con IA
   */
  async generateFullDay({
    dayIndex,
    kcal,
    language,
    preferences,
    credentials,
    username,
    recentMeals = []
  }) {
    const { like, dislike } = preferences || {}
    const { user, pass } = credentials || {}
    const variationTag = `day-${dayIndex + 1}-${Date.now()}`
    const recentList =
      Array.isArray(recentMeals) && recentMeals.length
        ? recentMeals.join(', ')
        : 'ninguna'

    // tema del día para obligar variedad
    const dayThemesEs = [
      'usa más huevos y aguacate, evita lácteos',
      'usa pollo o pavo, pocas nueces',
      'usa atún o pescado, incluye verduras bajas en carbohidratos',
      'usa cerdo o res magra, poco queso',
      'usa ensaladas completas con proteína',
      'usa preparaciones calientes tipo salteado',
      'usa opciones frías tipo bowl'
    ]
    const dayThemesEn = [
      'use more eggs and avocado, avoid dairy',
      'use chicken or turkey, few nuts',
      'use tuna or fish, include low carb veggies',
      'use pork or lean beef, little cheese',
      'use full salads with protein',
      'use warm stir fry style meals',
      'use cold bowl style meals'
    ]
    const dayTheme =
      language === 'en'
        ? dayThemesEn[dayIndex % dayThemesEn.length]
        : dayThemesEs[dayIndex % dayThemesEs.length]

    const hardBannedEs = [
      'yogur griego',
      'yogur griego con nueces',
      'tortilla de espinaca',
      'ensalada de pollo',
      'salmón al horno',
      'huevos revueltos con aguacate'
    ]
    const hardBannedEn = [
      'greek yogurt',
      'greek yogurt with nuts',
      'spinach omelette',
      'chicken salad',
      'baked salmon',
      'scrambled eggs with avocado'
    ]

    const prompt =
      language === 'en'
        ? `You are a keto nutrition planner.
Create a full keto day with ${kcal} kcal total, distributed like this:
- desayuno 25% (light, quick to digest)
- snackAM 10%
- almuerzo 35% (heavier, most complex meal)
- snackPM 10%
- cena 20%

Very important, variety between days. Do not repeat meals used in the last days: ${recentList}.
Also avoid these overused keto meals for this user today: ${hardBannedEn.join(', ')}.
User likes: ${like || 'none'}.
User dislikes: ${dislike || 'none'}.
Today theme, follow it: ${dayTheme}.
Breakfast and dinner must be light and simple, no heavy sauces or big stews. Snacks must have real foods, not only grams and stay under 2 items.
Calculate kcal for each meal from the total. Keep each meal close to its share and keep breakfast/dinner portions easy to digest.
Respond ONLY in JSON:
{
  "desayuno": { "nombre": "short breakfast name", "qty": "ingredients with quantities", "kcal": number, "isAI": true },
  "snackAM": { "nombre": "Morning snack", "qty": "ingredients with quantities", "kcal": number, "isAI": true },
  "almuerzo": { "nombre": "short lunch name", "qty": "ingredients with quantities", "kcal": number, "isAI": true },
  "snackPM": { "nombre": "Afternoon snack", "qty": "ingredients with quantities", "kcal": number, "isAI": true },
  "cena": { "nombre": "short dinner name", "qty": "ingredients with quantities", "kcal": number, "isAI": true },
  "totalKcal": ${kcal}
}`
        : `Eres un nutricionista keto.
Genera un día completo keto con ${kcal} kcal totales distribuidas así:
- desayuno 25 % (ligero, fácil de digerir)
- snackAM 10 %
- almuerzo 35 % (más completo del día)
- snackPM 10 %
- cena 20 %

Muy importante, variedad entre días. No repitas comidas usadas en los últimos días: ${recentList}.
Evita también estas comidas muy usadas para este usuario hoy: ${hardBannedEs.join(', ')}.
Preferencias del usuario, incluye en lo posible: ${like || 'ninguna'}.
Cosas que el usuario no quiere, no las pongas: ${dislike || 'ninguna'}.
Tema del día, síguelo: ${dayTheme}.
Desayuno y cena deben ser livianos y simples, sin salsas pesadas ni guisos grandes. Los snacks deben tener alimentos reales, no solo gramos y máximo 2 ítems.
Calcula las kcal desde el total y mantén cada comida cerca de su porcentaje, dejando desayuno y cena fáciles de digerir.
Responde SOLO en JSON:
{
  "desayuno": { "nombre": "Desayuno keto", "qty": "ingredientes con cantidades", "kcal": número, "isAI": true },
  "snackAM": { "nombre": "Snack mañana", "qty": "ingredientes con cantidades", "kcal": número, "isAI": true },
  "almuerzo": { "nombre": "Almuerzo keto", "qty": "ingredientes con cantidades", "kcal": número, "isAI": true },
  "snackPM": { "nombre": "Snack tarde", "qty": "ingredientes con cantidades", "kcal": número, "isAI": true },
  "cena": { "nombre": "Cena keto", "qty": "ingredientes con cantidades", "kcal": número, "isAI": true },
  "totalKcal": ${kcal}
}`

    try {
      const data = await callNetlifyAI({
        mode: 'full-day',
        lang: language,
        user,
        pass,
        kcal,
        prefs: { like, dislike },
        dayIndex: dayIndex + 1,
        username,
        prompt
      })

      return this.parseFullDayResponse(data, language)
    } catch (error) {
      console.error('Error generating full day:', error)
      throw error
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
    const { user, pass } = credentials || {}
    const { height, weight, age } = userStats || {}

    const intensityMap = {
      soft:
        language === 'en'
          ? 'light 20-25 min, mobility, stretching, low impact, bodyweight only, no equipment'
          : 'suave 20-25 min, movilidad, estiramientos, bajo impacto, solo peso corporal, sin equipos',
      medium:
        language === 'en'
          ? 'moderate 30-35 min, functional spartan style, bodyweight only, no equipment'
          : 'moderado 30-35 min, estilo funcional tipo Sparta, solo peso corporal, sin equipos',
      hard:
        language === 'en'
          ? 'hard 45-50 min, spartan style, high intensity, bodyweight only, no equipment'
          : 'intenso 45-50 min, estilo Sparta, alta intensidad, solo peso corporal, sin equipos'
    }

    const prompt =
      language === 'en'
        ? `Return a JSON with field "ejercicios" for day ${dayIndex + 1} (week ${weekNumber}) of a ${intensityMap[intensity]}. This must be a bodyweight-only workout, no equipment. User data: height ${height} cm, weight ${weight} kg, age ${age}. Each item must include: {"nombre": short name, "series": "3 x 12" or time, "descripcion": concise how-to, "detalle": 2 technique cues and breathing, "errores": common mistakes, "regresion": easy regression, "progresion": harder option}. Keep descriptions short (max 25 words) and return 5-7 exercises. English. Respond ONLY in JSON.`
        : `Devuelve un JSON con campo "ejercicios" para el día ${dayIndex + 1} (semana ${weekNumber}) de un entreno ${intensityMap[intensity]}. Debe ser SOLO con peso corporal, sin equipos. Datos usuario: estatura ${height} cm, peso ${weight} kg, edad ${age}. Cada ítem incluye: {"nombre": nombre corto, "series": "3 x 12" o tiempo, "descripcion": cómo hacerlo en breve, "detalle": 2 cues técnicos y respiración, "errores": errores comunes, "regresion": versión fácil, "progresion": versión difícil}. Sé breve (máx 25 palabras) y devuelve 5-7 ejercicios. Español. Responde SOLO en JSON.`

    const candidates = ['workout-day', 'workout', 'workout-plan', 'workouts', 'fitness']
    let lastErr = null

    for (const mode of candidates) {
      try {
        const data = await callNetlifyAI({
          mode,
          user,
          pass,
          lang: language,
          prompt
        })

        const parsed = this.parseWorkoutResponse(data, language)
        if (parsed.length) {
          return parsed
        }
        lastErr = new Error('Empty workout list')
      } catch (error) {
        const status = error?.response?.status
        if (status === 401 || status === 400 || status === 404) {
          lastErr = error
          continue
        }
        lastErr = error
        break
      }
    }

    console.error('Error generating workout:', lastErr)
    throw lastErr || new Error('Workout generation failed')
  }

  async generateWeekReview({ weekNumber, days, language, credentials }) {
    const { user, pass } = credentials || {}
    const safeDays = Array.isArray(days) ? days : []

    const prompt =
      language === 'en'
        ? `You will receive a 7-day keto plan. Analyze consistency, days that deviated, and 1 recommendation for next week. Return exactly 3 short sections: 1) Consistency, 2) Deviations, 3) Recommendation. Here is the week: ${JSON.stringify(
            safeDays
          )}`
        : `Vas a recibir un plan keto de 7 días. Analiza: 1) qué tan consistente fue, 2) qué días se desviaron, 3) una recomendación para la siguiente semana. Devuélvelo en 3 secciones cortas con título. Semana: ${JSON.stringify(
            safeDays
          )}`

    try {
      const data = await callNetlifyAI({
        mode: 'review-week',
        user,
        pass,
        lang: language,
        prompt
      })

      const raw = (data.text || '').replace(/\*/g, '').replace(/###\s*/g, '').trim()
      const items = raw
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4)

      return {
        items,
        raw
      }
    } catch (error) {
      console.error('Error generating week review:', error)
      throw error
    }
  }

  async generateShoppingList({ weekNumber, days, language, credentials }) {
    const { user, pass } = credentials || {}
    const safeDays = Array.isArray(days) ? days : []

    const prompt =
      language === 'en'
        ? `You will receive 7 keto days with ingredients and quantities. Condense all ingredients into 1 clean shopping list in English, grouped by sections (Protein, Veggies, Dairy/Fats, Pantry/Other). Merge similar items and sum quantities approximately. Keep it short. Here is the week: ${JSON.stringify(
            safeDays
          )}`
        : `Recibirás 7 días keto con ingredientes y cantidades. Condénsalos en 1 sola lista de compras en español, agrupada por secciones (Proteínas, Verduras, Lácteos/Grasas, Despensa/Otros). Une ítems parecidos y suma cantidades aproximadas. Sé breve. Semana: ${JSON.stringify(
            safeDays
          )}`

    try {
      const data = await callNetlifyAI({
        mode: 'shopping-week',
        user,
        pass,
        lang: language,
        prompt,
        week: weekNumber
      })

      const raw = (data.text || '').replace(/\*/g, '').replace(/\r/g, '\n').trim()
      const cleaned = stripMarkdownHeadings(raw)
        .split('\n')
        .map((line) => {
          if (!line.trim()) return ''
          return line.replace(/^[-•]\s*/g, '• ').trim()
        })
        .filter(Boolean)
        .join('\n')
      return cleaned
    } catch (error) {
      console.error('Error generating shopping list:', error)
      throw error
    }
  }

  async reviewDay({ dayData, language, credentials }) {
    const { user, pass } = credentials || {}

    const prompt =
      language === 'en'
        ? `You are reviewing a keto day. User has: breakfast "${dayData.desayuno?.nombre}", lunch "${dayData.almuerzo?.nombre}", dinner "${dayData.cena?.nombre}". Calories target: ${dayData.kcal}. Tell in 3 bullet points: (1) is it too fatty?, (2) is protein ok?, (3) 1 small tip. Keep it short.`
        : `Estás revisando un día keto. El usuario tiene: desayuno "${dayData.desayuno?.nombre}", almuerzo "${dayData.almuerzo?.nombre}", cena "${dayData.cena?.nombre}". Meta calórica: ${dayData.kcal}. Responde en 3 bullets: (1) si está muy graso, (2) si la proteína está ok, (3) 1 tip corto.`

    try {
      const data = await callNetlifyAI({
        mode: 'review-day',
        user,
        pass,
        lang: language,
        prompt
      })

      return this.parseReviewResponse(data.text, language)
    } catch (error) {
      console.error('Error reviewing day:', error)
      throw error
    }
  }

  // Helpers para parsear respuestas
  parseMealResponse(data, language = 'es') {
    let parsed = null

    if (data.structured) {
      parsed = data.structured
    } else if (data.text) {
      try {
        parsed = JSON.parse(data.text.trim())
      } catch (e) {
        const match = data.text.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            parsed = JSON.parse(match[0])
          } catch (e2) {}
        }
      }
    }

    if (!parsed) {
      throw new Error('Could not parse meal response')
    }

    if (
      typeof parsed === 'object' &&
      !parsed.nombre &&
      !parsed.qty &&
      !parsed.ingredientes &&
      Object.keys(parsed).length === 1
    ) {
      const onlyValue = parsed[Object.keys(parsed)[0]]
      if (onlyValue && typeof onlyValue === 'object') {
        parsed = onlyValue
      }
    }

    const defaultNote = language === 'en' ? 'Generated with AI' : 'Generado con IA'

    const buildQty = (obj) => {
      if (!obj) return ''
      if (typeof obj.qty === 'string') return obj.qty
      if (Array.isArray(obj.qty)) return obj.qty.join(', ')
      if (Array.isArray(obj.ingredientes)) return obj.ingredientes.join(', ')
      if (Array.isArray(obj.ingredients)) return obj.ingredients.join(', ')
      return ''
    }

    const rawDesc =
      parsed.descripcion || parsed.description || parsed.desc || defaultNote
    const shortDesc =
      rawDesc.length > 120 ? rawDesc.slice(0, 117).trim() + '…' : rawDesc

    return {
      nombre: parsed.nombre || parsed.name || '',
      qty: buildQty(parsed),
      note: shortDesc,
      kcal: parsed.kcal ? Number(parsed.kcal) : null,
      isAI: true
    }
  }

  parseFullDayResponse(data, language = 'es') {
    let structured = null

    if (data.structured) {
      structured = data.structured
    } else if (data.text) {
      try {
        structured = JSON.parse(data.text)
      } catch (e) {}
    }

    if (!structured) {
      throw new Error('Could not parse full day response')
    }

    const ensureSnackQty = (qty, lang) => {
      if (!qty) {
        return lang === 'en'
          ? '120 g Greek yogurt, 20 g nuts'
          : '120 g yogur griego, 20 g nueces'
      }
      const parts = qty
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      const hasLetters = (str) => /[a-zA-Záéíóúñ]/.test(str)
      const fixed = parts.map((p) => {
        if (hasLetters(p)) return p
        return lang === 'en' ? `${p} of nuts` : `${p} de almendras`
      })
      if (!fixed.length) {
        return lang === 'en'
          ? '120 g Greek yogurt, 20 g nuts'
          : '120 g yogur griego, 20 g nueces'
      }
      return fixed.join(', ')
    }

    const enhanceMeal = (meal, key) => {
      if (!meal || typeof meal !== 'object') return meal

      const base = { ...meal }
      if (!base.nombre && base.name) {
        base.nombre = base.name
      }

      let qty = ''
      if (typeof base.qty === 'string') {
        qty = base.qty
      } else if (Array.isArray(base.qty)) {
        qty = base.qty.join(', ')
      } else if (Array.isArray(base.ingredientes)) {
        qty = base.ingredientes.join(', ')
      } else if (Array.isArray(base.ingredients)) {
        qty = base.ingredients.join(', ')
      }

      if (key === 'snackAM' || key === 'snackPM') {
        base.qty = ensureSnackQty(qty, language)
      } else {
        base.qty = qty
      }

      const defaultNote = language === 'en' ? 'Generated with AI' : 'Generado con IA'

      if (!base.nombre) {
        const names = {
          desayuno: language === 'en' ? 'Keto breakfast' : 'Desayuno keto',
          snackAM: language === 'en' ? 'Morning snack' : 'Snack mañana',
          almuerzo: language === 'en' ? 'Keto lunch' : 'Almuerzo keto',
          snackPM: language === 'en' ? 'Afternoon snack' : 'Snack tarde',
          cena: language === 'en' ? 'Keto dinner' : 'Cena keto'
        }
        base.nombre = names[key] || 'Comida keto'
      }

      return {
        ...base,
        isAI: true,
        kcal: base.kcal ? Number(base.kcal) : null,
        note: base.note || base.descripcion || base.description || base.desc || defaultNote
      }
    }

    const desayuno = enhanceMeal(structured.desayuno, 'desayuno')
    const snackAM = enhanceMeal(structured.snackAM, 'snackAM')
    const almuerzo = enhanceMeal(structured.almuerzo, 'almuerzo')
    const snackPM = enhanceMeal(structured.snackPM, 'snackPM')
    const cena = enhanceMeal(structured.cena, 'cena')

    return {
      kcal: structured.totalKcal || structured.kcal,
      macros: structured.macros,
      desayuno,
      snackAM,
      almuerzo,
      snackPM,
      cena,
      isAI: true
    }
  }

  parseWorkoutResponse(data, language) {
    let workouts = []

    if (data.structured && Array.isArray(data.structured.ejercicios)) {
      workouts = data.structured.ejercicios
    } else {
      const rawText = data.text || ''
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          if (parsed && Array.isArray(parsed.ejercicios)) {
            workouts = parsed.ejercicios
          }
        } catch (e) {}
      }
    }

    return workouts
      .map((w) => {
        const rest = w.descanso || w.rest || w.restTime || w.resting || ''
        const detail = w.detalle || w.detalles || w.detail || w.how || ''
        const breathing = w.respiracion || w.breathing || ''
        const mistakes = w.errores || w.mistakes || ''
        const regression = w.regresion || w.regression || ''
        const progression = w.progresion || w.progression || ''
        const duration = w.duracion || w.tiempo || w.duration || ''
        const notes = w.notas || w.notes || ''

        return {
          nombre: w.nombre || w.name || '',
          series: w.series || w.reps || (language === 'en' ? '3 sets' : '3 series'),
          descripcion: w.descripcion || w.desc || '',
          detalle: detail,
          respiracion: breathing,
          errores: mistakes,
          regresion: regression,
          progresion: progression,
          descanso: rest,
          duracion: duration,
          notas: notes
        }
      })
      .slice(0, 8)
  }

  parseReviewResponse(text, language) {
    const clean = stripMarkdownHeadings((text || '').replace(/\*/g, '').trim())
    let parts = clean
      .split(/\n| - |\u2022/g)
      .map((t) => t.trim())
      .filter(Boolean)
    parts = parts.slice(0, 3)

    if (!parts.length) {
      parts = [clean]
    }

    const labels = language === 'en' ? ['Fat', 'Protein', 'Tip'] : ['Grasa', 'Proteína', 'Tip']

    return parts.map((txt, i) => ({
      label: labels[i] || (language === 'en' ? 'Note' : 'Nota'),
      text: sanitizeReviewBullet(txt)
    }))
  }
}

export default new AIService()

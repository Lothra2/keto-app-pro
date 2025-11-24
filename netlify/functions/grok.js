// netlify/functions/grok.js

// ===== Utils de máscara para logs seguros =====
function mask(v = "") {
  if (!v) return "<empty>";
  if (typeof v !== "string") v = String(v);
  if (v.length <= 2) return "*".repeat(v.length);
  return v[0] + "*".repeat(Math.max(1, v.length - 2)) + v[v.length - 1];
}

// ==== Helpers de AUTH flexible ====
function decodeBasicAuth(headerAuth = "") {
  if (!headerAuth || typeof headerAuth !== "string") return {};
  const raw = headerAuth.startsWith("Basic ") ? headerAuth.slice(6) : headerAuth;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return {};
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return {};
  }
}

function getExpectedCreds() {
  // Acepta cualquiera de las dos parejas de env vars
  const expectedUser = process.env.APP_USER || process.env.AI_USER || "";
  const expectedPass = process.env.APP_PASS || process.env.AI_PASS || "";
  return { expectedUser, expectedPass };
}

function getProvidedCreds(event, body) {
  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization || "";
  const fromHeader = decodeBasicAuth(authHeader);
  const fromBody = { user: body.user || "", pass: body.pass || "" };

  const provided = {
    user: fromBody.user || fromHeader.user || "",
    pass: fromBody.pass || fromHeader.pass || ""
  };

  const sources = [];
  if (fromBody.user || fromBody.pass) sources.push("body");
  if (fromHeader.user || fromHeader.pass) sources.push("header-basic");

  return { provided, sources, rawHeaderPresent: !!authHeader };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: "Method not allowed" })
    };
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: "Invalid JSON" })
    };
  }

  const {
    prompt,
    mode = "dinner",
    lang = "es",
    prefs = {},
    kcal = 1600,
    dayIndex = 1,
    username = "",
    size = "1024x1024"
  } = body;

  // ==== AUTH unificada (acepta APP_* o AI_* y Basic o body) ====
  const { expectedUser, expectedPass } = getExpectedCreds();

  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: "OPENAI_API_KEY not configured" })
    };
  }

  if (expectedUser && expectedPass) {
    const { provided, sources, rawHeaderPresent } = getProvidedCreds(event, body);
    const okAuth = provided.user === expectedUser && provided.pass === expectedPass;

    if (!okAuth) {
      // Logs seguros para debug en Netlify
      console.log("AUTH DEBUG => expectedUser:", mask(expectedUser), " expectedPass:", mask(expectedPass));
      console.log("AUTH DEBUG => providedUser:", mask(provided.user), " providedPass:", mask(provided.pass));
      console.log("AUTH DEBUG => sources:", sources, " rawHeaderPresent:", rawHeaderPresent);
      console.log("AUTH DEBUG => headers keys:", Object.keys(event.headers || {}));

      return {
        statusCode: 401,
        body: JSON.stringify({
          ok: false,
          error: "Unauthorized",
          reason: "mismatch",
          expectedSet: Boolean(expectedUser && expectedPass),
          providedSources: sources,
          hadAuthHeader: rawHeaderPresent
        })
      };
    }
  } else {
    // Si no hay vars esperadas, no exigimos auth
    console.log("AUTH INFO => No expected creds set (APP_/AI_). Skipping auth.");
  }

  // ====== 1) CHAT del Consultor ======
  if (["consultor-chat", "chat", "general", "free-chat"].includes(mode)) {
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "prompt required" }) };
    }

    const systemEs =
      "Eres un experto en dieta keto balanceada y entrenador de calistenia con 20 años de experiencia. Responde de forma clara, directa y accionable. Si hay riesgos, adviértelos. Puedes proponer recetas, planes y entrenos de peso corporal.";
    const systemEn =
      "You are a balanced keto nutrition expert and a calisthenics coach with 20 years of experience. Answer clearly, directly, and with actionable steps. Warn about risks if needed. You can propose recipes, plans, and bodyweight workouts.";

    const system = lang === "en" ? systemEn : systemEs;

    const messages = [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ];

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.5,
          max_tokens: 800
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        return {
          statusCode: resp.status,
          body: JSON.stringify({ ok: false, error: data.error?.message || "OpenAI error" })
        };
      }

      const text = data.choices?.[0]?.message?.content || "";
      return { statusCode: 200, body: JSON.stringify({ ok: true, text }) };
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: e.message || "request failed" })
      };
    }
  }

  // ====== 2) Generación de IMAGEN ======
  const imageModes = ["consultor-image", "image", "image-gen", "generate-image"];

  if (imageModes.includes(mode)) {
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "prompt required" }) };
    }

    const guardrail =
      lang === "en"
        ? "Clean fitness or keto look, no text overlays, natural lighting, high quality."
        : "Estética limpia de fitness o keto, sin textos, luz natural, alta calidad.";

    try {
      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: `${guardrail}\n\n${prompt}`,
          size,
          n: 1,
          response_format: "url"
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        return {
          statusCode: resp.status,
          body: JSON.stringify({ ok: false, error: data.error?.message || "OpenAI image error" })
        };
      }

      const imageUrl = data?.data?.[0]?.url || null;
      const b64 = data?.data?.[0]?.b64_json || null;

      if (!imageUrl && !b64) {
        return { statusCode: 502, body: JSON.stringify({ ok: false, error: "Image generation failed" }) };
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true, imageUrl, base64: b64 }) };
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: e.message || "request failed" })
      };
    }
  }

  // ====== 3) FULL-DAY existente ======
  if (mode === "full-day") {
    const like = prefs.like || "";
    const dislike = prefs.dislike || "";
    let messages = [];

    if (lang === "en") {
      messages = [
        {
          role: "system",
          content: "You are a nutrition and training assistant. You answer ONLY in JSON and never with explanations."
        },
        {
          role: "user",
          content: `Create a FULL KETO DAY plan for day ${dayIndex} for user ${username || "User"} with about ${kcal} kcal. Consider likes: ${like}. Avoid: ${dislike}. Add 5 meals: breakfast, snackAM, lunch, snackPM, dinner. Each meal must have 'nombre' and 'qty' fields. Add macros text field (carbs, protein, fat) for the day. Also add a 'workoutToday' field with a short description and a 'weeklyFocus' field. Respond ONLY with compact JSON like:
{
  "kcal": 1600,
  "macros": {"carbs":"7%", "prot":"25%", "fat":"68%"},
  "desayuno": {"nombre":"...", "qty":"..."},
  "snackAM": {"nombre":"...", "qty":"..."},
  "almuerzo": {"nombre":"...", "qty":"..."},
  "snackPM": {"nombre":"...", "qty":"..."},
  "cena": {"nombre":"...", "qty":"..."},
  "workoutToday": "...",
  "weeklyFocus": "..."
}
Do not wrap code, do not explain.`
        }
      ];
    } else {
      messages = [
        {
          role: "system",
          content: "Eres un asistente de nutrición y entrenamiento. Respondes SOLO en JSON sin explicaciones."
        },
        {
          role: "user",
          content: `Crea un plan KETO COMPLETO para el día ${dayIndex} para el usuario ${username || "Usuario"} de unas ${kcal} kcal. Considera que le gusta: ${like}. Evita: ${dislike}. Incluye 5 comidas: desayuno, snackAM, almuerzo, snackPM y cena. Cada una con campos 'nombre' y 'qty'. Agrega un campo 'macros' con texto (carbs, prot, fat). Agrega también 'workoutToday' con el entrenamiento del día y 'weeklyFocus' con el foco de la semana. Responde SOLO con JSON compacto así:
{
  "kcal": 1600,
  "macros": {"carbs":"7%", "prot":"25%", "fat":"68%"},
  "desayuno": {"nombre":"...", "qty":"..."},
  "snackAM": {"nombre":"...", "qty":"..."},
  "almuerzo": {"nombre":"...", "qty":"..."},
  "snackPM": {"nombre":"...", "qty":"..."},
  "cena": {"nombre":"...", "qty":"..."},
  "workoutToday": "...",
  "weeklyFocus": "..."
}
No expliques nada.`
        }
      ];
    }

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.45,
          max_tokens: 650
        })
      });

      const data = await resp.json();

      if (!resp.ok) {
        return {
          statusCode: resp.status,
          body: JSON.stringify({ ok: false, error: data.error?.message || "OpenAI error" })
        };
      }

      const text = data.choices?.[0]?.message?.content || "";
      let structured = null;
      try {
        structured = JSON.parse(text);
      } catch {}

      return { statusCode: 200, body: JSON.stringify({ ok: true, text, structured }) };
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: e.message || "request failed" })
      };
    }
  }

  // ====== 4) COMPAT: fallback tipo "dinner" ======
  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: "prompt required" }) };
  }

  const messages = [
    { role: "system", content: "You are a helpful keto assistant." },
    { role: "user", content: prompt }
  ];

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.45,
        max_tokens: 650
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: JSON.stringify({ ok: false, error: data.error?.message || "OpenAI error" })
      };
    }

    const text = data.choices?.[0]?.message?.content || "";
    return { statusCode: 200, body: JSON.stringify({ ok: true, text }) };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: e.message || "request failed" })
    };
  }
};

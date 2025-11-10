import axios from 'axios';

export const APP_USER = 'APP_USER';
export const APP_PASS = 'APP_PASS';

const NETLIFY_ENDPOINT = 'https://keto-plan-ai.netlify.app/.netlify/functions/grok';
const DEFAULT_TIMEOUT = Number(process.env.EXPO_PUBLIC_API_TIMEOUT || 30000);

const BASE_PAYLOAD = {
  mode: 'full-day',
  lang: 'es',
  kcal: 1600,
  dayIndex: 1,
  prefs: {},
  user: APP_USER,
  pass: APP_PASS
};

const mergePayload = (payload = {}) => {
  const merged = {
    ...BASE_PAYLOAD,
    ...payload,
    prefs: {
      ...BASE_PAYLOAD.prefs,
      ...(payload.prefs || {})
    }
  };

  if (!payload.user) {
    merged.user = APP_USER;
  }

  if (!payload.pass) {
    merged.pass = APP_PASS;
  }

  return merged;
};

export const callNetlifyAI = async (payload = {}, config = {}) => {
  const body = mergePayload(payload);

  try {
    const response = await axios.post(
      NETLIFY_ENDPOINT,
      body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: DEFAULT_TIMEOUT,
        ...config
      }
    );

    const data = response?.data;
    if (!data) {
      throw new Error('Empty response from Netlify AI service');
    }

    if (!data.ok) {
      console.error('Netlify AI responded with error:', data.error || data);
      throw new Error(data.error || 'Netlify AI request failed');
    }

    return data;
  } catch (error) {
    console.error('Error calling Netlify AI service:', error);
    throw error;
  }
};

export default callNetlifyAI;

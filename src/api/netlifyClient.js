import { API_BASE_URL, getApiConfig } from './config';

export const APP_USER = 'APP_USER';
export const APP_PASS = 'APP_PASS';

const DEFAULT_ENDPOINT = 'https://keto-plan-ai.netlify.app/.netlify/functions/grok';
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
  const { timeout: cfgTimeout, headers } = getApiConfig();
  const resolvedTimeout = config.timeout || cfgTimeout || DEFAULT_TIMEOUT;
  const url = config.url || API_BASE_URL || DEFAULT_ENDPOINT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, resolvedTimeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
        ...(config.headers || {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      } catch (readError) {
        console.warn('Unable to read error body from AI service:', readError);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data) {
      throw new Error('Empty response from Netlify AI service');
    }

    if (!data.ok) {
      console.error('Netlify AI responded with error:', data.error || data);
      throw new Error(data.error || 'Netlify AI request failed');
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error?.name === 'AbortError') {
      console.error('Netlify AI request timed out');
      throw new Error('Netlify AI request timed out');
    }
    console.error('Error calling Netlify AI service:', error);
    throw error;
  }
};

export default callNetlifyAI;

import Constants from 'expo-constants';

const DEFAULT_TIMEOUT = Number(process.env.EXPO_PUBLIC_API_TIMEOUT || 30000);
const RELATIVE_FALLBACK = '/.netlify/functions/grok';
const NETLIFY_FALLBACK = 'https://keto-pro-app.netlify.app/.netlify/functions/grok';

const resolveBaseUrl = () => {
  const raw = process.env.EXPO_PUBLIC_API_URL || RELATIVE_FALLBACK;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const extras = Constants.expoConfig?.extra || {};
  const explicitHost = extras.apiHost || extras.proxyHost;
  if (explicitHost) {
    const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
    return `${explicitHost.replace(/\/$/, '')}${normalizedPath}`;
  }

  return NETLIFY_FALLBACK;
};

export const API_BASE_URL = resolveBaseUrl();

export const getApiConfig = () => ({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default getApiConfig;

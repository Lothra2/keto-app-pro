import Constants from 'expo-constants';

const DEFAULT_TIMEOUT = Number(process.env.EXPO_PUBLIC_API_TIMEOUT || 30000);
const RELATIVE_FALLBACK = '/.netlify/functions/grok';
const DEFAULT_NETLIFY = 'https://keto-pro-app.netlify.app/.netlify/functions/grok';

const getExtras = () => {
  const expoConfig = Constants.expoConfig || {};
  const manifest = Constants.manifest || {};
  return expoConfig.extra || manifest.extra || {};
};

const buildUrl = (host, path) => {
  if (!host) return null;
  const normalizedHost = host.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedHost}${normalizedPath}`;
};

const resolveLocalDevUrl = (path, extras) => {
  const debuggerHost = Constants.expoGoConfig?.debuggerHost
    || Constants.manifest?.debuggerHost
    || '';

  if (!debuggerHost.includes(':')) {
    return null;
  }

  const [host] = debuggerHost.split(':');
  if (!host) {
    return null;
  }

  const port = process.env.EXPO_PUBLIC_NETLIFY_PORT
    || extras.netlifyPort
    || '8888';
  const scheme = process.env.EXPO_PUBLIC_NETLIFY_SCHEME
    || extras.netlifyScheme
    || 'http';

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${scheme}://${host}:${port}${normalizedPath}`;
};

const resolveBaseUrl = () => {
  const extras = getExtras();

  const explicit = process.env.EXPO_PUBLIC_API_URL
    || extras.apiBaseUrl
    || extras.apiUrl;

  if (explicit && /^https?:\/\//i.test(explicit)) {
    return explicit;
  }

  const path = explicit || RELATIVE_FALLBACK;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const hostUrl = extras.apiHost || extras.proxyHost;
  const hostResolved = buildUrl(hostUrl, path);
  if (hostResolved) {
    return hostResolved;
  }

  const localDev = resolveLocalDevUrl(path, extras);
  if (localDev) {
    return localDev;
  }

  const netlifySite = process.env.EXPO_PUBLIC_NETLIFY_SITE_URL
    || extras.netlifySiteUrl;
  const netlifyResolved = buildUrl(netlifySite, path);
  if (netlifyResolved) {
    return netlifyResolved;
  }

  return DEFAULT_NETLIFY;
};

export const API_BASE_URL = resolveBaseUrl();

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[AI] Base URL resolved to:', API_BASE_URL);
}

export const getApiConfig = () => ({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default getApiConfig;

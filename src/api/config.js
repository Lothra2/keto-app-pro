import Constants from 'expo-constants';

const DEFAULT_TIMEOUT = Number(process.env.EXPO_PUBLIC_API_TIMEOUT || 30000);
const DEFAULT_FUNCTION_PATH = '/.netlify/functions/grok';
const RELATIVE_FALLBACK = '/.netlify/functions/grok';
const DEFAULT_NETLIFY = 'https://keto-pro-app.netlify.app/.netlify/functions/grok';

const getExtras = () => {
  const expoConfig = Constants.expoConfig || {};
  const manifest = Constants.manifest || {};
  return expoConfig.extra || manifest.extra || {};
};

const ensurePath = (value) => {
  if (!value) return DEFAULT_FUNCTION_PATH;
  const trimmed = String(value).trim();
  if (!trimmed) return DEFAULT_FUNCTION_PATH;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const buildUrl = (host, path) => {
  if (!host) return null;

  let normalizedHost = String(host).trim();
  if (!normalizedHost) return null;

  if (!/^https?:\/\//i.test(normalizedHost)) {
    normalizedHost = /^(localhost|\d+\.\d+\.\d+\.\d+)/i.test(normalizedHost)
      ? `http://${normalizedHost}`
      : `https://${normalizedHost}`;
  }

  normalizedHost = normalizedHost.replace(/\/$/, '');
  const normalizedPath = ensurePath(path);
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

  const normalizedPath = ensurePath(path);
  return `${scheme}://${host}:${port}${normalizedPath}`;
};

const splitUrl = (url) => {
  try {
    const parsed = new URL(url);
    const baseURL = `${parsed.protocol}//${parsed.host}`;
    let path = parsed.pathname || '/';
    if (!path || path === '/') {
      path = DEFAULT_FUNCTION_PATH;
    }
    const search = parsed.search && parsed.search !== '?' ? parsed.search : '';
    return {
      baseURL,
      path: `${path}${search}` || DEFAULT_FUNCTION_PATH
    };
  } catch (error) {
    return null;
  }
};

const resolveEndpoint = () => {
  const extras = getExtras();

  const explicit = process.env.EXPO_PUBLIC_API_URL
    || extras.apiBaseUrl
    || extras.apiUrl;
  const pathOverride = process.env.EXPO_PUBLIC_API_PATH
    || extras.apiPath
    || RELATIVE_FALLBACK;
  const normalizedPath = ensurePath(pathOverride);

  const hostOverride = process.env.EXPO_PUBLIC_API_HOST
    || extras.apiHost
    || extras.proxyHost;

  const attempt = (candidate) => {
    if (!candidate) return null;
    const parsed = splitUrl(candidate);
    if (!parsed) return null;
    return {
      url: `${parsed.baseURL}${parsed.path}`,
      baseURL: parsed.baseURL,
      path: parsed.path
    };
  };

  if (explicit && /^https?:\/\//i.test(explicit)) {
    const parsed = attempt(explicit);
    if (parsed) return parsed;
  }

  if (explicit && !/^https?:\/\//i.test(explicit)) {
    const explicitPath = ensurePath(explicit);

    if (hostOverride) {
      const built = buildUrl(hostOverride, explicitPath);
      const parsed = attempt(built);
      if (parsed) return parsed;
    }

    const localFromExplicit = resolveLocalDevUrl(explicitPath, extras);
    const parsedLocalExplicit = attempt(localFromExplicit);
    if (parsedLocalExplicit) return parsedLocalExplicit;
  }

  if (hostOverride) {
    const built = buildUrl(hostOverride, normalizedPath);
    const parsed = attempt(built);
    if (parsed) return parsed;
  }

  const localDev = resolveLocalDevUrl(normalizedPath, extras);
  const parsedLocal = attempt(localDev);
  if (parsedLocal) return parsedLocal;

  const netlifySite = process.env.EXPO_PUBLIC_NETLIFY_SITE_URL
    || extras.netlifySiteUrl;
  const netlifyResolved = buildUrl(netlifySite, normalizedPath);
  const parsedNetlify = attempt(netlifyResolved);
  if (parsedNetlify) return parsedNetlify;

  const fallback = attempt(DEFAULT_NETLIFY);
  if (fallback) return fallback;

  return {
    url: DEFAULT_NETLIFY,
    baseURL: 'https://keto-pro-app.netlify.app',
    path: DEFAULT_FUNCTION_PATH
  };
};

const resolvedEndpoint = resolveEndpoint();

export const API_BASE_URL = resolvedEndpoint.url;
export const API_CLIENT_BASE = resolvedEndpoint.baseURL;
export const API_ENDPOINT_PATH = resolvedEndpoint.path;

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[AI] Base URL resolved to:', API_BASE_URL);
}

export const getApiConfig = () => ({
  baseURL: API_CLIENT_BASE,
  endpointPath: API_ENDPOINT_PATH,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default getApiConfig;

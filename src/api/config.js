const DEFAULT_TIMEOUT = Number(process.env.EXPO_PUBLIC_API_TIMEOUT || 30000);
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '/.netlify/functions/grok';

export const getApiConfig = () => ({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

export { API_BASE_URL };

export default getApiConfig;

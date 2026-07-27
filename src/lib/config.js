/** Production defaults; overridden by Vite env when present. */
export const OURA_CLIENT_ID = import.meta.env.VITE_OURA_CLIENT_ID
  || 'e11ec84d-5224-431d-8dbf-736690fbb75d';

export const OURA_API_BASE = (
  import.meta.env.VITE_OURA_API_BASE
  || 'https://oura-analytics-proxy.anirudhkumar.workers.dev'
).replace(/\/$/, '');

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearTokens,
  consumeOAuthRedirect,
  getApiBase,
  getClientId,
  isConnected,
  redirectUri,
  setApiBase as persistApiBase,
  setClientId as persistClientId,
  startOuraLogin,
} from '../lib/auth.js';
import { cacheAge, cacheGet, cachePut } from '../lib/cache.js';
import { fetchDashboard } from '../lib/oura.js';
import { aggregateRows, availableMetricsFor, buildDailySeries } from '../lib/series.js';

const UI_KEY = 'oura-analytics-ui';

function loadUi() {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeUi(next) {
  localStorage.setItem(UI_KEY, JSON.stringify(next));
}

function bootstrapAuth() {
  try {
    const tokens = consumeOAuthRedirect();
    if (tokens) {
      return { connected: true, notice: { message: 'Connected to Oura. Loading your data…', error: false } };
    }
    return { connected: isConnected(), notice: { message: '', error: false } };
  } catch (error) {
    return { connected: isConnected(), notice: { message: error.message, error: true } };
  }
}

export function useDashboard() {
  const initial = loadUi();
  const [authBoot] = useState(bootstrapAuth);
  const [days, setDaysState] = useState(initial.days || '30');
  const [granularity, setGranularityState] = useState(initial.granularity || 'daily');
  const [lag, setLagState] = useState(Number(initial.lag ?? 0));
  const [ui, setUi] = useState(initial);
  const [dashboard, setDashboard] = useState(null);
  const [notice, setNotice] = useState(authBoot.notice);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientIdState] = useState(() => getClientId());
  const [apiBase, setApiBaseState] = useState(() => getApiBase());
  const [connected, setConnected] = useState(authBoot.connected);

  const persistUi = useCallback((patch) => {
    setUi((prev) => {
      const next = { ...prev, ...patch };
      writeUi(next);
      return next;
    });
  }, []);

  const setDays = useCallback((value) => {
    setDaysState(value);
    persistUi({ days: value });
  }, [persistUi]);

  const setGranularity = useCallback((value) => {
    setGranularityState(value);
    persistUi({ granularity: value });
  }, [persistUi]);

  const setLag = useCallback((value) => {
    setLagState(value);
    persistUi({ lag: value });
  }, [persistUi]);

  const saveClientId = useCallback((value) => {
    const next = persistClientId(value);
    setClientIdState(next);
  }, []);

  const saveApiBase = useCallback((value) => {
    const next = persistApiBase(value);
    setApiBaseState(next);
  }, []);

  const daily = useMemo(() => {
    if (!dashboard?.raw) return { rows: [], metrics: [] };
    return buildDailySeries(dashboard.raw);
  }, [dashboard]);

  const rows = useMemo(
    () => aggregateRows(daily.rows, granularity),
    [daily.rows, granularity],
  );

  const metrics = useMemo(() => availableMetricsFor(rows), [rows]);

  const load = useCallback(async ({ force = false } = {}) => {
    setLoading(true);
    const cached = await cacheGet(days);
    if (cached?.data && !force) {
      setDashboard(cached.data);
      setNotice({ message: `Showing cached data (${cacheAge(cached.fetchedAt)}). Updating…`, error: false });
    }
    try {
      if (!isConnected()) {
        setConnected(false);
        setNotice({
          message: clientId
            ? 'Select Connect Oura to authorize your account.'
            : 'Enter your Oura Client ID, set the Redirect URI in the Oura developer portal to this page, then Connect Oura.',
          error: false,
        });
        return;
      }
      setConnected(true);
      const data = await fetchDashboard(Number(days));
      await cachePut(days, data);
      setDashboard(data);
      setNotice({ message: '', error: false });
    } catch (error) {
      if (cached?.data) {
        setDashboard(cached.data);
        setNotice({
          message: `Showing cached data (${cacheAge(cached.fetchedAt)}). ${error.message}`,
          error: true,
        });
      } else {
        setNotice({ message: error.message, error: true });
      }
    } finally {
      setLoading(false);
    }
  }, [days, clientId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  const connect = useCallback(async () => {
    try {
      await startOuraLogin();
    } catch (error) {
      setNotice({ message: error.message, error: true });
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTokens();
    setConnected(false);
    setDashboard(null);
    setNotice({ message: 'Disconnected. Select Connect Oura to authorize again.', error: false });
  }, []);

  return {
    days,
    setDays,
    granularity,
    setGranularity,
    lag,
    setLag,
    ui,
    persistUi,
    dashboard,
    rows,
    metrics,
    notice,
    loading,
    load,
    connect,
    disconnect,
    connected,
    clientId,
    saveClientId,
    apiBase,
    saveApiBase,
    redirectUri: redirectUri(),
  };
}

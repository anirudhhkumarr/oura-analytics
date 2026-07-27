import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearTokens,
  consumeOAuthRedirect,
  isConnected,
  startOuraLogin,
} from '../lib/auth.js';
import { cacheAge } from '../lib/cache.js';
import { fetchDashboard, hasRemoteSyncUpdate, loadCachedDashboard } from '../lib/oura.js';
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
      return { connected: true, notice: { message: 'Connected. Loading your data…', error: false } };
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
    const cached = await loadCachedDashboard(Number(days));
    if (cached && !force) {
      setDashboard(cached);
      const when = cached.cache?.lastFetchAt
        ? ` (${cacheAge(cached.cache.lastFetchAt)})`
        : '';
      setNotice({ message: `Showing cached history${when}. Checking for updates…`, error: false });
    }
    try {
      if (!isConnected()) {
        setConnected(false);
        setNotice({
          message: cached
            ? 'Showing cached history. Connect Oura to refresh.'
            : 'Connect your Oura account to get started.',
          error: false,
        });
        return;
      }
      setConnected(true);
      const data = await fetchDashboard(Number(days), {
        force,
        onProgress: (message) => setNotice({ message, error: false }),
      });
      setDashboard(data);
      setNotice({
        message: data.cache?.reusedHistory
          ? 'Updated recent days. Older history served from local cache.'
          : '',
        error: false,
      });
    } catch (error) {
      if (cached) {
        setDashboard(cached);
        setNotice({
          message: `Showing cached history. ${error.message}`,
          error: true,
        });
      } else {
        setNotice({ message: error.message, error: true });
      }
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  useEffect(() => {
    if (!connected) return undefined;
    const poll = window.setInterval(() => {
      void (async () => {
        const lastFetchAt = dashboard?.cache?.lastFetchAt;
        if (await hasRemoteSyncUpdate(lastFetchAt)) {
          await load({ force: false });
        }
      })();
    }, 60_000);
    return () => window.clearInterval(poll);
  }, [connected, dashboard?.cache?.lastFetchAt, load]);

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
    setNotice({ message: 'Disconnected.', error: false });
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
  };
}

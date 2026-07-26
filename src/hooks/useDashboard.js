import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, isHostedPage, startOuraLogin } from '../lib/api.js';
import { cacheAge, cacheGet, cachePut } from '../lib/cache.js';
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

export function useDashboard() {
  const initial = loadUi();
  const [days, setDaysState] = useState(initial.days || '30');
  const [granularity, setGranularityState] = useState(initial.granularity || 'daily');
  const [lag, setLagState] = useState(Number(initial.lag ?? 0));
  const [ui, setUi] = useState(initial);
  const [dashboard, setDashboard] = useState(null);
  const [notice, setNotice] = useState({ message: '', error: false });
  const [loading, setLoading] = useState(false);

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
    if (isHostedPage()) {
      setNotice({ message: 'Opening your local dashboard…', error: false });
      setTimeout(() => location.replace('http://localhost:8780'), 350);
      return;
    }
    setLoading(true);
    const cached = await cacheGet(days);
    if (cached?.data && !force) {
      setDashboard(cached.data);
      setNotice({ message: `Showing cached data (${cacheAge(cached.fetchedAt)}). Updating…`, error: false });
    }
    try {
      const status = await api('/api/auth/status');
      if (!status.connected) {
        setNotice({ message: 'Select Connect Oura to authorize your account.', error: false });
        return;
      }
      const data = await api(`/api/dashboard?days=${days}`);
      await cachePut(days, data);
      setDashboard(data);
      setNotice({ message: '', error: false });
    } catch (error) {
      if (cached?.data) {
        setDashboard(cached.data);
        setNotice({
          message: `Showing cached data (${cacheAge(cached.fetchedAt)}). Bridge unreachable — start it with \`npm run start:bridge\`. ${error.message}`,
          error: true,
        });
      } else {
        setNotice({
          message: `Cannot reach the local bridge. Start it with \`npm run start:bridge\`, then reload. ${error.message}`,
          error: true,
        });
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

  const connect = useCallback(async () => {
    try {
      await startOuraLogin();
    } catch (error) {
      setNotice({ message: error.message, error: true });
    }
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
    isHosted: isHostedPage(),
  };
}

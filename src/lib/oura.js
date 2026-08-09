import { OURA_API_BASE } from './config.js';
import { accessToken, getApiBase } from './auth.js';
import {
  getCollectionItems,
  getMeta,
  getSingleton,
  setMeta,
  upsertCollectionItems,
  upsertSingleton,
} from './cache.js';

/** Days that Oura may still revise (tonight's sleep / today's activity). */
const MUTABLE_DAYS = 2;

/** Dense beat-level series — only refresh the mutable window to protect localStorage. */
const DENSE_TIMESERIES = new Set(['interbeat_interval']);

/**
 * Every Oura usercollection route we know about.
 * date: start_date/end_date · datetime: start_datetime/end_datetime · none: no range filter
 */
const COLLECTIONS = [
  { name: 'daily_sleep', path: '/usercollection/daily_sleep', range: 'date' },
  { name: 'daily_readiness', path: '/usercollection/daily_readiness', range: 'date' },
  { name: 'daily_activity', path: '/usercollection/daily_activity', range: 'date' },
  { name: 'daily_stress', path: '/usercollection/daily_stress', range: 'date' },
  { name: 'daily_resilience', path: '/usercollection/daily_resilience', range: 'date' },
  { name: 'daily_spo2', path: '/usercollection/daily_spo2', range: 'date' },
  { name: 'daily_cardiovascular_age', path: '/usercollection/daily_cardiovascular_age', range: 'date' },
  { name: 'vo2_max', path: '/usercollection/vO2_max', range: 'date' },
  { name: 'sleep_time', path: '/usercollection/sleep_time', range: 'date' },
  { name: 'sleep', path: '/usercollection/sleep', range: 'date' },
  { name: 'workout', path: '/usercollection/workout', range: 'date' },
  { name: 'session', path: '/usercollection/session', range: 'date' },
  { name: 'rest_mode_period', path: '/usercollection/rest_mode_period', range: 'date' },
  { name: 'tag', path: '/usercollection/tag', range: 'date' },
  { name: 'enhanced_tag', path: '/usercollection/enhanced_tag', range: 'date' },
  { name: 'blood_glucose', path: '/usercollection/blood_glucose', range: 'date' },
  { name: 'activation_status', path: '/usercollection/activation_status', range: 'date' },
  { name: 'heartrate', path: '/usercollection/heartrate', range: 'datetime' },
  { name: 'ring_battery_level', path: '/usercollection/ring_battery_level', range: 'datetime' },
  { name: 'interbeat_interval', path: '/usercollection/interbeat_interval', range: 'datetime' },
  { name: 'ring_configuration', path: '/usercollection/ring_configuration', range: 'none' },
];

const CACHE_COLLECTIONS = COLLECTIONS.map((c) => c.name);

async function oura(path, query = {}) {
  const token = await accessToken();
  const apiRoot = getApiBase();
  const data = [];
  let nextToken;
  do {
    const url = new URL(`${apiRoot}/v2${path}`, location.origin);
    Object.entries({ ...query, ...(nextToken ? { next_token: nextToken } : {}) })
      .forEach(([key, value]) => url.searchParams.set(key, value));
    let response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      throw new Error(
        `Could not reach the Oura API (${error.message}). Please try again shortly.`,
      );
    }
    if (!response.ok) {
      throw new Error(`Oura API request failed (${response.status}) for ${path}.`);
    }
    const page = await response.json();
    if (Array.isArray(page.data)) data.push(...page.data);
    else return page;
    nextToken = page.next_token;
  } while (nextToken);
  return { data };
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day, delta) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return isoDay(date);
}

function avg(rows, field) {
  const values = rows.map((row) => row[field]).filter((value) => Number.isFinite(value));
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

function rangeQuery(range, startDay, endDay) {
  if (range === 'none') return {};
  if (range === 'datetime') {
    return {
      start_datetime: new Date(`${startDay}T00:00:00.000Z`).toISOString(),
      end_datetime: endDay === isoDay(new Date())
        ? new Date().toISOString()
        : new Date(`${endDay}T23:59:59.999Z`).toISOString(),
    };
  }
  return { start_date: startDay, end_date: endDay };
}

function buildDashboard(raw) {
  const byDay = new Map();
  for (const [key, collection] of [
    ['sleep_score', raw.daily_sleep?.data],
    ['readiness_score', raw.daily_readiness?.data],
    ['activity_score', raw.daily_activity?.data],
  ]) {
    for (const item of collection || []) {
      byDay.set(item.day, { ...(byDay.get(item.day) || { day: item.day }), [key]: item.score });
    }
  }
  const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const latest = (rows) => rows?.[rows.length - 1] || {};
  const latestSleep = latest(raw.sleep?.data);
  const latestActivity = latest(raw.daily_activity?.data);
  const latestSpo2 = latest(raw.daily_spo2?.data);

  return {
    daily,
    raw,
    errors: raw.__errors || {},
    collection_counts: Object.fromEntries(
      Object.entries(raw)
        .filter(([name]) => name !== '__errors')
        .map(([name, value]) => [
          name,
          Array.isArray(value?.data) ? value.data.length : value ? 1 : 0,
        ]),
    ),
    summary: {
      sleep: avg(daily, 'sleep_score'),
      readiness: avg(daily, 'readiness_score'),
      activity: avg(daily, 'activity_score'),
      steps: latestActivity.steps ?? null,
      hrv: latestSleep.average_hrv ?? latestSleep.contributors?.hrv_balance ?? null,
      spo2: latestSpo2.spo2_percentage?.average ?? null,
    },
  };
}

async function needsHistoricalBackfill(startDay, immutableEnd) {
  if (immutableEnd < startDay) return false;
  const historyStart = await getMeta('history_start');
  if (historyStart && historyStart <= startDay) return false;
  return true;
}

async function loadRawFromCache(startDay, endDay) {
  const raw = {};
  for (const name of CACHE_COLLECTIONS) {
    raw[name] = { data: await getCollectionItems(name, { startDay, endDay }) };
  }
  const personal = await getSingleton('personal_info');
  raw.personal_info = personal || { data: [] };
  return raw;
}

/**
 * Fetch dashboard data, reusing immutable older days from SQLite and only
 * refreshing the recent mutable window (and any historical gaps).
 */
export async function fetchDashboard(days, { force = false, onProgress } = {}) {
  const endDay = isoDay(new Date());
  const startDay = addDays(endDay, -(Math.max(1, Number(days) || 30) - 1));
  const mutableStart = addDays(endDay, -(MUTABLE_DAYS - 1));
  const immutableEnd = addDays(mutableStart, -1);

  const covered = !force && !(await needsHistoricalBackfill(startDay, immutableEnd));
  const fetchStart = force || !covered ? startDay : mutableStart;

  if (onProgress) {
    onProgress(covered
      ? 'Updating recent days…'
      : 'Loading history into local cache…');
  }

  const errors = {};
  let fetchedAny = false;
  for (const { name, path, range } of COLLECTIONS) {
    const windowStart = DENSE_TIMESERIES.has(name) ? mutableStart : fetchStart;
    const query = rangeQuery(range, windowStart, endDay);
    try {
      const page = await oura(path, query);
      await upsertCollectionItems(name, page.data || []);
      fetchedAny = true;
    } catch (error) {
      errors[name] = error.message;
    }
  }

  try {
    const personal = await oura('/usercollection/personal_info', {});
    await upsertSingleton('personal_info', personal);
    fetchedAny = true;
  } catch (error) {
    errors.personal_info = error.message;
  }

  if (!fetchedAny && Object.keys(errors).length) {
    throw new Error(Object.values(errors)[0] || 'All Oura API requests failed.');
  }

  await setMeta('last_fetch_at', String(Date.now()));
  await setMeta('last_fetch_end', endDay);
  if (force || !covered || fetchStart === startDay) {
    const previous = await getMeta('history_start');
    if (!previous || startDay < previous || force) await setMeta('history_start', startDay);
  }

  const raw = await loadRawFromCache(startDay, endDay);
  raw.__errors = errors;
  const dashboard = buildDashboard(raw);
  dashboard.cache = {
    fetchStart,
    startDay,
    endDay,
    reusedHistory: covered && !force,
    lastFetchAt: Number(await getMeta('last_fetch_at')) || Date.now(),
  };
  return dashboard;
}

/** True when the worker has a webhook event newer than our last local fetch. */
export async function hasRemoteSyncUpdate(lastFetchAt) {
  try {
    const response = await fetch(`${OURA_API_BASE}/sync-status`);
    if (!response.ok) return false;
    const body = await response.json();
    const remote = Number(body.last_event_at || 0);
    return Boolean(remote && remote > (Number(lastFetchAt) || 0));
  } catch {
    return false;
  }
}

/** Build a dashboard view from local cache only (no network). */
export async function loadCachedDashboard(days) {
  const endDay = isoDay(new Date());
  const startDay = addDays(endDay, -(Math.max(1, Number(days) || 30) - 1));
  const raw = await loadRawFromCache(startDay, endDay);
  const hasData = Object.values(raw).some((value) => (
    Array.isArray(value?.data) ? value.data.length > 0 : Boolean(value)
  ));
  if (!hasData) return null;
  const dashboard = buildDashboard(raw);
  dashboard.cache = {
    fetchStart: null,
    startDay,
    endDay,
    reusedHistory: true,
    lastFetchAt: Number(await getMeta('last_fetch_at')) || null,
  };
  return dashboard;
}

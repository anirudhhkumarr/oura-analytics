import { accessToken, getApiBase } from './auth.js';

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

function dateBefore(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function avg(rows, field) {
  const values = rows.map((row) => row[field]).filter((value) => Number.isFinite(value));
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export async function fetchDashboard(days) {
  const endDate = new Date().toISOString().slice(0, 10);
  const query = { start_date: dateBefore(days), end_date: endDate };
  const heartRateStart = new Date(Date.now() - Math.min(days, 30) * 86_400_000).toISOString();
  const collections = [
    ['daily_sleep', '/usercollection/daily_sleep', query],
    ['daily_readiness', '/usercollection/daily_readiness', query],
    ['daily_activity', '/usercollection/daily_activity', query],
    ['daily_stress', '/usercollection/daily_stress', query],
    ['daily_resilience', '/usercollection/daily_resilience', query],
    ['daily_spo2', '/usercollection/daily_spo2', query],
    ['daily_cardiovascular_age', '/usercollection/daily_cardiovascular_age', query],
    ['vo2_max', '/usercollection/vO2_max', query],
    ['sleep_time', '/usercollection/sleep_time', query],
    ['sleep', '/usercollection/sleep', query],
    ['workout', '/usercollection/workout', query],
    ['session', '/usercollection/session', query],
    ['rest_mode_period', '/usercollection/rest_mode_period', query],
    ['enhanced_tag', '/usercollection/enhanced_tag', query],
    ['heartrate', '/usercollection/heartrate', {
      start_datetime: heartRateStart,
      end_datetime: new Date().toISOString(),
    }],
    ['personal_info', '/usercollection/personal_info', {}],
  ];

  const raw = {};
  const errors = {};
  for (const [name, path, params] of collections) {
    try {
      raw[name] = await oura(path, params);
    } catch (error) {
      raw[name] = { data: [] };
      errors[name] = error.message;
    }
  }

  const byDay = new Map();
  for (const [key, collection] of [
    ['sleep_score', raw.daily_sleep.data],
    ['readiness_score', raw.daily_readiness.data],
    ['activity_score', raw.daily_activity.data],
  ]) {
    for (const item of collection || []) {
      byDay.set(item.day, { ...(byDay.get(item.day) || { day: item.day }), [key]: item.score });
    }
  }
  const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const latest = (rows) => rows?.[rows.length - 1] || {};
  const latestSleep = latest(raw.sleep?.data);
  const latestActivity = latest(raw.daily_activity.data);
  const latestSpo2 = latest(raw.daily_spo2.data);

  const hardFailures = Object.values(errors);
  if (hardFailures.length === collections.length) {
    throw new Error(hardFailures[0] || 'All Oura API requests failed.');
  }

  return {
    daily,
    raw,
    errors,
    collection_counts: Object.fromEntries(
      Object.entries(raw).map(([name, value]) => [
        name,
        Array.isArray(value.data) ? value.data.length : value ? 1 : 0,
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

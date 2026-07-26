import { METRIC_DEFS } from './metrics.js';

function dayKey(item) {
  return item.day || (item.timestamp || item.bedtime_start || '').slice(0, 10) || null;
}

function secToHours(sec) {
  return Number.isFinite(sec) ? sec / 3600 : null;
}

function mergeDay(map, day, patch) {
  if (!day) return;
  map.set(day, { ...(map.get(day) || { day }), ...patch });
}

export function buildDailySeries(raw = {}) {
  const map = new Map();
  for (const item of raw.daily_sleep?.data || []) {
    mergeDay(map, dayKey(item), { sleep_score: item.score });
  }
  for (const item of raw.daily_readiness?.data || []) {
    mergeDay(map, dayKey(item), { readiness_score: item.score });
  }
  for (const item of raw.daily_activity?.data || []) {
    mergeDay(map, dayKey(item), {
      activity_score: item.score,
      steps: item.steps,
      active_calories: item.active_calories,
      total_calories: item.total_calories,
    });
  }
  for (const item of raw.daily_stress?.data || []) {
    mergeDay(map, dayKey(item), {
      stress_high: item.stress_high,
      recovery_high: item.recovery_high,
    });
  }
  for (const item of raw.daily_spo2?.data || []) {
    mergeDay(map, dayKey(item), { spo2: item.spo2_percentage?.average ?? null });
  }
  for (const item of raw.daily_cardiovascular_age?.data || []) {
    mergeDay(map, dayKey(item), { vascular_age: item.vascular_age });
  }

  const sleepByDay = new Map();
  for (const item of raw.sleep?.data || []) {
    const day = dayKey(item);
    if (!day) continue;
    const prev = sleepByDay.get(day);
    if (!prev || (item.total_sleep_duration || 0) > (prev.total_sleep_duration || 0)) {
      sleepByDay.set(day, item);
    }
  }
  for (const [day, item] of sleepByDay) {
    mergeDay(map, day, {
      average_hrv: item.average_hrv,
      average_heart_rate: item.average_heart_rate,
      total_sleep_hours: secToHours(item.total_sleep_duration),
      deep_sleep_hours: secToHours(item.deep_sleep_duration),
      rem_sleep_hours: secToHours(item.rem_sleep_duration),
      sleep_efficiency: item.efficiency,
    });
  }

  const rows = [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
  const metrics = Object.keys(METRIC_DEFS).filter((key) => {
    const count = rows.filter((row) => Number.isFinite(row[key])).length;
    return count >= 3;
  });
  return { rows, metrics };
}

function isoWeekKey(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodKey(day, granularity) {
  if (granularity === 'weekly') return isoWeekKey(day);
  if (granularity === 'monthly') return day.slice(0, 7);
  return day;
}

/** Average numeric metrics into weekly or monthly buckets. */
export function aggregateRows(rows, granularity = 'daily') {
  if (granularity === 'daily' || !rows.length) return rows.map((row) => ({ ...row }));

  const buckets = new Map();
  for (const row of rows) {
    const key = periodKey(row.day, granularity);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  const metricKeys = Object.keys(METRIC_DEFS);
  const aggregated = [];
  for (const [key, group] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const next = { day: key };
    for (const metric of metricKeys) {
      const values = group.map((row) => row[metric]).filter((value) => Number.isFinite(value));
      next[metric] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    }
    aggregated.push(next);
  }
  return aggregated;
}

export function availableMetricsFor(rows) {
  return Object.keys(METRIC_DEFS).filter((key) => {
    const count = rows.filter((row) => Number.isFinite(row[key])).length;
    return count >= 3;
  });
}

/**
 * Pair X (lagged) with Y (current).
 * offset=1 means X is the previous period's value.
 */
export function paired(rows, xKey, yKey, offset = 0) {
  const lag = Math.max(0, Number(offset) || 0);
  const points = [];
  for (let i = lag; i < rows.length; i += 1) {
    const x = rows[i - lag][xKey];
    const y = rows[i][yKey];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({
        x,
        y,
        day: rows[i].day,
        xDay: rows[i - lag].day,
      });
    }
  }
  return points;
}

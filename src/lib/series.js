import { METRIC_DEFS } from './metrics.js';

function dayKey(item) {
  return item.day
    || item.start_day
    || (item.timestamp || item.bedtime_start || item.start_datetime || item.start_time || '').slice(0, 10)
    || null;
}

function secToHours(sec) {
  return Number.isFinite(sec) ? sec / 3600 : null;
}

function secToMin(sec) {
  return Number.isFinite(sec) ? sec / 60 : null;
}

function mergeDay(map, day, patch) {
  if (!day) return;
  map.set(day, { ...(map.get(day) || { day }), ...patch });
}

function mean(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function bump(map, day, key, amount = 1) {
  if (!day) return;
  const row = map.get(day) || { day };
  row[key] = (Number.isFinite(row[key]) ? row[key] : 0) + amount;
  map.set(day, row);
}

export function buildDailySeries(raw = {}) {
  const map = new Map();
  for (const item of raw.daily_sleep?.data || []) {
    mergeDay(map, dayKey(item), { sleep_score: item.score });
  }
  for (const item of raw.daily_readiness?.data || []) {
    mergeDay(map, dayKey(item), {
      readiness_score: item.score,
      temperature_deviation: item.temperature_deviation,
      temperature_trend: item.temperature_trend_deviation,
      hrv_balance: item.contributors?.hrv_balance ?? null,
      resting_heart_rate_score: item.contributors?.resting_heart_rate ?? null,
    });
  }
  for (const item of raw.daily_activity?.data || []) {
    mergeDay(map, dayKey(item), {
      activity_score: item.score,
      steps: item.steps,
      active_calories: item.active_calories,
      total_calories: item.total_calories,
      sedentary_hours: secToHours(item.sedentary_time),
      resting_hours: secToHours(item.resting_time),
      high_activity_hours: secToHours(item.high_activity_time),
      medium_activity_hours: secToHours(item.medium_activity_time),
      low_activity_hours: secToHours(item.low_activity_time),
      inactivity_alerts: item.inactivity_alerts,
      average_met: item.average_met_minutes,
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
    mergeDay(map, dayKey(item), {
      vascular_age: item.vascular_age,
      pulse_wave_velocity: item.pulse_wave_velocity,
    });
  }
  for (const item of raw.daily_resilience?.data || []) {
    mergeDay(map, dayKey(item), {
      resilience_sleep: item.contributors?.sleep_recovery ?? null,
      resilience_daytime: item.contributors?.daytime_recovery ?? null,
      resilience_stress: item.contributors?.stress ?? null,
    });
  }
  for (const item of raw.vo2_max?.data || []) {
    mergeDay(map, dayKey(item), { vo2_max: item.vo2_max });
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
      lowest_heart_rate: item.lowest_heart_rate,
      average_breath: item.average_breath,
      total_sleep_hours: secToHours(item.total_sleep_duration),
      deep_sleep_hours: secToHours(item.deep_sleep_duration),
      rem_sleep_hours: secToHours(item.rem_sleep_duration),
      light_sleep_hours: secToHours(item.light_sleep_duration),
      awake_hours: secToHours(item.awake_time),
      sleep_latency_min: secToMin(item.latency),
      sleep_efficiency: item.efficiency,
    });
  }

  const hrByDay = new Map();
  for (const item of raw.heartrate?.data || []) {
    const day = dayKey(item);
    if (!day || !Number.isFinite(item.bpm)) continue;
    if (item.source === 'sleep') continue;
    if (!hrByDay.has(day)) hrByDay.set(day, []);
    hrByDay.get(day).push(item.bpm);
  }
  for (const [day, values] of hrByDay) {
    mergeDay(map, day, { daytime_heart_rate: mean(values) });
  }

  const batteryByDay = new Map();
  for (const item of raw.ring_battery_level?.data || []) {
    const day = dayKey(item);
    if (!day || !Number.isFinite(item.level)) continue;
    if (!batteryByDay.has(day)) batteryByDay.set(day, []);
    batteryByDay.get(day).push(item.level);
  }
  for (const [day, values] of batteryByDay) {
    mergeDay(map, day, { ring_battery: mean(values) });
  }

  for (const item of raw.workout?.data || []) {
    const day = dayKey(item);
    bump(map, day, 'workout_count', 1);
    if (Number.isFinite(item.calories)) bump(map, day, 'workout_calories', item.calories);
  }
  for (const item of raw.session?.data || []) {
    bump(map, dayKey(item), 'session_count', 1);
  }
  for (const item of [...(raw.tag?.data || []), ...(raw.enhanced_tag?.data || [])]) {
    bump(map, dayKey(item), 'tag_count', 1);
  }

  for (const item of raw.rest_mode_period?.data || []) {
    const start = item.start_day || dayKey(item);
    const end = item.end_day || start;
    if (!start) continue;
    let cursor = start;
    for (let i = 0; i < 400; i += 1) {
      mergeDay(map, cursor, { rest_mode: 1 });
      if (!end || cursor >= end) break;
      const next = new Date(`${cursor}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor = next.toISOString().slice(0, 10);
    }
  }

  const glucoseByDay = new Map();
  for (const item of raw.blood_glucose?.data || []) {
    const day = dayKey(item);
    const value = item.glucose ?? item.value ?? item.mg_dl ?? item.mmol_l;
    if (!day || !Number.isFinite(Number(value))) continue;
    if (!glucoseByDay.has(day)) glucoseByDay.set(day, []);
    glucoseByDay.get(day).push(Number(value));
  }
  for (const [day, values] of glucoseByDay) {
    mergeDay(map, day, { blood_glucose: mean(values) });
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

/** Short axis label for a period key. */
export function formatPeriodLabel(day, granularity = 'daily') {
  if (!day) return '';
  if (granularity === 'weekly') return day.replace(/^\d{4}-/, '');
  if (granularity === 'monthly') return day;
  return day.length >= 10 ? day.slice(5) : day;
}

/** Aggregate numeric metrics into weekly or monthly buckets using each metric's roll. */
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
      if (!values.length) {
        next[metric] = null;
        continue;
      }
      const sum = values.reduce((a, b) => a + b, 0);
      next[metric] = METRIC_DEFS[metric]?.roll === 'sum' ? sum : sum / values.length;
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

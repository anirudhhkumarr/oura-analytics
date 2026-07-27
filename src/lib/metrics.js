export const COLORS = [
  '#74e6cb', '#9fb8ff', '#ffc978', '#f4a4c0', '#8fd3ff', '#c5f0a4',
  '#ffb38a', '#b8a6ff', '#7ddea3', '#f0d27a', '#9ad7d0', '#e8a0ff',
];

export const CLUSTER_COLORS = ['#74e6cb', '#9fb8ff', '#ffc978', '#f4a4c0', '#8fd3ff'];

export const METRIC_DEFS = {
  sleep_score: { label: 'Sleep score', scale: 'score', unit: '' },
  readiness_score: { label: 'Readiness score', scale: 'score', unit: '' },
  activity_score: { label: 'Activity score', scale: 'score', unit: '' },
  steps: { label: 'Steps', scale: 'magnitude', unit: '' },
  active_calories: { label: 'Active calories', scale: 'magnitude', unit: 'kcal' },
  total_calories: { label: 'Total calories', scale: 'magnitude', unit: 'kcal' },
  average_hrv: { label: 'Overnight HRV', scale: 'magnitude', unit: 'ms' },
  average_heart_rate: { label: 'Resting HR', scale: 'magnitude', unit: 'bpm' },
  total_sleep_hours: { label: 'Total sleep', scale: 'magnitude', unit: 'h' },
  deep_sleep_hours: { label: 'Deep sleep', scale: 'magnitude', unit: 'h' },
  rem_sleep_hours: { label: 'REM sleep', scale: 'magnitude', unit: 'h' },
  sleep_efficiency: { label: 'Sleep efficiency', scale: 'score', unit: '%' },
  stress_high: { label: 'High stress', scale: 'magnitude', unit: 'min' },
  recovery_high: { label: 'High recovery', scale: 'magnitude', unit: 'min' },
  spo2: { label: 'SpO₂', scale: 'score', unit: '%' },
  vascular_age: { label: 'Vascular age', scale: 'magnitude', unit: 'y' },
};

export const DEFAULT_TS = ['sleep_score', 'readiness_score', 'activity_score', 'steps', 'average_hrv'];
export const DEFAULT_CLUSTER = ['sleep_score', 'readiness_score', 'activity_score', 'steps'];

export function metricLabel(key) {
  return METRIC_DEFS[key]?.label || key;
}

/** Predictor label; appends (t−lag) when lag > 0. */
export function laggedMetricLabel(key, lag = 0) {
  const base = metricLabel(key);
  const n = Math.max(0, Number(lag) || 0);
  return n > 0 ? `${base} (t−${n})` : base;
}

/** Outcome label; appends (t) when lag > 0 so both sides stay explicit. */
export function currentMetricLabel(key, lag = 0) {
  const base = metricLabel(key);
  const n = Math.max(0, Number(lag) || 0);
  return n > 0 ? `${base} (t)` : base;
}

export function metricColor(key, index) {
  return COLORS[index % COLORS.length];
}

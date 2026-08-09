export const COLORS = [
  '#74e6cb', '#9fb8ff', '#ffc978', '#f4a4c0', '#8fd3ff', '#c5f0a4',
  '#ffb38a', '#b8a6ff', '#7ddea3', '#f0d27a', '#9ad7d0', '#e8a0ff',
];

export const CLUSTER_COLORS = ['#74e6cb', '#9fb8ff', '#ffc978', '#f4a4c0', '#8fd3ff'];

export const METRIC_DEFS = {
  sleep_score: { label: 'Sleep score', scale: 'score', unit: '', roll: 'avg' },
  readiness_score: { label: 'Readiness score', scale: 'score', unit: '', roll: 'avg' },
  activity_score: { label: 'Activity score', scale: 'score', unit: '', roll: 'avg' },
  steps: { label: 'Steps', scale: 'magnitude', unit: '', roll: 'sum' },
  active_calories: { label: 'Active calories', scale: 'magnitude', unit: 'kcal', roll: 'sum' },
  total_calories: { label: 'Total calories', scale: 'magnitude', unit: 'kcal', roll: 'sum' },
  average_hrv: { label: 'Overnight HRV', scale: 'magnitude', unit: 'ms', roll: 'avg' },
  average_heart_rate: { label: 'Sleep HR', scale: 'magnitude', unit: 'bpm', roll: 'avg' },
  lowest_heart_rate: { label: 'Lowest HR', scale: 'magnitude', unit: 'bpm', roll: 'avg' },
  average_breath: { label: 'Respiratory rate', scale: 'magnitude', unit: '/min', roll: 'avg' },
  total_sleep_hours: { label: 'Total sleep', scale: 'magnitude', unit: 'h', roll: 'avg' },
  deep_sleep_hours: { label: 'Deep sleep', scale: 'magnitude', unit: 'h', roll: 'avg' },
  rem_sleep_hours: { label: 'REM sleep', scale: 'magnitude', unit: 'h', roll: 'avg' },
  light_sleep_hours: { label: 'Light sleep', scale: 'magnitude', unit: 'h', roll: 'avg' },
  awake_hours: { label: 'Awake in bed', scale: 'magnitude', unit: 'h', roll: 'avg' },
  sleep_latency_min: { label: 'Sleep latency', scale: 'magnitude', unit: 'min', roll: 'avg' },
  sleep_efficiency: { label: 'Sleep efficiency', scale: 'score', unit: '%', roll: 'avg' },
  temperature_deviation: { label: 'Temp deviation', scale: 'magnitude', unit: '°C', roll: 'avg' },
  temperature_trend: { label: 'Temp trend', scale: 'magnitude', unit: '°C', roll: 'avg' },
  hrv_balance: { label: 'HRV balance', scale: 'score', unit: '', roll: 'avg' },
  resting_heart_rate_score: { label: 'RHR contributor', scale: 'score', unit: '', roll: 'avg' },
  stress_high: { label: 'High stress', scale: 'magnitude', unit: 'min', roll: 'sum' },
  recovery_high: { label: 'High recovery', scale: 'magnitude', unit: 'min', roll: 'sum' },
  spo2: { label: 'SpO₂', scale: 'score', unit: '%', roll: 'avg' },
  vascular_age: { label: 'Vascular age', scale: 'magnitude', unit: 'y', roll: 'avg' },
  pulse_wave_velocity: { label: 'Pulse wave velocity', scale: 'magnitude', unit: 'm/s', roll: 'avg' },
  vo2_max: { label: 'VO₂ max', scale: 'magnitude', unit: '', roll: 'avg' },
  resilience_sleep: { label: 'Resilience (sleep)', scale: 'score', unit: '', roll: 'avg' },
  resilience_daytime: { label: 'Resilience (day)', scale: 'score', unit: '', roll: 'avg' },
  resilience_stress: { label: 'Resilience (stress)', scale: 'score', unit: '', roll: 'avg' },
  sedentary_hours: { label: 'Sedentary time', scale: 'magnitude', unit: 'h', roll: 'avg' },
  resting_hours: { label: 'Resting time', scale: 'magnitude', unit: 'h', roll: 'avg' },
  high_activity_hours: { label: 'High activity', scale: 'magnitude', unit: 'h', roll: 'avg' },
  medium_activity_hours: { label: 'Medium activity', scale: 'magnitude', unit: 'h', roll: 'avg' },
  low_activity_hours: { label: 'Low activity', scale: 'magnitude', unit: 'h', roll: 'avg' },
  inactivity_alerts: { label: 'Inactivity alerts', scale: 'magnitude', unit: '', roll: 'sum' },
  average_met: { label: 'Average MET', scale: 'magnitude', unit: '', roll: 'avg' },
  daytime_heart_rate: { label: 'Daytime HR', scale: 'magnitude', unit: 'bpm', roll: 'avg' },
  ring_battery: { label: 'Ring battery', scale: 'score', unit: '%', roll: 'avg' },
  workout_calories: { label: 'Workout calories', scale: 'magnitude', unit: 'kcal', roll: 'sum' },
  workout_count: { label: 'Workouts', scale: 'magnitude', unit: '', roll: 'sum' },
  session_count: { label: 'Sessions', scale: 'magnitude', unit: '', roll: 'sum' },
  tag_count: { label: 'Tags', scale: 'magnitude', unit: '', roll: 'sum' },
  rest_mode: { label: 'Rest mode', scale: 'score', unit: '', roll: 'avg' },
  blood_glucose: { label: 'Blood glucose', scale: 'magnitude', unit: '', roll: 'avg' },
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

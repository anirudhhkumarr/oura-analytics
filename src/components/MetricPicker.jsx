import { metricColor, metricLabel } from '../lib/metrics.js';

export default function MetricPicker({ metrics, selected, onChange }) {
  const selectedSet = new Set(selected);
  return (
    <div className="metric-grid">
      {metrics.map((key, index) => (
        <label key={key} className="metric-option">
          <input
            type="checkbox"
            checked={selectedSet.has(key)}
            onChange={() => {
              const next = selectedSet.has(key)
                ? selected.filter((item) => item !== key)
                : [...selected, key];
              onChange(next);
            }}
          />
          <span className="swatch" style={{ background: metricColor(key, index) }} aria-hidden="true" />
          <span className="metric-name">{metricLabel(key)}</span>
        </label>
      ))}
    </div>
  );
}

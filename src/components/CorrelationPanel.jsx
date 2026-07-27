import { useMemo, useState } from 'react';
import MetricPicker from './MetricPicker.jsx';
import { metricLabel } from '../lib/metrics.js';
import { paired } from '../lib/series.js';
import { heatColor, pearson } from '../lib/stats.js';

export default function CorrelationPanel({
  rows,
  metrics,
  selected,
  onSelectedChange,
  lag,
  onPickRegression,
}) {
  const [version, setVersion] = useState(0);

  const result = useMemo(() => {
    void version;
    const keys = selected.filter((key) => metrics.includes(key));
    if (keys.length < 2) {
      return { insight: 'Select at least two metrics for correlation.', matrix: null, pairs: [] };
    }
    const matrix = keys.map((a) => keys.map((b) => {
      const points = paired(rows, b, a, lag);
      return pearson(points.map((p) => p.x), points.map((p) => p.y));
    }));
    const pairs = [];
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        const r = matrix[i][j];
        if (r != null) pairs.push({ a: keys[i], b: keys[j], r });
      }
    }
    pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const top = pairs[0];
    const lagNote = lag > 0
      ? ` X is lagged by ${lag} period${lag === 1 ? '' : 's'} (previous values).`
      : '';
    return {
      keys,
      matrix,
      pairs: pairs.slice(0, 5),
      insight: top
        ? `Strongest link: ${metricLabel(top.a)} and ${metricLabel(top.b)} (r = ${top.r.toFixed(2)}). Click a cell to inspect with regression.${lagNote}`
        : `Not enough overlapping periods to compute correlations.${lagNote}`,
    };
  }, [rows, metrics, selected, lag, version]);

  return (
    <section className="panel" id="corr-panel">
      <div className="panel-head">
        <div>
          <h2>Correlation</h2>
          <p className="hint">
            Pearson relationships across selected metrics. Lag shifts the predictor earlier in time.
          </p>
        </div>
        <button type="button" className="primary" onClick={() => setVersion((v) => v + 1)}>
          Run correlation
        </button>
      </div>
      <MetricPicker metrics={metrics} selected={selected} onChange={onSelectedChange} />
      {result.matrix ? (
        <div className="heatmap-wrap">
          <table className="heatmap">
            <thead>
              <tr>
                <th />
                {result.keys.map((key) => <th key={key}>{metricLabel(key)}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.keys.map((rowKey, i) => (
                <tr key={rowKey}>
                  <th>{metricLabel(rowKey)}</th>
                  {result.keys.map((colKey, j) => {
                    const r = result.matrix[i][j];
                    return (
                      <td
                        key={colKey}
                        style={{ background: heatColor(r) }}
                        title="Set regression axes"
                        onClick={() => onPickRegression(colKey, rowKey)}
                      >
                        {r == null ? '—' : r.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <ul className="pairs">
        {result.pairs.map((pair) => (
          <li key={`${pair.a}-${pair.b}`}>
            {metricLabel(pair.a)} ↔ {metricLabel(pair.b)}: r = {pair.r.toFixed(2)} ({pair.r >= 0 ? 'positive' : 'negative'})
          </li>
        ))}
      </ul>
      {result.insight ? <div className="insight">{result.insight}</div> : null}
    </section>
  );
}

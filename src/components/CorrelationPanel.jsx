import { useMemo } from 'react';
import MetricPicker from './MetricPicker.jsx';
import { currentMetricLabel, laggedMetricLabel } from '../lib/metrics.js';
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
  const result = useMemo(() => {
    const cols = selected.filter((key) => metrics.includes(key));
    const rowKeys = metrics;
    if (!cols.length) {
      return { insight: 'Select at least one column metric for correlation.', matrix: null, pairs: [] };
    }
    // Cell [row][col] = corr(col at t−lag, row at t). Columns follow selection; rows stay all metrics.
    const matrix = rowKeys.map((rowKey) => cols.map((colKey) => {
      const points = paired(rows, colKey, rowKey, lag);
      return pearson(points.map((p) => p.x), points.map((p) => p.y));
    }));
    const pairs = [];
    for (let i = 0; i < rowKeys.length; i += 1) {
      for (let j = 0; j < cols.length; j += 1) {
        if (lag === 0 && rowKeys[i] === cols[j]) continue;
        const r = matrix[i][j];
        if (r != null) pairs.push({ x: cols[j], y: rowKeys[i], r });
      }
    }
    pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const top = pairs[0];
    return {
      cols,
      rowKeys,
      matrix,
      pairs: pairs.slice(0, 5),
      insight: top
        ? `Strongest link: ${laggedMetricLabel(top.x, lag)} → ${currentMetricLabel(top.y, lag)} (r = ${top.r.toFixed(2)}). Click a cell to inspect with regression.`
        : 'Not enough overlapping periods to compute correlations.',
    };
  }, [rows, metrics, selected, lag]);

  return (
    <section className="panel" id="corr-panel">
      <div className="panel-head">
        <div>
          <h2>Correlation{lag > 0 ? ` · lag ${lag}` : ''}</h2>
          <p className="hint">
            {lag > 0
              ? `Select column predictors (t−${lag}); rows show every outcome at t.`
              : 'Selection filters columns; rows always include every metric.'}
          </p>
        </div>
      </div>
      <MetricPicker metrics={metrics} selected={selected} onChange={onSelectedChange} />
      {result.matrix ? (
        <div className="heatmap-wrap">
          <table className="heatmap">
            <thead>
              <tr>
                <th>{lag > 0 ? `row (t) \\ col (t−${lag})` : ''}</th>
                {result.cols.map((key) => (
                  <th key={key}>{laggedMetricLabel(key, lag)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rowKeys.map((rowKey, i) => (
                <tr key={rowKey}>
                  <th>{currentMetricLabel(rowKey, lag)}</th>
                  {result.cols.map((colKey, j) => {
                    const r = result.matrix[i][j];
                    return (
                      <td
                        key={colKey}
                        style={{ background: heatColor(r) }}
                        title={`${laggedMetricLabel(colKey, lag)} → ${currentMetricLabel(rowKey, lag)}`}
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
          <li key={`${pair.x}-${pair.y}`}>
            {laggedMetricLabel(pair.x, lag)} → {currentMetricLabel(pair.y, lag)}: r = {pair.r.toFixed(2)} ({pair.r >= 0 ? 'positive' : 'negative'})
          </li>
        ))}
      </ul>
      {result.insight ? <div className="insight">{result.insight}</div> : null}
    </section>
  );
}

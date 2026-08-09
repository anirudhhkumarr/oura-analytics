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
      return { insight: 'Pick at least one metric across the top to compare.', matrix: null, pairs: [] };
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
    const strength = top && Math.abs(top.r) >= 0.6 ? 'strong'
      : top && Math.abs(top.r) >= 0.3 ? 'moderate'
        : 'mild';
    return {
      cols,
      rowKeys,
      matrix,
      pairs: pairs.slice(0, 5),
      insight: top
        ? `Closest relationship: ${laggedMetricLabel(top.x, lag)} with ${currentMetricLabel(top.y, lag)} (${strength}, ${top.r.toFixed(2)}). Tap a cell to explore it below.`
        : 'Not enough shared days yet to compare these metrics.',
    };
  }, [rows, metrics, selected, lag]);

  return (
    <section className="panel" id="corr-panel">
      <div className="panel-head">
        <div>
          <h2>Correlation{lag > 0 ? ` · looking back ${lag}` : ''}</h2>
          <p className="hint">
            {lag > 0
              ? `Choose which earlier metrics appear across the top. Every metric stays listed on the side for comparison.`
              : 'Choose which metrics appear across the top. Every metric stays listed on the side.'}
          </p>
        </div>
      </div>
      <MetricPicker metrics={metrics} selected={selected} onChange={onSelectedChange} />
      {result.matrix ? (
        <div className="heatmap-wrap">
          <table className="heatmap">
            <thead>
              <tr>
                <th>{lag > 0 ? 'Earlier →' : ''}</th>
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
            {laggedMetricLabel(pair.x, lag)} with {currentMetricLabel(pair.y, lag)}: {pair.r.toFixed(2)} ({pair.r >= 0 ? 'move together' : 'move opposite'})
          </li>
        ))}
      </ul>
      {result.insight ? <div className="insight">{result.insight}</div> : null}
    </section>
  );
}

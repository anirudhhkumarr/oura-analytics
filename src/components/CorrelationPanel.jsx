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
      return { insight: 'Pick at least one column metric to compare.', matrix: null, pairs: [] };
    }
    // Cell [row][col] = corr(row at t−lag, col at t): how the row affects the column.
    const matrix = rowKeys.map((rowKey) => cols.map((colKey) => {
      const points = paired(rows, rowKey, colKey, lag);
      return pearson(points.map((p) => p.x), points.map((p) => p.y));
    }));
    const pairs = [];
    for (let i = 0; i < rowKeys.length; i += 1) {
      for (let j = 0; j < cols.length; j += 1) {
        if (lag === 0 && rowKeys[i] === cols[j]) continue;
        const r = matrix[i][j];
        if (r != null) pairs.push({ x: rowKeys[i], y: cols[j], r });
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
        ? `Strongest: ${laggedMetricLabel(top.x, lag)} → ${currentMetricLabel(top.y, lag)} (${strength}, ${top.r.toFixed(2)}). Tap a cell to explore it below.`
        : 'Not enough shared days yet to compare these metrics.',
    };
  }, [rows, metrics, selected, lag]);

  return (
    <section className="panel" id="corr-panel">
      <div className="panel-head">
        <div>
          <h2>Correlation{lag > 0 ? ` · −${lag}` : ''}</h2>
          <p className="hint">
            {lag > 0
              ? 'Select columns to study. Rows show earlier metrics that may affect them.'
              : 'Select columns to study. Rows show what may affect them.'}
          </p>
        </div>
      </div>
      <MetricPicker metrics={metrics} selected={selected} onChange={onSelectedChange} />
      {result.matrix ? (
        <div className="heatmap-wrap">
          <table className="heatmap">
            <thead>
              <tr>
                <th />
                {result.cols.map((key) => (
                  <th key={key}>{currentMetricLabel(key, lag)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rowKeys.map((rowKey, i) => (
                <tr key={rowKey}>
                  <th>{laggedMetricLabel(rowKey, lag)}</th>
                  {result.cols.map((colKey, j) => {
                    const r = result.matrix[i][j];
                    return (
                      <td
                        key={colKey}
                        style={{ background: heatColor(r) }}
                        title={`${laggedMetricLabel(rowKey, lag)} → ${currentMetricLabel(colKey, lag)}`}
                        onClick={() => onPickRegression(rowKey, colKey)}
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
            {laggedMetricLabel(pair.x, lag)} → {currentMetricLabel(pair.y, lag)}: {pair.r.toFixed(2)} ({pair.r >= 0 ? 'move together' : 'move opposite'})
          </li>
        ))}
      </ul>
      {result.insight ? <div className="insight">{result.insight}</div> : null}
    </section>
  );
}

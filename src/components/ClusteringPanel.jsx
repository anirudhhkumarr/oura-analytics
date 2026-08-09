import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { useMemo } from 'react';
import MetricPicker from './MetricPicker.jsx';
import { CLUSTER_COLORS, metricLabel } from '../lib/metrics.js';
import { bestKmeans } from '../lib/stats.js';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

export default function ClusteringPanel({
  rows,
  metrics,
  selected,
  onSelectedChange,
  k,
  onKChange,
}) {
  const result = useMemo(() => {
    const keys = selected.filter((key) => metrics.includes(key));
    if (keys.length < 2) {
      return { insight: 'Pick at least two metrics to group your days.', chart: null, table: null };
    }
    const completeRows = [];
    const matrix = [];
    for (const row of rows) {
      const values = keys.map((key) => row[key]);
      if (values.every((value) => Number.isFinite(value))) {
        completeRows.push(row);
        matrix.push(values);
      }
    }
    if (matrix.length < k) {
      return { insight: `Need at least ${k} days with all of these metrics filled in.`, chart: null, table: null };
    }
    const clustered = bestKmeans(matrix, k);
    if (!clustered) {
      return { insight: 'Could not group these days. Try a different set of metrics.', chart: null, table: null };
    }
    const xKey = keys[0];
    const yKey = keys[1];
    const datasets = Array.from({ length: k }, (_, c) => ({
      label: `Group ${c + 1} (${clustered.counts[c]} days)`,
      data: completeRows
        .map((row, i) => (clustered.labels[i] === c ? { x: row[xKey], y: row[yKey] } : null))
        .filter(Boolean),
      backgroundColor: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
      borderColor: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
    }));
    const largest = clustered.counts.indexOf(Math.max(...clustered.counts));
    return {
      insight:
        `Found ${k} patterns across ${completeRows.length} days using ${keys.map(metricLabel).join(', ')}. `
        + `The largest is Group ${largest + 1} (${clustered.counts[largest]} days).`,
      chart: {
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#edf4ff' } } },
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: metricLabel(xKey), color: '#94a6bd' },
              ticks: { color: '#94a6bd' },
              grid: { color: '#23334a' },
            },
            y: {
              title: { display: true, text: metricLabel(yKey), color: '#94a6bd' },
              ticks: { color: '#94a6bd' },
              grid: { color: '#23334a' },
            },
          },
        },
      },
      table: { keys, centroids: clustered.centroids, counts: clustered.counts, k },
    };
  }, [rows, metrics, selected, k]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Day patterns</h2>
          <p className="hint">
            Group similar days together. The chart uses the first two metrics you pick.
          </p>
        </div>
      </div>
      <div className="row-controls">
        <label className="field">
          <span>Number of groups</span>
          <select value={String(k)} onChange={(e) => onKChange(Number(e.target.value))}>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>
      </div>
      <MetricPicker metrics={metrics} selected={selected} onChange={onSelectedChange} />
      <div className="chart-wrap">
        {result.chart ? <Scatter data={result.chart.data} options={result.chart.options} /> : null}
      </div>
      {result.table ? (
        <table className="centroids">
          <thead>
            <tr>
              <th>Group</th>
              <th>Days</th>
              {result.table.keys.map((key) => <th key={key}>{metricLabel(key)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: result.table.k }, (_, c) => (
              <tr key={c}>
                <td>Group {c + 1}</td>
                <td>{result.table.counts[c]}</td>
                {result.table.centroids[c].map((value, i) => (
                  <td key={result.table.keys[i]}>{Number.isFinite(value) ? value.toFixed(1) : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {result.insight ? <div className="insight">{result.insight}</div> : null}
    </section>
  );
}

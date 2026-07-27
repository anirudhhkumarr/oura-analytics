import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { useMemo, useState } from 'react';
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
  const [version, setVersion] = useState(0);

  const result = useMemo(() => {
    void version;
    const keys = selected.filter((key) => metrics.includes(key));
    if (keys.length < 2) {
      return { insight: 'Select at least two features for clustering.', chart: null, table: null };
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
      return { insight: `Need at least ${k} complete periods for k = ${k}.`, chart: null, table: null };
    }
    const clustered = bestKmeans(matrix, k);
    if (!clustered) {
      return { insight: 'Clustering failed for this selection.', chart: null, table: null };
    }
    const xKey = keys[0];
    const yKey = keys[1];
    const datasets = Array.from({ length: k }, (_, c) => ({
      label: `Cluster ${c + 1} (n=${clustered.counts[c]})`,
      data: completeRows
        .map((row, i) => (clustered.labels[i] === c ? { x: row[xKey], y: row[yKey] } : null))
        .filter(Boolean),
      backgroundColor: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
      borderColor: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
    }));
    const largest = clustered.counts.indexOf(Math.max(...clustered.counts));
    return {
      insight:
        `Grouped ${completeRows.length} periods into ${k} clusters using ${keys.map(metricLabel).join(', ')}. `
        + `Largest group is Cluster ${largest + 1} (${clustered.counts[largest]} periods).`,
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
  }, [rows, metrics, selected, k, version]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Clustering</h2>
          <p className="hint">
            Group similar periods with k-means. The scatter uses the first two selected metrics.
          </p>
        </div>
        <button type="button" className="primary" onClick={() => setVersion((v) => v + 1)}>
          Run clustering
        </button>
      </div>
      <div className="row-controls">
        <label className="field">
          <span>Clusters (k)</span>
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
              <th>Cluster</th>
              <th>Periods</th>
              {result.table.keys.map((key) => <th key={key}>{metricLabel(key)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: result.table.k }, (_, c) => (
              <tr key={c}>
                <td>Cluster {c + 1}</td>
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

import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useMemo, useState } from 'react';
import { metricLabel } from '../lib/metrics.js';
import { paired } from '../lib/series.js';
import { ols } from '../lib/stats.js';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function RegressionPanel({ rows, metrics, xKey, yKey, onAxesChange, lag }) {
  const [version, setVersion] = useState(0);

  const result = useMemo(() => {
    void version;
    if (!xKey || !yKey || xKey === yKey) {
      return { insight: 'Choose two different metrics.', chart: null };
    }
    const points = paired(rows, xKey, yKey, lag);
    const fit = ols(points);
    if (!fit) {
      return { insight: 'Need at least 3 overlapping periods for regression.', chart: null };
    }
    const xs = points.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const line = [
      { x: minX, y: fit.intercept + fit.slope * minX },
      { x: maxX, y: fit.intercept + fit.slope * maxX },
    ];
    const direction = fit.slope >= 0 ? 'higher' : 'lower';
    const strength = Math.abs(fit.r) >= 0.6 ? 'strong' : Math.abs(fit.r) >= 0.3 ? 'moderate' : 'weak';
    const lagNote = lag > 0 ? ` X uses values from ${lag} period${lag === 1 ? '' : 's'} earlier.` : '';
    return {
      insight:
        `${metricLabel(yKey)} = ${fit.intercept.toFixed(2)} + ${fit.slope.toFixed(4)} × ${metricLabel(xKey)}. `
        + `R² = ${fit.r2?.toFixed(3) ?? '—'}, r = ${fit.r?.toFixed(3) ?? '—'}, n = ${fit.n}. `
        + `${strength[0].toUpperCase()}${strength.slice(1)} association: higher ${metricLabel(xKey)} tends to mean ${direction} ${metricLabel(yKey)}.${lagNote}`,
      chart: {
        data: {
          datasets: [
            {
              type: 'scatter',
              label: 'Periods',
              data: points,
              backgroundColor: '#9fb8ff',
              borderColor: '#9fb8ff',
            },
            {
              type: 'line',
              label: 'Fit',
              data: line,
              borderColor: '#74e6cb',
              backgroundColor: 'transparent',
              pointRadius: 0,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#edf4ff' } } },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: lag > 0 ? `${metricLabel(xKey)} (t−${lag})` : metricLabel(xKey),
                color: '#94a6bd',
              },
              ticks: { color: '#94a6bd' },
              grid: { color: '#23334a' },
            },
            y: {
              title: { display: true, text: `${metricLabel(yKey)} (t)`, color: '#94a6bd' },
              ticks: { color: '#94a6bd' },
              grid: { color: '#23334a' },
            },
          },
        },
      },
    };
  }, [rows, xKey, yKey, lag, version]);

  return (
    <section className="panel" id="reg-panel">
      <div className="panel-head">
        <div>
          <h2>Regression</h2>
          <p className="hint">Estimate how a predictor relates to an outcome, optionally with lag.</p>
        </div>
        <button type="button" className="primary" onClick={() => setVersion((v) => v + 1)}>
          Run regression
        </button>
      </div>
      <div className="row-controls">
        <label className="field">
          <span>X (predictor{lag > 0 ? `, t−${lag}` : ''})</span>
          <select value={xKey || ''} onChange={(e) => onAxesChange(e.target.value, yKey)}>
            {metrics.map((key) => <option key={key} value={key}>{metricLabel(key)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Y (outcome, t)</span>
          <select value={yKey || ''} onChange={(e) => onAxesChange(xKey, e.target.value)}>
            {metrics.map((key) => <option key={key} value={key}>{metricLabel(key)}</option>)}
          </select>
        </label>
      </div>
      <div className="chart-wrap">
        {result.chart ? <Chart type="scatter" data={result.chart.data} options={result.chart.options} /> : null}
      </div>
      {result.insight ? <div className="insight">{result.insight}</div> : null}
    </section>
  );
}

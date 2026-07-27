import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useMemo } from 'react';
import { currentMetricLabel, laggedMetricLabel } from '../lib/metrics.js';
import { paired } from '../lib/series.js';
import { ols } from '../lib/stats.js';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function RegressionPanel({ rows, metrics, xKey, yKey, onAxesChange, lag }) {
  const result = useMemo(() => {
    if (!xKey || !yKey || xKey === yKey) {
      return { insight: 'Choose two different metrics.', chart: null };
    }
    const xLabel = laggedMetricLabel(xKey, lag);
    const yLabel = currentMetricLabel(yKey, lag);
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
    return {
      insight:
        `${yLabel} = ${fit.intercept.toFixed(2)} + ${fit.slope.toFixed(4)} × ${xLabel}. `
        + `R² = ${fit.r2?.toFixed(3) ?? '—'}, r = ${fit.r?.toFixed(3) ?? '—'}, n = ${fit.n}. `
        + `${strength[0].toUpperCase()}${strength.slice(1)} association: higher ${xLabel} tends to mean ${direction} ${yLabel}.`,
      chart: {
        data: {
          datasets: [
            {
              type: 'scatter',
              label: lag > 0 ? `${yLabel} vs ${xLabel}` : 'Periods',
              data: points,
              backgroundColor: '#9fb8ff',
              borderColor: '#9fb8ff',
            },
            {
              type: 'line',
              label: lag > 0 ? `Fit · lag ${lag}` : 'Fit',
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
          plugins: {
            legend: { labels: { color: '#edf4ff' } },
            tooltip: {
              callbacks: {
                label(ctx) {
                  const point = ctx.raw;
                  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
                    return `${xLabel}: ${point.x.toFixed?.(2) ?? point.x}, ${yLabel}: ${point.y.toFixed?.(2) ?? point.y}`;
                  }
                  return ctx.dataset.label;
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: xLabel,
                color: '#94a6bd',
              },
              ticks: { color: '#94a6bd' },
              grid: { color: '#23334a' },
            },
            y: {
              title: { display: true, text: yLabel, color: '#94a6bd' },
              ticks: { color: '#94a6bd' },
              grid: { color: '#23334a' },
            },
          },
        },
      },
    };
  }, [rows, xKey, yKey, lag]);

  return (
    <section className="panel" id="reg-panel">
      <div className="panel-head">
        <div>
          <h2>Regression{lag > 0 ? ` · lag ${lag}` : ''}</h2>
          <p className="hint">
            {lag > 0
              ? `X is measured ${lag} period${lag === 1 ? '' : 's'} earlier than Y.`
              : 'Estimate how a predictor relates to an outcome.'}
          </p>
        </div>
      </div>
      <div className="row-controls">
        <label className="field">
          <span>{lag > 0 ? `X · t−${lag}` : 'X (predictor)'}</span>
          <select value={xKey || ''} onChange={(e) => onAxesChange(e.target.value, yKey)}>
            {metrics.map((key) => (
              <option key={key} value={key}>{laggedMetricLabel(key, lag)}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{lag > 0 ? 'Y · t' : 'Y (outcome)'}</span>
          <select value={yKey || ''} onChange={(e) => onAxesChange(xKey, e.target.value)}>
            {metrics.map((key) => (
              <option key={key} value={key}>{currentMetricLabel(key, lag)}</option>
            ))}
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

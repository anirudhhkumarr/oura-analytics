import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useMemo } from 'react';
import MetricPicker from './MetricPicker.jsx';
import { METRIC_DEFS, metricColor, metricLabel } from '../lib/metrics.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export default function TimeseriesPanel({ rows, metrics, selected, onSelectedChange, granularity }) {
  const chart = useMemo(() => {
    const keys = selected.filter((key) => metrics.includes(key));
    if (!keys.length || !rows.length) return null;
    const hasScore = keys.some((key) => METRIC_DEFS[key]?.scale === 'score');
    const hasMag = keys.some((key) => METRIC_DEFS[key]?.scale === 'magnitude');
    const dual = hasScore && hasMag;
    const labels = rows.map((row) => (granularity === 'daily' ? row.day.slice(5) : row.day));
    const datasets = keys.map((key) => {
      const index = metrics.indexOf(key);
      const useRight = dual && METRIC_DEFS[key]?.scale === 'magnitude';
      return {
        label: metricLabel(key),
        data: rows.map((row) => (Number.isFinite(row[key]) ? row[key] : null)),
        borderColor: metricColor(key, index),
        backgroundColor: 'transparent',
        tension: 0.3,
        spanGaps: true,
        yAxisID: useRight ? 'y1' : 'y',
      };
    });
    const scales = {
      x: { ticks: { color: '#94a6bd' }, grid: { display: false } },
      y: {
        type: 'linear',
        position: 'left',
        ticks: { color: '#94a6bd' },
        grid: { color: '#23334a' },
        title: dual ? { display: true, text: 'Scores', color: '#94a6bd' } : undefined,
      },
    };
    if (dual) {
      scales.y1 = {
        type: 'linear',
        position: 'right',
        ticks: { color: '#94a6bd' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Magnitude', color: '#94a6bd' },
      };
    }
    return {
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#edf4ff' } } },
        scales,
      },
    };
  }, [rows, metrics, selected, granularity]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Timeseries explorer</h2>
          <p className="hint">
            Select metrics to plot on {granularity} data. Score-scale and magnitude metrics use separate Y-axes.
          </p>
        </div>
      </div>
      <MetricPicker metrics={metrics} selected={selected} onChange={onSelectedChange} />
      <div className="chart-wrap">
        {chart ? <Line data={chart.data} options={chart.options} /> : null}
      </div>
    </section>
  );
}

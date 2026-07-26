import { useMemo } from 'react';
import ClusteringPanel from './components/ClusteringPanel.jsx';
import CollectionsDetails from './components/CollectionsDetails.jsx';
import CorrelationPanel from './components/CorrelationPanel.jsx';
import Header from './components/Header.jsx';
import Notice from './components/Notice.jsx';
import RegressionPanel from './components/RegressionPanel.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import TimeseriesPanel from './components/TimeseriesPanel.jsx';
import { useDashboard } from './hooks/useDashboard.js';
import { DEFAULT_CLUSTER, DEFAULT_TS } from './lib/metrics.js';

function resolveSelection(available, stored, fallback) {
  const source = Array.isArray(stored) ? stored : fallback;
  return source.filter((key) => available.includes(key));
}

export default function App() {
  const {
    days,
    setDays,
    granularity,
    setGranularity,
    lag,
    setLag,
    ui,
    persistUi,
    dashboard,
    rows,
    metrics,
    notice,
    load,
    connect,
    isHosted,
  } = useDashboard();

  const tsSelected = useMemo(
    () => resolveSelection(metrics, ui.tsMetrics, DEFAULT_TS),
    [metrics, ui.tsMetrics],
  );
  const corrSelected = useMemo(
    () => resolveSelection(metrics, ui.corrMetrics, tsSelected.length ? tsSelected : DEFAULT_TS),
    [metrics, ui.corrMetrics, tsSelected],
  );
  const clusterSelected = useMemo(
    () => resolveSelection(metrics, ui.clusterMetrics, DEFAULT_CLUSTER),
    [metrics, ui.clusterMetrics],
  );

  const regX = metrics.includes(ui.regX) ? ui.regX
    : metrics.includes('steps') ? 'steps'
      : metrics.includes('sleep_score') ? 'sleep_score'
        : metrics[0];
  const regY = metrics.includes(ui.regY) ? ui.regY
    : metrics.includes('readiness_score') ? 'readiness_score'
      : metrics.find((key) => key !== regX) || metrics[0];

  const ready = metrics.length >= 2;

  return (
    <main>
      <Header
        days={days}
        onDaysChange={setDays}
        granularity={granularity}
        onGranularityChange={setGranularity}
        lag={lag}
        onLagChange={setLag}
        onConnect={connect}
        onRefresh={() => load({ force: true })}
        isHosted={isHosted}
      />
      <Notice message={notice.message} error={notice.error} />
      <SummaryCards summary={dashboard?.summary} />

      {ready ? (
        <>
          <TimeseriesPanel
            rows={rows}
            metrics={metrics}
            selected={tsSelected}
            onSelectedChange={(next) => persistUi({ tsMetrics: next })}
            granularity={granularity}
          />
          <CorrelationPanel
            rows={rows}
            metrics={metrics}
            selected={corrSelected}
            onSelectedChange={(next) => persistUi({ corrMetrics: next })}
            lag={lag}
            onPickRegression={(x, y) => {
              persistUi({ regX: x, regY: y });
              document.getElementById('reg-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
          <RegressionPanel
            rows={rows}
            metrics={metrics}
            xKey={regX}
            yKey={regY}
            onAxesChange={(x, y) => persistUi({ regX: x, regY: y })}
            lag={lag}
          />
          <ClusteringPanel
            rows={rows}
            metrics={metrics}
            selected={clusterSelected}
            onSelectedChange={(next) => persistUi({ clusterMetrics: next })}
            k={ui.clusterK || 3}
            onKChange={(next) => persistUi({ clusterK: next })}
          />
        </>
      ) : (
        <section className="panel">
          <h2>Analytics</h2>
          <p className="hint">Connect Oura and load data to unlock timeseries, correlation, regression, and clustering.</p>
        </section>
      )}

      <CollectionsDetails dashboard={dashboard} />
      <footer>
        Connects through a local bridge at <code>localhost:8780</code>.
        Dashboard data is cached in this browser; your Oura token stays on your computer.
      </footer>
    </main>
  );
}

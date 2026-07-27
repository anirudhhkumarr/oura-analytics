export default function Header({
  days,
  onDaysChange,
  granularity,
  onGranularityChange,
  lag,
  onLagChange,
  clientId,
  onClientIdChange,
  apiBase,
  onApiBaseChange,
  redirectUri,
  connected,
  onConnect,
  onDisconnect,
  onRefresh,
}) {
  return (
    <header className="app-header">
      <div>
        <h1>Oura Analytics</h1>
        <p className="sub">Explore timeseries, lagged correlations, and what drives your recovery.</p>
      </div>
      <div className="controls">
        <label className="field wide">
          <span>Oura Client ID</span>
          <input
            value={clientId}
            onChange={(e) => onClientIdChange(e.target.value)}
            placeholder="from Oura developer portal"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="field wide">
          <span>API base (optional proxy)</span>
          <input
            value={apiBase}
            onChange={(e) => onApiBaseChange(e.target.value)}
            placeholder="https://your-worker.workers.dev"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>Range</span>
          <select value={days} onChange={(e) => onDaysChange(e.target.value)}>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
        <label className="field">
          <span>Aggregation</span>
          <select value={granularity} onChange={(e) => onGranularityChange(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly avg</option>
            <option value="monthly">Monthly avg</option>
          </select>
        </label>
        <label className="field">
          <span>Lag (X offset)</span>
          <select value={String(lag)} onChange={(e) => onLagChange(Number(e.target.value))}>
            <option value="0">0 periods</option>
            <option value="1">1 period</option>
            <option value="2">2 periods</option>
            <option value="3">3 periods</option>
            <option value="7">7 periods</option>
          </select>
        </label>
        <button type="button" className="primary" onClick={onConnect}>
          {connected ? 'Reconnect Oura' : 'Connect Oura'}
        </button>
        {connected ? (
          <button type="button" onClick={onDisconnect}>Disconnect</button>
        ) : null}
        <button type="button" onClick={onRefresh}>Refresh data</button>
      </div>
      <p className="redirect-hint">
        Oura Redirect URI (register exactly):
        {' '}
        <code>{redirectUri}</code>
      </p>
    </header>
  );
}

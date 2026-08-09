export default function Header({
  days,
  onDaysChange,
  granularity,
  onGranularityChange,
  lag,
  onLagChange,
  connected,
  onConnect,
  onDisconnect,
  onRefresh,
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <h1>Oura Analytics</h1>
        <p className="sub">Recovery trends and what drives readiness.</p>
      </div>
      <div className="toolbar">
        <div className="control-group" role="group" aria-label="Analysis filters">
          <label className="control">
            <span className="control-label">Range</span>
            <span className="select-wrap">
              <select value={days} onChange={(e) => onDaysChange(e.target.value)}>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </span>
          </label>
          <label className="control">
            <span className="control-label">View as</span>
            <span className="select-wrap">
              <select value={granularity} onChange={(e) => onGranularityChange(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </span>
          </label>
          <label className="control">
            <span className="control-label">Compare with</span>
            <span className="select-wrap">
              <select value={String(lag)} onChange={(e) => onLagChange(Number(e.target.value))}>
                <option value="0">Same time</option>
                <option value="1">1 earlier</option>
                <option value="2">2 earlier</option>
                <option value="3">3 earlier</option>
                <option value="7">7 earlier</option>
              </select>
            </span>
          </label>
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={onConnect}>
            {connected ? 'Reconnect' : 'Connect Oura'}
          </button>
          {connected ? (
            <button type="button" className="ghost" onClick={onDisconnect}>Disconnect</button>
          ) : null}
          <button type="button" className="ghost" onClick={onRefresh}>Refresh</button>
        </div>
      </div>
    </header>
  );
}

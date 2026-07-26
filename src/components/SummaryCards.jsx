export default function SummaryCards({ summary }) {
  const s = summary || {};
  return (
    <section className="cards">
      <div className="card"><div className="label">Sleep score</div><div className="value">{s.sleep ?? '—'}</div></div>
      <div className="card"><div className="label">Readiness score</div><div className="value">{s.readiness ?? '—'}</div></div>
      <div className="card"><div className="label">Activity score</div><div className="value">{s.activity ?? '—'}</div></div>
      <div className="card"><div className="label">Latest steps</div><div className="value">{s.steps?.toLocaleString?.() ?? '—'}</div></div>
      <div className="card"><div className="label">Overnight HRV</div><div className="value">{s.hrv ? `${s.hrv} ms` : '—'}</div></div>
      <div className="card"><div className="label">SpO₂</div><div className="value">{s.spo2 ? `${s.spo2}%` : '—'}</div></div>
    </section>
  );
}

export default function CollectionsDetails({ dashboard }) {
  if (!dashboard) {
    return (
      <details>
        <summary>Data collections</summary>
        <div className="collections">Connect your account to load available collections.</div>
      </details>
    );
  }
  const counts = Object.entries(dashboard.collection_counts || {})
    .map(([name, count]) => `${name}: ${count}`)
    .join('\n');
  const failures = Object.entries(dashboard.errors || {})
    .map(([name, error]) => `${name}: unavailable (${error})`)
    .join('\n');
  return (
    <details>
      <summary>Data collections</summary>
      <div className="collections">{[counts, failures].filter(Boolean).join('\n') || 'No collections loaded.'}</div>
    </details>
  );
}

export default function Notice({ message, error }) {
  if (!message) return null;
  return <div className={`notice show${error ? ' error' : ''}`}>{message}</div>;
}

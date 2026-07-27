import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const DB_KEY = 'oura-analytics-sqlite';

let dbPromise;

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function persist(db) {
  try {
    localStorage.setItem(DB_KEY, bytesToBase64(db.export()));
  } catch {
    /* quota / private mode — best-effort */
  }
}

async function openDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => wasmUrl });
      let db;
      try {
        const saved = localStorage.getItem(DB_KEY);
        db = saved ? new SQL.Database(base64ToBytes(saved)) : new SQL.Database();
      } catch {
        db = new SQL.Database();
      }
      db.run(`
        CREATE TABLE IF NOT EXISTS dashboard_cache (
          days TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          fetched_at INTEGER NOT NULL
        )
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function cacheGet(days) {
  try {
    const db = await openDb();
    const result = db.exec(
      'SELECT payload, fetched_at FROM dashboard_cache WHERE days = ?',
      [String(days)],
    );
    const row = result[0]?.values?.[0];
    if (!row) return null;
    return {
      data: JSON.parse(row[0]),
      fetchedAt: row[1],
    };
  } catch {
    return null;
  }
}

export async function cachePut(days, data) {
  try {
    const db = await openDb();
    db.run(
      `INSERT INTO dashboard_cache (days, payload, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT(days) DO UPDATE SET
         payload = excluded.payload,
         fetched_at = excluded.fetched_at`,
      [String(days), JSON.stringify(data), Date.now()],
    );
    persist(db);
  } catch {
    /* best-effort */
  }
}

export function cacheAge(fetchedAt) {
  const minutes = Math.max(1, Math.round((Date.now() - fetchedAt) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

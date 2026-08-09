import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const DB_KEY = 'oura-analytics-sqlite';
const SCHEMA_VERSION = 2;

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

function migrate(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      day TEXT,
      payload TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_items_collection_day ON items(collection, day)');

  const versionRow = db.exec("SELECT value FROM meta WHERE key = 'schema_version'");
  const version = Number(versionRow[0]?.values?.[0]?.[0] || 0);
  if (version < SCHEMA_VERSION) {
    // Drop legacy whole-dashboard blobs; history is stored per item now.
    db.run('DROP TABLE IF EXISTS dashboard_cache');
    db.run(
      "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [String(SCHEMA_VERSION)],
    );
    persist(db);
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
      migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

export function itemDay(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.day) return item.day;
  const stamp = item.timestamp || item.bedtime_start || item.start_datetime || item.start_time || '';
  return stamp ? String(stamp).slice(0, 10) : null;
}

export function itemId(item, fallback = 'item') {
  if (item?.id != null) return String(item.id);
  if (item?.timestamp_unix != null) return `ts:${item.timestamp_unix}`;
  const stamp = item?.timestamp || item?.start_datetime || item?.start_time || '';
  if (stamp) return `ts:${stamp}`;
  const day = itemDay(item);
  return day ? `${day}:${fallback}` : fallback;
}

export async function upsertCollectionItems(collection, items) {
  if (!Array.isArray(items) || !items.length) return;
  try {
    const db = await openDb();
    db.run('BEGIN');
    try {
      for (const [index, item] of items.entries()) {
        db.run(
          `INSERT INTO items (collection, id, day, payload)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(collection, id) DO UPDATE SET
             day = excluded.day,
             payload = excluded.payload`,
          [
            collection,
            itemId(item, String(index)),
            itemDay(item),
            JSON.stringify(item),
          ],
        );
      }
      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
    persist(db);
  } catch {
    /* best-effort */
  }
}

export async function upsertSingleton(collection, value) {
  try {
    const db = await openDb();
    db.run(
      `INSERT INTO items (collection, id, day, payload)
       VALUES (?, 'self', NULL, ?)
       ON CONFLICT(collection, id) DO UPDATE SET payload = excluded.payload`,
      [collection, JSON.stringify(value)],
    );
    persist(db);
  } catch {
    /* best-effort */
  }
}

export async function getCollectionItems(collection, { startDay = null, endDay = null } = {}) {
  try {
    const db = await openDb();
    let sql = 'SELECT payload FROM items WHERE collection = ?';
    const params = [collection];
    if (startDay && endDay) {
      sql += ' AND (day IS NULL OR (day >= ? AND day <= ?))';
      params.push(startDay, endDay);
    } else if (startDay) {
      sql += ' AND (day IS NULL OR day >= ?)';
      params.push(startDay);
    } else if (endDay) {
      sql += ' AND (day IS NULL OR day <= ?)';
      params.push(endDay);
    }
    sql += ' ORDER BY day ASC';
    const result = db.exec(sql, params);
    const rows = result[0]?.values || [];
    return rows.map(([payload]) => JSON.parse(payload));
  } catch {
    return [];
  }
}

export async function getSingleton(collection) {
  try {
    const db = await openDb();
    const result = db.exec(
      "SELECT payload FROM items WHERE collection = ? AND id = 'self' LIMIT 1",
      [collection],
    );
    const payload = result[0]?.values?.[0]?.[0];
    return payload ? JSON.parse(payload) : null;
  } catch {
    return null;
  }
}

export async function getMeta(key) {
  try {
    const db = await openDb();
    const result = db.exec('SELECT value FROM meta WHERE key = ?', [key]);
    return result[0]?.values?.[0]?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function setMeta(key, value) {
  try {
    const db = await openDb();
    db.run(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, String(value)],
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

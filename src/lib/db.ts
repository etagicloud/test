import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

export const pool: Pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

let initialized = false;
export async function ensureSchema(): Promise<void> {
  if (initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id BIGSERIAL PRIMARY KEY,
      ip TEXT,
      user_agent TEXT,
      path TEXT,
      visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS visits_visited_at_idx ON visits (visited_at DESC);
  `);
  initialized = true;
}

export type Stats = {
  total: number;
  today: number;
  lastHour: number;
  uniqueIps: number;
  byHour: { hour: string; count: number }[];
};

export async function getStats(): Promise<Stats> {
  await ensureSchema();
  const { rows } = await pool.query<{
    total: string;
    today: string;
    last_hour: string;
    unique_ips: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM visits)                                            AS total,
      (SELECT COUNT(*) FROM visits WHERE visited_at >= NOW() - INTERVAL '24h') AS today,
      (SELECT COUNT(*) FROM visits WHERE visited_at >= NOW() - INTERVAL '1h')  AS last_hour,
      (SELECT COUNT(DISTINCT ip) FROM visits)                                  AS unique_ips
  `);

  const hourly = await pool.query<{ bucket: Date; count: string }>(`
    SELECT date_trunc('hour', visited_at) AS bucket, COUNT(*) AS count
    FROM visits
    WHERE visited_at >= NOW() - INTERVAL '24h'
    GROUP BY bucket
    ORDER BY bucket
  `);

  const r = rows[0] ?? { total: "0", today: "0", last_hour: "0", unique_ips: "0" };
  return {
    total: Number(r.total),
    today: Number(r.today),
    lastHour: Number(r.last_hour),
    uniqueIps: Number(r.unique_ips),
    byHour: hourly.rows.map((row) => ({
      hour: row.bucket.toISOString(),
      count: Number(row.count),
    })),
  };
}

export async function recordVisit(opts: {
  ip: string | null;
  userAgent: string | null;
  path: string;
}): Promise<void> {
  await ensureSchema();
  await pool.query(
    "INSERT INTO visits (ip, user_agent, path) VALUES ($1, $2, $3)",
    [opts.ip, opts.userAgent, opts.path],
  );
}

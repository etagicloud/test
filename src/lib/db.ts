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
    connectionTimeoutMillis: 5_000,
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

// ============================================================================
// Vacation PDF generation tracking — /vacation tool
// ============================================================================

let vacationInitialized = false;
async function ensureVacationSchema(): Promise<void> {
  if (vacationInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vacation_generations (
      id BIGSERIAL PRIMARY KEY,
      template     TEXT NOT NULL,
      org          TEXT NOT NULL,
      type         TEXT NOT NULL,
      fio          TEXT,
      date_start   DATE,
      date_end     DATE,
      days         INT,
      ip           TEXT,
      user_agent   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS vac_gen_created_idx  ON vacation_generations (created_at DESC);
    CREATE INDEX IF NOT EXISTS vac_gen_template_idx ON vacation_generations (template);
    CREATE INDEX IF NOT EXISTS vac_gen_org_idx      ON vacation_generations (org);
  `);
  vacationInitialized = true;
}

export type VacationLog = {
  template: string;
  org: string;
  type: string;
  fio: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  days: number | null;
  ip: string | null;
  userAgent: string | null;
};

export async function logVacationGeneration(v: VacationLog): Promise<void> {
  await ensureVacationSchema();
  await pool.query(
    `INSERT INTO vacation_generations
       (template, org, type, fio, date_start, date_end, days, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      v.template, v.org, v.type, v.fio,
      v.dateStart, v.dateEnd, v.days,
      v.ip, v.userAgent,
    ],
  );
}

export type VacationStats = {
  total: number;
  today: number;
  last7d: number;
  last30d: number;
  totalDays: number;
  avgDays: number | null;
  byTemplate: { template: string; count: number }[];
  byOrg:      { org: string;      count: number }[];
  byType:     { type: string;     count: number }[];
  topFio:     { fio: string;      count: number }[];
  byDay:      { day: string;      count: number }[];
  recent: {
    id: number;
    template: string;
    org: string;
    type: string;
    fio: string | null;
    date_start: string | null;
    date_end: string | null;
    days: number | null;
    created_at: string;
  }[];
};

export async function getVacationStats(): Promise<VacationStats> {
  await ensureVacationSchema();

  const totals = await pool.query<{
    total: string; today: string; last7d: string; last30d: string;
    total_days: string; avg_days: string | null;
  }>(`
    SELECT
      (SELECT COUNT(*)             FROM vacation_generations)                                          AS total,
      (SELECT COUNT(*)             FROM vacation_generations WHERE created_at >= NOW() - INTERVAL '1 day')  AS today,
      (SELECT COUNT(*)             FROM vacation_generations WHERE created_at >= NOW() - INTERVAL '7 days') AS last7d,
      (SELECT COUNT(*)             FROM vacation_generations WHERE created_at >= NOW() - INTERVAL '30 days')AS last30d,
      (SELECT COALESCE(SUM(days),0) FROM vacation_generations)                                          AS total_days,
      (SELECT AVG(days)::numeric(10,1) FROM vacation_generations WHERE days IS NOT NULL)                AS avg_days
  `);

  const byTemplate = await pool.query<{ template: string; count: string }>(
    `SELECT template, COUNT(*) AS count FROM vacation_generations GROUP BY template ORDER BY count DESC`,
  );
  const byOrg = await pool.query<{ org: string; count: string }>(
    `SELECT org, COUNT(*) AS count FROM vacation_generations GROUP BY org ORDER BY count DESC`,
  );
  const byType = await pool.query<{ type: string; count: string }>(
    `SELECT type, COUNT(*) AS count FROM vacation_generations GROUP BY type ORDER BY count DESC`,
  );
  const topFio = await pool.query<{ fio: string; count: string }>(
    `SELECT fio, COUNT(*) AS count
     FROM vacation_generations
     WHERE fio IS NOT NULL AND fio <> ''
     GROUP BY fio ORDER BY count DESC LIMIT 10`,
  );
  const byDay = await pool.query<{ bucket: Date; count: string }>(`
    SELECT date_trunc('day', created_at) AS bucket, COUNT(*) AS count
    FROM vacation_generations
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY bucket
    ORDER BY bucket
  `);
  const recent = await pool.query<{
    id: string; template: string; org: string; type: string;
    fio: string | null; date_start: Date | null; date_end: Date | null;
    days: number | null; created_at: Date;
  }>(`
    SELECT id, template, org, type, fio, date_start, date_end, days, created_at
    FROM vacation_generations
    ORDER BY created_at DESC
    LIMIT 25
  `);

  const t = totals.rows[0] ?? {
    total: "0", today: "0", last7d: "0", last30d: "0",
    total_days: "0", avg_days: null,
  };

  const toIsoDate = (d: Date | null) =>
    d ? d.toISOString().slice(0, 10) : null;

  return {
    total: Number(t.total),
    today: Number(t.today),
    last7d: Number(t.last7d),
    last30d: Number(t.last30d),
    totalDays: Number(t.total_days),
    avgDays: t.avg_days == null ? null : Number(t.avg_days),
    byTemplate: byTemplate.rows.map((r) => ({ template: r.template, count: Number(r.count) })),
    byOrg:      byOrg.rows.map((r) => ({ org: r.org, count: Number(r.count) })),
    byType:     byType.rows.map((r) => ({ type: r.type, count: Number(r.count) })),
    topFio:     topFio.rows.map((r) => ({ fio: r.fio, count: Number(r.count) })),
    byDay:      byDay.rows.map((r) => ({ day: r.bucket.toISOString().slice(0, 10), count: Number(r.count) })),
    recent: recent.rows.map((r) => ({
      id: Number(r.id),
      template: r.template,
      org: r.org,
      type: r.type,
      fio: r.fio,
      date_start: toIsoDate(r.date_start),
      date_end:   toIsoDate(r.date_end),
      days: r.days,
      created_at: r.created_at.toISOString(),
    })),
  };
}

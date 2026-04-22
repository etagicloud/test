import { headers } from "next/headers";
import { getStats, recordVisit, type Stats } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadAndRecord(): Promise<{ stats: Stats; error: string | null }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const ua = h.get("user-agent") ?? null;

  try {
    await recordVisit({ ip, userAgent: ua, path: "/" });
    const stats = await getStats();
    return { stats, error: null };
  } catch (err) {
    console.error("[page] DB error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stats: { total: 0, today: 0, lastHour: 0, uniqueIps: 0, byHour: [] },
      error: msg || "Не удалось подключиться к БД (см. логи dev-сервера)",
    };
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow-md">
      <div
        className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-3xl transition group-hover:opacity-50"
        style={{ background: accent }}
      />
      <div className="relative">
        <div className="text-xs uppercase tracking-widest text-zinc-500">
          {label}
        </div>
        <div className="mt-3 font-mono text-4xl font-semibold tabular-nums text-zinc-900">
          {value}
        </div>
        <div className="mt-2 text-xs text-zinc-400">{hint}</div>
      </div>
    </div>
  );
}

function HourlyBars({ data }: { data: Stats["byHour"] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-400">
        Пока нет визитов за 24 часа
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d) => {
        const h = Math.max((d.count / max) * 100, 4);
        const time = new Date(d.hour);
        const label = `${time.getHours().toString().padStart(2, "0")}:00 — ${d.count}`;
        return (
          <div
            key={d.hour}
            title={label}
            className="flex-1 rounded-t bg-gradient-to-t from-indigo-300 to-fuchsia-500 transition hover:from-indigo-400 hover:to-fuchsia-600"
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

export default async function Home() {
  const { stats, error } = await loadAndRecord();
  const builtAt = process.env.BUILD_TIMESTAMP ?? new Date().toISOString();
  const commit = (process.env.SOURCE_COMMIT ?? "dev").slice(0, 7);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[600px] rounded-full bg-fuchsia-200/40 blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[600px] rounded-full bg-cyan-200/40 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            online
          </div>
          <div className="font-mono text-xs text-zinc-400">build · {commit}</div>
        </header>

        <section className="pt-16 sm:pt-24">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            megorov · launchpad
          </div>
          <h1 className="mt-4 text-6xl font-bold leading-[1.05] tracking-tight text-zinc-900 sm:text-8xl">
            Аналитика
            <br />
            <span className="bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
              и данные
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-zinc-600 sm:text-xl">
            Полигон для сервисов, ботов и пайплайнов. Каждый твой визит сохраняется
            в Postgres — это и есть первая метрика.
          </p>
        </section>

        <section className="mt-16 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          <StatCard
            label="Всего визитов"
            value={fmt(stats.total)}
            hint="с момента деплоя"
            accent="#6366f1"
          />
          <StatCard
            label="За 24 часа"
            value={fmt(stats.today)}
            hint="последние сутки"
            accent="#d946ef"
          />
          <StatCard
            label="За час"
            value={fmt(stats.lastHour)}
            hint="последние 60 минут"
            accent="#06b6d4"
          />
          <StatCard
            label="Уникальных IP"
            value={fmt(stats.uniqueIps)}
            hint="по всему времени"
            accent="#10b981"
          />
        </section>

        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm uppercase tracking-widest text-zinc-500">
              Визиты по часам · последние 24h
            </h2>
            <span className="font-mono text-xs text-zinc-400">
              {stats.byHour.length} bins
            </span>
          </div>
          <HourlyBars data={stats.byHour} />
        </section>

        {error && (
          <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="text-xs uppercase tracking-widest text-red-700">
              Ошибка БД
            </div>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-red-900">
              {error}
            </pre>
            <div className="mt-3 text-xs text-red-700/80">
              Полный стек — в терминале <code className="font-mono">npm run dev</code>.
              Локально проверь: <code className="font-mono">docker compose ps</code> →
              контейнер <code className="font-mono">test-db-1</code> должен быть healthy.
            </div>
          </section>
        )}

        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: "Стек",
              body: "Next.js 15 · TypeScript · Tailwind 3.4 · Postgres 16",
            },
            {
              title: "Деплой",
              body: "git push → Coolify собирает Docker-образ → выкатывает за ~60 сек",
            },
            {
              title: "Хост",
              body: "Beget VPS · Traefik · Let's Encrypt · panel.megorov.com",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-zinc-200 bg-white/60 p-4 shadow-sm"
            >
              <div className="text-xs uppercase tracking-widest text-zinc-500">
                {c.title}
              </div>
              <div className="mt-2 text-sm text-zinc-700">{c.body}</div>
            </div>
          ))}
        </section>

        <footer className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-400 sm:flex-row sm:items-center">
          <div className="font-mono">
            built · {builtAt.slice(0, 19).replace("T", " ")} UTC
          </div>
          <a
            href="https://github.com/etagicloud/test"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono transition hover:text-zinc-700"
          >
            github.com/etagicloud/test ↗
          </a>
        </footer>
      </div>
    </main>
  );
}

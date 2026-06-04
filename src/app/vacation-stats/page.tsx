"use client";

import { useCallback, useEffect, useState } from "react";

// === лейблы ===
const TEMPLATE_LABEL: Record<string, string> = {
  "etagi-paid":   "Этажи — оплачиваемый",
  "etagi-unpaid": "Этажи — без сохранения",
  "etagi-k":      "Этажи — (К)",
  "esoft-paid":   "Е-софт — оплачиваемый",
  "esoft-unpaid": "Е-софт — без сохранения",
  "esoft-k":      "Е-софт — (К)",
};
const ORG_LABEL: Record<string, string> = {
  etagi: "ООО «Этажи»",
  esoft: "ООО «Е-софт»",
};
const TYPE_LABEL: Record<string, string> = {
  paid:   "Оплачиваемый",
  unpaid: "Без сохранения зарплаты",
  k:      "Отпуск (К)",
};

type Stats = {
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
    id: number; template: string; org: string; type: string;
    fio: string | null; date_start: string | null; date_end: string | null;
    days: number | null; created_at: string;
  }[];
};

const PW_KEY = "vac-stats-pw";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};
const ruDate = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "—");

export default function VacationStatsPage() {
  const [pw, setPw] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async (password: string): Promise<boolean> => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/vacation/stats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (r.status === 401) {
        setErr("Неверный пароль");
        sessionStorage.removeItem(PW_KEY);
        return false;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(`Ошибка ${r.status}: ${j.error ?? r.statusText}`);
        return false;
      }
      const data = (await r.json()) as Stats;
      setStats(data);
      sessionStorage.setItem(PW_KEY, password);
      return true;
    } catch (e) {
      setErr("Ошибка сети: " + (e instanceof Error ? e.message : String(e)));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(PW_KEY) : null;
    if (saved) {
      setPw(saved);
      void load(saved);
    }
    setAuto(false);
  }, [load]);

  if (!stats) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-zinc-50 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); void load(pw); }}
          className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-lg font-semibold text-zinc-900 mb-1">Статистика заявлений</h1>
          <p className="text-sm text-zinc-500 mb-5">Защищённый раздел. Введите пароль.</p>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Пароль"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            disabled={loading || auto}
          />
          {err && <div className="mt-2 text-sm font-medium text-red-600">{err}</div>}
          <button
            type="submit"
            disabled={loading || auto || !pw}
            className="mt-4 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading || auto ? "Загрузка…" : "Войти"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-zinc-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Статистика заявлений</h1>
            <p className="text-sm text-zinc-500">Сводка по генерациям PDF/A через /vacation</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(PW_KEY); setStats(null); setPw(""); }}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            выйти
          </button>
        </header>

        {/* KPI */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Всего" value={fmt(stats.total)} hint="за всё время" />
          <Kpi label="Сегодня" value={fmt(stats.today)} hint="последние 24 часа" />
          <Kpi label="7 дней" value={fmt(stats.last7d)} hint="за неделю" />
          <Kpi label="30 дней" value={fmt(stats.last30d)} hint="за месяц" />
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Всего дней" value={fmt(stats.totalDays)} hint="сумма по всем заявлениям" tone="muted" />
          <Kpi label="Средний отпуск" value={stats.avgDays != null ? stats.avgDays.toFixed(1) + " дн." : "—"} hint="дней в одном заявлении" tone="muted" />
          <Kpi label="Шаблонов" value={fmt(stats.byTemplate.length)} hint={`из 6 используется`} tone="muted" />
          <Kpi label="Уникальных ФИО" value={fmt(stats.topFio.length)} hint="разных заявителей" tone="muted" />
        </section>

        {/* Распределения */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="По шаблону">
            <BarList
              items={stats.byTemplate.map((r) => ({
                label: TEMPLATE_LABEL[r.template] ?? r.template,
                count: r.count,
                accent: r.template.startsWith("etagi") ? "blue" : "violet",
              }))}
            />
          </Card>
          <Card title="По организации">
            <BarList
              items={stats.byOrg.map((r) => ({
                label: ORG_LABEL[r.org] ?? r.org,
                count: r.count,
                accent: r.org === "etagi" ? "blue" : "violet",
              }))}
            />
          </Card>
          <Card title="По типу отпуска">
            <BarList
              items={stats.byType.map((r) => ({
                label: TYPE_LABEL[r.type] ?? r.type,
                count: r.count,
                accent: r.type === "paid" ? "emerald" : r.type === "unpaid" ? "amber" : "fuchsia",
              }))}
            />
          </Card>
        </section>

        {/* Таймлайн 30 дней */}
        <Card title="За 30 дней (по дням)">
          <Timeline days={stats.byDay} />
        </Card>

        {/* Топ ФИО + Последние генерации */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Топ ФИО">
            {stats.topFio.length === 0 ? (
              <p className="text-sm text-zinc-500">Пока никого.</p>
            ) : (
              <BarList
                items={stats.topFio.map((r) => ({
                  label: r.fio, count: r.count, accent: "zinc",
                }))}
              />
            )}
          </Card>
          <div className="md:col-span-2">
            <Card title="Последние генерации">
              {stats.recent.length === 0 ? (
                <p className="text-sm text-zinc-500">Пока ничего не сгенерировано.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs text-zinc-500">
                      <tr className="border-b border-zinc-200">
                        <th className="text-left font-medium px-2 py-2">Когда</th>
                        <th className="text-left font-medium px-2 py-2">Шаблон</th>
                        <th className="text-left font-medium px-2 py-2">ФИО</th>
                        <th className="text-left font-medium px-2 py-2">Период</th>
                        <th className="text-right font-medium px-2 py-2">Дней</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent.map((r) => (
                        <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                          <td className="px-2 py-2 text-zinc-600 whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                          <td className="px-2 py-2">
                            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={tplPillStyle(r.template)}>
                              {TEMPLATE_LABEL[r.template] ?? r.template}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-zinc-700">{r.fio || "—"}</td>
                          <td className="px-2 py-2 text-zinc-600 whitespace-nowrap">{ruDate(r.date_start)} — {ruDate(r.date_end)}</td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums text-zinc-700">{r.days ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "muted" }) {
  return (
    <div className={`rounded-xl border border-zinc-200 ${tone === "muted" ? "bg-zinc-50" : "bg-white"} p-4`}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-zinc-900">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{hint}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{title}</div>
      {children}
    </div>
  );
}

const ACCENT_BAR: Record<string, string> = {
  blue:    "bg-blue-500",
  violet:  "bg-violet-500",
  emerald: "bg-emerald-500",
  amber:   "bg-amber-500",
  fuchsia: "bg-fuchsia-500",
  zinc:    "bg-zinc-400",
};

function BarList({ items }: { items: { label: string; count: number; accent: string }[] }) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">Пока ничего.</p>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-700 truncate pr-2">{it.label}</span>
            <span className="font-mono tabular-nums text-zinc-900">{fmt(it.count)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div className={`h-full rounded-full ${ACCENT_BAR[it.accent] ?? "bg-zinc-400"}`} style={{ width: `${(it.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline({ days }: { days: { day: string; count: number }[] }) {
  // build a 30-day window ending today, filling gaps with 0
  const map = new Map(days.map((d) => [d.day, d.count]));
  const today = new Date();
  const window: { day: string; count: number; label: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    window.push({
      day: iso,
      count: map.get(iso) ?? 0,
      label: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
    });
  }
  const max = Math.max(1, ...window.map((d) => d.count));
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {window.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col justify-end" title={`${d.label}: ${d.count}`}>
            <div className="rounded-t bg-blue-500/80 hover:bg-blue-600 transition" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
        <span>{window[0].label}</span>
        <span>{window[14].label}</span>
        <span>{window[29].label}</span>
      </div>
    </div>
  );
}

function tplPillStyle(t: string): React.CSSProperties {
  const isEtagi = t.startsWith("etagi");
  return {
    background: isEtagi ? "rgb(219 234 254)" : "rgb(237 233 254)",
    color:      isEtagi ? "rgb(29 78 216)"   : "rgb(109 40 217)",
  };
}

import { NextRequest, NextResponse } from "next/server";
import { getVacationFullList } from "@/lib/db";
import { passwordOk, parseFilters } from "@/lib/vacation-auth";

export const dynamic = "force-dynamic";

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
  unpaid: "Без сохранения заработной платы",
  k:      "Отпуск (К)",
};

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/["\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtIsoDateTime(iso: string): string {
  // 2026-06-04T14:32:11.123Z -> 2026-06-04 14:32:11
  return iso.replace("T", " ").replace(/\..*$/, "");
}
function fmtRuDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const provided =
      body && typeof (body as Record<string, unknown>).password === "string"
        ? ((body as Record<string, unknown>).password as string)
        : "";

    if (!passwordOk(provided)) {
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const filters = parseFilters(body);
    const rows = await getVacationFullList(filters);

    const header = [
      "ID", "Дата создания", "Шаблон", "ООО", "Тип отпуска",
      "ФИО", "Дата начала", "Дата окончания", "Дней",
      "IP", "User-Agent",
    ];
    const lines = [header.join(";")];

    for (const r of rows) {
      lines.push([
        r.id,
        fmtIsoDateTime(r.created_at),
        TEMPLATE_LABEL[r.template] ?? r.template,
        ORG_LABEL[r.org] ?? r.org,
        TYPE_LABEL[r.type] ?? r.type,
        r.fio ?? "",
        fmtRuDate(r.date_start),
        fmtRuDate(r.date_end),
        r.days ?? "",
        r.ip ?? "",
        r.user_agent ?? "",
      ].map(csvEscape).join(";"));
    }

    // BOM, чтобы Excel понял UTF-8 + RU
    const csv = "﻿" + lines.join("\r\n") + "\r\n";

    const now = new Date().toISOString().slice(0, 10);
    const filename = `vacation-generations-${now}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[vacation/export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

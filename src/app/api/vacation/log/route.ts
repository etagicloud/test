import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { logVacationGeneration } from "@/lib/db";

export const dynamic = "force-dynamic";

const ORG_BY_PREFIX: Record<string, string> = {
  etagi: "etagi",
  esoft: "esoft",
};

// templates: <org>-<type>, e.g. etagi-paid, esoft-unpaid, etagi-k
const VALID_TEMPLATES = new Set([
  "etagi-paid", "etagi-unpaid", "etagi-k",
  "esoft-paid", "esoft-unpaid", "esoft-k",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseTemplate(t: unknown): { org: string; type: string } | null {
  if (typeof t !== "string" || !VALID_TEMPLATES.has(t)) return null;
  const dash = t.indexOf("-");
  const org = ORG_BY_PREFIX[t.slice(0, dash)];
  const type = t.slice(dash + 1);
  if (!org) return null;
  return { org, type };
}

function strOrNull(v: unknown, maxLen = 200): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function isoDateOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !ISO_DATE.test(v)) return null;
  return v;
}

function intOrNull(v: unknown, min = 1, max = 365): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const parsed = parseTemplate((body as Record<string, unknown>).template);
    if (!parsed) {
      return NextResponse.json({ error: "unknown template" }, { status: 400 });
    }

    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    const ua = h.get("user-agent") ?? null;

    await logVacationGeneration({
      template: (body as Record<string, unknown>).template as string,
      org: parsed.org,
      type: parsed.type,
      fio:       strOrNull((body as Record<string, unknown>).fio),
      dateStart: isoDateOrNull((body as Record<string, unknown>).dateStart),
      dateEnd:   isoDateOrNull((body as Record<string, unknown>).dateEnd),
      days:      intOrNull((body as Record<string, unknown>).days),
      ip,
      userAgent: ua,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[vacation/log]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

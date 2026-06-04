import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getVacationStats, type VacationFilters } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_TEMPLATES = new Set([
  "etagi-paid", "etagi-unpaid", "etagi-k",
  "esoft-paid", "esoft-unpaid", "esoft-k",
]);

export function passwordOk(provided: string): boolean {
  const expected = process.env.VACATION_STATS_PASSWORD;
  if (!expected || expected.length < 6) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseFilters(body: unknown): VacationFilters {
  const out: VacationFilters = {};
  if (!body || typeof body !== "object") return out;
  const o = body as Record<string, unknown>;
  if (typeof o.org === "string" && (o.org === "etagi" || o.org === "esoft")) {
    out.org = o.org;
  }
  if (typeof o.template === "string" && ALLOWED_TEMPLATES.has(o.template)) {
    out.template = o.template;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const provided =
      body && typeof (body as Record<string, unknown>).password === "string"
        ? ((body as Record<string, unknown>).password as string)
        : "";

    if (!passwordOk(provided)) {
      // small artificial delay to slow brute force
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const filters = parseFilters(body);
    const stats = await getVacationStats(filters);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[vacation/stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

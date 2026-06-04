import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getVacationStats } from "@/lib/db";

export const dynamic = "force-dynamic";

function passwordOk(provided: string): boolean {
  const expected = process.env.VACATION_STATS_PASSWORD;
  if (!expected || expected.length < 6) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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

    const stats = await getVacationStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[vacation/stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

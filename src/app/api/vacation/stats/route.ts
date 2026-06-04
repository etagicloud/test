import { NextRequest, NextResponse } from "next/server";
import { getVacationStats } from "@/lib/db";
import { passwordOk, parseFilters } from "@/lib/vacation-auth";

export const dynamic = "force-dynamic";

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

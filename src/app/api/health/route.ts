import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "fail",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}

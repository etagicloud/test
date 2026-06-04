import { timingSafeEqual } from "node:crypto";
import type { VacationFilters } from "./db";

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

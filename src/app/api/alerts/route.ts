import { NextResponse } from "next/server";
import { getAlerts } from "@/lib/septa";

export const revalidate = 60;

export async function GET() {
  const alerts = await getAlerts();
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), alerts },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}

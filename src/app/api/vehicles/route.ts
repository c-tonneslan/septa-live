import { NextResponse } from "next/server";
import { getTransitVehicles } from "@/lib/septa";

export const revalidate = 15;

export async function GET() {
  const vehicles = await getTransitVehicles();
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), vehicles },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
  );
}

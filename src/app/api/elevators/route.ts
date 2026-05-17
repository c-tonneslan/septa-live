import { NextResponse } from "next/server";
import { getElevatorOutages } from "@/lib/septa";

export const revalidate = 300;

export async function GET() {
  const outages = await getElevatorOutages();
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), outages },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}

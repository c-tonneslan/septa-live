import { NextResponse } from "next/server";
import { getTrains } from "@/lib/septa";

export const revalidate = 15;

export async function GET() {
  const trains = await getTrains();
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), trains },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
  );
}

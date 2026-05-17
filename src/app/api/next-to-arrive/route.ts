import { NextRequest, NextResponse } from "next/server";
import { getNextToArrive } from "@/lib/septa";

export const revalidate = 30;

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const destination = req.nextUrl.searchParams.get("destination");
  if (!origin || !destination) {
    return NextResponse.json({ error: "origin and destination required" }, { status: 400 });
  }
  const results = Number(req.nextUrl.searchParams.get("results") ?? "6");
  const trips = await getNextToArrive(origin, destination, results);
  return NextResponse.json(
    { origin, destination, trips },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}

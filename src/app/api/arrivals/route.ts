import { NextRequest, NextResponse } from "next/server";
import { getArrivals } from "@/lib/septa";

export const revalidate = 20;

export async function GET(req: NextRequest) {
  const station = req.nextUrl.searchParams.get("station");
  if (!station) {
    return NextResponse.json({ error: "missing station" }, { status: 400 });
  }
  const results = Number(req.nextUrl.searchParams.get("results") ?? "8");
  const data = await getArrivals(station, results);
  if (!data) return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" },
  });
}

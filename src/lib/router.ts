// Multi-modal trip routing over SEPTA's full network.
//
// public/network.json (built by scripts/gen-gtfs.py) carries:
//   - stops:     every rail/subway/trolley/NHSL/bus stop with lat/lon + modes
//   - routes:    each route's color, mode, ordered stop list
//   - transfers: walking edges between stops within ~400m, with walk minutes
//   - speeds:    mph by mode (for time estimation, since SEPTA's public feeds
//                don't expose timetable lookups for non-RR routing)
//
// Routing is Dijkstra on the implicit edge set:
//   - same-route adjacency: each pair of consecutive stops on a route is an
//     edge weighted by haversine distance / mode speed + a 1-minute board
//     penalty so the search prefers fewer transfers all else being equal
//   - walking transfers: bidirectional edges weighted by walk minutes
//
// Result: an ordered list of legs (board route X at stop A, ride to stop B,
// walk to stop C, board route Y to stop D…), with total time and number of
// transfers.

export interface NetworkStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  lineIds: string[];
}

export interface NetworkRoute {
  color: string;
  mode: string;
  name: string;
  short: string;
  stops: string[];
}

export interface Network {
  stops: NetworkStop[];
  routes: Record<string, NetworkRoute>;
  transfers: [string, string, number][];
  speeds: Record<string, number>;
}

export type Leg =
  | {
      kind: "ride";
      routeId: string;
      routeName: string;
      routeShort: string;
      routeColor: string;
      mode: string;
      fromStop: NetworkStop;
      toStop: NetworkStop;
      stops: NetworkStop[];
      minutes: number;
    }
  | {
      kind: "walk";
      fromStop: NetworkStop;
      toStop: NetworkStop;
      minutes: number;
    };

export interface Trip {
  legs: Leg[];
  totalMinutes: number;
  transfers: number;
}

interface Edge {
  to: string;
  minutes: number;
  routeId: string | null; // null = walking edge
}

interface CompiledGraph {
  stops: Map<string, NetworkStop>;
  routes: Map<string, NetworkRoute>;
  adjacency: Map<string, Edge[]>;
}

// One-time setup cost: build the adjacency lists from the raw network.
export function compile(network: Network): CompiledGraph {
  const stops = new Map<string, NetworkStop>();
  for (const s of network.stops) stops.set(s.id, s);

  const routes = new Map<string, NetworkRoute>();
  for (const [rid, r] of Object.entries(network.routes)) routes.set(rid, r);

  const adjacency = new Map<string, Edge[]>();
  const edge = (from: string, to: string, minutes: number, routeId: string | null) => {
    const arr = adjacency.get(from);
    if (arr) arr.push({ to, minutes, routeId });
    else adjacency.set(from, [{ to, minutes, routeId }]);
  };

  const BOARD_PENALTY = 1.0;

  for (const [rid, route] of routes) {
    const speed = network.speeds[route.mode] ?? 12;
    for (let i = 0; i < route.stops.length - 1; i++) {
      const a = stops.get(route.stops[i]);
      const b = stops.get(route.stops[i + 1]);
      if (!a || !b) continue;
      const meters = haversineM(a.lat, a.lon, b.lat, b.lon);
      // miles / mph * 60 = minutes
      const minutes = (meters / 1609.34) / speed * 60 + BOARD_PENALTY;
      edge(a.id, b.id, minutes, rid);
      edge(b.id, a.id, minutes, rid);
    }
  }

  for (const [a, b, minutes] of network.transfers) {
    edge(a, b, minutes, null);
    edge(b, a, minutes, null);
  }

  return { stops, routes, adjacency };
}

function haversineM(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6_371_000;
  const p1 = (la1 * Math.PI) / 180;
  const p2 = (la2 * Math.PI) / 180;
  const dp = ((la2 - la1) * Math.PI) / 180;
  const dl = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Minimal binary heap (priority queue) for Dijkstra. The Map-based fallback
// is too slow at 7k+ nodes.
class MinHeap<T> {
  private a: [number, T][] = [];
  push(p: number, v: T) {
    this.a.push([p, v]);
    let i = this.a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.a[parent][0] <= this.a[i][0]) break;
      [this.a[parent], this.a[i]] = [this.a[i], this.a[parent]];
      i = parent;
    }
  }
  pop(): [number, T] | undefined {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length > 0 && last) {
      this.a[0] = last;
      let i = 0;
      const n = this.a.length;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < n && this.a[l][0] < this.a[smallest][0]) smallest = l;
        if (r < n && this.a[r][0] < this.a[smallest][0]) smallest = r;
        if (smallest === i) break;
        [this.a[smallest], this.a[i]] = [this.a[i], this.a[smallest]];
        i = smallest;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

export function route(g: CompiledGraph, fromId: string, toId: string): Trip | null {
  if (fromId === toId) return null;
  if (!g.stops.has(fromId) || !g.stops.has(toId)) return null;

  // Dijkstra. State: best cost to each (stop, current-route) so the router
  // can prefer staying on a route over hopping off and back on.
  type Key = string; // `${stopId}|${routeId ?? '-'}`
  const dist = new Map<Key, number>();
  const prev = new Map<Key, { from: Key; routeId: string | null }>();
  const heap = new MinHeap<{ key: Key; stopId: string; routeId: string | null }>();

  const startKey = `${fromId}|-`;
  dist.set(startKey, 0);
  heap.push(0, { key: startKey, stopId: fromId, routeId: null });

  let endKey: Key | null = null;
  let endCost = Infinity;

  while (heap.size > 0) {
    const top = heap.pop();
    if (!top) break;
    const [cost, node] = top;
    if (cost > (dist.get(node.key) ?? Infinity)) continue;
    if (node.stopId === toId) {
      if (cost < endCost) {
        endCost = cost;
        endKey = node.key;
      }
      // Don't early-break; with the staying-on-route state we may find a
      // cheaper end-key. But cap the search to 2x the best to bound runtime.
      if (cost > endCost * 1.2) break;
      continue;
    }

    const edges = g.adjacency.get(node.stopId);
    if (!edges) continue;
    for (const e of edges) {
      // Discourage adding extra transfers: every time the routeId changes
      // (or we walk), add a small switch cost.
      let extra = 0;
      if (node.routeId !== null && e.routeId !== node.routeId) extra = 3;
      if (node.routeId === null && e.routeId !== null && node.key !== startKey) extra = 1;
      const newCost = cost + e.minutes + extra;
      const newKey = `${e.to}|${e.routeId ?? "-"}`;
      if (newCost < (dist.get(newKey) ?? Infinity)) {
        dist.set(newKey, newCost);
        prev.set(newKey, { from: node.key, routeId: e.routeId });
        heap.push(newCost, { key: newKey, stopId: e.to, routeId: e.routeId });
      }
    }
  }

  if (!endKey) return null;

  // Reconstruct path (sequence of edges) back to start.
  type Step = { fromStopId: string; toStopId: string; routeId: string | null };
  const steps: Step[] = [];
  let cursor: Key | undefined = endKey;
  while (cursor && cursor !== startKey) {
    const p = prev.get(cursor);
    if (!p) break;
    const cursorStop = cursor.split("|")[0];
    const fromStop = p.from.split("|")[0];
    steps.push({ fromStopId: fromStop, toStopId: cursorStop, routeId: p.routeId });
    cursor = p.from;
  }
  steps.reverse();

  // Coalesce consecutive same-route edges into one Leg, collect walks as
  // standalone walk legs.
  const legs: Leg[] = [];
  for (const step of steps) {
    const fromStop = g.stops.get(step.fromStopId)!;
    const toStop = g.stops.get(step.toStopId)!;
    const meters = haversineM(fromStop.lat, fromStop.lon, toStop.lat, toStop.lon);
    if (step.routeId === null) {
      const minutes = +(meters / 1609.34 / 3 * 60).toFixed(1); // 3 mph walking
      legs.push({ kind: "walk", fromStop, toStop, minutes });
    } else {
      const route = g.routes.get(step.routeId);
      if (!route) continue;
      const last = legs[legs.length - 1];
      const speed = (g.adjacency.get(step.fromStopId) ?? []).find(
        (e) => e.to === step.toStopId && e.routeId === step.routeId,
      )?.minutes ?? meters / 1609.34 / 12 * 60;
      if (last && last.kind === "ride" && last.routeId === step.routeId) {
        last.toStop = toStop;
        last.stops.push(toStop);
        last.minutes = +(last.minutes + speed).toFixed(1);
      } else {
        legs.push({
          kind: "ride",
          routeId: step.routeId,
          routeName: route.name,
          routeShort: route.short,
          routeColor: route.color,
          mode: route.mode,
          fromStop,
          toStop,
          stops: [fromStop, toStop],
          minutes: +speed.toFixed(1),
        });
      }
    }
  }

  const totalMinutes = +legs.reduce((s, l) => s + l.minutes, 0).toFixed(1);
  const transfers = Math.max(0, legs.filter((l) => l.kind === "ride").length - 1);
  return { legs, totalMinutes, transfers };
}

// Lazy network loader. Singleton promise so multiple callers share one fetch.
let netPromise: Promise<{ network: Network; graph: CompiledGraph }> | null = null;

export function loadNetwork(): Promise<{ network: Network; graph: CompiledGraph }> {
  if (!netPromise) {
    netPromise = fetch("/network.json")
      .then((r) => {
        if (!r.ok) throw new Error(`network.json: ${r.status}`);
        return r.json() as Promise<Network>;
      })
      .then((network) => ({ network, graph: compile(network) }))
      .catch((e) => {
        netPromise = null;
        throw e;
      });
  }
  return netPromise;
}

// One delay scale for the whole app: markers, detail panels, arrivals, the
// "most delayed" list, and the legend all read from here so lateness never
// speaks in different colors/thresholds in different places.
//   on time / <3 min  → emerald
//   3–9 min late       → amber
//   10+ min late       → red (paired with a pulse on the map — motion is the
//                        non-color cue that keeps severe readable for
//                        red-deficient users)
export type DelayTier = "ontime" | "late" | "severe";

export interface DelayStatus {
  minutes: number;
  tier: DelayTier;
  label: string;      // "on time" | "N min late"
  textClass: string;  // tailwind text color token
}

export function lateStatus(lateMinutes: number): DelayStatus {
  const minutes = Number.isFinite(lateMinutes) ? lateMinutes : 0;
  const tier: DelayTier = minutes >= 10 ? "severe" : minutes >= 3 ? "late" : "ontime";
  return {
    minutes,
    tier,
    label: minutes <= 0 ? "on time" : `${minutes} min late`,
    textClass:
      tier === "severe" ? "text-late-severe" : tier === "late" ? "text-late" : "text-ontime",
  };
}

/**
 * useTokenCost — fetches token costs from the admin-managed API.
 * Returns a helper `getCost(action)` that returns the cost for a given action.
 * Falls back to hardcoded defaults if the API is unavailable.
 */
import { trpc } from "@/lib/trpc";

const DEFAULTS: Record<string, number> = {
  convert: 0,
  ai_generate: 3,
  ai_trace: 5,
  face_detect: 4,
  ai_refine: 2,
  cnc_relief: 4,
  needle_engraving: 10,
};

export function useTokenCost() {
  const { data: costs } = trpc.tokenCosts.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const getCost = (action: string): number => {
    if (costs) {
      const found = costs.find((c) => c.action === action);
      if (found !== undefined) return found.cost;
    }
    return DEFAULTS[action] ?? 1;
  };

  return { getCost };
}

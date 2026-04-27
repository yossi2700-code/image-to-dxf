import { useCallback } from "react";
import { trpc } from "@/lib/trpc";

/**
 * useTrackClick — lightweight hook that fires a fire-and-forget mutation
 * to record a button/action click in the user_click_events table.
 *
 * Usage:
 *   const track = useTrackClick("home/ai_trace");
 *   <button onClick={() => { track("btn_convert", "המר"); doConvert(); }}>המר</button>
 */
export function useTrackClick(defaultPage?: string) {
  const logClick = trpc.tracking.logClick.useMutation();

  const track = useCallback(
    (action: string, label?: string, page?: string, metadata?: string) => {
      // Fire and forget — never block the UI
      logClick.mutate({
        action,
        label: label ?? undefined,
        page: page ?? defaultPage ?? undefined,
        metadata: metadata ?? undefined,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultPage]
  );

  return track;
}

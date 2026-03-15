/**
 * useBugReport — lightweight hook for automatic bug reporting.
 * Calls trpc.bugs.report silently (fire-and-forget) so it never blocks the UI.
 */
import { useCallback } from "react";
import { trpc } from "@/lib/trpc";

export type BugErrorType = "convert_failed" | "ai_failed" | "download_failed" | "other";

export interface ReportBugParams {
  errorType: BugErrorType;
  errorMessage?: string;
  feature?: string;
  imageUrl?: string;
}

export function useBugReport() {
  const reportMutation = trpc.bugs.report.useMutation();

  const reportBug = useCallback(
    (params: ReportBugParams) => {
      // Fire-and-forget — never throw, never block UI
      try {
        reportMutation.mutate({
          errorType: params.errorType,
          errorMessage: params.errorMessage?.slice(0, 2000),
          feature: params.feature?.slice(0, 32),
          imageUrl: params.imageUrl?.slice(0, 1000),
        });
      } catch {
        // Silently ignore — bug reporting must never break the app
      }
    },
    [reportMutation]
  );

  return { reportBug };
}

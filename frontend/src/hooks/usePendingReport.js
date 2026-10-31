import { useEffect } from "react";
import { fetchRecordById } from "../api.js";

const POLL_MS = 1000;
const MAX_POLLS = 180;

// Polls a record until its report is no longer being written, then hands the fresh record back
export default function usePendingReport(record, onUpdate) {
  const id = record?.id;
  const pending = record?.reportStatus === "pending";

  useEffect(() => {
    if (!pending) return undefined;
    let cancelled = false;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      try {
        const next = await fetchRecordById(id);
        if (!cancelled && next.reportStatus !== "pending") onUpdate(next);
      } catch {
        // keep polling; a brief network error should not drop the report
      }
      if (!cancelled && polls >= MAX_POLLS) onUpdate({ ...record, reportStatus: "failed" });
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // `record` is only read when polling times out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pending, onUpdate]);
}

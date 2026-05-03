import { storage } from "./storage";

const TICK_MS = 60_000;

// Runs every 60 seconds. Looks for events whose 5-minute settle window
// since the last game change has elapsed and computes their result.
// Manual-source events are skipped inside storage.recomputeEventResult.
export function startEventResultScheduler(): void {
  const tick = async () => {
    try {
      const n = await storage.runDueEventResultAutoComputes();
      if (n > 0) console.log(`[event-scheduler] auto-computed ${n} event result(s)`);
    } catch (err) {
      console.error("[event-scheduler] tick failed:", err);
    }
  };
  setInterval(tick, TICK_MS);
  // First pass shortly after boot so events that became due during downtime
  // get computed promptly.
  setTimeout(tick, 5000);
  console.log(`[event-scheduler] started (tick every ${TICK_MS / 1000}s, 5min settle window)`);
}

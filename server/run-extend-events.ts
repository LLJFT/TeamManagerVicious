import { extendEventsRange } from "./seed-extend-events";

const start = parseInt(process.argv[2] || "0", 10);
const end = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

extendEventsRange(start, end).then(() => {
  console.log("[run-extend-events] complete");
  process.exit(0);
}).catch((e) => {
  console.error("[run-extend-events] error:", e);
  process.exit(1);
});

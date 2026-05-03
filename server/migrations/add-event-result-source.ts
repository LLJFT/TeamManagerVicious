import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addEventResultSource(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS result_source TEXT DEFAULT 'pending'
    `);
    await db.execute(sql`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS last_game_change_at TIMESTAMP
    `);
    // ALTER TABLE applies the DEFAULT to existing rows immediately, so by
    // the time we run the backfill all rows already have 'pending'. We need
    // to flip pending → auto for events whose result is already a valid
    // win/loss/draw, otherwise the scheduler will never re-run them and the
    // UI will incorrectly badge them as "Pending" forever.
    await db.execute(sql`
      UPDATE events SET result_source = 'auto'
      WHERE (result_source IS NULL OR result_source = 'pending')
        AND result IN ('win', 'loss', 'draw')
    `);
    await db.execute(sql`
      UPDATE events SET result_source = 'pending'
      WHERE result_source IS NULL
    `);
  } catch (err) {
    console.error("[migration] add-event-result-source failed:", err);
  }
}

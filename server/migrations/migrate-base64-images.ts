/**
 * Round-3 fix: migrate any image columns whose value got persisted as a
 * `data:image/...;base64,...` data URL back into proper object-storage
 * `/objects/uploads/<id>.<ext>` URLs.
 *
 * Background: between Round 1 and Round 2, the upload route had a fallback
 * that embedded the file as a data URL whenever the object-storage sidecar
 * was unreachable. This kept the image visible but bloated the JSONB / text
 * columns with megabytes of base64, which in turn caused 413 errors when
 * the editor tried to PATCH a template back, and made the editor hang
 * while React diffed/serialized the strings on every keystroke.
 *
 * This migration scans every column that legitimately holds an image URL,
 * decodes the base64, re-uploads through ObjectStorageService.uploadBuffer,
 * and writes the new short URL back. It runs at boot on a live system, so
 * every UPDATE is conditional on the value STILL being the original data
 * URL — if a user has edited the field in the meantime (e.g. uploaded a
 * new image themselves), we leave their change alone. Failures are also
 * non-destructive: the original base64 value is left intact and the
 * failure is logged so a later run can retry it. The migration is fully
 * idempotent — anything that doesn't start with `data:image/` is skipped.
 *
 * Tables / columns covered:
 *  - heroes.image_url                       (roster-scoped hero images)
 *  - maps.image_url                         (roster-scoped map images)
 *  - opponents.logo_url                     (opponent logos)
 *  - games.image_url                        (per-game scoreboard uploads)
 *  - media_items.url                        (media library entries)
 *  - game_templates.config (jsonb)          (heroes[].imageUrl,
 *                                            maps[].imageUrl,
 *                                            opponents[].logoUrl)
 */
import { db } from "../db";
import {
  heroes, maps, opponents, games, mediaItems, gameTemplates,
} from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { ObjectStorageService } from "../objectStorage";

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;
const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
};

type Counts = {
  scanned: number;
  migrated: number;
  failed: number;
  skipped: number;
  /** Bumped when the row was edited by a user between our SELECT and our
   *  conditional UPDATE — we deliberately leave their newer value alone. */
  raced: number;
};

function isDataUrl(s: unknown): s is string {
  return typeof s === "string" && s.startsWith("data:image/") && s.length > 32;
}

async function uploadDataUrl(value: string, svc: ObjectStorageService): Promise<string | null> {
  const m = value.match(DATA_URL_RE);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const ext = MIME_EXT[mime] ?? "";
  let buf: Buffer;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch {
    return null;
  }
  if (buf.length === 0) return null;
  return svc.uploadBuffer(buf, mime, ext);
}

/**
 * Migrate a flat column. The UPDATE includes a value guard so concurrent
 * user edits between our SELECT and UPDATE are preserved — `affectedRows`
 * comes back 0 in that case and we just count it as "raced".
 */
async function migrateColumn<T extends { id: string }>(
  label: string,
  rows: T[],
  getter: (r: T) => string | null | undefined,
  conditionalSet: (id: string, oldVal: string, newUrl: string) => Promise<number>,
  svc: ObjectStorageService,
  counts: Counts,
): Promise<void> {
  for (const row of rows) {
    const v = getter(row);
    if (!isDataUrl(v)) { counts.skipped++; continue; }
    counts.scanned++;
    const oldVal = v as string;
    try {
      const newUrl = await uploadDataUrl(oldVal, svc);
      if (!newUrl) {
        counts.failed++;
        console.warn(`[base64-migration] ${label}#${row.id}: could not decode data URL — leaving original.`);
        continue;
      }
      const updated = await conditionalSet(row.id, oldVal, newUrl);
      if (updated === 0) {
        counts.raced++;
        console.log(`[base64-migration] ${label}#${row.id}: value changed by user during migration — keeping their newer value.`);
        continue;
      }
      counts.migrated++;
      console.log(`[base64-migration] ${label}#${row.id}: ${oldVal.length} bytes → ${newUrl}`);
    } catch (err: any) {
      counts.failed++;
      console.warn(`[base64-migration] ${label}#${row.id}: upload failed (${err?.message ?? err}) — leaving original.`);
    }
  }
}

/**
 * Template config migration. We:
 *   1. Read the template config and identify every (path, oldDataUrl) tuple.
 *   2. Upload each data URL to object storage outside any transaction
 *      (uploads can be slow). Build map oldDataUrl → newUrl.
 *   3. In a short transaction, re-read the row, and ONLY replace
 *      occurrences whose value is still the same base64 string we
 *      originally saw. Anything the user edited in the meantime is
 *      preserved. Anything new the user added stays untouched.
 */
async function migrateTemplateConfigs(svc: ObjectStorageService, counts: Counts): Promise<void> {
  const tpls = await db.select().from(gameTemplates);
  for (const tpl of tpls) {
    const initialCfg = (tpl.config ?? {}) as any;
    if (!initialCfg || typeof initialCfg !== "object") { counts.skipped++; continue; }

    type Target = { array: "heroes" | "maps" | "opponents"; key: "imageUrl" | "logoUrl"; oldVal: string };
    const targets: Target[] = [];
    const collect = (arr: any[] | undefined, array: Target["array"], key: Target["key"]) => {
      if (!Array.isArray(arr)) return;
      for (const item of arr) {
        const v = item?.[key];
        if (isDataUrl(v)) targets.push({ array, key, oldVal: v });
      }
    };
    collect(initialCfg.heroes, "heroes", "imageUrl");
    collect(initialCfg.maps, "maps", "imageUrl");
    collect(initialCfg.opponents, "opponents", "logoUrl");
    if (targets.length === 0) { counts.skipped++; continue; }

    counts.scanned += targets.length;

    // Step 2: upload all data URLs to object storage. Dedupe by oldVal so
    // we don't re-upload the same image twice if the template uses it in
    // multiple slots.
    const replacements = new Map<string, string>();
    for (const t of targets) {
      if (replacements.has(t.oldVal)) continue;
      try {
        const newUrl = await uploadDataUrl(t.oldVal, svc);
        if (!newUrl) {
          counts.failed++;
          console.warn(`[base64-migration] template#${tpl.id} ${t.array}.${t.key}: could not decode — leaving original.`);
          continue;
        }
        replacements.set(t.oldVal, newUrl);
      } catch (err: any) {
        counts.failed++;
        console.warn(`[base64-migration] template#${tpl.id} ${t.array}.${t.key}: upload failed (${err?.message ?? err}) — leaving original.`);
      }
    }
    if (replacements.size === 0) continue;

    // Step 3: short transaction, re-read, only patch unchanged values.
    try {
      await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(gameTemplates)
          .where(eq(gameTemplates.id, tpl.id))
          .limit(1);
        if (!current) return; // template was deleted; nothing to do

        const cfg = JSON.parse(JSON.stringify(current.config ?? {})) as any;
        let dirty = false;
        let migratedHere = 0;
        let racedHere = 0;

        const patch = (arr: any[] | undefined, key: Target["key"]) => {
          if (!Array.isArray(arr)) return;
          for (const item of arr) {
            const v = item?.[key];
            if (!isDataUrl(v)) continue;
            const newUrl = replacements.get(v);
            if (newUrl) {
              item[key] = newUrl;
              dirty = true;
              migratedHere++;
            }
          }
        };
        patch(cfg.heroes, "imageUrl");
        patch(cfg.maps, "imageUrl");
        patch(cfg.opponents, "logoUrl");

        // Anything we expected to migrate but no longer present == race.
        racedHere = Math.max(0, replacements.size - migratedHere);

        if (dirty) {
          await tx.update(gameTemplates).set({ config: cfg }).where(eq(gameTemplates.id, tpl.id));
          counts.migrated += migratedHere;
          console.log(`[base64-migration] template#${tpl.id}: migrated ${migratedHere} embedded image(s).`);
        }
        if (racedHere > 0) {
          counts.raced += racedHere;
          console.log(`[base64-migration] template#${tpl.id}: ${racedHere} embedded image(s) changed during migration — kept user values.`);
        }
      });
    } catch (err: any) {
      counts.failed += replacements.size;
      console.warn(`[base64-migration] template#${tpl.id}: transaction failed (${err?.message ?? err}) — leaving originals.`);
    }
  }
}

export async function migrateBase64Images(): Promise<void> {
  // Cheap probe: if object storage is not reachable, defer the migration
  // rather than churn the DB and log noise. The next boot will retry.
  let svc: ObjectStorageService;
  try {
    svc = new ObjectStorageService();
    (svc as any).getPrivateObjectDir?.();
  } catch (err: any) {
    console.warn("[base64-migration] Object storage not configured — skipping migration:", err?.message ?? err);
    return;
  }

  // Health probe: try a single 1-byte upload before scanning the DB. If the
  // sidecar is broken (e.g. deployment lacks bucket grants), this fails fast
  // and we skip the per-row attempts so we don't generate hundreds of noisy
  // failure lines. We also dump the real GCS error fields here, since
  // err.message alone often comes back as "Error code undefined" — the
  // useful information lives in err.code / err.errors / err.response.
  try {
    const probe = Buffer.from([0]);
    await svc.uploadBuffer(probe, "application/octet-stream", ".probe");
  } catch (err: any) {
    const code = err?.code ?? err?.response?.statusCode ?? "?";
    const msg = err?.message ?? String(err);
    const inner = err?.errors ? JSON.stringify(err.errors).slice(0, 400) : "";
    const respBody = err?.response?.body ? String(err.response.body).slice(0, 400) : "";
    console.warn(
      `[base64-migration] Object storage probe FAILED — skipping migration this boot. ` +
      `code=${code} message=${msg}${inner ? ` errors=${inner}` : ""}${respBody ? ` body=${respBody}` : ""}. ` +
      `On a deployed app this usually means the published instance lacks bucket grants — republish from Replit to refresh permissions.`
    );
    return;
  }

  const counts: Counts = { scanned: 0, migrated: 0, failed: 0, skipped: 0, raced: 0 };
  const t0 = Date.now();

  try {
    const heroRows = await db.select().from(heroes);
    await migrateColumn(
      "heroes.image_url", heroRows,
      r => r.imageUrl,
      async (id, oldVal, newUrl) => {
        const r = await db
          .update(heroes)
          .set({ imageUrl: newUrl })
          .where(and(eq(heroes.id, id), eq(heroes.imageUrl, oldVal)));
        return (r as any)?.rowCount ?? (r as any)?.count ?? 1;
      },
      svc, counts,
    );

    const mapRows = await db.select().from(maps);
    await migrateColumn(
      "maps.image_url", mapRows,
      r => r.imageUrl,
      async (id, oldVal, newUrl) => {
        const r = await db
          .update(maps)
          .set({ imageUrl: newUrl })
          .where(and(eq(maps.id, id), eq(maps.imageUrl, oldVal)));
        return (r as any)?.rowCount ?? (r as any)?.count ?? 1;
      },
      svc, counts,
    );

    const oppRows = await db.select().from(opponents);
    await migrateColumn(
      "opponents.logo_url", oppRows,
      r => r.logoUrl,
      async (id, oldVal, newUrl) => {
        const r = await db
          .update(opponents)
          .set({ logoUrl: newUrl })
          .where(and(eq(opponents.id, id), eq(opponents.logoUrl, oldVal)));
        return (r as any)?.rowCount ?? (r as any)?.count ?? 1;
      },
      svc, counts,
    );

    const gameRows = await db.select().from(games);
    await migrateColumn(
      "games.image_url", gameRows,
      r => r.imageUrl,
      async (id, oldVal, newUrl) => {
        const r = await db
          .update(games)
          .set({ imageUrl: newUrl })
          .where(and(eq(games.id, id), eq(games.imageUrl, oldVal)));
        return (r as any)?.rowCount ?? (r as any)?.count ?? 1;
      },
      svc, counts,
    );

    const miRows = await db.select().from(mediaItems);
    await migrateColumn(
      "media_items.url", miRows,
      r => r.url,
      async (id, oldVal, newUrl) => {
        const r = await db
          .update(mediaItems)
          .set({ url: newUrl })
          .where(and(eq(mediaItems.id, id), eq(mediaItems.url, oldVal)));
        return (r as any)?.rowCount ?? (r as any)?.count ?? 1;
      },
      svc, counts,
    );

    await migrateTemplateConfigs(svc, counts);
  } catch (err: any) {
    console.error("[base64-migration] Aborted:", err?.message ?? err);
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  if (counts.scanned > 0 || counts.migrated > 0 || counts.failed > 0 || counts.raced > 0) {
    console.log(
      `[base64-migration] Done in ${dt}s — ` +
      `scanned ${counts.scanned}, migrated ${counts.migrated}, failed ${counts.failed}, ` +
      `raced ${counts.raced} (originals preserved on failure / races).`,
    );
  } else {
    console.log(`[base64-migration] Nothing to migrate (${dt}s).`);
  }
}

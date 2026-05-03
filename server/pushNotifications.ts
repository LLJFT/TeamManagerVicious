import { db } from "./db";
import { pushTokens, pushReminders, events, subscriptions } from "@shared/schema";
import { and, eq, gte, lte, inArray } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  channelId?: string;
};

export async function sendExpoPush(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const valid = messages.filter((m) => /^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(m.to));
  if (valid.length === 0) return;
  const chunks: ExpoMessage[][] = [];
  for (let i = 0; i < valid.length; i += 100) chunks.push(valid.slice(i, i + 100));
  for (const chunk of chunks) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.warn("[push] failed to dispatch chunk:", (err as Error).message);
    }
  }
}

async function getEnabledTokensForUsers(userIds: string[]): Promise<{ userId: string; token: string }[]> {
  if (userIds.length === 0) return [];
  const rows = await db.select().from(pushTokens)
    .where(and(inArray(pushTokens.userId, userIds), eq(pushTokens.enabled, true)));
  return rows.map((r) => ({ userId: r.userId, token: r.token }));
}

/**
 * Atomically claim the right to send a reminder. Returns true if this caller
 * inserted the row (and should send), false if another caller (or a previous
 * tick) has already claimed it. Relies on the
 * push_reminders_kind_ref_user_uniq unique index to be race-safe across
 * concurrent server instances.
 */
async function claimReminder(kind: string, refId: string, userId: string): Promise<boolean> {
  try {
    const inserted = await db.insert(pushReminders)
      .values({ kind, refId, userId })
      .onConflictDoNothing({ target: [pushReminders.kind, pushReminders.refId, pushReminders.userId] })
      .returning();
    return inserted.length > 0;
  } catch {
    return false;
  }
}

async function releaseReminder(kind: string, refId: string, userId: string): Promise<void> {
  try {
    await db.delete(pushReminders).where(and(
      eq(pushReminders.kind, kind),
      eq(pushReminders.refId, refId),
      eq(pushReminders.userId, userId),
    ));
  } catch {}
}

function eventDateTime(date: string, time: string | null | undefined): Date | null {
  if (!date) return null;
  const t = time && /^\d{2}:\d{2}/.test(time) ? time : "00:00";
  const iso = `${date}T${t.length === 5 ? t + ":00" : t}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export async function checkUpcomingEventsAndNotify(now: Date = new Date()): Promise<number> {
  // Notify for events starting within the next ~24h (and not in the past).
  // Filter at the DB level by date so we don't scan the entire events table
  // on every tick.
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const candidateEvents = await db.select().from(events).where(and(
    gte(events.date, today),
    lte(events.date, tomorrow),
  ));
  if (candidateEvents.length === 0) return 0;

  const teamIds = Array.from(new Set(candidateEvents.map((e) => e.teamId).filter((t): t is string => !!t)));
  if (teamIds.length === 0) return 0;

  const tokenRows = await db.select().from(pushTokens).where(and(
    eq(pushTokens.enabled, true),
    inArray(pushTokens.teamId, teamIds),
  ));
  const tokensByTeam = new Map<string, { userId: string; token: string }[]>();
  for (const t of tokenRows) {
    const key = t.teamId ?? "";
    if (!tokensByTeam.has(key)) tokensByTeam.set(key, []);
    tokensByTeam.get(key)!.push({ userId: t.userId, token: t.token });
  }

  let sent = 0;
  for (const ev of candidateEvents) {
    const when = eventDateTime(ev.date, ev.time);
    if (!when) continue;
    if (when <= now || when > horizon) continue;
    const teamKey = ev.teamId ?? "";
    const tokens = tokensByTeam.get(teamKey) ?? [];
    if (tokens.length === 0) continue;

    const minsUntil = Math.max(1, Math.round((when.getTime() - now.getTime()) / 60000));
    const human = minsUntil >= 60 ? `${Math.round(minsUntil / 60)}h` : `${minsUntil}m`;
    const title = `Upcoming ${ev.eventType ?? "event"} in ${human}`;
    const body = ev.opponentName ? `${ev.title} vs ${ev.opponentName}` : ev.title;

    for (const { userId, token } of tokens) {
      // Atomically claim the reminder before sending so concurrent server
      // instances cannot send duplicates.
      const claimed = await claimReminder("event", ev.id, userId);
      if (!claimed) continue;
      try {
        await sendExpoPush([
          {
            to: token,
            title,
            body,
            data: { kind: "event", eventId: ev.id },
            sound: "default",
            channelId: "default",
          },
        ]);
        sent += 1;
      } catch (err) {
        // If sending failed, release the claim so it can be retried next tick.
        await releaseReminder("event", ev.id, userId);
        console.warn("[push] event send failed:", (err as Error).message);
      }
    }
  }

  return sent;
}

export async function checkExpiringSubscriptionsAndNotify(now: Date = new Date()): Promise<number> {
  // Notify subscription owners 7 days, 3 days, and 1 day before expiry
  const subs = await db.select().from(subscriptions);
  const reminderWindowsDays = [7, 3, 1];
  let sent = 0;

  const userIds = Array.from(new Set(subs.map((s) => s.userId)));
  const tokens = await getEnabledTokensForUsers(userIds);
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens) {
    if (!tokensByUser.has(t.userId)) tokensByUser.set(t.userId, []);
    tokensByUser.get(t.userId)!.push(t.token);
  }

  for (const sub of subs) {
    if (!sub.endDate) continue;
    const end = new Date(sub.endDate);
    if (isNaN(end.getTime())) continue;
    const msLeft = end.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    const window = reminderWindowsDays.find((d) => daysLeft === d);
    if (!window) continue;

    const userTokens = tokensByUser.get(sub.userId);
    if (!userTokens || userTokens.length === 0) continue;

    const refId = `${sub.id}:${window}`;
    const claimed = await claimReminder("subscription", refId, sub.userId);
    if (!claimed) continue;

    const messages: ExpoMessage[] = userTokens.map((token) => ({
      to: token,
      title: window === 1 ? "Subscription expires tomorrow" : `Subscription expires in ${window} days`,
      body: `Your ${sub.type ?? "subscription"} ends on ${end.toDateString()}. Renew to avoid interruption.`,
      data: { kind: "subscription", subscriptionId: sub.id, daysLeft: window },
      sound: "default",
      channelId: "default",
    }));
    try {
      await sendExpoPush(messages);
      sent += messages.length;
    } catch (err) {
      await releaseReminder("subscription", refId, sub.userId);
      console.warn("[push] subscription send failed:", (err as Error).message);
    }
  }

  return sent;
}

let schedulerHandle: NodeJS.Timeout | null = null;

export function startPushScheduler(intervalMs: number = 5 * 60 * 1000): void {
  if (schedulerHandle) return;
  const tick = async () => {
    try {
      await checkUpcomingEventsAndNotify();
      await checkExpiringSubscriptionsAndNotify();
    } catch (err) {
      console.warn("[push] scheduler tick failed:", (err as Error).message);
    }
  };
  // Fire once shortly after boot, then on the interval
  setTimeout(tick, 30_000);
  schedulerHandle = setInterval(tick, intervalMs);
}

export function stopPushScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}

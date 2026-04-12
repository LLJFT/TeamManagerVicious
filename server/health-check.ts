import { db } from "./db";
import { sql } from "drizzle-orm";
import { users, supportedGames, rosters, events, players, games, playerGameStats, attendance, chatChannels, chatMessages, roles } from "@shared/schema";

export async function runHealthCheck() {
  console.log("\n========================================");
  console.log("  HEALTH CHECK — The Vicious Platform");
  console.log("========================================\n");

  const results: { name: string; status: "PASS" | "FAIL"; detail: string }[] = [];

  try {
    const r = await db.execute(sql`SELECT 1 as ok`);
    results.push({ name: "Database connection", status: "PASS", detail: "Connected to PostgreSQL" });
  } catch (e: any) {
    results.push({ name: "Database connection", status: "FAIL", detail: e.message });
  }

  try {
    const g = await db.select({ count: sql<number>`count(*)` }).from(supportedGames);
    const count = Number(g[0]?.count || 0);
    results.push({ name: "Supported games", status: count >= 29 ? "PASS" : "FAIL", detail: `${count} games found` });
  } catch (e: any) {
    results.push({ name: "Supported games", status: "FAIL", detail: e.message });
  }

  try {
    const u = await db.select({ count: sql<number>`count(*)` }).from(users);
    const count = Number(u[0]?.count || 0);
    results.push({ name: "Admin user exists", status: count >= 1 ? "PASS" : "FAIL", detail: `${count} users found` });
  } catch (e: any) {
    results.push({ name: "Admin user exists", status: "FAIL", detail: e.message });
  }

  try {
    const r = await db.select({ count: sql<number>`count(*)` }).from(roles);
    const count = Number(r[0]?.count || 0);
    results.push({ name: "Roles seeded", status: count >= 3 ? "PASS" : "FAIL", detail: `${count} roles found` });
  } catch (e: any) {
    results.push({ name: "Roles seeded", status: "FAIL", detail: e.message });
  }

  try {
    const r = await db.select({ count: sql<number>`count(*)` }).from(rosters);
    const count = Number(r[0]?.count || 0);
    results.push({ name: "Rosters created", status: count > 0 ? "PASS" : "FAIL", detail: `${count} rosters` });
  } catch (e: any) {
    results.push({ name: "Rosters created", status: "FAIL", detail: e.message });
  }

  try {
    const p = await db.select({ count: sql<number>`count(*)` }).from(players);
    const count = Number(p[0]?.count || 0);
    results.push({ name: "Players seeded", status: count > 0 ? "PASS" : "FAIL", detail: `${count} players` });
  } catch (e: any) {
    results.push({ name: "Players seeded", status: "FAIL", detail: e.message });
  }

  try {
    const e = await db.select({ count: sql<number>`count(*)` }).from(events);
    const count = Number(e[0]?.count || 0);
    results.push({ name: "Events seeded", status: count > 0 ? "PASS" : "FAIL", detail: `${count} events` });
  } catch (e: any) {
    results.push({ name: "Events seeded", status: "FAIL", detail: e.message });
  }

  try {
    const g = await db.select({ count: sql<number>`count(*)` }).from(games);
    const count = Number(g[0]?.count || 0);
    results.push({ name: "Match results", status: count > 0 ? "PASS" : "FAIL", detail: `${count} matches` });
  } catch (e: any) {
    results.push({ name: "Match results", status: "FAIL", detail: e.message });
  }

  try {
    const s = await db.select({ count: sql<number>`count(*)` }).from(playerGameStats);
    const count = Number(s[0]?.count || 0);
    results.push({ name: "Player statistics", status: count > 0 ? "PASS" : "FAIL", detail: `${count} stat entries` });
  } catch (e: any) {
    results.push({ name: "Player statistics", status: "FAIL", detail: e.message });
  }

  try {
    const a = await db.select({ count: sql<number>`count(*)` }).from(attendance);
    const count = Number(a[0]?.count || 0);
    results.push({ name: "Attendance records", status: count > 0 ? "PASS" : "FAIL", detail: `${count} records` });
  } catch (e: any) {
    results.push({ name: "Attendance records", status: "FAIL", detail: e.message });
  }

  try {
    const c = await db.select({ count: sql<number>`count(*)` }).from(chatChannels);
    const count = Number(c[0]?.count || 0);
    results.push({ name: "Chat channels", status: count > 0 ? "PASS" : "FAIL", detail: `${count} channels` });
  } catch (e: any) {
    results.push({ name: "Chat channels", status: "FAIL", detail: e.message });
  }

  try {
    const m = await db.select({ count: sql<number>`count(*)` }).from(chatMessages);
    const count = Number(m[0]?.count || 0);
    results.push({ name: "Chat messages", status: count > 0 ? "PASS" : "FAIL", detail: `${count} messages` });
  } catch (e: any) {
    results.push({ name: "Chat messages", status: "FAIL", detail: e.message });
  }

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;

  for (const r of results) {
    const icon = r.status === "PASS" ? "[PASS]" : "[FAIL]";
    console.log(`  ${icon} ${r.name}: ${r.detail}`);
  }

  console.log(`\n  Result: ${passed}/${results.length} passed, ${failed} failed`);
  console.log("========================================\n");

  return { passed, failed, total: results.length, results };
}

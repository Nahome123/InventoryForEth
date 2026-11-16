import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { sessions, users, type Role } from "./db/schema";
import { UserError } from "./errors";
import { can, type Permission } from "./permissions";

const COOKIE = "erp_session";
const SESSION_DAYS = 14;

let DUMMY_HASH: string | undefined;

const hashToken =(t: string) => crypto.createHash("sha256").update(t).digest("hex");

export type SessionUser = { id: number; username: string; fullName: string; role: Role };

export async function hashPassword(pw: string) {
  if (pw.length < 8) throw new UserError("Password must be at least 8 characters.");
  return bcrypt.hash(pw, 10);
}

export async function hasAnyUser() {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return Number(r.n) > 0;
}

export async function login(username: string, password: string) {
  const db = await getDb();
  const [u] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username.trim()})`);
  // Compare even when the user is missing so timing doesn't reveal valid usernames.
  const ok = await bcrypt.compare(password, u?.passwordHash ?? (DUMMY_HASH ??= bcrypt.hashSync("not-a-real-password", 10)));
  if (!u || !ok || !u.active) throw new UserError("Wrong username or password.");
  await startSession(u.id);
}

export async function startSession(userId: number) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, username: users.username, fullName: users.fullName, role: users.role, active: users.active })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  if (!row || !row.active) return null;
  return { id: row.id, username: row.username, fullName: row.fullName, role: row.role };
});

/** For pages: redirects to login (or home) when not allowed. */
export async function requireUser(permission?: Permission): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (permission && !can(u.role, permission)) redirect("/?denied=1");
  return u;
}

/** For server actions: throws a friendly error instead of redirecting. */
export async function requireActionUser(permission?: Permission): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new UserError("Your session has expired. Please sign in again.");
  if (permission && !can(u.role, permission)) throw new UserError("You don't have permission to do that.");
  return u;
}

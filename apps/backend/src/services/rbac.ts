import { randomBytes } from "node:crypto";
import { and, eq, sql, count } from "drizzle-orm";
import {
  organizationMembers,
  projectMembers,
  projects,
  invites,
  rbacAuditLog,
  type OrgRole,
  type ProjectRole,
  type RbacAuditAction,
} from "@coglity/shared/schema";
import { db } from "../db.js";

export type EffectiveProjectRole = "super_admin" | ProjectRole | null;

class RbacError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

const CACHE_TTL_MS = 30_000;
type CacheEntry<T> = { value: T; expiresAt: number };
const orgRoleCache = new Map<string, CacheEntry<OrgRole | null>>();
const projectRoleCache = new Map<string, CacheEntry<EffectiveProjectRole>>();

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateOrgCache(userId: string, organizationId?: string): void {
  if (organizationId) {
    orgRoleCache.delete(`${userId}:${organizationId}`);
    for (const key of projectRoleCache.keys()) {
      if (key.startsWith(`${userId}:${organizationId}:`)) projectRoleCache.delete(key);
    }
    return;
  }
  for (const key of orgRoleCache.keys()) {
    if (key.startsWith(`${userId}:`)) orgRoleCache.delete(key);
  }
  for (const key of projectRoleCache.keys()) {
    if (key.startsWith(`${userId}:`)) projectRoleCache.delete(key);
  }
}

export function invalidateProjectCache(userId: string, projectId: string): void {
  for (const key of projectRoleCache.keys()) {
    if (key.startsWith(`${userId}:`) && key.endsWith(`:${projectId}`)) {
      projectRoleCache.delete(key);
    }
  }
}

export async function resolveOrgRole(userId: string, organizationId: string): Promise<OrgRole | null> {
  const key = `${userId}:${organizationId}`;
  const cached = cacheGet(orgRoleCache, key);
  if (cached !== undefined) return cached;

  const [row] = await db
    .select({ orgRole: organizationMembers.orgRole })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
    .limit(1);

  const role = row?.orgRole ?? null;
  cacheSet(orgRoleCache, key, role);
  return role;
}

export async function resolveProjectRole(
  userId: string,
  organizationId: string,
  projectId: string,
): Promise<EffectiveProjectRole> {
  const key = `${userId}:${organizationId}:${projectId}`;
  const cached = cacheGet(projectRoleCache, key);
  if (cached !== undefined) return cached;

  const orgRole = await resolveOrgRole(userId, organizationId);
  if (orgRole === "super_admin") {
    cacheSet(projectRoleCache, key, "super_admin");
    return "super_admin";
  }
  if (orgRole === null) {
    cacheSet(projectRoleCache, key, null);
    return null;
  }

  const [row] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  const role = row?.role ?? null;
  cacheSet(projectRoleCache, key, role);
  return role;
}

export async function projectBelongsToOrg(projectId: string, organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
    .limit(1);
  return !!row;
}

export const PROJECT_ROLE_RANK: Record<"read" | "writer" | "admin" | "super_admin", number> = {
  read: 1,
  writer: 2,
  admin: 3,
  super_admin: 4,
};

export async function ensureNotLastSuperAdmin(organizationId: string, targetUserId: string): Promise<void> {
  const [row] = await db
    .select({ c: count() })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.orgRole, "super_admin")));
  if ((row?.c ?? 0) <= 1) {
    const [target] = await db
      .select({ orgRole: organizationMembers.orgRole })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, targetUserId)))
      .limit(1);
    if (target?.orgRole === "super_admin") {
      throw new RbacError(409, "LAST_SUPER_ADMIN", "Cannot demote the last super admin of an organization");
    }
  }
}

export async function ensureNotLastProjectAdmin(projectId: string, targetUserId: string): Promise<void> {
  const [row] = await db
    .select({ c: count() })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, "admin")));
  if ((row?.c ?? 0) <= 1) {
    const [target] = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, targetUserId)))
      .limit(1);
    if (target?.role === "admin") {
      throw new RbacError(409, "LAST_PROJECT_ADMIN", "Cannot remove the last admin of a project");
    }
  }
}

export async function auditRbac(opts: {
  actorUserId: string;
  targetUserId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  action: RbacAuditAction;
  fromRole?: string | null;
  toRole?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(rbacAuditLog).values({
    actorUserId: opts.actorUserId,
    targetUserId: opts.targetUserId ?? null,
    organizationId: opts.organizationId ?? null,
    projectId: opts.projectId ?? null,
    action: opts.action,
    fromRole: opts.fromRole ?? null,
    toRole: opts.toRole ?? null,
    metadata: opts.metadata ?? null,
  });
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createInvite(opts: {
  organizationId: string;
  projectId: string;
  email: string;
  projectRole: ProjectRole;
  createdBy: string;
  ttlMs?: number;
}): Promise<{ token: string; expiresAt: Date; id: string }> {
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + (opts.ttlMs ?? 7 * 24 * 60 * 60 * 1000));
  const [row] = await db
    .insert(invites)
    .values({
      token,
      email: opts.email.toLowerCase().trim(),
      organizationId: opts.organizationId,
      projectId: opts.projectId,
      projectRole: opts.projectRole,
      expiresAt,
      createdBy: opts.createdBy,
    })
    .returning({ id: invites.id });
  await auditRbac({
    actorUserId: opts.createdBy,
    organizationId: opts.organizationId,
    projectId: opts.projectId,
    action: "create_invite",
    toRole: opts.projectRole,
    metadata: { email: opts.email.toLowerCase().trim(), inviteId: row.id },
  });
  return { token, expiresAt, id: row.id };
}

export async function consumeInvite(opts: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<{ organizationId: string; projectId: string; projectRole: ProjectRole }> {
  const nowLiteral = sql`now()`;
  const updated = await db
    .update(invites)
    .set({ consumedAt: new Date(), consumedByUserId: opts.userId })
    .where(
      and(
        eq(invites.token, opts.token),
        sql`${invites.consumedAt} IS NULL`,
        sql`${invites.expiresAt} > ${nowLiteral}`,
        eq(invites.email, opts.userEmail.toLowerCase().trim()),
      ),
    )
    .returning();

  if (updated.length === 0) {
    throw new RbacError(410, "INVITE_INVALID", "This invite is invalid, expired, or not addressed to you");
  }

  const invite = updated[0];

  await db
    .insert(organizationMembers)
    .values({
      organizationId: invite.organizationId,
      userId: opts.userId,
      orgRole: "member",
      joinedVia: "invite",
    })
    .onConflictDoNothing();

  await db
    .insert(projectMembers)
    .values({
      projectId: invite.projectId,
      userId: opts.userId,
      role: invite.projectRole,
      createdBy: invite.createdBy,
    })
    .onConflictDoUpdate({
      target: [projectMembers.projectId, projectMembers.userId],
      set: { role: invite.projectRole, updatedAt: new Date() },
    });

  invalidateOrgCache(opts.userId, invite.organizationId);

  await auditRbac({
    actorUserId: opts.userId,
    targetUserId: opts.userId,
    organizationId: invite.organizationId,
    projectId: invite.projectId,
    action: "consume_invite",
    toRole: invite.projectRole,
    metadata: { inviteId: invite.id },
  });

  return {
    organizationId: invite.organizationId,
    projectId: invite.projectId,
    projectRole: invite.projectRole,
  };
}

export { RbacError };

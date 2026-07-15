import "server-only";

import { Prisma, type Role, type UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { listAuditLogFor } from "../audit";
import type { UserListFilter } from "./validation";

/**
 * Čtecí vrstva admin výpisu/detailu uživatelů (T035 § Main flow 2). Vyhledání
 * „jménem" hledá v e-mailu a v titulku profesního profilu (headline) — appka
 * nemá samostatné pole „jméno" na `User` (T002).
 */

export const PAGE_SIZE = 20;

export type AdminUserRow = {
  id: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  lastLoginAt: Date | null;
  createdAt: Date;
  professionalHeadline: string | null;
  verifiedPhone: boolean;
  verifiedEmail: boolean;
};

/** Výpis uživatelů podle filtrů (T035 § Main flow 2). Stránkováno po 20. */
export async function listUsersForAdmin(
  filter: UserListFilter,
): Promise<{ rows: AdminUserRow[]; total: number; pageCount: number }> {
  const where: Prisma.UserWhereInput = {};

  if (filter.status !== "all") where.status = filter.status;
  if (filter.role !== "all") {
    where.roles = { some: { role: filter.role as Role } };
  }
  if (filter.verified !== "all") {
    const verifiedFilter: Prisma.VerificationWhereInput = {
      status: "verified",
      type: { in: ["email", "phone"] },
    };
    where.verifications =
      filter.verified === "yes" ? { some: verifiedFilter } : { none: verifiedFilter };
  }
  if (filter.query) {
    const q = filter.query;
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      {
        professionalProfile: {
          headline: { contains: q, mode: "insensitive" },
        },
      },
    ];
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { select: { role: true } },
        professionalProfile: { select: { headline: true } },
        verifications: {
          where: { status: "verified", type: { in: ["email", "phone"] } },
          select: { type: true },
        },
      },
    }),
  ]);

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    status: u.status,
    roles: u.roles.map((r) => r.role),
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    professionalHeadline: u.professionalProfile?.headline ?? null,
    verifiedPhone: u.verifications.some((v) => v.type === "phone"),
    verifiedEmail: u.verifications.some((v) => v.type === "email"),
  }));

  return { rows, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type AdminUserDetail = {
  id: string;
  email: string;
  status: UserStatus;
  locale: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  roles: Role[];
  professionalProfile: { headline: string | null; slug: string | null; status: string } | null;
  organizations: { id: string; name: string; role: string }[];
  verifications: { type: string; status: string }[];
  auditLog: {
    id: string;
    action: string;
    reason: string | null;
    createdAt: Date;
    actorEmail: string | null;
  }[];
};

/** Detail uživatele pro admin (T035 § Main flow 2): účet, role, profily, firmy. */
export async function getUserDetailForAdmin(
  userId: string,
): Promise<AdminUserDetail | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      locale: true,
      createdAt: true,
      lastLoginAt: true,
      roles: { select: { role: true } },
      professionalProfile: {
        select: { headline: true, slug: true, status: true },
      },
      orgMemberships: {
        select: { role: true, org: { select: { id: true, name: true } } },
      },
      verifications: { select: { type: true, status: true } },
    },
  });
  if (!user) return null;

  const auditLog = await listAuditLogFor("user", userId);

  return {
    id: user.id,
    email: user.email,
    status: user.status,
    locale: user.locale,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    roles: user.roles.map((r) => r.role),
    professionalProfile: user.professionalProfile,
    organizations: user.orgMemberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      role: m.role,
    })),
    verifications: user.verifications,
    auditLog: auditLog.map((entry) => ({
      id: entry.id,
      action: entry.action,
      reason: entry.reason,
      createdAt: entry.createdAt,
      actorEmail: entry.actorUser?.email ?? null,
    })),
  };
}

/** Základní čísla pro admin dashboard (T035 § Main flow 6). Jen počty z DB. */
export async function getAdminDashboardCounts(): Promise<{
  users: number;
  professionalProfiles: number;
  activeRequests: number;
}> {
  const [users, professionalProfiles, activeRequests] = await Promise.all([
    db.user.count(),
    db.professionalProfile.count({ where: { status: "published" } }),
    db.request.count({ where: { status: "active" } }),
  ]);
  return { users, professionalProfiles, activeRequests };
}

import { eq } from 'drizzle-orm';
import {
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  selectOrganizationSchema,
} from '@coglity/shared/schema';
import { db } from '../db';
import { auditRbac, invalidateOrgCache } from './rbac';

export class OrganizationService {
  static async listUserOrganizations(userId: string) {
    return db
      .select({
        id: organizations.id,
        name: organizations.name,
        orgRole: organizationMembers.orgRole,
        joinedVia: organizationMembers.joinedVia,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, userId));
  }

  static async createOrganization(
    userId: string,
    orgName: string,
    firstProject: { name: string; description?: string }
  ) {
    const [org] = await db
      .insert(organizations)
      .values({ name: orgName, createdBy: userId })
      .returning();

    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId,
      orgRole: 'super_admin',
      joinedVia: 'creation',
    });

    const [project] = await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: firstProject.name,
        description: firstProject.description ?? '',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await db.insert(projectMembers).values({
      projectId: project.id,
      userId,
      role: 'admin',
      createdBy: userId,
    });

    await auditRbac({
      actorUserId: userId,
      organizationId: org.id,
      action: 'create_org',
      metadata: { name: org.name },
    });
    await auditRbac({
      actorUserId: userId,
      organizationId: org.id,
      projectId: project.id,
      action: 'create_project',
      metadata: { name: project.name },
    });

    invalidateOrgCache(userId);
    return { organization: org, project };
  }

  static async getOrganization(organizationId: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    return org ? selectOrganizationSchema.parse(org) : null;
  }

  static async updateOrganization(organizationId: string, payload: Record<string, any>) {
    const [updated] = await db
      .update(organizations)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning();
    return updated;
  }

  static async deleteOrganization(
    organizationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const [projCount] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .limit(1);

    if (projCount) {
      return { success: false, error: 'Organization has projects; delete them first' };
    }

    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await auditRbac({
      actorUserId: userId,
      organizationId,
      action: 'delete_org',
    });
    invalidateOrgCache(userId, organizationId);

    return { success: true };
  }
}

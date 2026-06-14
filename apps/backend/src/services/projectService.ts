import { and, eq } from 'drizzle-orm';
import { projects, projectMembers } from '@coglity/shared/schema';
import { db } from '../db';
import { auditRbac } from './rbac';

export class ProjectService {
  static async listProjects(organizationId: string, userId: string, orgRole: string) {
    if (orgRole === 'super_admin') {
      return db
        .select({
          id: projects.id,
          organizationId: projects.organizationId,
          name: projects.name,
          description: projects.description,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .where(eq(projects.organizationId, organizationId));
    }

    return db
      .select({
        id: projects.id,
        organizationId: projects.organizationId,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        role: projectMembers.role,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(and(eq(projects.organizationId, organizationId), eq(projectMembers.userId, userId)));
  }

  static async createProject(
    organizationId: string,
    userId: string,
    payload: { name: string; description?: string }
  ) {
    const [project] = await db
      .insert(projects)
      .values({
        organizationId,
        name: payload.name,
        description: payload.description ?? '',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await auditRbac({
      actorUserId: userId,
      organizationId,
      projectId: project.id,
      action: 'create_project',
      metadata: { name: project.name },
    });

    return project;
  }

  static async getProject(projectId: string) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId));
    return proj;
  }

  static async updateProject(projectId: string, userId: string, payload: Record<string, any>) {
    const [updated] = await db
      .update(projects)
      .set({ ...payload, updatedBy: userId, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    return updated;
  }

  static async deleteProject(organizationId: string, projectId: string, userId: string) {
    await db.delete(projects).where(eq(projects.id, projectId));
    await auditRbac({
      actorUserId: userId,
      organizationId,
      projectId,
      action: 'delete_project',
    });
  }
}

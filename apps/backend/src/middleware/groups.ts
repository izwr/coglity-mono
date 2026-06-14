import { requireAuth } from './requireAuth';
import { resolveOrg } from './resolveOrg';
import { requireOrgRole } from './requireOrgRole';
import { resolveProject } from './resolveProject';
import { requireProjectRole } from './requireProjectRole';

export const withOrgAccess = [requireAuth, resolveOrg];
export const withOrgSuperAdmin = [requireAuth, resolveOrg, requireOrgRole('super_admin')];

export const withProjectRead = [requireAuth, resolveOrg, resolveProject, requireProjectRole('read')];
export const withProjectWrite = [requireAuth, resolveOrg, resolveProject, requireProjectRole('writer')];
export const withProjectAdmin = [requireAuth, resolveOrg, resolveProject, requireProjectRole('admin')];

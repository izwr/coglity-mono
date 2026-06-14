import { Router, type Router as RouterType } from 'express';
import { z } from 'zod/v4';
import { insertOrganizationSchema, insertProjectSchema } from '@coglity/shared/schema';
import { withOrgAccess, withOrgSuperAdmin } from '../middleware/groups';
import { validateBody } from '../middleware/validate';
import { OrganizationService } from '../services/organizationService';

const router: RouterType = Router();

const createOrgWithProjectSchema = z.object({
  name: z.string().min(1).max(255),
  firstProject: insertProjectSchema.pick({ name: true, description: true }),
});

// List orgs I'm a member of
router.get('/', requireAuth, async (req, res) => {
  const rows = await OrganizationService.listUserOrganizations(req.session.userId!);
  res.json({ data: rows });
});

// Create org (+ first project, + make me super_admin)
router.post('/', requireAuth, validateBody(createOrgWithProjectSchema), async (req, res) => {
  const orgInsert = insertOrganizationSchema.safeParse({ name: req.body.name });
  if (!orgInsert.success) {
    res.status(400).json({ error: orgInsert.error.flatten().fieldErrors });
    return;
  }

  const result = await OrganizationService.createOrganization(
    req.session.userId!,
    orgInsert.data.name,
    req.body.firstProject
  );

  res.status(201).json(result);
});

// Get org
router.get('/:orgId', ...withOrgAccess, async (req, res) => {
  const org = await OrganizationService.getOrganization(req.organizationId!);
  if (!org) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }
  res.json({ ...org, orgRole: req.orgRole });
});

// Update org
router.put(
  '/:orgId',
  ...withOrgSuperAdmin,
  validateBody(insertOrganizationSchema.partial()),
  async (req, res) => {
    const updated = await OrganizationService.updateOrganization(
      req.organizationId!,
      req.body
    );
    if (!updated) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    res.json(updated);
  }
);

// Delete org
router.delete(
  '/:orgId',
  ...withOrgSuperAdmin,
  async (req, res) => {
    const result = await OrganizationService.deleteOrganization(
      req.organizationId!,
      req.session.userId!
    );
    if (!result.success) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(204).send();
  }
);

export default router;

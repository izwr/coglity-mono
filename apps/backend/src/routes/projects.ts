import { Router, type Router as RouterType } from 'express';
import { insertProjectSchema } from '@coglity/shared/schema';
import { withOrgAccess, withOrgSuperAdmin, withProjectRead, withProjectAdmin } from '../middleware/groups';
import { validateBody } from '../middleware/validate';
import { ProjectService } from '../services/projectService';

const router: RouterType = Router({ mergeParams: true });

// List projects in this org
router.get('/', ...withOrgAccess, async (req, res) => {
  const rows = await ProjectService.listProjects(
    req.organizationId!,
    req.session.userId!,
    req.orgRole!
  );
  res.json({ data: rows });
});

// Create project (super_admin only)
router.post(
  '/',
  ...withOrgSuperAdmin,
  validateBody(insertProjectSchema),
  async (req, res) => {
    const project = await ProjectService.createProject(
      req.organizationId!,
      req.session.userId!,
      req.body
    );
    res.status(201).json(project);
  }
);

// Get project
router.get(
  '/:projectId',
  ...withProjectRead,
  async (req, res) => {
    const proj = await ProjectService.getProject(req.projectId!);
    if (!proj) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ ...proj, role: req.projectRole });
  }
);

// Update project
router.put(
  '/:projectId',
  ...withProjectAdmin,
  validateBody(insertProjectSchema.partial()),
  async (req, res) => {
    const updated = await ProjectService.updateProject(
      req.projectId!,
      req.session.userId!,
      req.body
    );
    if (!updated) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(updated);
  }
);

// Delete project
router.delete(
  '/:projectId',
  ...withProjectAdmin,
  async (req, res) => {
    await ProjectService.deleteProject(
      req.organizationId!,
      req.projectId!,
      req.session.userId!
    );
    res.status(204).send();
  }
);

export default router;

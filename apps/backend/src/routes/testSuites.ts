import { type Router as RouterType, Router } from 'express';
import { insertTestSuiteSchema } from '@coglity/shared/schema';
import { withProjectRead, withProjectWrite } from '../middleware/groups';
import { validateBody } from '../middleware/validate';
import { TestSuiteService } from '../services/testSuiteService';
import { db } from '../db';

const router: RouterType = Router({ mergeParams: true });

router.get('/', ...withProjectRead, async (req, res) => {
  const projectId = req.projectId!;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : '';
  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));

  const result = await TestSuiteService.listTestSuites(req.db ?? db, projectId, {
    search,
    tagId,
    sortBy,
    sortDir,
    page,
    limit,
  });

  res.json(result);
});

router.get('/:id', ...withProjectRead, async (req, res) => {
  const projectId = req.projectId!;
  const suite = await TestSuiteService.getTestSuite(req.db ?? db, projectId, req.params.id as string);
  
  if (!suite) {
    res.status(404).json({ error: 'Test suite not found' });
    return;
  }
  res.json(suite);
});

router.post(
  '/',
  ...withProjectWrite,
  validateBody(insertTestSuiteSchema),
  async (req, res) => {
    const projectId = req.projectId!;
    const userId = req.session.userId;
    const { tagIds, ...data } = req.body;

    const suite = await TestSuiteService.createTestSuite(
      req.db ?? db,
      projectId,
      userId,
      data,
      tagIds
    );
    res.status(201).json(suite);
  }
);

router.put(
  '/:id',
  ...withProjectWrite,
  validateBody(insertTestSuiteSchema),
  async (req, res) => {
    const projectId = req.projectId!;
    const userId = req.session.userId;
    const { tagIds, ...data } = req.body;

    const suite = await TestSuiteService.updateTestSuite(
      req.db ?? db,
      projectId,
      userId,
      req.params.id as string,
      data,
      tagIds
    );

    if (!suite) {
      res.status(404).json({ error: 'Test suite not found' });
      return;
    }

    res.json(suite);
  }
);

router.delete('/:id', ...withProjectWrite, async (req, res) => {
  const projectId = req.projectId!;
  const deleted = await TestSuiteService.deleteTestSuite(
    req.db ?? db,
    projectId,
    req.params.id as string
  );

  if (!deleted) {
    res.status(404).json({ error: 'Test suite not found' });
    return;
  }

  res.status(204).send();
});

export default router;

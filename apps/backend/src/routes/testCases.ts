import { type Router as RouterType, Router } from 'express';
import { insertTestCaseSchema } from '@coglity/shared/schema';
import { withProjectRead, withProjectWrite } from '../middleware/groups';
import { validateBody } from '../middleware/validate';
import { TestCaseService } from '../services/testCaseService';
import { db } from '../db';

const router: RouterType = Router({ mergeParams: true });

router.get('/', ...withProjectRead, async (req, res) => {
  const projectId = req.projectId!;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const suiteId = typeof req.query.testSuiteId === 'string' ? req.query.testSuiteId : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : '';
  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));

  const result = await TestCaseService.listTestCases(req.db ?? db, projectId, {
    search,
    suiteId,
    status,
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
  const tc = await TestCaseService.getTestCase(req.db ?? db, projectId, req.params.id as string);
  
  if (!tc) {
    res.status(404).json({ error: 'Test case not found' });
    return;
  }
  
  res.json(tc);
});

router.post(
  '/',
  ...withProjectWrite,
  validateBody(insertTestCaseSchema),
  async (req, res) => {
    const projectId = req.projectId!;
    const userId = req.session.userId;
    const { tagIds, ...data } = req.body;

    try {
      const tc = await TestCaseService.createTestCase(
        req.db ?? db,
        projectId,
        userId,
        data,
        tagIds
      );
      res.status(201).json(tc);
    } catch (e: any) {
      if (e.message === 'Test suite not found in this project') {
        res.status(400).json({ error: e.message });
      } else {
        throw e;
      }
    }
  }
);

router.put(
  '/:id',
  ...withProjectWrite,
  validateBody(insertTestCaseSchema.omit({ testSuiteId: true })),
  async (req, res) => {
    const projectId = req.projectId!;
    const userId = req.session.userId;
    const { tagIds, testSuiteId: _ignored, ...data } = req.body;

    const tc = await TestCaseService.updateTestCase(
      req.db ?? db,
      projectId,
      userId,
      req.params.id as string,
      data,
      tagIds
    );

    if (!tc) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    res.json(tc);
  }
);

router.delete('/:id', ...withProjectWrite, async (req, res) => {
  const projectId = req.projectId!;
  
  const deleted = await TestCaseService.deleteTestCase(
    req.db ?? db,
    projectId,
    req.params.id as string
  );

  if (!deleted) {
    res.status(404).json({ error: 'Test case not found' });
    return;
  }

  res.status(204).send();
});

export default router;

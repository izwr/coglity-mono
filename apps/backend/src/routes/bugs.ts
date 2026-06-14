import { type Router as RouterType, Router } from 'express';
import { insertBugSchema } from '@coglity/shared/schema';
import { withProjectRead, withProjectWrite } from '../middleware/groups';
import { validateBody } from '../middleware/validate';
import { BugService } from '../services/bugService';
import { db } from '../db';

const router: RouterType = Router({ mergeParams: true });

router.get('/', ...withProjectRead, async (req, res) => {
  const projectId = req.projectId!;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const priority = typeof req.query.priority === 'string' ? req.query.priority : '';
  const severity = typeof req.query.severity === 'string' ? req.query.severity : '';
  const bugType = typeof req.query.bugType === 'string' ? req.query.bugType : '';
  const assignedToId = typeof req.query.assignedTo === 'string' ? req.query.assignedTo : '';
  const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : '';
  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));

  const result = await BugService.listBugs(req.db ?? db, projectId, {
    search,
    state,
    priority,
    severity,
    bugType,
    assignedToId,
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
  const bug = await BugService.getBug(req.db ?? db, projectId, req.params.id as string);
  
  if (!bug) {
    res.status(404).json({ error: 'Bug not found' });
    return;
  }
  
  res.json(bug);
});

router.post(
  '/',
  ...withProjectWrite,
  validateBody(insertBugSchema),
  async (req, res) => {
    const projectId = req.projectId!;
    const userId = req.session.userId;
    const { tagIds, ...data } = req.body;

    const bug = await BugService.createBug(
      req.db ?? db,
      projectId,
      userId,
      data,
      tagIds
    );

    res.status(201).json(bug);
  }
);

router.put(
  '/:id',
  ...withProjectWrite,
  validateBody(insertBugSchema.partial()),
  async (req, res) => {
    const projectId = req.projectId!;
    const userId = req.session.userId;
    const { tagIds, ...data } = req.body;

    const bug = await BugService.updateBug(
      req.db ?? db,
      projectId,
      userId,
      req.params.id as string,
      data,
      tagIds
    );

    if (!bug) {
      res.status(404).json({ error: 'Bug not found' });
      return;
    }

    res.json(bug);
  }
);

router.post('/:id/comments', ...withProjectWrite, async (req, res) => {
  const projectId = req.projectId!;
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'Comment text is required' });
    return;
  }

  const userId = req.session.userId;
  const bug = await BugService.addComment(
    req.db ?? db,
    projectId,
    userId,
    req.params.id as string,
    text
  );

  if (!bug) {
    res.status(404).json({ error: 'Bug not found' });
    return;
  }

  res.status(201).json(bug);
});

router.delete('/:id', ...withProjectWrite, async (req, res) => {
  const projectId = req.projectId!;
  
  const deleted = await BugService.deleteBug(
    req.db ?? db,
    projectId,
    req.params.id as string
  );

  if (!deleted) {
    res.status(404).json({ error: 'Bug not found' });
    return;
  }

  res.status(204).send();
});

export default router;

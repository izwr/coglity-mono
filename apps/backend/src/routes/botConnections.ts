import { type Router as RouterType, Router } from 'express';
import { insertBotConnectionSchema } from '@coglity/shared/schema';
import { withProjectRead, withProjectWrite } from '../middleware/groups';
import { validateBody } from '../middleware/validate';
import { BotConnectionService } from '../services/botConnectionService';
import { db } from '../db';

const router: RouterType = Router({ mergeParams: true });

router.get('/', ...withProjectRead, async (req, res) => {
  const projectId = req.projectId!;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const botType = typeof req.query.botType === 'string' ? req.query.botType : '';
  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));

  const result = await BotConnectionService.listConnections(req.db ?? db, projectId, req.projectRole, {
    search,
    botType,
    sortBy,
    sortDir,
    page,
    limit,
  });

  res.json(result);
});

router.get('/:id', ...withProjectRead, async (req, res) => {
  const projectId = req.projectId!;
  const row = await BotConnectionService.getConnection(req.db ?? db, projectId, req.params.id as string, req.projectRole);
  
  if (!row) {
    res.status(404).json({ error: 'Bot connection not found' });
    return;
  }
  
  res.json(row);
});

router.post(
  '/',
  ...withProjectWrite,
  validateBody(insertBotConnectionSchema),
  async (req, res) => {
    const projectId = req.projectId!;
    const userId = req.session.userId;
    
    const row = await BotConnectionService.createConnection(
      req.db ?? db,
      projectId,
      userId,
      req.body
    );
    res.status(201).json(row);
  }
);

router.put(
  '/:id',
  ...withProjectWrite,
  validateBody(insertBotConnectionSchema),
  async (req, res) => {
    const projectId = req.projectId!;
    const userId = req.session.userId;
    
    const row = await BotConnectionService.updateConnection(
      req.db ?? db,
      projectId,
      userId,
      req.params.id as string,
      req.body
    );

    if (!row) {
      res.status(404).json({ error: 'Bot connection not found' });
      return;
    }

    res.json(row);
  }
);

router.delete('/:id', ...withProjectWrite, async (req, res) => {
  const projectId = req.projectId!;
  
  const deleted = await BotConnectionService.deleteConnection(
    req.db ?? db,
    projectId,
    req.params.id as string
  );

  if (!deleted) {
    res.status(404).json({ error: 'Bot connection not found' });
    return;
  }

  res.status(204).send();
});

export default router;

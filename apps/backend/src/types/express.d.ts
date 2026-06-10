import type { db } from '../db';

declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      orgRole?: 'super_admin' | 'member';
      projectId?: string;
      projectRole?: 'admin' | 'writer' | 'read' | 'super_admin';
      projectIdsScope?: string[];
      // Subset of projectIdsScope the caller has writer+ access to (used to decide whether
      // secret fields like bot-connection config may be returned in multi-project lists).
      writableProjectIdsScope?: string[];
      db?: typeof db;
    }
  }
}

export {};

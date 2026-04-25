import type { db } from "../db.js";

declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      orgRole?: "super_admin" | "member";
      projectId?: string;
      projectRole?: "admin" | "writer" | "read" | "super_admin";
      projectIdsScope?: string[];
      db?: typeof db;
    }
  }
}

export {};

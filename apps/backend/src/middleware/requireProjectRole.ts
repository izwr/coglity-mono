import type { Request, Response, NextFunction } from "express";
import { PROJECT_ROLE_RANK } from "../services/rbac.js";

export function requireProjectRole(min: "read" | "writer" | "admin") {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.projectRole) {
      res.status(401).json({ error: "Project context not resolved" });
      return;
    }
    if (PROJECT_ROLE_RANK[req.projectRole] < PROJECT_ROLE_RANK[min]) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

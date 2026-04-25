import type { Request, Response, NextFunction } from "express";

export function requireOrgRole(role: "super_admin" | "member") {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.orgRole) {
      res.status(401).json({ error: "Organization context not resolved" });
      return;
    }
    if (role === "super_admin" && req.orgRole !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

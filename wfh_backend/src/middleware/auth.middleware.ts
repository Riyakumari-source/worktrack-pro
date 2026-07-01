import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "wfh_secret_key_2026_super_secure_telemetry";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    employeeId?: string;
    name: string;
    role: "ADMIN" | "EMPLOYEE";
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  let token = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ error: "Access denied. No token provided." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Database lookup to verify user still exists and role hasn't changed
    const user = await prisma.regUser.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      res.status(401).json({ error: "Access denied. User no longer exists in database." });
      return;
    }

    if (user.role !== decoded.role) {
      res.status(401).json({ error: "Access denied. User role has changed." });
      return;
    }

    req.user = {
      id: user.id,
      employeeId: user.employeeId || undefined,
      name: user.name,
      role: user.role
    };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

export const requireRole = (role: "ADMIN" | "EMPLOYEE") => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: `Forbidden. Requires ${role} role.` });
      return;
    }
    next();
  };
};

import { Router } from "express";
import { register, login, changePassword, getClientIp } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// POST /api/auth/change-password
router.post("/change-password", authMiddleware as any, changePassword as any);

// GET /api/auth/ip
router.get("/ip", getClientIp as any);

export default router;

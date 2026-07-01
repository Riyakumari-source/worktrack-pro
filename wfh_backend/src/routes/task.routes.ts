import { Router } from "express";
import { getTasks, createTask, toggleTask } from "../controllers/task.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Apply auth middleware to all task routes
router.use(authMiddleware as any);

// GET /api/tasks
router.get("/", getTasks as any);

// POST /api/tasks
router.post("/", createTask as any);

// PATCH /api/tasks/:taskId
router.patch("/:taskId", toggleTask as any);

export default router;

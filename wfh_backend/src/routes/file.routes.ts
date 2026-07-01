import { Router } from "express";
import { downloadFile } from "../controllers/file.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Protected file serving
router.get("/download/:type/:filename", authMiddleware as any, downloadFile as any);

export default router;

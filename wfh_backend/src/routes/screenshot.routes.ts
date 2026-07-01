import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getScreenshots, uploadScreenshot } from "../controllers/screenshot.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Ensure upload destination folder exists
const uploadDir = path.join(process.cwd(), "public", "uploads", "screenshots");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "SS-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit size to 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
      return cb(new Error("Only images (.jpg, .jpeg, .png) are allowed"));
    }
    cb(null, true);
  }
});

// Protect all screenshot telemetry routes
router.use(authMiddleware as any);

// GET /api/telemetry/screenshot
router.get("/", getScreenshots as any);

// POST /api/telemetry/screenshot/upload
router.post("/upload", upload.single("screenshot"), uploadScreenshot as any);

export default router;

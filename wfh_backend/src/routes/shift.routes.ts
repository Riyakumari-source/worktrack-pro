import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  clockIn,
  clockOut,
  getActiveShift,
  startBreak,
  endBreak,
  postTelemetry,
  getShiftHistory,
  uploadPdfReport
} from "../controllers/shift.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Ensure upload destination folder exists
const reportsUploadDir = path.join(process.cwd(), "public", "uploads", "reports");
if (!fs.existsSync(reportsUploadDir)) {
  fs.mkdirSync(reportsUploadDir, { recursive: true });
}

// Multer Storage Configuration for PDF Reports
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, reportsUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "REPORT-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit size to 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".pdf") {
      return cb(new Error("Only PDF documents (.pdf) are allowed"));
    }
    cb(null, true);
  }
});

// Apply auth middleware to all shift routes
router.use(authMiddleware as any);

// POST /api/shifts/clock-in
router.post("/clock-in", clockIn as any);

// POST /api/shifts/clock-out
router.post("/clock-out", clockOut as any);

// GET /api/shifts/active
router.get("/active", getActiveShift as any);

// GET /api/shifts/history
router.get("/history", getShiftHistory as any);

// POST /api/shifts/breaks/start
router.post("/breaks/start", startBreak as any);

// POST /api/shifts/breaks/end
router.post("/breaks/end", endBreak as any);

// POST /api/shifts/telemetry
router.post("/telemetry", postTelemetry as any);

// POST /api/shifts/upload-pdf
router.post("/upload-pdf", upload.single("pdfReport"), uploadPdfReport as any);

export default router;


import { Router } from "express";
import { getEmployeesFeed, getEmployeeScreenshots, getDailyPdfReports, adjustShift, getAllShifts } from "../controllers/admin.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";

const router = Router();

// Apply auth middleware and requireRole ADMIN to all admin routes
router.use(authMiddleware as any);
router.use(requireRole("ADMIN") as any);

// GET /api/admin/employees-feed
router.get("/employees-feed", getEmployeesFeed as any);

// GET /api/admin/employee/:employeeId/screenshots
router.get("/employee/:employeeId/screenshots", getEmployeeScreenshots as any);

// GET /api/admin/daily-reports
router.get("/daily-reports", getDailyPdfReports as any);

// PUT /api/admin/shift/:shiftId
router.put("/shift/:shiftId", adjustShift as any);

// GET /api/admin/shifts-log
router.get("/shifts-log", getAllShifts as any);

export default router;

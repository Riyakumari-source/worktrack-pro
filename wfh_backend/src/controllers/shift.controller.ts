import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  appConfig,
  getShiftTargetSeconds,
  isSystemClockOutReason,
  resolveShiftStatus,
} from "../config/app.config";

export const clockIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const employeeId = req.user?.employeeId;
  if (!userId || !employeeId) {
    res.status(401).json({ error: "Unauthorized. Missing user credentials in token." });
    return;
  }
  const { location, latitude, longitude, startAddress } = req.body;
  const shiftLocation = location || "CUSTOMER";

  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    !startAddress ||
    startAddress.includes("Permission Denied") ||
    startAddress.includes("GPS Location Blocked")
  ) {
    res.status(400).json({
      error:
        "Location tracking is strictly required to start your WFH shift. Please enable browser GPS permissions and retry.",
    });
    return;
  }

  try {
    const today = new Date();
    const startOfToday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfToday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999)
    );

    const completedShiftToday = await prisma.shift.findFirst({
      where: {
        userId,
        status: "Completed",
        shiftStartTime: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    if (completedShiftToday) {
      res.status(400).json({
        error:
          "Lockout Compliance Block: You have already completed a shift today. Restarting a shift is disabled for the rest of today.",
      });
      return;
    }

    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
    });

    if (activeShift) {
      const todayStr = new Date().toISOString().split("T")[0];
      const activeShiftDateStr = new Date(activeShift.shiftStartTime).toISOString().split("T")[0];

      if (activeShiftDateStr !== todayStr) {
        await prisma.shift.update({
          where: { id: activeShift.id },
          data: {
            status: "Absent",
            shiftEndTime: new Date(
              new Date(activeShift.shiftStartTime).getTime() +
                appConfig.autoClockOutHours * 60 * 60 * 1000
            ),
          },
        });
      } else {
        res.status(400).json({ error: "Active shift already exists. Clock out first.", shift: activeShift });
        return;
      }
    }

    const newShift = await prisma.shift.create({
      data: {
        employeeId,
        userId,
        shiftStartLocation: shiftLocation,
        status: "Active",
        latitude: Number(latitude),
        longitude: Number(longitude),
        startAddress: startAddress,
        locationFetchedAt: new Date(),
      },
    });

    res.status(201).json({
      message: "Successfully clocked in to Database",
      shift: newShift,
      config: { shiftTargetSeconds: getShiftTargetSeconds() },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to clock in" });
  }
};

export const clockOut = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user credentials in token." });
    return;
  }

  const { latitude, longitude, endAddress, reason } = req.body;
  const isSystemClockOut = isSystemClockOutReason(reason);

  const hasValidGps =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    Number(latitude) !== 0 &&
    Number(longitude) !== 0 &&
    endAddress &&
    !endAddress.includes("Permission Denied") &&
    !endAddress.includes("GPS Location Blocked");

  if (!isSystemClockOut && !hasValidGps) {
    res.status(400).json({
      error:
        "Location tracking is strictly required to end your WFH shift. Please enable browser GPS permissions and retry.",
    });
    return;
  }

  if (isSystemClockOut && !endAddress) {
    res.status(400).json({ error: "Clock-out reason description is required." });
    return;
  }

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
    });

    if (!activeShift) {
      res.status(404).json({ error: "No active shift found to clock out." });
      return;
    }

    const shiftEndTime = new Date();
    const durationMs = shiftEndTime.getTime() - new Date(activeShift.shiftStartTime).getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const finalStatus = resolveShiftStatus(durationHours);

    const clockOutData: Record<string, unknown> = {
      status: finalStatus,
      shiftEndTime,
      endLocationFetchedAt: new Date(),
      clockOutReason: isSystemClockOut ? reason : "employee_submit",
    };

    if (hasValidGps) {
      clockOutData.endLatitude = Number(latitude);
      clockOutData.endLongitude = Number(longitude);
      clockOutData.endAddress = endAddress;
    } else if (endAddress) {
      clockOutData.endAddress = endAddress;
    }

    const updatedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: clockOutData,
    });

    res.status(200).json({ message: "Successfully clocked out from Database", shift: updatedShift });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to clock out" });
  }
};

export const getActiveShift = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user credentials in token." });
    return;
  }

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
      include: {
        breaks: true,
        tasks: true,
        telemetry: {
          orderBy: { timestamp: "desc" },
          take: 10,
        },
      },
    });

    if (activeShift) {
      const todayStr = new Date().toISOString().split("T")[0];
      const activeShiftDateStr = new Date(activeShift.shiftStartTime).toISOString().split("T")[0];

      if (activeShiftDateStr !== todayStr) {
        await prisma.shift.update({
          where: { id: activeShift.id },
          data: {
            status: "Absent",
            shiftEndTime: new Date(
              new Date(activeShift.shiftStartTime).getTime() +
                appConfig.autoClockOutHours * 60 * 60 * 1000
            ),
          },
        });
        res.status(200).json({ shift: null });
        return;
      }
    }

    if (!activeShift) {
      const today = new Date();
      const startOfToday = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0)
      );
      const endOfToday = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999)
      );

      const completedShiftToday = await prisma.shift.findFirst({
        where: {
          userId,
          status: "Completed",
          shiftStartTime: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      });

      if (completedShiftToday) {
        res.status(200).json({ shift: null, completedToday: true });
        return;
      }
    }

    res.status(200).json({ shift: activeShift });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve active shift" });
  }
};

export const startBreak = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user credentials in token." });
    return;
  }
  const { breakName } = req.body;
  const resolvedBreakName = breakName || "Short Break";

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
      include: { breaks: true },
    });

    if (!activeShift) {
      res.status(404).json({ error: "No active shift found. Clock in first." });
      return;
    }

    const activeBreak = activeShift.breaks.find((b) => b.endTime === null);
    if (activeBreak) {
      res.status(400).json({
        error: "Another break is currently running. End it first.",
        break: activeBreak,
      });
      return;
    }

    const isLunch = resolvedBreakName.toLowerCase().includes("lunch");
    const shortBreaks = activeShift.breaks.filter((b) =>
      b.name.toLowerCase().includes("short")
    );

    if (isLunch) {
      const lunchUsed = activeShift.breaks.some((b) => b.name.toLowerCase().includes("lunch"));
      if (lunchUsed) {
        res.status(400).json({ error: "Lunch Break has already been used today." });
        return;
      }
      const now = new Date();
      if (now.getHours() < appConfig.lunchUnlockHour) {
        res.status(400).json({
          error: `Lunch Break is locked. It unlocks at ${appConfig.lunchUnlockHour}:00.`,
        });
        return;
      }
    } else if (shortBreaks.length >= appConfig.shortBreakLimit) {
      res.status(400).json({ error: "No short breaks remaining today." });
      return;
    }

    const newBreak = await prisma.break.create({
      data: {
        shiftId: activeShift.id,
        name: resolvedBreakName,
        status: "Used",
      },
    });

    res.status(201).json({ message: "Break started in Database", break: newBreak });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to start break" });
  }
};

export const endBreak = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user credentials in token." });
    return;
  }

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
    });

    if (!activeShift) {
      res.status(404).json({ error: "No active shift found." });
      return;
    }

    const activeBreak = await prisma.break.findFirst({
      where: { shiftId: activeShift.id, endTime: null },
    });

    if (!activeBreak) {
      res.status(404).json({ error: "No active running break found to end." });
      return;
    }

    const updatedBreak = await prisma.break.update({
      where: { id: activeBreak.id },
      data: {
        endTime: new Date(),
      },
    });

    res.status(200).json({ message: "Break ended in Database", break: updatedBreak });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to end break" });
  }
};

export const postTelemetry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user credentials in token." });
    return;
  }
  const { x, y, isMoving } = req.body;

  if (x === undefined || y === undefined || isMoving === undefined) {
    res.status(400).json({ error: "Missing coordinates (x, y) or movement state (isMoving)" });
    return;
  }

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
    });

    if (!activeShift) {
      res.status(404).json({ error: "No active shift found to log telemetry." });
      return;
    }

    const log = await prisma.telemetryLog.create({
      data: {
        shiftId: activeShift.id,
        x: parseInt(x, 10),
        y: parseInt(y, 10),
        isMoving: !!isMoving,
      },
    });

    res.status(201).json({ message: "Telemetry logged in Database", telemetry: log });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to log telemetry" });
  }
};

export const getShiftHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user credentials in token." });
    return;
  }

  try {
    const shifts = await prisma.shift.findMany({
      where: { userId },
      orderBy: { shiftStartTime: "desc" },
      include: {
        breaks: true,
        tasks: true,
      },
      take: appConfig.shiftHistoryLimit,
    });

    res.status(200).json({ shifts });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve shift history" });
  }
};

export const uploadPdfReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user credentials in token." });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No PDF report file uploaded." });
    return;
  }

  try {
    const fs = require("fs");
    const buffer = fs.readFileSync(file.path);
    const isPdf = buffer.slice(0, 4).toString() === "%PDF";
    if (!isPdf) {
      fs.unlinkSync(file.path);
      res.status(400).json({
        error: "Robust Validation Block: The uploaded file is not a valid PDF document.",
      });
      return;
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to perform file integrity check." });
    return;
  }

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
    });

    if (!activeShift) {
      const fs = require("fs");
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      res.status(404).json({ error: "No active shift found to attach report. Clock in first." });
      return;
    }

    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const pdfReportSize = `${sizeMb} MB`;

    const updatedShift = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        pdfReportName: file.filename,
        pdfReportSize: pdfReportSize,
        pdfReportUploadedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Daily PDF Report uploaded successfully in Database",
      pdfReport: {
        name: file.filename,
        size: pdfReportSize,
        uploadedAt: new Date().toLocaleTimeString("en-US", { hour12: true }),
      },
      shift: updatedShift,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to upload PDF report" });
  }
};

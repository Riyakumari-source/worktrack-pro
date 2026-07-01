import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

// Configurable shift duration (default 8.5 hours)
const AUTO_CLOCK_OUT_HOURS = parseFloat(process.env.AUTO_CLOCK_OUT_HOURS || "8.5");

export const getEmployeesFeed = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 1. Fetch all registered users with role EMPLOYEE, along with their latest shift, breaks, tasks, telemetry, and shifts count
    const employees = await prisma.regUser.findMany({
      where: {
        role: "EMPLOYEE"
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        role: true,
        shifts: {
          orderBy: { shiftStartTime: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            shiftStartTime: true,
            shiftEndTime: true,
            shiftStartLocation: true,
            latitude: true,
            longitude: true,
            startAddress: true,
            locationFetchedAt: true,
            endLatitude: true,
            endLongitude: true,
            endAddress: true,
            endLocationFetchedAt: true,
            pdfReportName: true,
            pdfReportSize: true,
            pdfReportUploadedAt: true,
            breaks: {
              select: {
                id: true,
                name: true,
                startTime: true,
                endTime: true,
                status: true
              }
            },
            tasks: {
              select: {
                id: true,
                text: true,
                completed: true,
                completedAt: true,
                createdAt: true
              }
            },
            telemetry: {
              orderBy: { timestamp: "desc" },
              take: 1,
              select: {
                x: true,
                y: true,
                isMoving: true,
                timestamp: true
              }
            }
          }
        },
        _count: {
          select: {
            shifts: true
          }
        }
      }
    });

    const feed: any[] = [];

    // 2. Build the feed mapping
    for (const emp of employees) {
      const initials = emp.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "EM";

      // If no shifts are recorded, represent them as offline/not started
      if (emp.shifts.length === 0) {
        feed.push({
          employeeId: emp.employeeId || `EMP-${emp.id}`,
          name: emp.name,
          avatar: initials,
          role: emp.role, // Use actual role from DB (EMPLOYEE)
          isWfhActive: false,
          currentStatus: "Offline",
          cursorStatus: "Offline",
          shiftStartTime: undefined,
          shiftEndTime: undefined,
          shiftStatus: undefined,
          breaks: { shortBreaksLeft: 3, lunchBreakUsed: false, totalDuration: "0m", history: [] },
          tasks: [],
          pdfReport: null,
          activityLogs: ["No shift started today"],
          latestCoordinate: { x: 0, y: 0 },
          wfhDaysCount: 0
        });
        continue;
      }

      let shift = emp.shifts[0];

      // Timezone neutrality: automatic clock-out if shift was on a past day
      const isWfhActive = shift.status === "Active";
      if (isWfhActive) {
        const todayStr = new Date().toISOString().split('T')[0];
        const activeShiftDateStr = new Date(shift.shiftStartTime).toISOString().split('T')[0];

        if (activeShiftDateStr !== todayStr) {
          // Automatically mark the past active shift as Absent in the database
          const updatedShift = await prisma.shift.update({
            where: { id: shift.id },
            data: {
              status: "Absent",
              shiftEndTime: new Date(new Date(shift.shiftStartTime).getTime() + AUTO_CLOCK_OUT_HOURS * 60 * 60 * 1000)
            },
            include: {
              breaks: true,
              tasks: true,
              telemetry: {
                orderBy: { timestamp: "desc" },
                take: 1
              }
            }
          });
          // Update local reference to the auto-completed shift
          shift = updatedShift as any;
        }
      }

      const isStillActive = shift.status === "Active";
      let currentStatus: "Active" | "On Break" | "Offline" = "Offline";
      let cursorStatus: "Moving" | "Stopped" | "Offline" = "Offline";
      let latestCoordinate = { x: 0, y: 0 };

      const shiftStartTimeStr = new Date(shift.shiftStartTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });

      const shiftEndTimeStr = shift.shiftEndTime ? new Date(shift.shiftEndTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }) : undefined;

      const shiftDateStr = new Date(shift.shiftStartTime).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });

      // Determine status
      const runningBreak = shift.breaks.find((b: any) => b.endTime === null);
      if (isStillActive) {
        if (runningBreak) {
          currentStatus = "On Break";
          cursorStatus = "Stopped";
        } else {
          currentStatus = "Active";
        }
      }

      // Live telemetry coordinates mapping
      const latestLog = shift.telemetry && shift.telemetry.length > 0 ? shift.telemetry[0] : null;
      if (latestLog) {
        latestCoordinate = { x: latestLog.x, y: latestLog.y };
        if (isStillActive && currentStatus !== "On Break") {
          cursorStatus = latestLog.isMoving ? "Moving" : "Stopped";
        }
      } else if (isStillActive && currentStatus !== "On Break") {
        cursorStatus = "Stopped";
      }

      // Gather breaks
      const shortBreaks = shift.breaks.filter((b: any) => b.name.includes("Short"));
      const breaks = {
        shortBreaksLeft: Math.max(0, 3 - shortBreaks.length),
        lunchBreakUsed: shift.breaks.some((b: any) => b.name.includes("Lunch")),
        totalDuration: "0m",
        history: shift.breaks.map((b: any) => ({
          name: b.name,
          time: new Date(b.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          status: b.endTime ? "Used" : "Active"
        }))
      };

      // Gather tasks
      const tasks = shift.tasks.map((t: any) => ({
        text: t.text,
        completed: t.completed,
        completedAt: t.completedAt ? `Completed at ${new Date(t.completedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}` : undefined,
        createdAt: t.createdAt ? new Date(t.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : undefined
      }));

      // Gather PDF reports
      let pdfReport = null;
      if (shift.pdfReportName) {
        pdfReport = {
          name: shift.pdfReportName,
          size: shift.pdfReportSize || "0.00 MB",
          uploadedAt: shift.pdfReportUploadedAt
            ? `Uploaded at ${new Date(shift.pdfReportUploadedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`
            : "Uploaded today"
        };
      }

      // Compile chronological activity logs feed
      const activityLogs: string[] = [];
      if (latestLog && isStillActive) {
        activityLogs.push(`[${new Date(latestLog.timestamp).toLocaleTimeString()}] Telemetry heartbeat: Cursor is ${cursorStatus.toUpperCase()} at X:${latestLog.x}px, Y:${latestLog.y}px`);
      }
      shift.breaks.forEach((b: any) => {
        activityLogs.push(`[${new Date(b.startTime).toLocaleTimeString()}] Break session '${b.name}' initiated`);
        if (b.endTime) {
          activityLogs.push(`[${new Date(b.endTime).toLocaleTimeString()}] Break session '${b.name}' ended`);
        }
      });
      shift.tasks.forEach((t: any) => {
        const timeLabel = t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : "Recent";
        if (t.completed) {
          activityLogs.push(`[${t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : "Recent"}] Compliance Task completed: "${t.text}"`);
        } else {
          activityLogs.push(`[${timeLabel}] Task registered: "${t.text}"`);
        }
      });

      feed.push({
        employeeId: emp.employeeId || `EMP-${emp.id}`,
        name: emp.name,
        avatar: initials,
        role: `${emp.role} (${shiftDateStr})`, // Display the actual role + date
        isWfhActive: isStillActive,
        currentStatus,
        cursorStatus,
        shiftStartTime: `${shiftStartTimeStr} (${shiftDateStr})`,
        shiftEndTime: shiftEndTimeStr ? `${shiftEndTimeStr} (${shiftDateStr})` : undefined,
        shiftStatus: shift.status, // Database attendance status
        breaks,
        tasks,
        pdfReport,
        activityLogs,
        latestCoordinate,
        latitude: shift.latitude,
        longitude: shift.longitude,
        startAddress: shift.startAddress,
        locationFetchedAt: shift.locationFetchedAt ? new Date(shift.locationFetchedAt).toISOString() : null,
        endLatitude: shift.endLatitude,
        endLongitude: shift.endLongitude,
        endAddress: shift.endAddress,
        endLocationFetchedAt: shift.endLocationFetchedAt ? new Date(shift.endLocationFetchedAt).toISOString() : null,
        wfhDaysCount: emp._count.shifts
      });
    }

    res.status(200).json({ feed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve employees dashboard feed" });
  }
};

// GET /api/admin/employee/:employeeId/screenshots (restricted to only 24 hours)
export const getEmployeeScreenshots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { employeeId } = req.params as { employeeId: string };
  const limit = parseInt(req.query.limit as string) || 12;
  const skip = parseInt(req.query.skip as string) || 0;

  try {
    const user = await prisma.regUser.findUnique({
      where: {
        employeeId: employeeId
      }
    });

    if (!user) {
      res.status(200).json({ screenshots: [], hasMore: false });
      return;
    }

    // Filter screenshots: strictly show only those captured within the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const dbScreenshots = await prisma.screenshot.findMany({
      where: {
        userId: user.id,
        capturedAt: { gte: oneDayAgo }
      },
      orderBy: { capturedAt: "desc" },
      take: limit + 1,
      skip: skip
    });

    const hasMore = dbScreenshots.length > limit;
    const screenshots = hasMore ? dbScreenshots.slice(0, limit) : dbScreenshots;

    res.status(200).json({ screenshots, hasMore });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve employee screenshots" });
  }
};

// GET /api/admin/daily-reports
export const getDailyPdfReports = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const shiftsWithPdf = await prisma.shift.findMany({
      where: {
        pdfReportName: { not: null }
      },
      include: {
        user: {
          select: {
            employeeId: true,
            name: true
          }
        }
      },
      orderBy: { pdfReportUploadedAt: "desc" }
    });

    const reports = shiftsWithPdf.map((shift: any) => {
      const u = shift.user || { name: "Unknown", employeeId: shift.employeeId };
      return {
        shiftId: shift.id,
        employeeId: u.employeeId || shift.employeeId,
        employeeName: u.name,
        employeeEmail: "",
        date: new Date(shift.shiftStartTime).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        }),
        uploadedAt: shift.pdfReportUploadedAt
          ? new Date(shift.pdfReportUploadedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true
            })
          : "N/A",
        pdfReportUploadedAt: shift.pdfReportUploadedAt,
        pdfReportName: shift.pdfReportName,
        pdfReportSize: shift.pdfReportSize || "0.00 MB"
      };
    });

    res.status(200).json({ reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve daily PDF reports" });
  }
};
export const adjustShift = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const shiftId = req.params.shiftId as string;
  const { shiftStartTime, shiftEndTime, status } = req.body;

  try {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    });

    if (!shift) {
      res.status(404).json({ error: "Shift not found." });
      return;
    }

    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        shiftStartTime: shiftStartTime ? new Date(shiftStartTime) : undefined,
        shiftEndTime: shiftEndTime ? new Date(shiftEndTime) : undefined,
        status: status || undefined
      }
    });

    res.status(200).json({ message: "Shift adjusted successfully.", shift: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to adjust shift." });
  }
};

export const getAllShifts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const shifts = await prisma.shift.findMany({
      orderBy: { shiftStartTime: "desc" },
      include: {
        user: {
          select: {
            name: true,
            employeeId: true,
            role: true
          }
        },
        breaks: { orderBy: { startTime: "asc" } },
        tasks: { orderBy: { createdAt: "asc" } }
      }
    });

    const mapped = shifts.map(s => {
      const shiftStartTimeStr = new Date(s.shiftStartTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
      const shiftEndTimeStr = s.shiftEndTime ? new Date(s.shiftEndTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }) : undefined;
      const shiftDateStr = new Date(s.shiftStartTime).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });

      return {
        id: s.id,
        employeeId: s.employeeId || s.user?.employeeId,
        name: s.user?.name || "Unknown",
        role: s.user?.role || "EMPLOYEE",
        shiftStartTime: `${shiftStartTimeStr} (${shiftDateStr})`,
        shiftEndTime: shiftEndTimeStr ? `${shiftEndTimeStr} (${shiftDateStr})` : undefined,
        shiftDate: shiftDateStr,
        status: s.status,
        latitude: s.latitude,
        longitude: s.longitude,
        startAddress: s.startAddress,
        endLatitude: s.endLatitude,
        endLongitude: s.endLongitude,
        endAddress: s.endAddress,
        breaksCount: s.breaks.length,
        tasksCount: s.tasks.length,
        tasksCompletedCount: s.tasks.filter(t => t.completed).length,
        pdfReportName: s.pdfReportName,
        pdfReportSize: s.pdfReportSize,
        breaks: s.breaks.map(b => ({
          name: b.name,
          time: new Date(b.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          status: b.endTime ? "Used" : "Active"
        })),
        tasks: s.tasks.map(t => ({
          text: t.text,
          completed: t.completed,
          completedAt: t.completedAt ? `Completed at ${new Date(t.completedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}` : undefined,
          createdAt: t.createdAt ? new Date(t.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : undefined
        }))
      };
    });

    res.status(200).json({ shifts: mapped });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve shifts logs" });
  }
};




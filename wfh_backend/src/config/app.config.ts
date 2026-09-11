/**
 * Central application configuration — all values driven by environment variables.
 * dotenv must load here because ES module imports evaluate before app.ts calls dotenv.config().
 */
import dotenv from "dotenv";
dotenv.config();

export const appConfig = {
  companyName: process.env.COMPANY_NAME || "WFH Portal",
  appSubtitle:
    process.env.APP_SUBTITLE || "Workforce Monitoring & Productivity Platform",

  autoClockOutHours: parseFloat(process.env.AUTO_CLOCK_OUT_HOURS || "8.5"),
  halfDayHours: parseFloat(process.env.HALF_DAY_HOURS || "4.0"),

  taskAssignMinutes: parseInt(process.env.TASK_ASSIGN_MINUTES || "30", 10),
  screenshotIntervalMinutes: parseInt(process.env.SCREENSHOT_INTERVAL_MINUTES || "30", 10),

  shortBreakLimit: parseInt(process.env.SHORT_BREAK_LIMIT || "3", 10),
  shortBreakMinutes: parseInt(process.env.SHORT_BREAK_MINUTES || "15", 10),
  lunchBreakMinutes: parseInt(process.env.LUNCH_BREAK_MINUTES || "45", 10),
  lunchUnlockHour: parseInt(process.env.LUNCH_UNLOCK_HOUR || "13", 10),

  idleTimeoutMinutes: parseInt(process.env.IDLE_TIMEOUT_MINUTES || "7", 10),
  backgroundHiddenTimeoutMinutes: parseInt(
    process.env.BACKGROUND_HIDDEN_TIMEOUT_MINUTES || "7",
    10
  ),
  breakGraceSeconds: parseInt(process.env.BREAK_GRACE_SECONDS || "15", 10),

  screenshotRetentionDays: parseInt(process.env.SCREENSHOT_RETENTION_DAYS || "7", 10),
  adminScreenshotWindowHours: parseInt(
    process.env.ADMIN_SCREENSHOT_WINDOW_HOURS || "24",
    10
  ),
  shiftHistoryLimit: parseInt(process.env.SHIFT_HISTORY_LIMIT || "30", 10),

  corsOrigin: process.env.CORS_ORIGIN || "*",
  jwtSecret: process.env.JWT_SECRET || "wfh_secret_key_2026_super_secure_telemetry",
  timezone: process.env.TIMEZONE || "Asia/Kolkata",
};

/** Shift target in seconds (one second less than full hours, matching UI countdown). */
export function getShiftTargetSeconds(): number {
  return Math.floor(appConfig.autoClockOutHours * 3600) - 1;
}

export function getTaskAssignSeconds(): number {
  return appConfig.taskAssignMinutes * 60;
}

export function getScreenshotIntervalSeconds(): number {
  return appConfig.screenshotIntervalMinutes * 60;
}

export function getShortBreakSeconds(): number {
  return appConfig.shortBreakMinutes * 60;
}

export function getLunchBreakSeconds(): number {
  return appConfig.lunchBreakMinutes * 60;
}

export function getIdleTimeoutSeconds(): number {
  return appConfig.idleTimeoutMinutes * 60;
}

export function getBackgroundHiddenTimeoutSeconds(): number {
  return appConfig.backgroundHiddenTimeoutMinutes * 60;
}

/** Public config payload for frontend consumption. */
export function getPublicConfig() {
  return {
    companyName: appConfig.companyName,
    appSubtitle: appConfig.appSubtitle,
    shiftTargetSeconds: getShiftTargetSeconds(),
    autoClockOutHours: appConfig.autoClockOutHours,
    halfDayHours: appConfig.halfDayHours,
    taskAssignSeconds: getTaskAssignSeconds(),
    screenshotIntervalSeconds: getScreenshotIntervalSeconds(),
    shortBreakLimit: appConfig.shortBreakLimit,
    shortBreakSeconds: getShortBreakSeconds(),
    lunchBreakSeconds: getLunchBreakSeconds(),
    lunchUnlockHour: appConfig.lunchUnlockHour,
    idleTimeoutSeconds: getIdleTimeoutSeconds(),
    backgroundHiddenTimeoutSeconds: getBackgroundHiddenTimeoutSeconds(),
    breakGraceSeconds: appConfig.breakGraceSeconds,
  };
}

export function resolveShiftStatus(durationHours: number): string {
  if (durationHours >= appConfig.autoClockOutHours) {
    return "Completed";
  }
  if (durationHours >= appConfig.halfDayHours) {
    return "Half Day";
  }
  return "Absent";
}

export function formatBreakDuration(totalMs: number): string {
  if (totalMs <= 0) return "0m";
  const totalMins = Math.floor(totalMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const SYSTEM_CLOCK_OUT_REASONS = [
  "idle_timeout",
  "break_exceeded",
  "overtime_guard",
  "screen_share_stopped",
] as const;

export type SystemClockOutReason = (typeof SYSTEM_CLOCK_OUT_REASONS)[number];

export function isSystemClockOutReason(reason: unknown): reason is SystemClockOutReason {
  return (
    typeof reason === "string" &&
    (SYSTEM_CLOCK_OUT_REASONS as readonly string[]).includes(reason)
  );
}

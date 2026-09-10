export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export type PublicAppConfig = {
  companyName: string;
  appSubtitle: string;
  shiftTargetSeconds: number;
  autoClockOutHours: number;
  halfDayHours: number;
  taskAssignSeconds: number;
  screenshotIntervalSeconds: number;
  shortBreakLimit: number;
  shortBreakSeconds: number;
  lunchBreakSeconds: number;
  lunchUnlockHour: number;
  idleTimeoutSeconds: number;
  backgroundHiddenTimeoutSeconds: number;
  breakGraceSeconds: number;
};

export const DEFAULT_PUBLIC_CONFIG: PublicAppConfig = {
  companyName: "WFH Portal",
  appSubtitle: "Workforce Monitoring & Productivity Platform",
  shiftTargetSeconds: Math.floor(8.5 * 3600) - 1,
  autoClockOutHours: 8.5,
  halfDayHours: 4,
  taskAssignSeconds: 30 * 60,
  screenshotIntervalSeconds: 30 * 60,
  shortBreakLimit: 3,
  shortBreakSeconds: 15 * 60,
  lunchBreakSeconds: 45 * 60,
  lunchUnlockHour: 13,
  idleTimeoutSeconds: 7 * 60,
  backgroundHiddenTimeoutSeconds: 7 * 60,
  breakGraceSeconds: 15,
};

export async function fetchAppConfig(): Promise<PublicAppConfig> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`);
    if (!res.ok) return DEFAULT_PUBLIC_CONFIG;
    const data = await res.json();
    if (data?.config) {
      return { ...DEFAULT_PUBLIC_CONFIG, ...data.config };
    }
  } catch (err) {
    console.error("Failed to load app config:", err);
  }
  return DEFAULT_PUBLIC_CONFIG;
}

export function formatLunchUnlockLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${suffix}`;
}

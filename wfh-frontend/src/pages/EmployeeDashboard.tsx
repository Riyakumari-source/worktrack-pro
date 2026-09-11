import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
    FiBell, 
    FiLogOut, 
    FiClock, 
    FiCalendar, 
    FiCoffee, 
    FiPlay, 
    FiPause, 
    FiPower, 
    FiActivity, 
    FiCheck, 
    FiShield, 
    FiAlertTriangle, 
    FiMonitor, 
    FiUser, 
    FiCheckSquare, 
    FiList,
    FiFileText,
    FiUploadCloud,
    FiLock,
    FiCompass,
    FiMapPin,
    FiMenu
} from "react-icons/fi";
import EmployeeSidebar from "@/components/EmployeeSidebar";
import { getSocket } from "@/utils/socket";
import {
    API_BASE_URL,
    DEFAULT_PUBLIC_CONFIG,
    fetchAppConfig,
    formatLunchUnlockLabel,
    type PublicAppConfig,
} from "../config";

interface TaskItem {
    id: string | number;
    text: string;
    completed: boolean;
    completedAt?: string;
}

const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, "0")}h : ${m.toString().padStart(2, "0")}m : ${s.toString().padStart(2, "0")}s`;
};

const formatTarget = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h.toString().padStart(2, "0")}h : ${m.toString().padStart(2, "0")}m`;
};

const formatCountdown = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}m : ${s.toString().padStart(2, "0")}s`;
};


const isDisplayMediaSupported = () => {
    return typeof navigator !== "undefined" && 
        !!navigator.mediaDevices && 
        typeof navigator.mediaDevices.getDisplayMedia === "function";
};

const isMobileOrTouchDevice = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;

    // 1. Chromium Client Hints (Android Chrome reports mobile: true even in Desktop Site mode!)
    if ((navigator as any).userAgentData?.mobile === true) {
        return true;
    }

    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
    // 2. Standard Mobile User Agent regex
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Silk/i.test(ua)) {
        return true;
    }

    // 3. iPad / iOS tablet spoofing Macintosh Desktop
    if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) {
        return true;
    }

    // 4. Mobile browsers do NOT support getDisplayMedia (even in Desktop Site mode)
    const hasDisplayMedia = !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function";
    if (!hasDisplayMedia) {
        return true;
    }

    // 5. Coarse touch pointer & multi-touch screen check
    const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) || "ontouchstart" in window;
    const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const isFine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (hasTouch && isCoarse && !isFine) {
        return true;
    }

    // 6. Mobile screen dimensions with touch
    const minDim = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
    if (minDim < 640 && hasTouch) {
        return true;
    }

    return false;
};

const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const handleLogout = () => {
        sessionStorage.removeItem("wfh_auth_token");
        sessionStorage.removeItem("wfh_logged_in_user");
        sessionStorage.removeItem("wfh_user_name");
        sessionStorage.removeItem("wfh_user_role");
        sessionStorage.removeItem("wfh_session_active");
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith("wfh_") || key.startsWith("wfh_session"))) {
                localStorage.removeItem(key);
            }
        }
        navigate("/login");
    };
    const [activeTab, setActiveTab] = useState("Dashboard");
    const [appCfg, setAppCfg] = useState<PublicAppConfig>(DEFAULT_PUBLIC_CONFIG);

    const userName = sessionStorage.getItem("wfh_user_name") || "Employee User";
    const userEmpId = sessionStorage.getItem("wfh_logged_in_user") || "";
    const userRole = sessionStorage.getItem("wfh_user_role") || "Employee";
    const userInitials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "EM";

    // Live Date & Time
    const [currentTime, setCurrentTime] = useState("");
    const [currentDate, setCurrentDate] = useState("");

    // Clock In & Availability States
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [clockInTime, setClockInTime] = useState<string | null>(null);
    const [currentStatus, setCurrentStatus] = useState<"Active" | "On Break" | "Idle" | "Offline">("Offline");
    const [shiftId, setShiftId] = useState<string | null>(null);
    
    // Timers (in seconds)
    const [workTime, setWorkTime] = useState(0); 
    const [targetSeconds, setTargetSeconds] = useState(DEFAULT_PUBLIC_CONFIG.shiftTargetSeconds);
    const [isSunday, setIsSunday] = useState(false);

    // Productivity from telemetry heartbeats (moving / total)
    const [telemetrySamples, setTelemetrySamples] = useState({ moving: 0, total: 0 });
    const [overtimeGuardActive, setOvertimeGuardActive] = useState(true);

    // BREAK MANAGEMENT states
    const [shortBreaksLeft, setShortBreaksLeft] = useState(DEFAULT_PUBLIC_CONFIG.shortBreakLimit);
    const [lunchBreakUsed, setLunchBreakUsed] = useState(false);
    const [activeBreakType, setActiveBreakType] = useState<"Short" | "Lunch" | null>(null);
    const [breakRemaining, setBreakRemaining] = useState(0);
    const [showBreakPopup, setShowBreakPopup] = useState(false);

    // Grace period state (Condition 2: 15-second grace period)
    const [showGraceAlert, setShowGraceAlert] = useState(false);
    const [graceSecondsLeft, setGraceSecondsLeft] = useState(DEFAULT_PUBLIC_CONFIG.breakGraceSeconds);
    
    // ACTIVITY / INACTIVITY states
    const [idleTime, setIdleTime] = useState(0);
    const lastActiveTimeRef = useRef<number>(Date.now());
    const [backgroundHiddenStart, setBackgroundHiddenStart] = useState<number | null>(null);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [activityLogs, setActivityLogs] = useState<string[]>([
        `[${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}] Activity Tracker Initialized Successfully`
    ]);
    const clockOutInProgressRef = useRef(false);
    const systemClockOutRef = useRef<(reason: string, message: string) => Promise<void>>(async () => {});
    const appCfgRef = useRef(appCfg);
    appCfgRef.current = appCfg;

    // ==========================================
    // SCREENSHOT MONITORING STATES
    // ==========================================
    const [screenCountdown, setScreenCountdown] = useState(DEFAULT_PUBLIC_CONFIG.screenshotIntervalSeconds);
    const [screenshots, setScreenshots] = useState<any[]>([]);
    const [screenNotification, setScreenNotification] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
    const screenStreamRef = useRef<MediaStream | null>(null);
    const [showScreenSyncModal, setShowScreenSyncModal] = useState(false);
    const persistentLiveVideoRef = useRef<HTMLVideoElement | null>(null);
    const persistentLiveCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const isLiveStreamingFrameRef = useRef<boolean>(false);
    const latestMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const [showMobileBlockModal, setShowMobileBlockModal] = useState(false);

    useEffect(() => {
        const updateDevice = () => {
            setIsMobileDevice(isMobileOrTouchDevice());
        };
        updateDevice();
        window.addEventListener("resize", updateDevice);
        return () => window.removeEventListener("resize", updateDevice);
    }, []);

    // ==========================================
    // CORE FEATURE 3: SMART DAILY TASK PLANNER
    // ==========================================
    const [tasks, setTasks] = useState<TaskItem[]>([
        { id: "temp-1", text: "", completed: false }
    ]);
    const [taskAssignTime, setTaskAssignTime] = useState(DEFAULT_PUBLIC_CONFIG.taskAssignSeconds);
    const [isTaskLocked, setIsTaskLocked] = useState(false);

    // Dynamic database-driven state variables
    const [systemIp, setSystemIp] = useState("Loading...");
    const [shiftHistory, setShiftHistory] = useState<any[]>([]);
    const [completedToday, setCompletedToday] = useState(false);

    // ==========================================
    // CORE FEATURE 4: PDF REPORT UPLOADER
    // ==========================================
    const [pdfFile, setPdfFile] = useState<{ name: string; size: string; uploadedAt: string } | null>(null);
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);

    // Shift Location Selection State
    const [shiftLocation, setShiftLocation] = useState<"CUSTOMER" | "OFFICE" | "OTHER">("CUSTOMER");

    // ==========================================
    // GEOLOCATION AUDITING STATES
    // ==========================================
    const [isClockingIn, setIsClockingIn] = useState(false);
    const [locationStatusText, setLocationStatusText] = useState<string | null>(null);

    // ==========================================
    // CHANGE PASSWORD STATES & ACTIONS
    // ==========================================
    const [currentPass, setCurrentPass] = useState("");
    const [newPass, setNewPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");

    const handleChangePassword = async () => {
        if (!currentPass || !newPass || !confirmPass) {
            alert("Please fill in all password fields!");
            return;
        }

        if (newPass !== confirmPass) {
            alert("New password and confirm password do not match!");
            return;
        }

        if (newPass.length < 4) {
            alert("Password must be at least 4 characters long!");
            return;
        }

        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: currentPass,
                    newPassword: newPass
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert("Password updated successfully! Please keep it secure.");
                setCurrentPass("");
                setNewPass("");
                setConfirmPass("");
            } else {
                alert(data.error || "Failed to update password.");
            }
        } catch (err) {
            console.error("Failed to update password:", err);
            alert("Network connection error. Failed to change password.");
        }
    };

    // Helper to fetch screenshots from employee telemetry route
    const fetchScreenshots = async () => {
        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/telemetry/screenshot`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.screenshots) {
                    const formatted = data.screenshots.map((ss: any) => {
                        const d = new Date(ss.capturedAt);
                        const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
                        return {
                            id: ss.id,
                            imageUrl: ss.imageUrl.startsWith("/") ? `${API_BASE_URL}${ss.imageUrl}?token=${token}` : ss.imageUrl,
                            timestamp: timeStr,
                            activeWindow: ss.activeWindow,
                            status: ss.status || "Uploaded"
                        };
                    });
                    setScreenshots(formatted);
                }
            }
        } catch (err) {
            console.error("Failed to fetch screenshots:", err);
        }
    };

    // Helper to capture and upload a live screen capture frame (Instant & Non-freezing)
    const isUploadingScreenshotRef = useRef(false);
    const captureAndUploadLiveScreenshot = async () => {
        if (isUploadingScreenshotRef.current) return;
        try {
            if (!screenStreamRef.current || !screenStreamRef.current.active) {
                return;
            }

            const track = screenStreamRef.current.getVideoTracks()[0];
            if (!track || track.readyState !== "live") return;

            isUploadingScreenshotRef.current = true;
            let blob: Blob | null = null;

            // 1. Try native ImageCapture API (Instantaneous & Native)
            if ("ImageCapture" in window) {
                try {
                    const imageCapture = new (window as any).ImageCapture(track);
                    const bitmap = await imageCapture.grabFrame();
                    const canvas = document.createElement("canvas");
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.drawImage(bitmap, 0, 0);
                        blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png", 0.85));
                    }
                } catch (icErr) {
                    console.warn("ImageCapture fallback to video canvas:", icErr);
                }
            }

            // 2. Fallback to Video Element with guaranteed 1.2s timeout
            if (!blob) {
                blob = await new Promise<Blob | null>((resolve) => {
                    const video = document.createElement("video");
                    video.muted = true;
                    video.playsInline = true;
                    video.autoplay = true;
                    video.srcObject = screenStreamRef.current;

                    let done = false;
                    const finish = (result: Blob | null) => {
                        if (done) return;
                        done = true;
                        video.pause();
                        video.srcObject = null;
                        resolve(result);
                    };

                    const draw = () => {
                        try {
                            const canvas = document.createElement("canvas");
                            canvas.width = video.videoWidth || 1280;
                            canvas.height = video.videoHeight || 720;
                            const ctx = canvas.getContext("2d");
                            if (ctx) {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                canvas.toBlob((b) => finish(b), "image/png", 0.85);
                                return;
                            }
                        } catch (err) {}
                        finish(null);
                    };

                    const safetyTimer = setTimeout(draw, 1200);

                    video.onloadeddata = () => {
                        video.play().then(() => setTimeout(draw, 100)).catch(draw);
                    };
                    video.play().catch(() => {});
                });
            }

            if (!blob) {
                isUploadingScreenshotRef.current = false;
                return;
            }

            const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
            const token = sessionStorage.getItem("wfh_auth_token");
            const formData = new FormData();
            formData.append("screenshot", file);
            formData.append("activeWindow", document.title || "Desktop Screen (Live Monitoring)");

            const res = await fetch(`${API_BASE_URL}/api/telemetry/screenshot/upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                fetchScreenshots();
            }
        } catch (err) {
            console.error("Failed to capture and upload screenshot:", err);
        } finally {
            isUploadingScreenshotRef.current = false;
        }
    };

    // Live Screen Frame Sync (Continuous real-time live streaming at ~1 FPS)
    useEffect(() => {
        if (!isClockedIn || currentStatus !== "Active") {
            if (persistentLiveVideoRef.current) {
                persistentLiveVideoRef.current.srcObject = null;
            }
            return;
        }

        const socket = getSocket();
        if (!persistentLiveCanvasRef.current) {
            persistentLiveCanvasRef.current = document.createElement("canvas");
        }
        const canvas = persistentLiveCanvasRef.current;
        const ctx = canvas.getContext("2d");

        const captureAndEmitLiveFrame = () => {
            if (isLiveStreamingFrameRef.current) return;
            isLiveStreamingFrameRef.current = true;

            try {
                const stream = screenStreamRef.current;
                const track = stream?.getVideoTracks()[0];
                const hasLiveVideoTrack = track && track.readyState === "live";

                if (hasLiveVideoTrack && stream) {
                    if (!persistentLiveVideoRef.current) {
                        const v = document.createElement("video");
                        v.muted = true;
                        v.playsInline = true;
                        v.autoplay = true;
                        persistentLiveVideoRef.current = v;
                    }

                    const video = persistentLiveVideoRef.current;
                    if (video.srcObject !== stream) {
                        video.srcObject = stream;
                        video.play().catch(() => {});
                    }

                    if (video.readyState >= 2 && ctx) {
                        const targetWidth = Math.min(video.videoWidth || 1280, 1280);
                        const targetHeight = Math.min(video.videoHeight || 720, 720);
                        canvas.width = targetWidth;
                        canvas.height = targetHeight;
                        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

                        const frameData = canvas.toDataURL("image/jpeg", 0.62);
                        socket.emit("live:frame", {
                            frame: frameData,
                            cursor: latestMousePosRef.current,
                            activeWindow: document.title || "Active Workspace (Live Stream)"
                        });
                    }
                }
            } catch (err) {
                console.error("Live frame capture error:", err);
            } finally {
                isLiveStreamingFrameRef.current = false;
            }
        };

        const interval = setInterval(captureAndEmitLiveFrame, 1000);
        const initTimer = setTimeout(captureAndEmitLiveFrame, 800);

        return () => {
            clearInterval(interval);
            clearTimeout(initTimer);
        };
    }, [isClockedIn, currentStatus, shiftLocation]);

    // Helper to save task to database
    const saveTaskToDb = async (text: string) => {
        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ text })
            });
            if (res.ok) {
                const data = await res.json();
                return data.task;
            }
        } catch (err) {
            console.error("Failed to save task to database:", err);
        }
        return null;
    };

    // 1. Recover active shift from database on mount
    useEffect(() => {
        const sessionActive = sessionStorage.getItem("wfh_session_active");
        if (sessionActive !== "true") {
            handleLogout();
            return;
        }

        const recoverActiveShift = async () => {
            try {
                const cfg = await fetchAppConfig();
                setAppCfg(cfg);
                setGraceSecondsLeft(cfg.breakGraceSeconds);
                setScreenCountdown(cfg.screenshotIntervalSeconds);
                if (!isClockedIn) {
                    setTaskAssignTime(cfg.taskAssignSeconds);
                    setShortBreaksLeft(cfg.shortBreakLimit);
                }

                const token = sessionStorage.getItem("wfh_auth_token");
                const res = await fetch(`${API_BASE_URL}/api/shifts/active`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.shift) {
                        const s = data.shift;
                        setShiftId(s.id);
                        setIsClockedIn(true);
                        setShiftLocation(s.shiftStartLocation);

                        const startMs = new Date(s.shiftStartTime).getTime();
                        const elapsedSecs = Math.floor((Date.now() - startMs) / 1000);
                        setWorkTime(elapsedSecs);

                        const elapsedTaskSecs = Math.floor((Date.now() - startMs) / 1000);
                        if (elapsedTaskSecs >= cfg.taskAssignSeconds) {
                            setTaskAssignTime(0);
                            setIsTaskLocked(true);
                        } else {
                            setTaskAssignTime(cfg.taskAssignSeconds - elapsedTaskSecs);
                            setIsTaskLocked(false);
                        }

                        // Format clock in time
                        const clockInTimeStr = new Date(s.shiftStartTime).toLocaleTimeString("en-US", { hour12: true });
                        setClockInTime(clockInTimeStr);

                        // Load tasks
                        if (s.tasks && s.tasks.length > 0) {
                            setTasks(s.tasks.map((t: any) => ({
                                id: t.id,
                                text: t.text,
                                completed: t.completed,
                                completedAt: t.completedAt ? `Completed at ${new Date(t.completedAt).toLocaleTimeString()}` : undefined
                            })));
                        } else {
                            setTasks([{ id: "temp-1", text: "", completed: false }]);
                        }

                        // Load PDF report if already uploaded in active shift
                        if (s.pdfReportName) {
                            setPdfFile({
                                name: s.pdfReportName,
                                size: s.pdfReportSize || "0.00 MB",
                                uploadedAt: s.pdfReportUploadedAt 
                                    ? `Uploaded at ${new Date(s.pdfReportUploadedAt).toLocaleTimeString("en-US", { hour12: true })}`
                                    : "Uploaded today"
                            });
                        } else {
                            setPdfFile(null);
                        }

                        const shortBreaks = (s.breaks || []).filter((b: any) => b.name.toLowerCase().includes("short"));
                        setShortBreaksLeft(Math.max(0, cfg.shortBreakLimit - shortBreaks.length));
                        setLunchBreakUsed((s.breaks || []).some((b: any) => b.name.toLowerCase().includes("lunch")));

                        const activeBreak = (s.breaks || []).find((b: any) => b.endTime === null);
                        if (activeBreak) {
                            setCurrentStatus("On Break");
                            const isLunch = activeBreak.name.toLowerCase().includes("lunch");
                            setActiveBreakType(isLunch ? "Lunch" : "Short");
                            
                            const breakStartMs = new Date(activeBreak.startTime).getTime();
                            const limitSecs = isLunch ? cfg.lunchBreakSeconds : cfg.shortBreakSeconds;
                            const elapsedBreakSecs = Math.floor((Date.now() - breakStartMs) / 1000);
                            setBreakRemaining(Math.max(0, limitSecs - elapsedBreakSecs));
                        } else {
                            setCurrentStatus("Active");
                        }

                        // Load screenshots
                        fetchScreenshots();
                    } else if (data && data.completedToday) {
                        setCompletedToday(true);
                    }
                }
            } catch (err) {
                console.error("Shift recovery error:", err);
            }
        };

        recoverActiveShift();

        // Multi-device sync: Periodically sync shift status every 8 seconds
        const syncInterval = setInterval(recoverActiveShift, 8000);

        // Immediate sync whenever user switches to this tab or window
        const onSyncFocus = () => recoverActiveShift();
        window.addEventListener("focus", onSyncFocus);
        document.addEventListener("visibilitychange", onSyncFocus);

        return () => {
            clearInterval(syncInterval);
            window.removeEventListener("focus", onSyncFocus);
            document.removeEventListener("visibilitychange", onSyncFocus);
        };
    }, [navigate]);

    // Mount hooks to fetch System IP and historical WFH shifts
    useEffect(() => {
        const fetchSystemIp = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/ip`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.ip) {
                        setSystemIp(`${data.ip} (Verified)`);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch system IP:", err);
                setSystemIp("Unavailable");
            }
        };

        const fetchShiftHistory = async () => {
            try {
                const token = sessionStorage.getItem("wfh_auth_token");
                const res = await fetch(`${API_BASE_URL}/api/shifts/history`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.shifts) {
                        setShiftHistory(data.shifts);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch shift history:", err);
            }
        };

        fetchSystemIp();
        fetchShiftHistory();
    }, [isClockedIn]);

    // Tab Close / Refreshes warning lock
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const sessionActive = sessionStorage.getItem("wfh_session_active");
            if (sessionActive === "true") {
                localStorage.setItem("wfh_session_completed_date", new Date().toDateString());
                e.preventDefault();
                e.returnValue = "Are you sure you want to leave? Your WFH session for today will be closed and locked out.";
                return e.returnValue;
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    useEffect(() => {
        const today = new Date();
        if (today.getDay() === 0) {
            setIsSunday(true);
            setTargetSeconds(0);
        } else {
            setIsSunday(false);
            setTargetSeconds(appCfg.shiftTargetSeconds);
        }
    }, [appCfg.shiftTargetSeconds]);

    // Live clock ticks
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { hour12: true }));
            setCurrentDate(now.toLocaleDateString("en-US", { 
                weekday: "long", 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
            }));
        };
        updateClock();
        const clockInterval = setInterval(updateClock, 1000);
        return () => clearInterval(clockInterval);
    }, []);

    // Inactivity mouse and key hooks
    useEffect(() => {
        if (!isClockedIn || currentStatus === "Offline") return;

        const resetIdle = () => {
            lastActiveTimeRef.current = Date.now();
            setIdleTime(0);
            
            if (currentStatus === "Idle") {
                setCurrentStatus("Active");
            }
            
            if (showGraceAlert) {
                setShowGraceAlert(false);
                setGraceSecondsLeft(appCfgRef.current.breakGraceSeconds);
                setCurrentStatus("Active");
                setActiveBreakType(null);
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            setCursorPos({ x: e.clientX, y: e.clientY });
            latestMousePosRef.current = { x: e.clientX, y: e.clientY };
            resetIdle();
            
            if (Math.random() < 0.03) {
                const now = new Date();
                const ts = now.toLocaleTimeString("en-US", { hour12: true });
                setActivityLogs(prev => [
                    `[${ts}] Cursor moved - X: ${e.clientX}px, Y: ${e.clientY}px`,
                    ...prev.slice(0, 4)
                ]);
            }
        };

        const handleKeyDown = () => {
            resetIdle();
            const now = new Date();
            const ts = now.toLocaleTimeString("en-US", { hour12: true });
            setActivityLogs(prev => [
                `[${ts}] Keyboard keystroke registered`,
                ...prev.slice(0, 4)
            ]);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("click", resetIdle);
        window.addEventListener("scroll", resetIdle);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("click", resetIdle);
            window.removeEventListener("scroll", resetIdle);
        };
    }, [isClockedIn, currentStatus, showGraceAlert]);

    // Live Mouse Activity Telemetry Heartbeat (Sends X, Y to DB every 5 seconds)
    const hasActivityThisPeriodRef = useRef(false);
    useEffect(() => {
        if (!isClockedIn || currentStatus !== "Active") return;

        const recordActivityFlag = () => {
            hasActivityThisPeriodRef.current = true;
        };

        window.addEventListener("mousemove", recordActivityFlag);
        window.addEventListener("keydown", recordActivityFlag);
        window.addEventListener("click", recordActivityFlag);
        window.addEventListener("scroll", recordActivityFlag);

        return () => {
            window.removeEventListener("mousemove", recordActivityFlag);
            window.removeEventListener("keydown", recordActivityFlag);
            window.removeEventListener("click", recordActivityFlag);
            window.removeEventListener("scroll", recordActivityFlag);
        };
    }, [isClockedIn, currentStatus]);

    useEffect(() => {
        if (!isClockedIn || currentStatus !== "Active") return;

        const sendTelemetryLogs = async () => {
            try {
                const token = sessionStorage.getItem("wfh_auth_token");
                const isMoving = hasActivityThisPeriodRef.current;
                hasActivityThisPeriodRef.current = false;

                await fetch(`${API_BASE_URL}/api/shifts/telemetry`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        x: Math.round(cursorPos.x),
                        y: Math.round(cursorPos.y),
                        isMoving
                    })
                });

                setTelemetrySamples((prev) => ({
                    moving: prev.moving + (isMoving ? 1 : 0),
                    total: prev.total + 1,
                }));
            } catch (err) {
                console.error("Failed to post mouse telemetry heartbeat:", err);
            }
        };

        const interval = setInterval(sendTelemetryLogs, 5000);
        return () => clearInterval(interval);
    }, [isClockedIn, currentStatus, cursorPos]);

    // Page Visibility Tracker
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!isClockedIn) return;

            if (document.hidden) {
                setBackgroundHiddenStart(Date.now());
            } else {
                if (backgroundHiddenStart) {
                    const elapsedMs = Date.now() - backgroundHiddenStart;
                    const elapsedSecs = Math.floor(elapsedMs / 1000);
                    
                    if (elapsedSecs >= appCfgRef.current.backgroundHiddenTimeoutSeconds) {
                        void systemClockOutRef.current(
                            "idle_timeout",
                            `Auto Logout: Workspace remained minimized or hidden in the background for more than ${Math.round(appCfgRef.current.backgroundHiddenTimeoutSeconds / 60)} minutes.`
                        );
                    }
                    setBackgroundHiddenStart(null);
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [isClockedIn, backgroundHiddenStart, navigate]);

    // Main interval loop for timers, countdowns and auto captures
    useEffect(() => {
        if (isSunday || !isClockedIn) return;

        const mainTimer = setInterval(() => {
            if (currentStatus === "Active") {

                const elapsedSecs = Math.floor((Date.now() - lastActiveTimeRef.current) / 1000);
                setIdleTime(elapsedSecs);

                if (elapsedSecs >= appCfgRef.current.idleTimeoutSeconds) {
                    void systemClockOutRef.current(
                        "idle_timeout",
                        `Auto Logout: Inactive for ${Math.round(appCfgRef.current.idleTimeoutSeconds / 60)} minutes.`
                    );
                    return;
                }

                setWorkTime(prev => {
                    const nextTime = prev + 1;
                    if (overtimeGuardActive && nextTime >= targetSeconds) {
                        void systemClockOutRef.current(
                            "overtime_guard",
                            "Shift Goal Completed! Overtime Guard clocked you out."
                        );
                        return targetSeconds;
                    }
                    return nextTime;
                });

                setTaskAssignTime(prev => {
                    if (prev <= 1) {
                        setIsTaskLocked(true);
                        return 0;
                    }
                    return prev - 1;
                });

                setScreenCountdown(prev => {
                    if (prev <= 1) {
                        captureAndUploadLiveScreenshot();
                        return appCfgRef.current.screenshotIntervalSeconds;
                    }
                    return prev - 1;
                });
            }

            if (currentStatus === "On Break") {
                setBreakRemaining(prev => {
                    if (prev <= 1) {
                        setShowGraceAlert(true);
                        setGraceSecondsLeft(appCfgRef.current.breakGraceSeconds);
                        return 0;
                    }
                    return prev - 1;
                });
            }

            if (showGraceAlert) {
                setGraceSecondsLeft(prev => {
                    if (prev <= 1) {
                        setShowGraceAlert(false);
                        void systemClockOutRef.current(
                            "break_exceeded",
                            "Auto Logout: Break exceeded grace limit."
                        );
                        return 0;
                    }
                    return prev - 1;
                });
            }
        }, 1000);

        return () => clearInterval(mainTimer);
    }, [isClockedIn, currentStatus, isSunday, showGraceAlert, overtimeGuardActive, targetSeconds]);

    const getGPSCoordinates = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser."));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => reject(error),
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        });
    };

    const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
            );
            if (!response.ok) {
                throw new Error("Geocoding failed");
            }
            const data = await response.json();
            if (data && data.display_name) {
                return data.display_name;
            }
            return `Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        } catch (err) {
            console.error("Nominatim Reverse Geocoding Error:", err);
            return `Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
    };

    const stopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => track.stop());
            screenStreamRef.current = null;
        }
    };

    const persistClockOut = async (opts: {
        reason?: string;
        requireGps: boolean;
        fallbackAddress: string;
        onStatus?: (text: string) => void;
    }) => {
        let latitude: number | null = null;
        let longitude: number | null = null;
        let endAddress = opts.fallbackAddress;

        try {
            opts.onStatus?.("Requesting GPS location...");
            const position = await getGPSCoordinates();
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            opts.onStatus?.("Resolving physical address...");
            endAddress = await reverseGeocode(latitude, longitude);
        } catch (err) {
            if (opts.requireGps) {
                throw err;
            }
            console.warn("GPS unavailable for clock-out; storing fallback address.", err);
        }

        const token = sessionStorage.getItem("wfh_auth_token");
        opts.onStatus?.("Syncing clock-out with server...");
        const res = await fetch(`${API_BASE_URL}/api/shifts/clock-out`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                latitude,
                longitude,
                endAddress,
                reason: opts.reason,
            }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data as { error?: string }).error || "Failed to clock out");
        }
        return res;
    };

    const performSystemClockOut = async (reason: string, userMessage: string) => {
        if (clockOutInProgressRef.current) return;
        clockOutInProgressRef.current = true;
        try {
            await persistClockOut({
                reason,
                requireGps: false,
                fallbackAddress: userMessage,
            });
        } catch (err) {
            console.error("System clock-out failed:", err);
        }
        stopScreenShare();
        alert(userMessage);
        handleLogout();
    };
    systemClockOutRef.current = performSystemClockOut;

    useEffect(() => {
        if (!isClockedIn) {
            setShowScreenSyncModal(false);
            return;
        }

        // Mobile devices or secondary devices where screen share is on desktop should never be blocked by sync modal
        if (isMobileOrTouchDevice() || !isDisplayMediaSupported()) {
            setShowScreenSyncModal(false);
            return;
        }

        const checkStream = () => {
            const hasActiveStream = screenStreamRef.current && screenStreamRef.current.active;
            if (!hasActiveStream) {
                setShowScreenSyncModal(true);
            } else {
                setShowScreenSyncModal(false);
            }
        };

        checkStream();
        const interval = setInterval(checkStream, 2000);
        return () => clearInterval(interval);
    }, [isClockedIn]);

    const handleReSyncScreen = async () => {
        if (isMobileOrTouchDevice() || !isDisplayMediaSupported()) {
            setShowScreenSyncModal(false);
            return;
        }
        try {
            const stream = await getScreenStream();
            screenStreamRef.current = stream;
            
            stream.getVideoTracks()[0].onended = () => {
                alert("⚠️ Compliance Alert: Screen sharing was stopped! Ending WFH Shift.");
                handleForceClockOut();
            };
            setShowScreenSyncModal(false);
        } catch (err) {
            alert("❌ Screen Sharing is strictly required to continue your WFH shift compliance monitoring.");
        }
    };

    const getScreenStream = async (): Promise<MediaStream> => {
        if (!isDisplayMediaSupported()) {
            throw new Error("Screen sharing is not supported on this device/browser.");
        }
        return await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: "monitor"
            } as any,
            audio: false
        });
    };

    const handleForceClockOut = async () => {
        try {
            await persistClockOut({
                reason: "screen_share_stopped",
                requireGps: false,
                fallbackAddress: "Shift Ended Forcefully - Screen Share Stopped",
            });
        } catch (e) {
            console.error("Force clock out API failed:", e);
        }

        stopScreenShare();
        setIsClockedIn(false);
        setCurrentStatus("Offline");
        setClockInTime(null);
        setShiftId(null);
        setCompletedToday(true);
    };

    // Toggle Clock-in and Clock-out
    const handleClockInToggle = async () => {
        const token = sessionStorage.getItem("wfh_auth_token");
        if (!isClockedIn) {
            // Strict compliance: Block any mobile / non-desktop shift initiation
            if (isMobileOrTouchDevice()) {
                setShowMobileBlockModal(true);
                return;
            }

            if (completedToday) {
                alert("❌ Lockout Compliance Block: You have already completed or logged out of your WFH shift today. Re-starting a shift is strictly disabled for the rest of today.");
                return;
            }

            setIsClockingIn(true);
            setLocationStatusText("Requesting GPS Telemetry Permission...");

            let lat: number | null = null;
            let lon: number | null = null;
            let address: string | null = null;

            try {
                // Fetch GPS coordinates
                const position = await getGPSCoordinates();
                lat = position.coords.latitude;
                lon = position.coords.longitude;

                setLocationStatusText("Resolving Precise Physical Address...");
                // Reverse-geocode physical address via OpenStreetMap Nominatim
                address = await reverseGeocode(lat, lon);

                if (!lat || !lon || !address || address.includes("Permission Denied") || address.includes("GPS Location Blocked")) {
                    throw new Error("Geolocation access was denied or resolved address is invalid.");
                }
            } catch (locationErr: any) {
                console.error("Location fetch strictly failed for clock-in:", locationErr);
                alert("❌ Shift Start Blocked: You must enable browser GPS location access to start your WFH shift.");
                setIsClockingIn(false);
                setLocationStatusText(null);
                return; // Strictly block clock-in
            }

            // Desktop screen sharing strictly required
            setLocationStatusText("Waiting for Screen Share Telemetry Permission...");
            try {
                const screenStream = await getScreenStream();
                screenStreamRef.current = screenStream;

                // Watch for when the user stops sharing screen from the browser bar!
                screenStream.getVideoTracks()[0].onended = () => {
                    alert("⚠️ Compliance Alert: Screen sharing was stopped! Ending WFH Shift.");
                    handleForceClockOut();
                };
            } catch (screenErr: any) {
                console.error("Screen stream permission denied:", screenErr);
                alert("❌ Shift Start Blocked: You must enable Screen Sharing (select Entire Screen) to start your WFH shift compliance monitoring.");
                setIsClockingIn(false);
                setLocationStatusText(null);
                return; // Block clock-in on desktop if denied
            }

            setLocationStatusText("Syncing Telemetry with Remote Server...");

            try {
                const res = await fetch(`${API_BASE_URL}/api/shifts/clock-in`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        location: shiftLocation,
                        latitude: lat,
                        longitude: lon,
                        startAddress: address
                    })
                });

                if (!res.ok) {
                    const data = await res.json();
                    alert(data.error || "Failed to Clock In");
                    setIsClockingIn(false);
                    setLocationStatusText(null);
                    return;
                }

                const data = await res.json();
                setShiftId(data.shift.id);
                setIsClockedIn(true);
                setCurrentStatus("Active");
                setWorkTime(0);
                
                // Actual real-time timestamp when shift started
                const actualStart = data.shift?.shiftStartTime ? new Date(data.shift.shiftStartTime) : new Date();
                setClockInTime(actualStart.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
                lastActiveTimeRef.current = Date.now();
                setIdleTime(0);
                setTaskAssignTime(appCfg.taskAssignSeconds);
                setIsTaskLocked(false);
                setTasks([{ id: "temp-1", text: "", completed: false }]);

                // Immediately capture and upload the first compliance screenshot!
                setTimeout(() => {
                    captureAndUploadLiveScreenshot();
                }, 1000);
            } catch (err) {
                console.error("Failed to clock in:", err);
                alert("Connection failed during clock in.");
            } finally {
                setIsClockingIn(false);
                setLocationStatusText(null);
            }
        } else {
            const confirmOut = confirm("Are you sure you want to End Shift and Clock Out today?");
            if (confirmOut) {
                setIsClockingIn(true);
                setLocationStatusText("Requesting GPS Telemetry for Clock-Out...");

                let outLat: number | null = null;
                let outLon: number | null = null;
                let outAddress: string | null = null;

                try {
                    // Fetch GPS coordinates
                    const position = await getGPSCoordinates();
                    outLat = position.coords.latitude;
                    outLon = position.coords.longitude;

                    setLocationStatusText("Resolving Precise Clock-Out Address...");
                    // Reverse-geocode physical address via OpenStreetMap Nominatim
                    outAddress = await reverseGeocode(outLat, outLon);

                    if (!outLat || !outLon || !outAddress || outAddress.includes("Permission Denied") || outAddress.includes("GPS Location Blocked")) {
                        throw new Error("Geolocation access was denied or resolved address is invalid.");
                    }
                } catch (locationErr: any) {
                    console.error("Location fetch strictly failed for clock-out:", locationErr);
                    alert("❌ Shift End Blocked: You must enable browser GPS location access to end your WFH shift.");
                    setIsClockingIn(false);
                    setLocationStatusText(null);
                    return; // Strictly block clock-out
                }

                setLocationStatusText("Syncing Clock-Out Telemetry with Server...");

                try {
                    const res = await fetch(`${API_BASE_URL}/api/shifts/clock-out`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            latitude: outLat,
                            longitude: outLon,
                            endAddress: outAddress
                        })
                    });

                    if (res.ok) {
                        setIsClockedIn(false);
                        setCurrentStatus("Offline");
                        setClockInTime(null);
                        setShiftId(null);
                        setCompletedToday(true);
                    } else {
                        const data = await res.json();
                        alert(data.error || "Failed to Clock Out");
                    }
                } catch (err) {
                    console.error("Failed to clock out:", err);
                    alert("Connection failed during clock out.");
                } finally {
                    setIsClockingIn(false);
                    setLocationStatusText(null);
                }
            }
        }
    };

    // Trigger Short Break
    const triggerShortBreak = async () => {
        if (!isClockedIn) {
            alert("Please Clock In / Start Shift first before taking a break!");
            return;
        }
        if (currentStatus !== "Active") {
            alert("You can only take a break when your status is Active / Working!");
            return;
        }
        if (shortBreaksLeft <= 0) {
            alert("No short breaks remaining today!");
            return;
        }

        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const breakNameStr = `Short Break ${appCfg.shortBreakLimit + 1 - shortBreaksLeft}`;
            const res = await fetch(`${API_BASE_URL}/api/shifts/breaks/start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ breakName: breakNameStr })
            });

            if (res.ok) {
                setShortBreaksLeft(prev => prev - 1);
                setCurrentStatus("On Break");
                setActiveBreakType("Short");
                setBreakRemaining(appCfg.shortBreakSeconds);
                setIdleTime(0);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to start short break");
            }
        } catch (err) {
            console.error("Failed to start break:", err);
        }
    };

    // Trigger Lunch Break
    const triggerLunchBreak = async () => {
        if (!isClockedIn) {
            alert("Please Clock In / Start Shift first before taking a break!");
            return;
        }
        if (currentStatus !== "Active") {
            alert("You can only take a break when your status is Active / Working!");
            return;
        }
        if (lunchBreakUsed) {
            alert("Lunch Break has already been used today!");
            return;
        }

        const now = new Date();
        if (now.getHours() < appCfg.lunchUnlockHour) {
            alert(`Lunch Break is locked. It will automatically unlock starting at ${formatLunchUnlockLabel(appCfg.lunchUnlockHour)}!`);
            return;
        }

        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/shifts/breaks/start`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ breakName: "Lunch Break" })
            });

            if (res.ok) {
                setLunchBreakUsed(true);
                setCurrentStatus("On Break");
                setActiveBreakType("Lunch");
                setBreakRemaining(appCfg.lunchBreakSeconds);
                setIdleTime(0);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to start lunch break");
            }
        } catch (err) {
            console.error("Failed to start break:", err);
        }
    };

    // End break session
    const handleResumeWork = async () => {
        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/shifts/breaks/end`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                setCurrentStatus("Active");
                setActiveBreakType(null);
                setBreakRemaining(0);
                setShowGraceAlert(false);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to resume work");
            }
        } catch (err) {
            console.error("Failed to end break:", err);
        }
    };

    // 7-Day History helper
    const getLast7Days = () => {
        const days = [];
        const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = weekdays[d.getDay()];
            const dateString = `${d.getDate()} ${months[d.getMonth()]}`;
            
            const isSundayDay = d.getDay() === 0;
            
            // Search in shift history for a shift on this day
            const targetDateStr = d.toISOString().split('T')[0];
            const shiftForDay = shiftHistory.find(s => {
                const sDate = new Date(s.shiftStartTime).toISOString().split('T')[0];
                return sDate === targetDateStr;
            });

            let hrs = "00h : 00m";
            let percent = 0;
            let completed = false;

            if (shiftForDay) {
                if (shiftForDay.status === "Active") {
                    const elapsed = Math.floor((Date.now() - new Date(shiftForDay.shiftStartTime).getTime()) / 1000);
                    const totalMins = Math.floor(elapsed / 60);
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    hrs = `${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m`;
                    percent = Math.min(100, Math.floor((elapsed / (appCfg.autoClockOutHours * 3600)) * 100));
                    completed = false;
                } else {
                    const startMs = new Date(shiftForDay.shiftStartTime).getTime();
                    const endMs = shiftForDay.shiftEndTime ? new Date(shiftForDay.shiftEndTime).getTime() : startMs;
                    const diffMs = endMs - startMs;
                    const totalMins = Math.floor(diffMs / 60000);
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    hrs = `${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m`;
                    percent = Math.min(100, Math.floor(((totalMins * 60) / (appCfg.autoClockOutHours * 3600)) * 100));
                    completed = shiftForDay.status === "Completed";
                }
            } else if (isSundayDay) {
                hrs = "00h : 00m";
                percent = 0;
                completed = false;
            }

            days.push({
                day: dayName,
                date: dateString,
                hrs: hrs,
                percent: percent,
                completed: completed,
                isToday: i === 0,
                isSunday: isSundayDay
            });
        }
        return days;
    };

    // Task Scheduler actions
    const handleTaskKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, id: string | number, index: number) => {
        if (isTaskLocked || !isClockedIn || !String(id).startsWith("temp-")) return;

        if (e.key === "Enter") {
            e.preventDefault();
            const currentTask = tasks.find(t => t.id === id);
            if (!currentTask || currentTask.text.trim() === "") return;

            let dbTask = null;
            if (String(id).startsWith("temp-")) {
                dbTask = await saveTaskToDb(currentTask.text);
            }

            const savedId = dbTask ? dbTask.id : id;
            const newTempId = `temp-${Date.now()}`;

            setTasks(prev => {
                const copy = [...prev];
                copy[index] = { ...copy[index], id: savedId };
                copy.splice(index + 1, 0, { id: newTempId, text: "", completed: false });
                return copy;
            });

            setTimeout(() => {
                const nextInput = document.getElementById(`task-input-${newTempId}`);
                nextInput?.focus();
            }, 50);
        }
    };

    const handleTaskChange = (id: string | number, val: string) => {
        if (isTaskLocked || !isClockedIn || !String(id).startsWith("temp-")) return;
        setTasks(prev => prev.map(t => t.id === id ? { ...t, text: val } : t));
    };

    const handleTaskCompleteToggle = async (id: string | number) => {
        if (!isClockedIn) return;
        
        let finalId = id;
        const currentTask = tasks.find(t => t.id === id);
        if (!currentTask || currentTask.text.trim() === "") return;

        if (String(id).startsWith("temp-")) {
            const dbTask = await saveTaskToDb(currentTask.text);
            if (dbTask) {
                finalId = dbTask.id;
                setTasks(prev => prev.map(t => t.id === id ? { ...t, id: dbTask.id } : t));
            } else {
                alert("Failed to sync task before marking complete.");
                return;
            }
        }

        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/tasks/${finalId}`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                const now = new Date();
                const timestamp = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
                setTasks(prev => prev.map(t => 
                    t.id === finalId 
                        ? { ...t, completed: data.task.completed, completedAt: data.task.completed ? `Completed at ${timestamp}` : undefined } 
                        : t
                ));
            }
        } catch (err) {
            console.error("Failed to complete task:", err);
        }
    };

    const activeHighlightTaskId = tasks.find(t => !t.completed && t.text.trim() !== "")?.id || null;

    // PDF Report uploads (Real multipart upload to server)
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            alert("Only PDF files are allowed!");
            return;
        }

        setIsUploadingPdf(true);
        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const formData = new FormData();
            formData.append("pdfReport", file);

            const res = await fetch(`${API_BASE_URL}/api/shifts/upload-pdf`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                const now = new Date();
                const timeString = now.toLocaleTimeString("en-US", { hour12: true });
                
                setPdfFile({
                    name: data.pdfReport.name,
                    size: data.pdfReport.size,
                    uploadedAt: `Uploaded at ${timeString}`
                });
            } else {
                const errData = await res.json();
                alert(errData.error || "Failed to upload PDF report to server.");
            }
        } catch (err) {
            console.error("PDF upload error:", err);
            alert("Failed to connect to server during PDF upload.");
        } finally {
            setIsUploadingPdf(false);
        }
    };

    // Submit shift today
    const handleSubmitShift = async () => {
        if (!isClockedIn) {
            alert("Please Clock In / Start Shift first before submitting!");
            return;
        }

        const assignedTasks = tasks.filter(t => t.text.trim() !== "");
        if (assignedTasks.length === 0) {
            alert("❌ Compliance Error: You did not assign any tasks to yourself!");
            return;
        }

        const incompleteTasks = assignedTasks.filter(t => !t.completed);
        if (incompleteTasks.length > 0) {
            alert("❌ Compliance Error: You have incomplete tasks in your planner!");
            return;
        }

        if (!pdfFile) {
            alert("❌ Compliance Error: You must upload your Daily PDF Work Report!");
            return;
        }

        try {
            setIsClockingIn(true);
            await persistClockOut({
                requireGps: true,
                fallbackAddress: "Employee submitted daily report",
                onStatus: setLocationStatusText,
            });
        } catch (err: any) {
            console.error("Failed to clock out on submit:", err);
            alert(err?.message || "❌ Shift End Blocked: Enable GPS location and retry submitting your shift.");
            setIsClockingIn(false);
            setLocationStatusText(null);
            return;
        }

        stopScreenShare();
        alert("🎉 Shift and Tasks Submitted Successfully! Today's attendance has been marked. Logging out...");
        handleLogout();
    };


    const workPercent = targetSeconds > 0 ? Math.min((workTime / targetSeconds) * 100, 100) : 0;
    const remainingTime = Math.max(targetSeconds - workTime, 0);
    const productivityScore =
        telemetrySamples.total > 0
            ? Math.round((telemetrySamples.moving / telemetrySamples.total) * 100)
            : null;

    const radius = 55;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (workPercent / 100) * circumference;

    /*
    const renderCursorActivity = () => {
        return (
            <div className="space-y-8 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-peacock bg-brand-peacock/5 border border-brand-peacock/10 px-3 py-1 rounded-full">
                            System Activity Monitoring
                        </span>
                        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mt-3">
                            Cursor & Active Window Tracker
                        </h2>
                        <p className="text-sm text-slate-400 mt-1 font-medium">
                            Live compliance validation checking OS-level inactive timeouts and companion app bridges.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-md p-6 flex flex-col space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                            <div>
                                <h4 className="text-sm font-bold text-slate-700">Live Browser Interaction Canvas</h4>
                                <p className="text-[11px] text-slate-400">Move cursor within this card to see coordinate vector captures.</p>
                            </div>
                            <span className="flex items-center gap-1.5 text-[9px] font-bold bg-green-50 border border-green-100 text-green-600 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                            </span>
                        </div>

                        <div 
                            onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = Math.round(e.clientX - rect.left);
                                const y = Math.round(e.clientY - rect.top);
                                // setCursorPos({ x, y });
                                setIdleTime(0);
                            }}
                            className="h-64 bg-slate-950 rounded-2xl relative overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner group cursor-crosshair"
                        >
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-25" />
                            
                            <div 
                                className="absolute w-48 h-48 bg-brand-peacock/10 rounded-full blur-xl pointer-events-none transition-all duration-75"
                                style={{ 
                                    left: `${cursorPos.x - 96}px`, 
                                    top: `${cursorPos.y - 96}px` 
                                }}
                            />

                            <div 
                                className="absolute left-0 right-0 h-px bg-brand-peacock/20 pointer-events-none"
                                style={{ top: `${cursorPos.y}px` }}
                            />
                            <div 
                                className="absolute top-0 bottom-0 w-px bg-brand-peacock/20 pointer-events-none"
                                style={{ left: `${cursorPos.x}px` }}
                            />

                            <div 
                                className="absolute w-2.5 h-2.5 bg-brand-peacock rounded-full ring-4 ring-brand-peacock/30 pointer-events-none animate-ping"
                                style={{ 
                                    left: `${cursorPos.x - 5}px`, 
                                    top: `${cursorPos.y - 5}px` 
                                }}
                            />
                            <div 
                                className="absolute w-2.5 h-2.5 bg-brand-peacock rounded-full border border-white pointer-events-none"
                                style={{ 
                                    left: `${cursorPos.x - 5}px`, 
                                    top: `${cursorPos.y - 5}px` 
                                }}
                            />

                            <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-black text-brand-peacock font-mono shadow-md backdrop-blur-sm select-none">
                                VECTOR: [X: 0px | Y: 0px]
                            </div>

                            <div className="absolute pointer-events-none text-center opacity-40 group-hover:opacity-10 select-none text-[10px] uppercase font-bold text-slate-400 tracking-widest max-w-xs transition-opacity duration-300">
                                Interactive Compliance Test Field
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-500 pt-2">
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Real-time coordinates</span>
                                <p className="text-sm font-black text-slate-800 mt-1 font-mono">X: 0px • Y: 0px</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1m Inactivity Remaining</span>
                                <p className={`text-sm font-black mt-1 tabular-nums ${idleTime >= 45 ? "text-red-500 animate-pulse" : "text-brand-peacock"}`}>
                                    {formatCountdown(Math.max(60 - idleTime, 0))}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 flex flex-col">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 space-y-4 flex-1 flex flex-col justify-between">
                            <div className="border-b border-slate-50 pb-3 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700">Verification Signals Log</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Captures system and browser input heartbeats.</p>
                                </div>
                                <FiActivity size={16} className="text-brand-peacock" />
                            </div>

                            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[140px] pr-1 py-1 font-mono text-[9px] font-semibold text-slate-500">
                                {activityLogs.map((log, idx) => (
                                    <div key={idx} className="bg-slate-50 border border-slate-100/60 rounded-lg p-2 flex items-center gap-2">
                                        <span className="w-1 h-1 rounded-full bg-brand-peacock shrink-0" />
                                        <span className="truncate">{log}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-slate-600">Desktop Companion Bypass</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Disabled</span>
                                </div>
                                <p className="text-[9px] text-slate-400 leading-relaxed font-semibold">
                                    Background companion simulation is turned off. Idle, hidden-tab, and break timeouts clock you out through the backend using GPS when available.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 sm:p-8 space-y-6">
                    <div className="border-b border-slate-100 pb-4">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-brand-blue bg-brand-blue/5 border border-brand-blue/10 px-2.5 py-1 rounded-full">
                            System Architecture Clarification
                        </span>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight mt-3">
                            Do We Need a Backend to Track Cursor Activity in the Background?
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                            Understanding browser security boundaries and how we build enterprise-grade remote tracking portals.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shadow-sm">
                                <FiShield size={20} />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800">1. Browser Security Sandbox</h4>
                            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                                Web browsers run inside a secure virtual sandbox. Standard JavaScript web pages **are structurally restricted** from listening to any keystrokes, mouse coordinates, or system inputs outside their active browser tab.
                            </p>
                        </div>

                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shadow-sm">
                                <FiMonitor size={20} />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800">2. OS-Level Companion App</h4>
                            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                                To track desktop cursor movements when the browser is minimized, we need a lightweight **Desktop Companion App** (written in Electron, Node.js, C#, or Rust) that hooks into system inputs and broadcasts them.
                            </p>
                        </div>

                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-peacock/10 text-brand-peacock flex items-center justify-center shadow-sm">
                                <FiActivity size={20} />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800">3. Backend WebSocket Hub</h4>
                            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                                <strong>Yes! A backend is needed</strong> to receive background heartbeat logs from the desktop app and synchronize them with this dashboard web panel in real-time using secure WebSockets.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    */

    return (
        <div className="min-h-screen bg-[#F8F7FF] flex relative overflow-hidden font-[Inter,sans-serif] select-none">
            {/* Background Accent Blobs */}
            <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-blue opacity-[0.07] rounded-full blur-[120px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-peacock opacity-[0.06] rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            {/* Sidebar - Mobile Responsive */}
            <EmployeeSidebar 
                activeMenu={activeTab} 
                onMenuChange={setActiveTab}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={() => setMobileSidebarOpen(false)}
            />

            {/* Content Canvas */}
            <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-y-auto">
                
                {/* Navbar - Mobile Responsive */}
                <header className="h-16 sm:h-20 bg-white border-b border-slate-100 px-4 sm:px-8 flex items-center justify-between shadow-sm flex-shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        {/* Mobile hamburger */}
                        <button 
                            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                            onClick={() => setMobileSidebarOpen(true)}
                            title="Menu"
                        >
                            <FiMenu size={18} />
                        </button>
                        <img 
                            src="/logo.png" 
                            alt="Company Logo" 
                            className="h-8 sm:h-10 w-auto object-contain"
                        />
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Live Status indicator */}
                        <div className="flex items-center gap-2 bg-slate-50 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-slate-100 shadow-sm">
                            <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${
                                currentStatus === "Active" ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                                currentStatus === "On Break" ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" :
                                currentStatus === "Idle" ? "bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)]" : "bg-slate-300"
                            }`} />
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {currentStatus === "Active" ? "Working" : currentStatus === "Idle" ? "Idle" : currentStatus}
                            </span>
                        </div>

                        <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 hover:text-brand-blue hover:bg-brand-blue/5 transition-all duration-300 relative">
                            <FiBell size={16} />
                            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-peacock" />
                        </button>

                        <div className="h-5 sm:h-6 w-px bg-slate-200" />

                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-md shrink-0">
                                {userInitials}
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-sm font-bold text-slate-800 leading-tight">{userName}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{userRole}</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                const confirmLogout = confirm("Are you sure you want to log out? Logging out will end your shift and block logins for the rest of today!");
                                if (confirmLogout) {
                                    handleLogout();
                                }
                            }}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300 cursor-pointer active:scale-95"
                            title="Log Out"
                        >
                            <FiLogOut size={16} />
                        </button>
                    </div>
                </header>

                {/* Dashboard Main Viewport */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-5 sm:gap-8 max-w-7xl mx-auto w-full relative">
                    
                    {/* Screenshot Telemetry Notification Toast */}
                    {screenNotification.show && (
                        <div className="fixed top-6 right-6 bg-slate-900/95 text-white border border-slate-800 rounded-3xl p-5 shadow-2xl flex items-center gap-4 animate-fade-in z-50 max-w-sm backdrop-blur-md">
                            <div className="w-11 h-11 rounded-2xl bg-brand-peacock text-white flex items-center justify-center shadow-lg shadow-brand-peacock/20 animate-pulse shrink-0">
                                <FiMonitor size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-black text-brand-peacock uppercase tracking-wider">Telemetry Synchronized</h4>
                                <p className="text-[11px] text-slate-300 mt-1 font-semibold leading-relaxed">
                                    {screenNotification.message}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {/* Exceeded Break Grace Period Warning */}
                    {showGraceAlert && (
                        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 shadow-lg flex items-center gap-4 animate-bounce z-20">
                            <div className="w-12 h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center animate-pulse">
                                <FiAlertTriangle size={24} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-red-800">Auto Logout Alert: Break Exceeded</h4>
                                <p className="text-xs text-red-600 mt-0.5 font-medium leading-relaxed">
                                    Your break allowance has completed. **Move your mouse or type on this page** within <span className="font-extrabold text-red-700 underline tabular-nums">{graceSecondsLeft} seconds</span> to resume shift tracking, or you will be automatically logged out.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Dashboard Tab */}
                    {activeTab === "Dashboard" && (
                        <>
                            {/* Header Welcome banner */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-brand-blue bg-brand-blue/5 border border-brand-blue/10 px-2.5 sm:px-3 py-1 rounded-full">
                                        WORK SHIFT MONITORING
                                    </span>
                                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight mt-2 sm:mt-3">
                                        Welcome Back, {userName.split(" ")[0]}
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                                        Keep track of your shift hours. All offline times are clocked securely.
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold text-slate-500 flex-wrap">
                                    <div className="flex items-center gap-2 bg-white border border-slate-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-sm">
                                        <FiCalendar className="text-brand-blue shrink-0" size={14} />
                                        <span className="text-[10px] sm:text-xs">{currentDate || "Loading..."}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white border border-slate-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-sm min-w-[100px]">
                                        <FiClock className="text-brand-peacock shrink-0" size={14} />
                                        <span className="tabular-nums text-[10px] sm:text-xs">{currentTime || "Loading..."}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Workstation Requirement Notice Banner */}
                            {isMobileDevice && (
                                <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-5 sm:p-6 mb-6 shadow-sm animate-fade-in flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                                        <FiMonitor size={22} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-sm font-black text-amber-900 tracking-tight">
                                                Desktop Workstation Required for WFH Shifts
                                            </h4>
                                            <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white tracking-wider">
                                                Mobile Policy
                                            </span>
                                        </div>
                                        <p className="text-xs text-amber-900/80 font-medium mt-1.5 leading-relaxed">
                                            Work-from-Home compliance protocols require continuous desktop screen sharing and physical workstation telemetry. 
                                            You can browse your personal details, attendance records, profile, and tasks on this mobile device, but <strong>shift start is strictly restricted to desktop and laptop computers</strong> (even in browser Desktop Site mode).
                                        </p>
                                        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-800">
                                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                            <span>Please log in from your laptop or desktop PC to start your shift.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Clock In Control Panel Card */}
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/30 p-6 sm:p-10 relative overflow-hidden transition-all duration-300 hover:shadow-2xl">
                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-blue via-emerald-400 to-brand-peacock" />

                                {isSunday ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 mb-6 shadow-sm animate-bounce">
                                            <FiCoffee size={36} />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Weekly Holiday • Sunday</h3>
                                        <p className="text-sm text-slate-400 max-w-sm mt-2 leading-relaxed">
                                            Rest, recover, and connect with loved ones. Remote shift servers are offline today.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                                        {/* Circular Gauge */}
                                        <div className="lg:col-span-4 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 pb-8 lg:pb-0 lg:pr-8">
                                            <div className="w-44 h-44 relative flex items-center justify-center">
                                                <svg className="w-full h-full transform -rotate-90 select-none">
                                                    <circle cx="88" cy="88" r={radius} stroke="#F8F7FF" strokeWidth="10" fill="transparent" />
                                                    <circle
                                                        cx="88"
                                                        cy="88"
                                                        r={radius}
                                                        stroke="url(#minimalGradient)"
                                                        strokeWidth="10"
                                                        fill="transparent"
                                                        strokeDasharray={circumference}
                                                        strokeDashoffset={isClockedIn ? strokeDashoffset : circumference}
                                                        strokeLinecap="round"
                                                        className="transition-all duration-1000 ease-out"
                                                    />
                                                    <defs>
                                                        <linearGradient id="minimalGradient" x1="1" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#4F46E5" />
                                                            <stop offset="100%" stopColor="#7C3AED" />
                                                        </linearGradient>
                                                    </defs>
                                                </svg>
                                                
                                                <div className="absolute text-center">
                                                    {isClockedIn ? (
                                                        <>
                                                            <span className="text-3xl font-black text-slate-800 tracking-tight block">
                                                                {workPercent.toFixed(0)}%
                                                    </span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                                Goal Completed
                                                            </span>
                                                        </>
                                                    ) : isClockingIn ? (
                                                        <div className="flex flex-col items-center justify-center p-2">
                                                            <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mb-1.5" />
                                                            <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest leading-tight block text-center max-w-[120px]">
                                                                Syncing GPS...
                                                            </span>
                                                        </div>
                                                    ) : isMobileDevice ? (
                                                        <div className="flex flex-col items-center justify-center p-2 cursor-pointer" onClick={() => setShowMobileBlockModal(true)}>
                                                            <FiLock size={20} className="text-amber-500 mb-1" />
                                                            <span className="text-sm font-black text-slate-700 tracking-tight block">
                                                                Desktop Only
                                                            </span>
                                                            <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider block mt-0.5">
                                                                Laptop Required
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button 
                                                                onClick={handleClockInToggle}
                                                                className="text-lg font-extrabold text-brand-blue hover:text-brand-blue/80 transition-colors tracking-tight block cursor-pointer outline-none bg-transparent border-none"
                                                            >
                                                                Start Shift
                                                            </button>
                                                            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block mt-0.5">
                                                                Ready To Start
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {isClockedIn && (
                                                <div className="mt-5 space-y-2 w-full max-w-[200px]">
                                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-full px-4 py-1.5 shadow-sm">
                                                        <div className="flex items-center gap-1.5">
                                                            <FiActivity className="text-brand-peacock" size={12} />
                                                            <span className="text-[11px] font-bold text-slate-600">Productivity:</span>
                                                        </div>
                                                        <span className="text-[11px] font-black text-slate-800">{productivityScore === null ? "--" : `${productivityScore}%`}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Shift timer details */}
                                        <div className="lg:col-span-8 flex flex-col justify-between h-full space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-800">
                                                        {isClockedIn ? "Active WFH Session" : "Shift System Offline"}
                                                    </h3>
                                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                                        {isClockedIn ? "Work session active. Background tracking enabled." : "Clock in to start tracking your daily work goals."}
                                                    </p>
                                                </div>
                                                {isClockedIn && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                                                        <span className="text-[9px] font-bold bg-green-50 border border-green-100 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                            Monitoring Live
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Timer display card */}
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 relative overflow-hidden">
                                                <div className="flex justify-between items-center gap-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Time Remaining</p>
                                                        <p className={`text-3xl font-black tracking-tight mt-1.5 tabular-nums ${isClockedIn && currentStatus === "Active" ? "animate-pulse text-brand-blue" : "text-slate-600"}`}>
                                                            {isClockedIn ? formatTime(remainingTime) : "00h : 00m : 00s"}
                                                        </p>
                                                    </div>

                                                    {isClockedIn && clockInTime && (
                                                        <div className="text-center bg-brand-blue/5 border border-brand-blue/10 px-4 py-2 rounded-2xl">
                                                            <p className="text-[9px] font-bold text-brand-blue uppercase tracking-wider">Shift Start</p>
                                                            <p className="text-xs font-black text-slate-700 mt-0.5 tabular-nums">
                                                                {clockInTime}
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Target Goal</p>
                                                        <p className="text-base font-extrabold text-slate-700 mt-1">
                                                            {formatTime(targetSeconds)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {isClockedIn && (
                                                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200/60 text-xs">
                                                        <div className="text-slate-400 font-medium">
                                                            Shift Time Worked: <span className="font-bold text-slate-700 tabular-nums">{formatTime(workTime)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <button 
                                                                type="button"
                                                                onClick={() => setShowBreakPopup(true)}
                                                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-700 hover:underline cursor-pointer bg-transparent border-none outline-none"
                                                            >
                                                                <FiCoffee size={12} className="text-amber-500" />
                                                                Breaks Status
                                                            </button>
                                                            <div className="h-3 w-px bg-slate-200" />
                                                            <div className="flex items-center gap-2">
                                                                <FiShield size={12} className={overtimeGuardActive ? "text-brand-blue" : "text-slate-300"} />
                                                                <span 
                                                                    onClick={() => setOvertimeGuardActive(!overtimeGuardActive)}
                                                                    className="text-[10px] font-bold uppercase tracking-wider text-brand-blue hover:underline cursor-pointer"
                                                                >
                                                                    Overtime Guard: {overtimeGuardActive ? "Active" : "Disabled"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Shift Start / Shift Logout Action Button */}
                                            {isMobileDevice && !isClockedIn ? (
                                                <button
                                                    onClick={() => setShowMobileBlockModal(true)}
                                                    className="w-full py-4 mt-6 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2.5 shadow-sm transition-all duration-300 cursor-pointer border border-amber-200 bg-amber-50/90 text-amber-800 hover:bg-amber-100 hover:border-amber-300 active:scale-[0.98]"
                                                >
                                                    <FiLock size={16} className="text-amber-600" />
                                                    <span>Desktop Workstation Required to Start Shift</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        if (!isClockedIn) {
                                                            handleClockInToggle();
                                                        } else {
                                                            setActiveTab("My Tasks");
                                                            setTimeout(() => {
                                                                alert("Shift Ended! Please submit your Daily PDF Work Report here to complete your shift logout.");
                                                                const uploader = document.getElementById("pdf-uploader-widget");
                                                                uploader?.scrollIntoView({ behavior: "smooth" });
                                                            }, 300);
                                                        }
                                                    }}
                                                    disabled={isClockingIn}
                                                    className={`w-full py-4 mt-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all duration-300 cursor-pointer border ${
                                                        isClockingIn
                                                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                                            : !isClockedIn
                                                            ? "bg-gradient-to-r from-brand-blue to-brand-peacock text-white border-transparent hover:shadow-md hover:shadow-brand-blue/15 hover:scale-[1.01] active:scale-[0.98]"
                                                            : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 hover:shadow active:scale-[0.98]"
                                                    }`}
                                                >
                                                    {isClockingIn ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                                            <span className="animate-pulse">{locationStatusText || "Fetching GPS..."}</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <FiPower size={14} />
                                                            {!isClockedIn ? "Start Shift" : "Shift Logout / End Shift"}
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Inactivity Monitor Bar - Commented Out
                            {isClockedIn && currentStatus !== "Offline" && (
                                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-brand-blue/5 text-brand-blue flex items-center justify-center animate-pulse">
                                                <FiMonitor size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-700">Remote Activity Monitor</h4>
                                                <p className="text-xs text-slate-400 mt-0.5">Autodetects local keystrokes, scrolling, mouse moves, and clicks.</p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inactivity Limit Guard: 7m</span>
                                            <p className="text-sm font-extrabold text-slate-700 mt-0.5 tabular-nums">
                                                Idle Time: {formatCountdown(idleTime)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${
                                                idleTime >= 420 ? "bg-red-500 animate-pulse" :
                                                idleTime >= 315 ? "bg-red-500" :
                                                idleTime >= 140 ? "bg-yellow-500" : "bg-brand-peacock"
                                            }`}
                                            style={{ width: `${Math.min((idleTime / 420) * 100, 100)}%` }}
                                        />
                                    </div>
 
                                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider pt-1">
                                        <span>Active (0s)</span>
                                        <span>Idle Mode Trigger (2m 20s)</span>
                                        <span>Auto-Logout Trigger (7m)</span>
                                    </div>
                                </div>
                            )}
                            */}

                            {/* DYNAMIC WEEKLY SUMMARY CAROUSEL (Dates calculated backwards, today last) */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Weekly Summary • Shift History
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                                    {getLast7Days().map((item, index) => (
                                        <div 
                                            key={index}
                                            className={`bg-white rounded-2xl border p-4 shadow-sm transition-all duration-300 flex flex-col justify-between h-28 ${
                                                item.isToday 
                                                    ? "border-brand-blue ring-2 ring-brand-blue/5 shadow-brand-blue/5 shadow-md" 
                                                    : "border-slate-100/80 hover:border-slate-200"
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-700 uppercase block">{item.day}</span>
                                                    <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">{item.date}</span>
                                                </div>
                                                {item.completed ? (
                                                    <FiCheck className="text-green-500" size={12} />
                                                ) : item.isToday && isClockedIn ? (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
                                                ) : (
                                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                )}
                                            </div>

                                            <div className="mt-3">
                                                <p className="text-xs font-bold text-slate-800 tracking-tight">{item.hrs}</p>
                                                <div className="w-full bg-slate-100 rounded-full h-1 mt-2 overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-1000 ${
                                                            item.completed ? "bg-green-500" : "bg-gradient-to-r from-brand-blue to-brand-peacock"
                                                        }`} 
                                                        style={{ width: `${item.percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Break Tab */}
                    {activeTab === "Break" && (
                        <div className="space-y-6 sm:space-y-8 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                                <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/5 border border-amber-500/10 px-2.5 sm:px-3 py-1 rounded-full">
                                        Shift Break Management
                                    </span>
                                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight mt-2 sm:mt-3">
                                        Your Break Allowance
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                                        Clock breaks to pause your working shift timer. Overstaying breaks triggers Auto-Logout.
                                    </p>
                                </div>
                            </div>

                            {/* Breaks Stat Cards Dashboard Summary (remaining breaks display) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all duration-300">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                        <FiCoffee size={22} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Short Breaks remaining</span>
                                        <h4 className="text-lg font-black text-slate-800 mt-1">{shortBreaksLeft} of 3 Available</h4>
                                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{3 - shortBreaksLeft} breaks used today</p>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all duration-300">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                                        <FiActivity size={22} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Lunch Break status</span>
                                        <h4 className="text-lg font-black text-slate-800 mt-1">
                                            {lunchBreakUsed ? "Completed / Used" : new Date().getHours() < 13 ? "Locked until 1:00 PM" : "Available"}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Duration: 45 Mins</p>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4 sm:col-span-2 md:col-span-1 hover:shadow-md transition-all duration-300">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-peacock/10 text-brand-peacock flex items-center justify-center">
                                        <FiClock size={22} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Active Break State</span>
                                        <h4 className="text-lg font-black text-slate-800 mt-1">
                                            {currentStatus === "On Break" ? `On ${activeBreakType} Break` : "Working / Shift Active"}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                            {currentStatus === "On Break" ? "Shift timer is paused" : "Session monitored live"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Live Break countdown */}
                            {currentStatus === "On Break" && (
                                <div className="bg-amber-50/50 border border-amber-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm hover:shadow-md transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 animate-pulse">
                                            <FiCoffee size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-bold text-slate-700">Currently On {activeBreakType} Break</h4>
                                            <p className="text-xs text-slate-400 mt-0.5">Your work timer has been successfully paused.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className="bg-white border border-amber-100 text-amber-500 font-black tracking-tight rounded-2xl px-6 py-3 text-2xl tabular-nums text-center shadow-sm w-full sm:w-auto">
                                            {formatCountdown(breakRemaining)}
                                        </div>
                                        <button
                                            onClick={handleResumeWork}
                                            className="py-4 px-6 rounded-xl font-bold text-xs bg-green-500 text-white hover:bg-green-600 shadow-sm hover:shadow-lg hover:shadow-green-500/10 active:scale-[0.98] transition-all duration-300 whitespace-nowrap cursor-pointer"
                                        >
                                            <FiPlay size={12} className="inline mr-1.5" /> End Break
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 7 Breaks Grid */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Break to Clock In</h4>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                                    {/* Lunch Break (Locked until 1:00 PM) */}
                                    {(() => {
                                        const isLunchLocked = new Date().getHours() < 13;
                                        return (
                                            <div 
                                                onClick={triggerLunchBreak}
                                                className={`rounded-2xl border p-4 shadow-sm flex flex-col justify-between h-32 transition-all duration-300 relative overflow-hidden group select-none ${
                                                    !isClockedIn
                                                        ? "bg-slate-50/50 border-slate-100 text-slate-300 cursor-not-allowed"
                                                        : isLunchLocked
                                                        ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-75"
                                                        : lunchBreakUsed && activeBreakType !== "Lunch"
                                                        ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                                                        : activeBreakType === "Lunch"
                                                        ? "border-amber-400 ring-2 ring-amber-500/10 bg-amber-50/20"
                                                        : "bg-white border-slate-100 hover:border-brand-blue hover:shadow-md cursor-pointer"
                                                }`}
                                                title={isLunchLocked ? "Locked until 1:00 PM" : ""}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">45 Mins</span>
                                                    {isLunchLocked ? (
                                                        <FiLock className="text-slate-400" size={12} />
                                                    ) : lunchBreakUsed && activeBreakType !== "Lunch" ? (
                                                        <FiCheck className="text-green-500" size={14} />
                                                    ) : activeBreakType === "Lunch" ? (
                                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                                                    )}
                                                </div>
                                                
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 leading-tight">Lunch Break</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                                        {isLunchLocked ? "Locked until 1:00 PM" : "1:00 PM - 1:45 PM"}
                                                    </p>
                                                </div>

                                                {activeBreakType === "Lunch" && (
                                                    <div className="absolute inset-0 bg-amber-500 text-white flex flex-col items-center justify-center p-3 text-center">
                                                        <FiClock size={18} className="animate-spin" />
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1.5">Ticking</p>
                                                        <p className="text-sm font-black tabular-nums mt-0.5">{formatCountdown(breakRemaining)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* 3 Short breaks */}
                                    {[1, 2, 3].map((idx) => {
                                        const isUsed = idx > shortBreaksLeft;
                                        const isActive = activeBreakType === "Short" && (idx === shortBreaksLeft + 1);
                                        
                                        return (
                                            <div 
                                                key={idx}
                                                onClick={triggerShortBreak}
                                                className={`rounded-2xl border p-4 shadow-sm flex flex-col justify-between h-32 transition-all duration-300 relative overflow-hidden group select-none ${
                                                    !isClockedIn
                                                        ? "bg-slate-50/50 border-slate-100 text-slate-300 cursor-not-allowed"
                                                        : isUsed && !isActive
                                                        ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                                                        : isActive
                                                        ? "border-amber-400 ring-2 ring-amber-500/10 bg-amber-50/20"
                                                        : "bg-white border-slate-100 hover:border-brand-peacock hover:shadow-md cursor-pointer"
                                                }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">15 Mins</span>
                                                    {isUsed && !isActive ? (
                                                        <FiCheck className="text-green-500" size={14} />
                                                    ) : isActive ? (
                                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-peacock" />
                                                    )}
                                                </div>
 
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 leading-tight">Short Break</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Break {idx}</p>
                                                </div>

                                                {isActive && (
                                                    <div className="absolute inset-0 bg-amber-500 text-white flex flex-col items-center justify-center p-3 text-center">
                                                        <FiCoffee size={18} className="animate-bounce" />
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1.5">On Break</p>
                                                        <p className="text-sm font-black tabular-nums mt-0.5">{formatCountdown(breakRemaining)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SMART INTERACTIVE TASK PLANNER TAB */}
                    {activeTab === "My Tasks" && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                                <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-brand-blue bg-brand-blue/5 border border-brand-blue/10 px-2.5 sm:px-3 py-1 rounded-full">
                                        Shift Operations Planning
                                    </span>
                                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight mt-2 sm:mt-3">
                                        Daily Task Planner
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                                        Assign your work plans before the 59-minute timer expires, and check items to lock logs.
                                    </p>
                                </div>

                                {/* Dynamic 59-Minute Task-Assignment Countdown Alert */}
                                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-sm transition-all duration-300 ${
                                    !isClockedIn ? "bg-slate-50 border-slate-100 text-slate-400" :
                                    isTaskLocked ? "bg-red-50 border-red-200 text-red-600 animate-pulse" : "bg-brand-peacock/5 border-brand-peacock/20 text-brand-peacock"
                                }`}>
                                    {isTaskLocked ? <FiLock size={16} /> : <FiClock size={16} />}
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-wider">Assignment Timer</p>
                                        <p className="text-sm font-black tabular-nums mt-0.5">
                                            {!isClockedIn ? "00:00" : isTaskLocked ? "LOCKED / TIMED OUT" : formatCountdown(taskAssignTime)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Core Planner Board Card */}
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 sm:p-8 space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <h4 className="text-sm font-bold text-slate-700">Today's Active Task List</h4>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Press ENTER inside fields to append new tasks
                                    </span>
                                </div>

                                {!isClockedIn ? (
                                    /* Offline Warning */
                                    <div className="flex flex-col items-center justify-center py-10 text-center">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100 mb-4">
                                            <FiPower size={24} />
                                        </div>
                                        <h5 className="text-sm font-bold text-slate-700">Clock In Required</h5>
                                        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                                            Please Clock In from the main Dashboard tab to activate your 30-minute task assignment timer.
                                        </p>
                                    </div>
                                ) : (
                                    /* Active dynamic inputs list */
                                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                                        {tasks.map((task, index) => {
                                            const isActiveHighlight = task.id === activeHighlightTaskId;
                                            return (
                                                <div 
                                                    key={task.id}
                                                    className={`flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300 ${
                                                        isActiveHighlight 
                                                            ? "border-brand-peacock/60 ring-4 ring-brand-peacock/5 bg-brand-peacock/5 shadow-sm" 
                                                            : task.completed 
                                                            ? "bg-slate-50/50 border-slate-200/60 opacity-70"
                                                            : "border-slate-100 bg-white hover:border-slate-200"
                                                    }`}
                                                >
                                                    {/* Number index (Brand Blue color text) */}
                                                    <span className="text-xs font-extrabold text-brand-blue w-5 text-right">{index + 1}.</span>

                                                    {/* Custom Checkbox locking trigger */}
                                                    <button
                                                        type="button"
                                                        onClick={() => !task.completed && task.text.trim() !== "" && handleTaskCompleteToggle(task.id)}
                                                        disabled={task.completed || task.text.trim() === ""}
                                                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all duration-300 outline-none ${
                                                            task.completed 
                                                                ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-500/20" 
                                                                : task.text.trim() === ""
                                                                ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                                                                : "border-slate-300 bg-white hover:border-brand-peacock cursor-pointer"
                                                        }`}
                                                    >
                                                        {task.completed && <FiCheck size={14} className="stroke-[3]" />}
                                                    </button>

                                                    {/* Editable / Locked text input */}
                                                    <input
                                                        id={`task-input-${task.id}`}
                                                        type="text"
                                                        placeholder={isTaskLocked ? "Assignment time expired." : "What will you work on today? (Type and press Enter)"}
                                                        value={task.text}
                                                        onChange={(e) => handleTaskChange(task.id, e.target.value)}
                                                        onKeyDown={(e) => handleTaskKeyDown(e, task.id, index)}
                                                        disabled={task.completed || isTaskLocked || !String(task.id).startsWith("temp-")}
                                                        className={`flex-1 bg-transparent outline-none text-sm font-semibold transition-all ${
                                                            task.completed 
                                                                ? "text-slate-400 line-through" 
                                                                : "text-slate-700 placeholder-slate-300"
                                                        }`}
                                                    />

                                                    {/* Live completion timestamp display */}
                                                    {task.completed && task.completedAt && (
                                                        <span className="text-[10px] font-bold text-green-500 uppercase bg-green-50 border border-green-100 rounded-full px-3 py-1 shadow-sm shrink-0">
                                                            {task.completedAt}
                                                        </span>
                                                    )}

                                                    {/* Lock indicator */}
                                                    {(isTaskLocked || !String(task.id).startsWith("temp-")) && !task.completed && (
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 flex items-center gap-1 shrink-0">
                                                            <FiLock size={8} /> Locked
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* PDF Work Report Uploader Widget */}
                            <div id="pdf-uploader-widget" className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 sm:p-8 space-y-5">
                                <h4 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-3">Daily PDF Work Report Upload</h4>
                                
                                {!isClockedIn ? (
                                    <p className="text-xs text-slate-400 font-medium">Please Clock In first to activate shift report uploads.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                        
                                        {/* Dynamic Drag-box clickable uploader */}
                                        <div className="relative border-2 border-dashed border-slate-200 hover:border-brand-blue/70 rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer group bg-slate-50/50 hover:bg-white select-none">
                                            <input 
                                                type="file" 
                                                accept=".pdf"
                                                onChange={handlePdfUpload}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={isUploadingPdf}
                                            />
                                            
                                            <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 text-brand-blue flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-sm">
                                                <FiUploadCloud size={24} />
                                            </div>

                                            <h5 className="text-xs font-bold text-slate-700 mt-3">
                                                {isUploadingPdf ? "Uploading Document..." : "Click to select or drag PDF Daily Report"}
                                            </h5>
                                            <p className="text-[10px] text-slate-400 font-medium mt-1">Only PDF formats allowed up to 10 MB.</p>
                                        </div>

                                        {/* Status results panel */}
                                        <div className="flex flex-col justify-center">
                                            {isUploadingPdf ? (
                                                /* Loading spinner */
                                                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 animate-pulse">
                                                    <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-xs font-bold text-slate-600">Uploading Daily PDF Report...</span>
                                                </div>
                                            ) : pdfFile ? (
                                                /* Uploaded success indicators */
                                                <div className="bg-green-50/50 border border-green-200 rounded-2xl p-5 space-y-3 shadow-sm animate-fade-in">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center shadow-md shadow-green-500/20">
                                                            <FiFileText size={20} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h5 className="text-xs font-bold text-slate-700 truncate leading-tight">{pdfFile.name}</h5>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">{pdfFile.size} • {pdfFile.uploadedAt}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-100/50 border border-green-200 rounded-full px-3 py-1 shadow-sm w-fit uppercase tracking-wider">
                                                        <FiCheck size={10} className="stroke-[3]" /> Uploaded Successfully
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Empty indicator */
                                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-3 text-slate-400">
                                                    <FiFileText size={22} />
                                                    <p className="text-xs font-medium">No report file uploaded yet today.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Submit Shift & Tasks Button */}
                                {isClockedIn && (
                                    <div className="mt-8 flex justify-center">
                                        <button
                                            onClick={handleSubmitShift}
                                            className="w-full sm:w-[350px] bg-gradient-to-r from-brand-blue to-brand-peacock text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-blue/15 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer text-center text-sm flex items-center justify-center gap-2 outline-none"
                                        >
                                            <FiCheckSquare size={18} />
                                            Submit My Task & Complete Shift
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CURSOR & ACTIVITY TRACKING - Commented out cursor tracking tab layout */}

                    {/* Screen Telemetry Tab */}
                    {activeTab === "Screen Telemetry" && (
                        <div className="space-y-6 sm:space-y-8 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                                <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-brand-blue bg-brand-blue/5 border border-brand-blue/10 px-2.5 sm:px-3 py-1 rounded-full">
                                        Compliance Telemetry
                                    </span>
                                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight mt-2 sm:mt-3">
                                        Background Screen Capture
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                                        Automatic screenshots are captured every 30 minutes, even when minimized, and uploaded directly to Admin audits.
                                    </p>
                                </div>
                            </div>

                            {/* Header Telemetry Status Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                
                                {/* Status Card */}
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center gap-5 hover:shadow-md transition-all duration-300">
                                    <div className="w-14 h-14 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center shadow-inner shrink-0">
                                        <FiShield size={26} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Screen Tracker Status</span>
                                        <h4 className="text-lg font-black text-slate-800 mt-1">
                                            {isClockedIn ? "Active & Protected" : "Inactive / Offline"}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                            {isClockedIn ? "Desktop agent connected" : "Start shift to connect agent"}
                                        </p>
                                    </div>
                                </div>

                                {/* Timer / Countdown Card */}
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center gap-5 hover:shadow-md transition-all duration-300">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shadow-inner shrink-0">
                                        <FiClock size={26} />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Next Scheduled Capture</span>
                                        <h4 className="text-lg font-black text-brand-blue mt-1 tabular-nums">
                                            {isClockedIn ? formatCountdown(screenCountdown) : "--h : --m"}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Interval: 30 minutes</p>
                                    </div>
                                </div>

                                {/* Total Captured Card */}
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center gap-5 hover:shadow-md transition-all duration-300">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-peacock/10 text-brand-peacock flex items-center justify-center shadow-inner shrink-0">
                                        <FiMonitor size={26} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Total Uploads Today</span>
                                        <h4 className="text-lg font-black text-slate-800 mt-1">{screenshots.length} Screenshots</h4>
                                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Verified & Encrypted</p>
                                    </div>
                                </div>

                            </div>

                            {/* Professional Guidelines Card (Simulation Removed) */}
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 sm:p-8 space-y-6">
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs text-slate-600 font-semibold leading-relaxed flex items-start gap-4 animate-fade-in">
                                    <div className="w-10 h-10 rounded-xl bg-brand-peacock/10 text-brand-peacock flex items-center justify-center shrink-0 shadow-sm mt-1">
                                        💡
                                    </div>
                                    <div>
                                        <h5 className="font-extrabold text-slate-800 text-sm">How WFH Background Screenshot Telemetry Works</h5>
                                        <p className="text-slate-400 mt-1 font-medium leading-relaxed">
                                            1. The lightweight **Desktop Companion Agent** runs silently in your system tray.<br />
                                            2. Every **2 minutes**, it automatically captures a secure snapshot of your primary display screen, even when the portal is minimized or in the background.<br />
                                            3. It detects the active application name (e.g. *VS Code*, *Slack*) and bundles it with the image.<br />
                                            4. The payload is securely uploaded to the Admin dashboard, and you receive an instant floating notification to verify compliance status.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Screenshots Log Feed */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Captured Screen Timeline (Today)</h3>
                                
                                {screenshots.length === 0 ? (
                                    <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center text-slate-400 font-bold text-xs uppercase tracking-wider">
                                        No screenshot logs registered. Clock in to initiate background captures.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        {screenshots.map((ss) => (
                                            <div key={ss.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group">
                                                {/* Image Panel */}
                                                <div className="h-44 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                                                    <img 
                                                        src={ss.imageUrl} 
                                                        alt="Telemetry screenshot" 
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 bg-slate-950/20 pointer-events-none" />
                                                    
                                                    {/* Uploaded Indicator badge */}
                                                    <span className="absolute top-4 right-4 text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-green-500/90 text-white shadow-md backdrop-blur-sm flex items-center gap-1">
                                                        <FiCheck size={9} /> {ss.status}
                                                    </span>
                                                </div>

                                                {/* Metadata panel */}
                                                <div className="p-5 flex-1 flex flex-col justify-between space-y-3 bg-white">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Active Desktop App</span>
                                                        <h4 className="text-xs font-black text-slate-700 mt-1 leading-normal truncate" title={ss.activeWindow}>
                                                            {ss.activeWindow}
                                                        </h4>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <span>Time: <span className="text-slate-600 font-extrabold tabular-nums">{ss.timestamp}</span></span>
                                                        <span className="text-brand-peacock">Compliance Verified</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    )}

                    {activeTab === "Attendance Logs" && (
                        <div className="space-y-6 sm:space-y-8 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                                <div>
                                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-brand-blue bg-brand-blue/5 border border-brand-blue/10 px-2.5 sm:px-3 py-1 rounded-full">
                                        Personal Records
                                    </span>
                                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight mt-2 sm:mt-3">
                                        My Attendance History
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                                        Chronological log of your clocked shifts, resolved physical locations, and task completions.
                                    </p>
                                </div>
                            </div>

                            {shiftHistory.length === 0 ? (
                                <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center text-slate-400 font-bold text-xs uppercase tracking-wider">
                                    No shifts recorded in your history.
                                </div>
                            ) : (
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-widest bg-slate-50">
                                                <th className="py-4 px-5">Date</th>
                                                <th className="py-4 px-5">Clock In</th>
                                                <th className="py-4 px-5">Clock Out</th>
                                                <th className="py-4 px-5">Status</th>
                                                <th className="py-4 px-5">Start Location</th>
                                                <th className="py-4 px-5">End Location</th>
                                                <th className="py-4 px-5 text-center">Breaks</th>
                                                <th className="py-4 px-5 text-center">Tasks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                                            {shiftHistory.map((s) => {
                                                const startDate = new Date(s.shiftStartTime).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric"
                                                });
                                                const clockInTime = new Date(s.shiftStartTime).toLocaleTimeString("en-US", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    hour12: true
                                                });
                                                const clockOutTime = s.shiftEndTime ? new Date(s.shiftEndTime).toLocaleTimeString("en-US", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    hour12: true
                                                }) : "--:--";

                                                const tasksCount = s.tasks ? s.tasks.length : 0;
                                                const completedTasks = s.tasks ? s.tasks.filter((t: any) => t.completed).length : 0;
                                                const breaksCount = s.breaks ? s.breaks.length : 0;

                                                return (
                                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 px-5 font-bold text-slate-800">{startDate}</td>
                                                        <td className="py-4 px-5 tabular-nums">{clockInTime}</td>
                                                        <td className="py-4 px-5 tabular-nums">
                                                            {s.status === "Active" ? (
                                                                <span className="text-slate-400">Ongoing</span>
                                                            ) : clockOutTime}
                                                        </td>
                                                        <td className="py-4 px-5">
                                                            {s.status === "Active" ? (
                                                                <span className="text-green-500 font-extrabold uppercase text-[9px] px-2 py-0.5 rounded-md bg-green-50 border border-green-200">Active</span>
                                                            ) : s.status === "Absent" ? (
                                                                <span className="text-red-500 font-extrabold uppercase text-[9px] px-2 py-0.5 rounded-md bg-red-50 border border-red-200" title="Shift unclosed or marked absent">Absent</span>
                                                            ) : s.status === "Half Day" ? (
                                                                <span className="text-amber-500 font-extrabold uppercase text-[9px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">Half Day</span>
                                                            ) : (
                                                                <span className="text-brand-blue font-extrabold uppercase text-[9px] px-2 py-0.5 rounded-md bg-brand-blue/5 border border-brand-blue/10">Present</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-5 max-w-[150px] truncate text-slate-500 text-[10px]" title={s.startAddress}>{s.startAddress || "N/A"}</td>
                                                        <td className="py-4 px-5 max-w-[150px] truncate text-slate-500 text-[10px]" title={s.endAddress}>{s.endAddress || "--"}</td>
                                                        <td className="py-4 px-5 text-center text-slate-500">{breaksCount} used</td>
                                                        <td className="py-4 px-5 text-center">
                                                            <span className="bg-slate-100 text-slate-600 text-[10px] px-2.5 py-1 rounded-full font-bold">
                                                                {completedTasks}/{tasksCount}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Profile Tab */}
                    {activeTab === "Profile" && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="border-b border-slate-100 pb-5">
                                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-brand-peacock bg-brand-peacock/5 border border-brand-peacock/10 px-2.5 sm:px-3 py-1 rounded-full">
                                    Employee Profile Details
                                </span>
                                <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight mt-2 sm:mt-3">
                                    {userName}
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                                    Review your remote employee credentials, scheduled hours, and connection status.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-6 flex flex-col">
                                    {/* Profile Avatar Card */}
                                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col items-center text-center space-y-4">
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-4xl shadow-lg shadow-brand-blue/15">
                                            {userInitials}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-slate-800">{userName}</h4>
                                            <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5">{userRole}</p>
                                        </div>
                                        
                                        <div className="w-full pt-4 border-t border-slate-100 text-xs space-y-2 text-slate-500">
                                            <div className="flex justify-between">
                                                <span className="font-medium">Shift Status:</span>
                                                <span className={`font-bold uppercase tracking-wider ${isClockedIn ? "text-green-500" : "text-slate-400"}`}>
                                                    {isClockedIn ? "Online" : "Offline"}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-medium">User Role:</span>
                                                <span className="font-bold text-slate-700">Remote Employee</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* High Fidelity Change Password Card */}
                                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Change Password</h4>
                                        <div className="space-y-3.5">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Current Password</label>
                                                <input 
                                                    type="password" 
                                                    placeholder="••••••••" 
                                                    value={currentPass}
                                                    onChange={(e) => setCurrentPass(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-300 outline-none focus:border-brand-blue transition-all duration-200 text-xs font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">New Password</label>
                                                <input 
                                                    type="password" 
                                                    placeholder="••••••••" 
                                                    value={newPass}
                                                    onChange={(e) => setNewPass(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-300 outline-none focus:border-brand-blue transition-all duration-200 text-xs font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Confirm Password</label>
                                                <input 
                                                    type="password" 
                                                    placeholder="••••••••" 
                                                    value={confirmPass}
                                                    onChange={(e) => setConfirmPass(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-300 outline-none focus:border-brand-blue transition-all duration-200 text-xs font-medium"
                                                />
                                            </div>

                                            <button
                                                onClick={handleChangePassword}
                                                className="w-full bg-gradient-to-r from-brand-blue to-brand-peacock text-white py-2.5 rounded-xl font-bold hover:shadow hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 cursor-pointer text-xs flex items-center justify-center outline-none"
                                            >
                                                Update Password
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:col-span-2 space-y-6">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Workspace Connection Details</h4>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-600">
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Target Hours</p>
                                            <p className="text-base font-extrabold text-slate-700 mt-1">08h : 29m : 59s (Compliance Target)</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System IP Address</p>
                                            <p className="text-base font-extrabold text-slate-700 mt-1 tabular-nums">{systemIp}</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inactivity Security Timeout</p>
                                            <p className="text-base font-extrabold text-slate-700 mt-1">7 Minutes (Enabled)</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daily Break Allowance</p>
                                            <p className="text-base font-extrabold text-slate-700 mt-1">Lunch (45m) • 3 Short Breaks (15m each)</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="h-12 border-t border-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-auto select-none pointer-events-none flex-shrink-0">
                    © 2026 company@demo
                </footer>
            </div>

            {/* Elegant Glassmorphic Break Status Popup Modal */}
            {showBreakPopup && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-sm w-full relative overflow-hidden transition-all transform scale-100">
                        {/* Colorful header band */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-amber-500" />
                        
                        <div className="flex items-center gap-3.5 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                <FiCoffee size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Daily Break Status</h3>
                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Dashboard Quick-Check</p>
                            </div>
                        </div>

                        {/* Breaks detailed metrics inside popup */}
                        <div className="space-y-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-xs text-slate-600 font-semibold leading-relaxed">
                            <div className="flex items-center justify-between border-b border-slate-200/50 pb-2.5">
                                <span className="text-slate-500">Short Breaks Used:</span>
                                <span className="font-extrabold text-slate-800">{3 - shortBreaksLeft} of 3</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-200/50 pb-2.5">
                                <span className="text-slate-500">Short Breaks Left:</span>
                                <span className={`font-black ${shortBreaksLeft > 0 ? "text-green-500" : "text-red-500"}`}>
                                    {shortBreaksLeft > 0 ? `${shortBreaksLeft} Remaining` : "No breaks remaining"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Lunch Break Status:</span>
                                <span className={`font-extrabold ${lunchBreakUsed ? "text-slate-400" : "text-brand-blue"}`}>
                                    {lunchBreakUsed ? "Used Today" : "Available"}
                                </span>
                            </div>
                        </div>

                        {/* Interactive dynamic summary description based on exact user requests */}
                        <div className="text-xs text-slate-500 font-medium mb-6 text-center leading-relaxed">
                            {shortBreaksLeft === 3 && !lunchBreakUsed && (
                                <p className="bg-green-50 border border-green-100 text-green-700 px-4 py-2.5 rounded-2xl">
                                    ✨ <strong>All breaks remaining!</strong> You have 3 Short Breaks remaining and 0 used. Lunch Break is Available.
                                </p>
                            )}
                            {shortBreaksLeft === 2 && (
                                <p className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-2.5 rounded-2xl">
                                    ☕ <strong>2 remaining, 1 used.</strong> Lunch Break is {lunchBreakUsed ? "Used" : "Available"}.
                                </p>
                            )}
                            {shortBreaksLeft === 1 && (
                                <p className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-2.5 rounded-2xl">
                                    ☕ <strong>1 remaining, 2 used.</strong> Lunch Break is {lunchBreakUsed ? "Used" : "Available"}.
                                </p>
                            )}
                            {shortBreaksLeft === 0 && !lunchBreakUsed && (
                                <p className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-2.5 rounded-2xl">
                                    ⚠️ <strong>No short breaks remaining</strong> (3 used). However, your 45-min Lunch Break is still Available!
                                </p>
                            )}
                            {shortBreaksLeft === 0 && lunchBreakUsed && (
                                <p className="bg-red-50 border border-red-100 text-red-700 px-4 py-2.5 rounded-2xl">
                                    🚫 <strong>No breaks remaining!</strong> All short breaks and lunch break have been used for today.
                                </p>
                            )}
                        </div>

                        <button 
                            onClick={() => setShowBreakPopup(false)}
                            className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-900 active:scale-[0.98] transition-all text-xs cursor-pointer shadow-sm shadow-slate-900/10 text-center"
                        >
                            Close Break Status
                        </button>
                    </div>
                </div>
            )}
            {/* Strict Compliance Screen Share Re-Sync Blocker Overlay */}
            {showScreenSyncModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] flex items-center justify-center p-6 select-none animate-fade-in">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden transition-all transform scale-100">
                        {/* Red danger header band */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />
                        
                        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-6 border border-red-100">
                            <FiMonitor size={32} />
                        </div>
                        
                        <h3 className="text-lg font-black text-slate-800 tracking-tight mb-2">
                            ⚠️ Screen Share Connection Required
                        </h3>
                        
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">
                            Compliance Monitoring Telemetry
                        </p>
                        
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
                            To comply with work-from-home policy requirements, you must keep your desktop screen shared. Access to the dashboard is blocked until screen sharing is re-synced.
                        </p>
                        
                        <button
                            onClick={handleReSyncScreen}
                            className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white font-extrabold py-4 rounded-xl active:scale-[0.98] transition-all text-xs tracking-widest uppercase cursor-pointer shadow-md shadow-brand-blue/15"
                        >
                            Sync Screen Sharing
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile Workstation Policy Strict Compliance Modal */}
            {showMobileBlockModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] flex items-center justify-center p-5 select-none animate-fade-in">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 sm:p-8 max-w-md w-full text-center relative overflow-hidden transition-all transform scale-100">
                        {/* Top Amber Band */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-500" />
                        
                        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-5 border border-amber-100 shadow-inner">
                            <FiMonitor size={32} />
                        </div>
                        
                        <h3 className="text-lg font-black text-slate-800 tracking-tight mb-1">
                            Desktop Workstation Required
                        </h3>
                        
                        <span className="inline-block text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full mb-4">
                            Shift Initiation Policy
                        </span>
                        
                        <div className="text-xs text-slate-600 font-medium leading-relaxed mb-6 text-left bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                            <p>
                                WorkTrack Pro compliance protocols require <strong>continuous desktop screen sharing</strong> and <strong>physical workstation telemetry</strong> to record active WFH shifts.
                            </p>
                            <p>
                                Starting a shift from a mobile phone, tablet, or mobile browser (<strong>including Desktop Site mode</strong>) is strictly disabled.
                            </p>
                            <p className="text-amber-800 font-bold">
                                Please open this portal on your <strong>laptop or desktop PC</strong> to start your shift. You may continue to use this mobile device to review your profile, tasks, and attendance records.
                            </p>
                        </div>
                        
                        <button
                            onClick={() => setShowMobileBlockModal(false)}
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-3.5 rounded-xl active:scale-[0.98] transition-all text-xs tracking-wider uppercase cursor-pointer shadow-md"
                        >
                            Understood, I will use Desktop
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeDashboard;
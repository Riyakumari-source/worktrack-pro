import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "@/utils/socket";
import { 
    FiBell, 
    FiLogOut, 
    FiSearch, 
    FiActivity, 
    FiCheck, 
    FiCoffee, 
    FiClock, 
    FiUser, 
    FiShield, 
    FiFileText, 
    FiMonitor, 
    FiCalendar, 
    FiCheckSquare,
    FiGrid,
    FiLock,
    FiX,
    FiEye,
    FiCompass,
    FiMapPin,
    FiTv,
    FiMaximize2,
    FiRefreshCw,
    FiRadio,
    FiMenu,
    FiArrowLeft
} from "react-icons/fi";
import { API_BASE_URL } from "../config";
import { LiveScreenModal } from "@/components/LiveScreenModal";
import { mapName } from "@/utils/nameMapper";

interface EmployeeAuditData {
    employeeId: string;
    name: string;
    avatar: string;

    role: string;
    isWfhActive: boolean;
    wfhDaysCount: number;
    currentStatus: "Active" | "On Break" | "Offline" | "Idle";
    cursorStatus: "Moving" | "Stopped" | "Offline";
    shiftStartTime?: string;
    shiftStartTimeRaw?: string;
    shiftEndTime?: string;
    shiftEndTimeRaw?: string;
    shiftStatus?: string;
    shiftDateRaw?: string;      // YYYY-MM-DD for date grouping
    shiftDateLabel?: string;    // e.g. "Sep 8, 2026" for display
    latestScreenshot?: {
        id: string;
        imageUrl: string;
        activeWindow: string;
        capturedAt: string;
        status: string;
    } | null;
    breaks: {
        shortBreaksLeft: number;
        lunchBreakUsed: boolean;
        totalDuration: string;
        history: { name: string; time: string; status: "Used" | "Available" | "Locked" }[];
    };
    tasks: {
        text: string;
        completed: boolean;
        completedAt?: string;
    }[];
    pdfReport: {
        name: string;
        size: string;
        uploadedAt: string;
    } | null;
    activityLogs: string[];
    latestCoordinate: { x: number; y: number };
    latitude?: number | null;
    longitude?: number | null;
    startAddress?: string | null;
    locationFetchedAt?: string | null;
    endLatitude?: number | null;
    endLongitude?: number | null;
    endAddress?: string | null;
    endLocationFetchedAt?: string | null;
}
 
const AdminDashboard = () => {
    const navigate = useNavigate();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    
    const adminName = sessionStorage.getItem("wfh_user_name") || "Admin Portal";
    const adminRole = sessionStorage.getItem("wfh_user_role") || "Admin";
    const token = sessionStorage.getItem("wfh_auth_token") || "";
    const adminInitials = adminName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "AD";

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEmpId, setSelectedEmpId] = useState("");
    const [activeMenu, setActiveMenu] = useState("Overview");
    const [mobileEmployeeTab, setMobileEmployeeTab] = useState<"list" | "details">("list");
 
    // Selected employee details modal popup
    const [detailsModalEmp, setDetailsModalEmp] = useState<EmployeeAuditData | null>(null);

    // Live Screen Fullscreen Stream Viewer states
    const [selectedLiveScreenEmp, setSelectedLiveScreenEmp] = useState<EmployeeAuditData | null>(null);
    const [liveScreenStreamUrl, setLiveScreenStreamUrl] = useState<string | null>(null);
    // liveFrames state is throttled (used for grid card display, ~1 update/sec)
    const [liveFrames, setLiveFrames] = useState<Record<string, { frame: string; activeWindow?: string; cursor?: { x: number; y: number }; timestamp: number }>>({});
    // liveFramesRef is for instant access without triggering re-renders
    const liveFramesRef = useRef<Record<string, { frame: string; activeWindow?: string; timestamp: number }>>({});
    // Direct DOM ref for the fullscreen modal <img> — updated imperatively at full 5 FPS
    const modalImgRef = useRef<HTMLImageElement | null>(null);
    const modalActiveBadgeRef = useRef<HTMLSpanElement | null>(null);
    const selectedLiveScreenEmpRef = useRef<EmployeeAuditData | null>(null);
    selectedLiveScreenEmpRef.current = selectedLiveScreenEmp;
    const [isModalFullscreen, setIsModalFullscreen] = useState(false);

    // Zoomed screenshot for admin lightbox
    const [zoomedScreenshot, setZoomedScreenshot] = useState<string | null>(null);

    // Dynamic screenshot tracking for audited employee
    const [employeeScreenshots, setEmployeeScreenshots] = useState<any[]>([]);
    const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false);
 
    // Live Calendar & Clock
    const [currentDate, setCurrentDate] = useState("");
    const [currentTime, setCurrentTime] = useState("");
 
    // Live employees state loaded from database
    const [employees, setEmployees] = useState<EmployeeAuditData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // New states for toggling screenshots and paging inside the Screenshots tab
    const [screenshotTabFilter, setScreenshotTabFilter] = useState<"all" | "active" | "completed">("all");
    const [expandedEmpIds, setExpandedEmpIds] = useState<string[]>([]);
    const [expandedScreenshots, setExpandedScreenshots] = useState<Record<string, {
        screenshots: any[];
        skip: number;
        hasMore: boolean;
        isLoading: boolean;
        totalCount?: number;
    }>>({});

    // New states and fetch for PDF Reports tab
    const [pdfReports, setPdfReports] = useState<any[]>([]);
    const [isLoadingReports, setIsLoadingReports] = useState(false);

    // Historical shifts log states
    const [shiftsLog, setShiftsLog] = useState<any[]>([]);
    const [isLoadingShiftsLog, setIsLoadingShiftsLog] = useState(false);

    const fetchDailyPdfReports = async () => {
        setIsLoadingReports(true);
        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/admin/daily-reports`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.reports) {
                    setPdfReports(data.reports);
                }
            }
        } catch (err) {
            console.error("Failed to fetch daily PDF reports:", err);
        } finally {
            setIsLoadingReports(false);
        }
    };

    const fetchShiftsLog = async () => {
        setIsLoadingShiftsLog(true);
        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/admin/shifts-log`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setShiftsLog(data.shifts || []);
            }
        } catch (err) {
            console.error("Failed to fetch shifts logs:", err);
        } finally {
            setIsLoadingShiftsLog(false);
        }
    };

    useEffect(() => {
        if (activeMenu === "PDF Reports") {
            fetchDailyPdfReports();
        } else if (activeMenu === "Shifts Log") {
            fetchShiftsLog();
        }
    }, [activeMenu]);

    // Helper to format screenshot timestamp with 2-day awareness (Today, Yesterday, or DD Mon)
    const formatRelativeScreenshotTime = (rawDate: string | Date) => {
        if (!rawDate) return "Unknown Date";
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return "Unknown Date";

        const now = new Date();
        const isToday = d.getDate() === now.getDate() &&
                        d.getMonth() === now.getMonth() &&
                        d.getFullYear() === now.getFullYear();

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = d.getDate() === yesterday.getDate() &&
                            d.getMonth() === yesterday.getMonth() &&
                            d.getFullYear() === yesterday.getFullYear();

        const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

        if (isToday) {
            return `Today, ${timeStr}`;
        }
        if (isYesterday) {
            return `Yesterday, ${timeStr}`;
        }
        const dateStr = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
        return `${dateStr}, ${timeStr}`;
    };

    const fetchScreenshotsForEmp = async (employeeId: string, isLoadMore = false) => {
        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const currentData = expandedScreenshots[employeeId] || { screenshots: [], skip: 0, hasMore: false, isLoading: false };
            
            const skip = isLoadMore ? currentData.skip + 12 : 0;
            
            setExpandedScreenshots(prev => ({
                ...prev,
                [employeeId]: {
                    ...currentData,
                    isLoading: true
                }
            }));

            const res = await fetch(`${API_BASE_URL}/api/admin/employee/${employeeId}/screenshots?limit=12&skip=${skip}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                if (data && data.screenshots) {
                    const formatted = data.screenshots.map((ss: any) => {
                        return {
                            id: ss.id,
                            imageUrl: ss.imageUrl.startsWith("/") ? `${API_BASE_URL}${ss.imageUrl}?token=${token}` : ss.imageUrl,
                            timestamp: formatRelativeScreenshotTime(ss.capturedAt),
                            rawCapturedAt: ss.capturedAt,
                            activeWindow: ss.activeWindow,
                            status: ss.status || "Uploaded"
                        };
                    });

                    setExpandedScreenshots(prev => {
                        const existing = prev[employeeId]?.screenshots || [];
                        const newList = isLoadMore ? [...existing, ...formatted] : formatted;
                        return {
                            ...prev,
                            [employeeId]: {
                                screenshots: newList,
                                skip: skip,
                                hasMore: data.hasMore || false,
                                isLoading: false,
                                totalCount: data.totalCount ?? (newList.length)
                            }
                        };
                    });
                }
            }
        } catch (err) {
            console.error("Failed to fetch expanded screenshots for employee:", employeeId, err);
            setExpandedScreenshots(prev => ({
                ...prev,
                [employeeId]: {
                    ...(prev[employeeId] || { screenshots: [], skip: 0, hasMore: false, isLoading: false }),
                    isLoading: false
                }
            }));
        }
    };

    const toggleKeepAnEye = (employeeId: string) => {
        if (expandedEmpIds.includes(employeeId)) {
            setExpandedEmpIds(prev => prev.filter(id => id !== employeeId));
        } else {
            setExpandedEmpIds(prev => [...prev, employeeId]);
            // If we don't have screenshots loaded yet for this employee, fetch them!
            if (!expandedScreenshots[employeeId]) {
                fetchScreenshotsForEmp(employeeId, false);
            }
        }
    };

    useEffect(() => {
        if (activeMenu !== "Screenshots" || expandedEmpIds.length === 0) return;

        const interval = setInterval(() => {
            expandedEmpIds.forEach(id => {
                fetchScreenshotsForEmp(id, false);
            });
        }, 10000); // Auto-refresh screens from database every 10 seconds

        return () => clearInterval(interval);
    }, [activeMenu, expandedEmpIds]);

    const fetchFeed = async () => {
        try {
            const token = sessionStorage.getItem("wfh_auth_token");
            const res = await fetch(`${API_BASE_URL}/api/admin/employees-feed`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.feed) {
                    const formattedFeed = data.feed.map((emp: any) => ({
                        ...emp,
                        latestScreenshot: emp.latestScreenshot ? {
                            ...emp.latestScreenshot,
                            imageUrl: emp.latestScreenshot.imageUrl?.startsWith("/")
                                ? `${API_BASE_URL}${emp.latestScreenshot.imageUrl}?token=${token}`
                                : emp.latestScreenshot.imageUrl
                        } : null
                    }));
                    setEmployees(formattedFeed);
                    // Automatically select the first employee from feed if none is currently selected
                    setSelectedEmpId(current => {
                        if (!current && data.feed.length > 0) {
                            return data.feed[0].employeeId;
                        }
                        return current;
                    });
                }
            }
        } catch (err) {
            console.error("Failed to fetch employees feed:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-refresh single employee live screen modal every 3.5 seconds
    useEffect(() => {
        if (!selectedLiveScreenEmp) {
            setLiveScreenStreamUrl(null);
            return;
        }

        const fetchLatestFrame = async () => {
            try {
                const token = sessionStorage.getItem("wfh_auth_token");
                const res = await fetch(`${API_BASE_URL}/api/admin/employee/${selectedLiveScreenEmp.employeeId}/screenshots?limit=1&skip=0`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.screenshots && data.screenshots.length > 0) {
                        const ss = data.screenshots[0];
                        const img = ss.imageUrl.startsWith("/") ? `${API_BASE_URL}${ss.imageUrl}?token=${token}&t=${Date.now()}` : ss.imageUrl;
                        setLiveScreenStreamUrl(img);
                    }
                }
            } catch (e) {
                console.error("Failed to poll latest screen frame:", e);
            }
        };

        fetchLatestFrame();
        const pollTimer = setInterval(fetchLatestFrame, 3500);
        return () => clearInterval(pollTimer);
    }, [selectedLiveScreenEmp]);

    // Real-time live screen socket subscription for all active employees simultaneously
    useEffect(() => {
        const token = sessionStorage.getItem("wfh_auth_token");
        const role = sessionStorage.getItem("wfh_user_role");
        if (!token || role?.toUpperCase() !== "ADMIN") return;

        const socket = getSocket();
        socket.emit("watch:all");

        // Throttle grid state updates to 1/sec per employee to avoid re-render storm
        const lastGridUpdateRef: Record<string, number> = {};
        const GRID_THROTTLE_MS = 1000;

        const handleLiveFrame = (data: { employeeId: string; frame: string; cursor?: { x: number; y: number }; activeWindow?: string; timestamp?: number }) => {
            if (!data.employeeId || !data.frame) return;
            const now = data.timestamp || Date.now();

            // --- IMPERATIVE UPDATE: fullscreen modal image (no React re-render) ---
            const activeLiveEmp = selectedLiveScreenEmpRef.current;
            if (activeLiveEmp && activeLiveEmp.employeeId === data.employeeId) {
                if (modalImgRef.current) {
                    modalImgRef.current.src = data.frame;
                }
                if (modalActiveBadgeRef.current && data.activeWindow) {
                    modalActiveBadgeRef.current.textContent = data.activeWindow + " • Shift started at: " + (activeLiveEmp.shiftStartTimeRaw
                        ? new Date(activeLiveEmp.shiftStartTimeRaw).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
                        : activeLiveEmp.shiftStartTime || "");
                }
            }

            // Always update the ref store (instant, zero re-render cost)
            liveFramesRef.current[data.employeeId] = {
                frame: data.frame,
                activeWindow: data.activeWindow,
                timestamp: now
            };

            // Throttled state update for the grid cards
            const lastUpdate = lastGridUpdateRef[data.employeeId] || 0;
            if (now - lastUpdate >= GRID_THROTTLE_MS) {
                lastGridUpdateRef[data.employeeId] = now;
                setLiveFrames((prev) => ({
                    ...prev,
                    [data.employeeId]: {
                        frame: data.frame,
                        activeWindow: data.activeWindow,
                        cursor: data.cursor,
                        timestamp: now
                    }
                }));
            }
        };

        socket.on("live:frame", handleLiveFrame);

        // Keep watch:all room active on reconnects
        const pingInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit("watch:all");
            }
        }, 8000);

        return () => {
            socket.off("live:frame", handleLiveFrame);
            clearInterval(pingInterval);
        };
    }, []);

    // Watch specific employee when modal opens
    useEffect(() => {
        if (!selectedLiveScreenEmp) return;
        const socket = getSocket();
        socket.emit("watch:employee", selectedLiveScreenEmp.employeeId);
    }, [selectedLiveScreenEmp]);

    useEffect(() => {
        const token = sessionStorage.getItem("wfh_auth_token");
        const role = sessionStorage.getItem("wfh_user_role");
        if (!token || role?.toUpperCase() !== "ADMIN") {
            navigate("/login");
            return;
        }

        fetchFeed();
        // Poll every 3 seconds for real-time cursor status and break updates!
        const interval = setInterval(fetchFeed, 3000);
        return () => clearInterval(interval);
    }, [navigate]);

    useEffect(() => {
        if (!detailsModalEmp) {
            setEmployeeScreenshots([]);
            return;
        }

        const fetchScreenshots = async () => {
            setIsLoadingScreenshots(true);
            try {
                const token = sessionStorage.getItem("wfh_auth_token");
                const res = await fetch(`${API_BASE_URL}/api/admin/employee/${detailsModalEmp.employeeId}/screenshots`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.screenshots) {
                        const formatted = data.screenshots.map((ss: any) => {
                            return {
                                id: ss.id,
                                imageUrl: ss.imageUrl.startsWith("/") ? `${API_BASE_URL}${ss.imageUrl}?token=${token}` : ss.imageUrl,
                                timestamp: formatRelativeScreenshotTime(ss.capturedAt),
                                rawCapturedAt: ss.capturedAt,
                                activeWindow: ss.activeWindow,
                                status: ss.status || "Uploaded"
                            };
                        });
                        setEmployeeScreenshots(formatted);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch employee screenshots:", err);
            } finally {
                setIsLoadingScreenshots(false);
            }
        };

        fetchScreenshots();
    }, [detailsModalEmp]);

    // Helper to format exact shift time in user/Indian local format with seconds
    const formatShiftTime = (rawTime?: string, formattedFallback?: string) => {
        if (rawTime) {
            try {
                const d = new Date(rawTime);
                if (!isNaN(d.getTime())) {
                    return d.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    });
                }
            } catch (_) {}
        }
        if (formattedFallback) {
            return formattedFallback.replace(/\s*\(.*?\)\s*/, "");
        }
        return "--:--";
    };

    // Helper to calculate live ticking elapsed shift duration
    const getElapsedShiftTime = (rawTime?: string) => {
        if (!rawTime) return "";
        try {
            const start = new Date(rawTime).getTime();
            if (isNaN(start)) return "";
            const diffSecs = Math.max(0, Math.floor((Date.now() - start) / 1000));
            const hrs = Math.floor(diffSecs / 3600);
            const mins = Math.floor((diffSecs % 3600) / 60);
            const secs = diffSecs % 60;
            return `${String(hrs).padStart(2, '0')}h : ${String(mins).padStart(2, '0')}m : ${String(secs).padStart(2, '0')}s`;
        } catch (_) {
            return "";
        }
    };

    // Helper to parse AM/PM time into minutes for chronological sorting
    const parseTime = (tStr: string) => {
        if (!tStr) return 0;
        const match = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return 0;
        let hrs = parseInt(match[1]);
        const mins = parseInt(match[2]);
        const pm = match[3].toUpperCase() === "PM";
        if (pm && hrs < 12) hrs += 12;
        if (!pm && hrs === 12) hrs = 0;
        return hrs * 60 + mins;
    };

    useEffect(() => {
        const clockInterval = setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { 
                hour: "2-digit", 
                minute: "2-digit", 
                second: "2-digit", 
                hour12: true 
            }));
            setCurrentDate(now.toLocaleDateString("en-US", { 
                weekday: "long", 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
            }));
        }, 1000);
        return () => clearInterval(clockInterval);
    }, []);
  
    // Filter employees by search bar query (Overview & Employees tabs)
    const filteredEmployees = employees.filter(emp => 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
 
    // Find currently selected employee object (for double-panel Employees Tab)
    const currentEmployee = employees.find(e => e.employeeId === selectedEmpId) || employees[0] || {
        employeeId: "EMP001",
        name: "No Employee Active",
        avatar: "--",
        role: "Software Developer",
        isWfhActive: false,
        wfhDaysCount: 0,
        currentStatus: "Offline",
        breaks: { shortBreaksLeft: 3, lunchBreakUsed: false, totalDuration: "0m", history: [] },
        tasks: [],
        pdfReport: null,
        activityLogs: [],
        latestCoordinate: { x: 0, y: 0 }
    };
 
    const sidebarMenuItems = [
        { name: "Overview", icon: <FiGrid size={18} /> },
        { name: "Live Screens", icon: <FiTv size={18} />, isLive: true },
        { name: "Employees", icon: <FiUser size={18} /> },
        { name: "Shifts Log", icon: <FiCalendar size={18} /> },
        { name: "Screenshots", icon: <FiMonitor size={18} /> },
        { name: "Task Logs", icon: <FiCheckSquare size={18} /> },
        { name: "PDF Reports", icon: <FiFileText size={18} /> }
    ];
 
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex relative overflow-hidden font-[Inter,sans-serif] select-none">
            {/* Background Accent Blobs */}
            <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-blue/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-peacock/4 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
 
            {/* Mobile Sidebar Backdrop Overlay */}
            {mobileSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden animate-fade-in"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* Sidebar (Matching EmployeeSidebar Theme exactly) */}
            <aside className={`w-72 max-w-[85vw] min-h-screen bg-white border-r border-slate-100 p-6 flex flex-col justify-between flex-shrink-0 z-40 transition-transform duration-300 md:translate-x-0 md:static md:w-64 md:z-20 md:flex ${
                mobileSidebarOpen 
                    ? "fixed inset-y-0 left-0 shadow-2xl translate-x-0" 
                    : "fixed inset-y-0 left-0 -translate-x-full md:translate-x-0 hidden md:flex"
            }`}>
                <div>
                    {/* Logo Section */}
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <img 
                            src="/logo.png" 
                            alt="Company Logo" 
                            className="h-9 w-auto object-contain animate-fade-in"
                        />
                        {mobileSidebarOpen && (
                            <button 
                                className="ml-auto p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all" 
                                onClick={() => setMobileSidebarOpen(false)}
                                title="Close Menu"
                            >
                                <FiX size={20} />
                            </button>
                        )}
                    </div>
 
                    {/* Sidebar menu navigation */}
                    <div className="flex flex-col gap-2">
                        {sidebarMenuItems.map((item) => {
                            const isActive = activeMenu === item.name;
                            return (
                                <button
                                    key={item.name}
                                    onClick={() => {
                                        setActiveMenu(item.name);
                                        setSearchQuery(""); // Clear searches on switch
                                        setMobileSidebarOpen(false);
                                    }}
                                    className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 w-full text-left outline-none ${
                                        isActive
                                            ? "bg-gradient-to-r from-brand-blue to-brand-peacock text-white shadow-lg shadow-brand-blue/15 scale-[1.01]"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                    }`}
                                >
                                    <span className={`transition-transform duration-300 ${isActive ? "scale-110" : "text-slate-400"}`}>
                                        {item.icon}
                                    </span>
                                    <div className="flex items-center justify-between flex-1">
                                        <span>{item.name}</span>
                                        {item.isLive && (
                                            <span className={`flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                isActive ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                            }`}>
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                                LIVE
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
 
                {/* Admin profile card footer */}
                <div className="border-t border-slate-100 pt-6 px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-sm shadow-md">
                            {adminInitials}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 leading-tight">{adminName}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{adminRole}</p>
                        </div>
                    </div>
                </div>
            </aside>
 
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-y-auto z-10">
                {/* Navbar (Same clean style) */}
                <header className="h-16 sm:h-20 bg-white border-b border-slate-100 px-4 sm:px-8 flex items-center justify-between shadow-xs flex-shrink-0 z-10">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-brand-blue bg-brand-blue/5 border border-brand-blue/10 px-2.5 sm:px-3 py-1 rounded-full truncate">
                            ADMIN CONTROL BOARD
                        </span>
                    </div>
 
                    <div className="flex items-center gap-3 sm:gap-6">
                        {/* Mobile sidebar toggle */}
                        <button className="md:hidden flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all" onClick={() => setMobileSidebarOpen(true)} title="Menu">
                            <FiMenu size={18} />
                        </button>
                        <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold text-slate-500">
                            <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl shadow-xs">
                                <FiCalendar className="text-brand-blue" size={16} />
                                <span>{currentDate || "Loading..."}</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl shadow-xs min-w-[100px]">
                                <FiClock className="text-brand-peacock" size={16} />
                                <span className="tabular-nums">{currentTime || "Loading..."}</span>
                            </div>
                        </div>
 
                        <div className="h-5 sm:h-6 w-px bg-slate-200" />
 
                        <button 
                            onClick={() => {
                                const confirmLogout = confirm("Are you sure you want to log out of the Admin dashboard?");
                                if (confirmLogout) {
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
                                }
                            }}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300 cursor-pointer shadow-xs active:scale-95"
                            title="Log Out"
                        >
                            <FiLogOut size={16} />
                        </button>
                    </div>
                </header>
 
                {/* Dashboard body */}
                <main className="flex-1 p-3.5 sm:p-6 lg:p-8 flex flex-col gap-5 sm:gap-8 max-w-7xl mx-auto w-full relative">
                    
                    {/* Header welcome banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight">
                                {activeMenu === "Overview" ? "WFH Shift Realtime Overview" : "Remote Work Compliance Audits"}
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                                {activeMenu === "Overview" 
                                    ? "Live monitoring of all 20 remote team member shifts, start times, and active cursor heartbeats."
                                    : "Audit WFH historical records, compliance task planners, and submitted PDF Work Reports."
                                }
                            </p>
                        </div>
                    </div>
 
                    {/* OVERVIEW TAB VIEW */}
                    {activeMenu === "Overview" && (
                        <div className="space-y-8 animate-fade-in">
                            
                            {/* Live WFH Customer Shifts Chronological Feed */}
                            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
                                <div className="border-b border-slate-50 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-peacock bg-brand-peacock/5 border border-brand-peacock/10 px-3 py-1 rounded-full">
                                            LIVE COMPLIANCE FEED
                                        </span>
                                        <h3 className="text-lg font-black text-slate-800 tracking-tight mt-2">CUSTOMER WFH Shift Timeline</h3>
                                        <p className="text-xs text-slate-400 font-semibold mt-0.5">Chronologically sorted log of all Work-From-Home Customer shifts started today.</p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 text-center text-xs font-bold text-slate-500 shadow-sm shrink-0">
                                        Active Shifts: {employees.filter(e => e.isWfhActive).length}
                                    </div>
                                </div>

                                {/* Shift list rows */}
                                {employees.filter(e => e.isWfhActive).length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-50/50 border border-slate-100 rounded-2xl">
                                        No active WFH Customer compliance shifts recorded today.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {employees
                                            .filter(e => e.isWfhActive)
                                            .sort((a, b) => parseTime(a.shiftStartTime || "") - parseTime(b.shiftStartTime || ""))
                                            .map((emp) => {
                                                return (
                                                    <div key={emp.employeeId} className="bg-white rounded-2xl border px-5 py-4 shadow-sm border-brand-blue ring-2 ring-brand-blue/5 shadow-brand-blue/5 shadow-md flex items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)] shrink-0" />
                                                            <div className="min-w-0">
                                                                <h4 className="text-sm font-bold text-slate-800 leading-tight truncate">{mapName(emp.name)}</h4>
                                                                <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5 uppercase">{emp.employeeId}</p>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => setSelectedLiveScreenEmp(emp)} className="ml-2 py-1 px-3 rounded-md text-xs bg-brand-blue text-white hover:bg-brand-peacock">Live Watch</button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* Global Employee Directory - Date Grouped */}
                            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                                    <div>
                                        <h3 className="text-base font-black text-slate-800 tracking-tight">Team Shift Directory</h3>
                                        <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                            Date-wise shift history — Today's shifts shown at top, older shifts grouped below.
                                        </p>
                                    </div>
                                    <div className="relative flex items-center w-full sm:max-w-xs">
                                        <input 
                                            type="text" 
                                            placeholder="Search directory..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-300 outline-none focus:border-brand-blue transition-all duration-200 text-xs font-semibold"
                                        />
                                        <FiSearch className="absolute left-3.5 text-slate-300" size={16} />
                                    </div>
                                </div>

                                {(() => {
                                    const todayStr = new Date().toISOString().split("T")[0];

                                    // Employees WITH a shift
                                    const withShift = filteredEmployees.filter(e => e.shiftDateRaw);
                                    // Employees with NO shift at all
                                    const noShift = filteredEmployees.filter(e => !e.shiftDateRaw);

                                    // Group by date descending
                                    const dateGroups: Record<string, EmployeeAuditData[]> = {};
                                    withShift.forEach(emp => {
                                        const key = emp.shiftDateRaw!;
                                        if (!dateGroups[key]) dateGroups[key] = [];
                                        dateGroups[key].push(emp);
                                    });
                                    const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));

                                    const renderEmployeeRow = (emp: EmployeeAuditData) => {
                                        const isActiveShift = emp.isWfhActive;
                                        const hasShiftData = !!emp.shiftStartTime;
                                        return (
                                            <div
                                                key={`${emp.employeeId}_${emp.shiftDateRaw}`}
                                                className={`bg-white rounded-2xl border p-4 shadow-sm transition-all duration-300 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden ${
                                                    isActiveShift
                                                        ? "border-brand-blue ring-2 ring-brand-blue/5 shadow-brand-blue/5 shadow-md"
                                                        : "border-slate-100"
                                                }`}
                                            >
                                                {/* Left: Avatar + Name */}
                                                <div className="flex items-center gap-4 lg:w-1/4 shrink-0 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-sm shadow">
                                                            {emp.avatar}
                                                        </div>
                                                        {isActiveShift && (
                                                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">{mapName(emp.name)}</h4>
                                                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{emp.employeeId} • {emp.role.replace(/\s*\(.*?\)\s*/g, "")}</p>
                                                    </div>
                                                </div>

                                                {/* Status badge */}
                                                <div className="lg:w-1/5 shrink-0">
                                                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 w-fit ${
                                                        isActiveShift
                                                            ? (emp.currentStatus === "On Break" ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse" : "bg-green-50 border-green-200 text-green-600 animate-pulse")
                                                            : (emp.shiftStatus === "Completed" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                                                               emp.shiftStatus === "Half Day" ? "bg-amber-50 border-amber-200 text-amber-600" :
                                                               emp.shiftStatus === "Absent" ? "bg-red-50 border-red-200 text-red-600" :
                                                               "bg-slate-50 border-slate-200 text-slate-400")
                                                    }`}>
                                                        {isActiveShift
                                                            ? (emp.currentStatus === "On Break" ? "On Break" : "WFH Shift Active")
                                                            : (emp.shiftStatus || "Completed")}
                                                    </span>
                                                </div>

                                                {/* Shift time */}
                                                <div className="lg:w-1/5 shrink-0">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Shift Start</span>
                                                    <span className="font-extrabold text-slate-700 tabular-nums text-xs mt-0.5 block">
                                                        {formatShiftTime(emp.shiftStartTimeRaw, emp.shiftStartTime)}
                                                    </span>
                                                    {isActiveShift && emp.shiftStartTimeRaw && (
                                                        <span className="text-[9px] font-bold text-emerald-600 tabular-nums block mt-0.5 animate-pulse">
                                                            ⏱ {getElapsedShiftTime(emp.shiftStartTimeRaw)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* View Details */}
                                                <button
                                                    onClick={() => hasShiftData && setDetailsModalEmp(emp)}
                                                    disabled={!hasShiftData}
                                                    className={`py-2.5 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all duration-300 w-full lg:w-auto shrink-0 ${
                                                        hasShiftData
                                                            ? "bg-gradient-to-r from-brand-blue to-brand-peacock text-white shadow-md shadow-brand-blue/10 hover:shadow-lg cursor-pointer active:scale-[0.98]"
                                                            : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
                                                    }`}
                                                >
                                                    {hasShiftData ? <><FiMonitor size={12} /> View Details</> : <><FiLock size={12} /> View Details</>}
                                                </button>
                                            </div>
                                        );
                                    };

                                    return (
                                        <div className="flex flex-col gap-6 select-none">
                                            {sortedDates.map(dateKey => {
                                                const isToday = dateKey === todayStr;
                                                const emps = dateGroups[dateKey];
                                                const label = emps[0]?.shiftDateLabel || dateKey;
                                                const activeCount = emps.filter(e => e.isWfhActive).length;

                                                return (
                                                    <div key={dateKey} className="flex flex-col gap-3">
                                                        {/* Date section header */}
                                                        <div className={`flex items-center gap-3 px-1`}>
                                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                                                isToday
                                                                    ? "bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/20"
                                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}>
                                                                <FiCalendar size={10} />
                                                                {isToday ? `Today — ${label}` : label}
                                                            </div>
                                                            <div className="flex-1 h-px bg-slate-100" />
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                                {emps.length} employee{emps.length !== 1 ? "s" : ""}
                                                                {activeCount > 0 && isToday && (
                                                                    <span className="ml-1.5 text-green-500">• {activeCount} active</span>
                                                                )}
                                                            </span>
                                                        </div>

                                                        {/* Employee rows for this date */}
                                                        <div className="flex flex-col gap-2.5">
                                                            {emps
                                                                .sort((a, b) => (b.isWfhActive ? 1 : 0) - (a.isWfhActive ? 1 : 0))
                                                                .map(renderEmployeeRow)}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* No-shift employees at the bottom */}
                                            {noShift.length > 0 && (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center gap-3 px-1">
                                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-slate-50 text-slate-400 border-slate-200">
                                                            <FiClock size={10} />
                                                            Not Started Today
                                                        </div>
                                                        <div className="flex-1 h-px bg-slate-100" />
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                            {noShift.length} employee{noShift.length !== 1 ? "s" : ""}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-2.5">
                                                        {noShift.map(emp => (
                                                            <div
                                                                key={emp.employeeId}
                                                                className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 opacity-60"
                                                            >
                                                                <div className="flex items-center gap-4 lg:w-1/4 shrink-0 min-w-0">
                                                                    <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm shadow shrink-0">
                                                                        {emp.avatar}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <h4 className="text-xs font-bold text-slate-600 leading-tight truncate">{mapName(emp.name)}</h4>
                                                                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{emp.employeeId} • {emp.role.replace(/\s*\(.*?\)\s*/g, "")}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="lg:w-1/5 shrink-0">
                                                                    <span className="text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 w-fit bg-slate-50 border-slate-200 text-slate-400">
                                                                        Not Started
                                                                    </span>
                                                                </div>
                                                                <div className="lg:w-1/5 shrink-0">
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Shift Start</span>
                                                                    <span className="font-extrabold text-slate-400 tabular-nums text-xs mt-0.5 block">--:--</span>
                                                                </div>
                                                                <button disabled className="py-2.5 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50 w-full lg:w-auto shrink-0">
                                                                    <FiLock size={12} /> View Details
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {filteredEmployees.length === 0 && (
                                                <div className="py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-50/50 border border-slate-100 rounded-2xl">
                                                    No employees found matching your search.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* DUAL-PANE AUDITING TAB VIEW */}
                    {activeMenu === "Employees" && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start animate-fade-in">
                            {/* KPI cards grid for context */}
                            <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
                                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-blue/5 text-brand-blue flex items-center justify-center shrink-0">
                                        <FiUser size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">Total Staff</span>
                                        <h4 className="text-sm sm:text-xl font-black text-slate-800 mt-0.5">{employees.length} Users</h4>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-green-500/5 text-green-500 flex items-center justify-center shrink-0">
                                        <FiActivity size={18} className="animate-pulse" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">WFH Active</span>
                                        <h4 className="text-sm sm:text-xl font-black text-slate-800 mt-0.5">{employees.filter(e => e.isWfhActive).length} Online</h4>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/5 text-amber-500 flex items-center justify-center shrink-0">
                                        <FiCoffee size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">Break Logs</span>
                                        <h4 className="text-sm sm:text-xl font-black text-slate-800 mt-0.5">{employees.filter(e => e.currentStatus === "On Break").length} On Break</h4>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-peacock/5 text-brand-peacock flex items-center justify-center shrink-0">
                                        <FiFileText size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest block truncate">Tasks Done</span>
                                        <h4 className="text-sm sm:text-xl font-black text-slate-800 mt-0.5">{employees.reduce((acc, curr) => acc + (curr.tasks ? curr.tasks.filter((t: any) => t.completed).length : 0), 0)} Completed</h4>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile View Switcher (List vs Details) */}
                            <div className="lg:col-span-12 lg:hidden flex items-center bg-slate-200/70 p-1 rounded-2xl border border-slate-300/40 w-full">
                                <button
                                    onClick={() => setMobileEmployeeTab("list")}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        mobileEmployeeTab === "list"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    <FiUser size={13} />
                                    <span>Team List ({filteredEmployees.length})</span>
                                </button>
                                <button
                                    onClick={() => setMobileEmployeeTab("details")}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        mobileEmployeeTab === "details"
                                            ? "bg-white text-brand-blue shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    <FiActivity size={13} />
                                    <span className="truncate">Audit Details ({mapName(currentEmployee.name).split(" ")[0]})</span>
                                </button>
                            </div>

                            {/* LEFT COLUMN: Search & Filterable employee list (col-span-4) */}
                            <div className={`lg:col-span-4 space-y-4 w-full ${mobileEmployeeTab === "list" ? "block" : "hidden lg:block"}`}>
                                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-700">Search Remote Team</h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{filteredEmployees.length} Members</span>
                                    </div>
                                    
                                    {/* Sleek Search Bar */}
                                    <div className="relative flex items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Search by name, ID, or role..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 outline-none focus:border-brand-blue transition-all duration-200 text-xs font-semibold"
                                        />
                                        <FiSearch className="absolute left-3 text-slate-400" size={15} />
                                    </div>

                                    {/* Employee listings */}
                                    <div className="space-y-2.5 sm:space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                                        {filteredEmployees.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-6 font-medium">No active employees match search query.</p>
                                        ) : (
                                            filteredEmployees.map((emp) => {
                                                const isSelected = emp.employeeId === selectedEmpId;
                                                const isActive = emp.isWfhActive && emp.currentStatus !== "Offline";
                                                return (
                                                    <div 
                                                        key={emp.employeeId}
                                                        onClick={() => {
                                                            setSelectedEmpId(emp.employeeId);
                                                            setMobileEmployeeTab("details");
                                                        }}
                                                        className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between cursor-pointer active:scale-[0.99] ${
                                                            isSelected 
                                                                ? "border-brand-blue ring-2 sm:ring-4 ring-brand-blue/10 bg-brand-blue/5 shadow-xs" 
                                                                : "border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/50"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                                                                {emp.avatar}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h5 className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1.5 truncate">
                                                                    {mapName(emp.name)}
                                                                    {isActive && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" title="Working from Home" />
                                                                    )}
                                                                </h5>
                                                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-tight truncate">{emp.role.replace(/\s*\(.*?\)\s*/g, "")} • {emp.employeeId}</p>
                                                            </div>
                                                        </div>

                                                        {/* Status Pill */}
                                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                            <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                                                isActive ? "bg-green-50 border-green-200 text-green-600" :
                                                                emp.currentStatus === "On Break" ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse" :
                                                                "bg-slate-50 border-slate-200 text-slate-400"
                                                            }`}>
                                                                {isActive ? "Working" : emp.currentStatus}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-brand-blue lg:hidden">→</span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Selected Employee Analytics Dashboard Details (col-span-8) */}
                            <div className={`lg:col-span-8 space-y-4 sm:space-y-6 w-full ${mobileEmployeeTab === "details" ? "block" : "hidden lg:block"}`}>
                                
                                {/* Mobile Back Button */}
                                <div className="lg:hidden flex items-center justify-between bg-white border border-slate-100 rounded-2xl p-2.5 sm:p-3 shadow-xs">
                                    <button
                                        onClick={() => setMobileEmployeeTab("list")}
                                        className="flex items-center gap-1.5 text-xs font-extrabold text-brand-blue hover:text-brand-blue/80 py-1.5 px-3 rounded-xl bg-brand-blue/5 border border-brand-blue/10 active:scale-95 transition-all"
                                    >
                                        <FiArrowLeft size={14} /> Back to Team List
                                    </button>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                        Auditing {currentEmployee.employeeId}
                                    </span>
                                </div>

                                {/* Employee summary analytics overview */}
                                <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xs space-y-5 sm:space-y-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-blue to-brand-peacock" />
                                    
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 sm:pb-5">
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-black text-base sm:text-lg shadow-md shrink-0">
                                                {currentEmployee.avatar}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-base sm:text-lg font-black text-slate-800 leading-tight truncate">{mapName(currentEmployee.name)}</h3>
                                                <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase mt-0.5 tracking-wider truncate">{currentEmployee.role} • ID: {currentEmployee.employeeId}</p>
                                            </div>
                                        </div>

                                        {/* WFH status details */}
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                            <div className="flex-1 sm:flex-initial min-w-[100px] bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-xs text-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">WFH Taken</span>
                                                <span className="text-xs font-black text-brand-blue mt-0.5 block">{currentEmployee.wfhDaysCount} Days</span>
                                            </div>
                                            <div className="flex-1 sm:flex-initial min-w-[110px] bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-xs text-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Shift Status</span>
                                                <span className={`text-xs font-black mt-0.5 block uppercase tracking-wider ${
                                                    currentEmployee.isWfhActive 
                                                        ? "text-green-500" 
                                                        : (currentEmployee.shiftStatus === "Completed" ? "text-brand-blue" :
                                                           currentEmployee.shiftStatus === "Half Day" ? "text-amber-500" :
                                                           currentEmployee.shiftStatus === "Absent" ? "text-red-500" :
                                                           "text-slate-400")
                                                }`}>
                                                    {currentEmployee.isWfhActive 
                                                        ? "Remote" 
                                                        : (currentEmployee.shiftStatus || "Offline")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Shift Timing Details (Start and End times) */}
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 shadow-xs">
                                        <div>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Shift Start Time</span>
                                            <span className="text-xs font-black text-slate-700 mt-0.5 block tabular-nums">
                                                {formatShiftTime(currentEmployee.shiftStartTimeRaw, currentEmployee.shiftStartTime)}
                                            </span>
                                            {currentEmployee.isWfhActive && currentEmployee.shiftStartTimeRaw && (
                                                <span className="text-[9px] font-bold text-emerald-600 tabular-nums block mt-0.5 animate-pulse">
                                                    ⏱ {getElapsedShiftTime(currentEmployee.shiftStartTimeRaw)}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Shift End Time</span>
                                            <span className="text-xs font-black text-slate-700 mt-0.5 block tabular-nums">
                                                {currentEmployee.isWfhActive ? (
                                                    <span className="text-emerald-600 font-bold text-[10px] animate-pulse">● Active Now</span>
                                                ) : (
                                                    formatShiftTime(currentEmployee.shiftEndTimeRaw, currentEmployee.shiftEndTime) || "--:--"
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        {/* 1. Breaks Audit Widget */}
                                        <div className="space-y-3 sm:space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
                                                    <FiCoffee size={14} className="text-amber-500" />
                                                    Breaks Audit Logs
                                                </h4>
                                                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Total: {currentEmployee.breaks.totalDuration}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                                                {currentEmployee.breaks.history.map((brk, idx) => (
                                                    <div 
                                                        key={idx}
                                                        className={`rounded-2xl border p-2.5 sm:p-3 flex flex-col justify-between min-h-[72px] transition-all duration-300 ${
                                                            brk.status === "Used" 
                                                                ? "bg-amber-50/20 border-amber-200 text-slate-600" 
                                                                : brk.status === "Locked"
                                                                ? "bg-slate-50 border-slate-200/60 opacity-60 text-slate-400 cursor-not-allowed"
                                                                : "bg-white border-slate-100 text-slate-500"
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-[8px] font-bold uppercase tracking-wider">{brk.status}</span>
                                                            {brk.status === "Used" ? (
                                                                <FiCheck className="text-amber-500 stroke-[3]" size={12} />
                                                            ) : (
                                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h5 className="text-[10px] font-bold text-slate-800 leading-tight truncate">{brk.name}</h5>
                                                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate">{brk.time}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 2. Remote tracking telemetry */}
                                        <div className="space-y-3 sm:space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 sm:gap-2">
                                                    <FiMonitor size={14} className="text-brand-blue" />
                                                    Telemetry Signals
                                                </h4>
                                            </div>

                                            {/* Mock Active tracking logs */}
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 sm:p-4 space-y-2.5 font-mono text-[9px] font-semibold text-slate-500 max-h-[160px] overflow-y-auto">
                                                {currentEmployee.activityLogs.map((log, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 border-b border-slate-200/30 pb-2 last:border-b-0 last:pb-0">
                                                        <span className="w-1 h-1 rounded-full bg-brand-peacock shrink-0" />
                                                        <span className="truncate">{log}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {currentEmployee.isWfhActive && currentEmployee.currentStatus !== "Offline" && (
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-brand-peacock/5 border border-brand-peacock/10 rounded-xl px-3 py-2 text-[9px] font-extrabold text-brand-peacock uppercase tracking-wider">
                                                    <span>Telemetry</span>
                                                    <span className="tabular-nums">X: {currentEmployee.latestCoordinate.x}px • Y: {currentEmployee.latestCoordinate.y}px</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* WFH Shift Start Geolocation Card */}
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 mb-4 sm:mb-6 space-y-3 sm:space-y-4 shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2.5 sm:pb-3">
                                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                <FiCompass className="text-brand-blue" size={15} />
                                                Clock-In Geolocation Audit
                                            </h4>
                                            {currentEmployee.locationFetchedAt && (
                                                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Synced at {new Date(currentEmployee.locationFetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                                </span>
                                            )}
                                        </div>

                                        {currentEmployee.startAddress ? (
                                            <div className="space-y-3 sm:space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-brand-blue/5 text-brand-blue flex items-center justify-center shrink-0 mt-0.5 shadow-xs border border-brand-blue/10">
                                                        <FiMapPin size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Resolved Physical Address</span>
                                                        <p className="text-xs font-semibold text-slate-700 leading-normal mt-0.5 break-words">
                                                            {currentEmployee.startAddress}
                                                        </p>
                                                    </div>
                                                </div>

                                                {currentEmployee.latitude && currentEmployee.longitude && (
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 sm:pt-3 border-t border-slate-200/50">
                                                        <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 font-mono break-all">
                                                            COORD: {currentEmployee.latitude.toFixed(6)}, {currentEmployee.longitude.toFixed(6)}
                                                        </div>
                                                        <button
                                                            onClick={() => window.open(`https://www.google.com/maps?q=${currentEmployee.latitude},${currentEmployee.longitude}`, "_blank")}
                                                            className="py-2 px-3 rounded-xl bg-brand-blue text-white font-extrabold text-[9px] uppercase tracking-wider hover:bg-brand-blue/90 hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer outline-none border-none flex items-center justify-center gap-1.5 w-full sm:w-auto"
                                                        >
                                                            <FiMapPin size={10} /> View on Google Maps
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2.5 text-xs text-slate-400 bg-white border border-slate-100 rounded-xl p-3">
                                                <FiCompass size={15} />
                                                <span>Location auditing telemetry was offline for this shift session.</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* WFH Shift End Geolocation Card */}
                                    {currentEmployee.endAddress && (
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 mb-4 sm:mb-6 space-y-3 sm:space-y-4 shadow-xs animate-fade-in">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2.5 sm:pb-3">
                                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                    <FiCompass className="text-brand-peacock" size={15} />
                                                    Clock-Out Geolocation Audit
                                                </h4>
                                                {currentEmployee.endLocationFetchedAt && (
                                                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Synced at {new Date(currentEmployee.endLocationFetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-3 sm:space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-brand-peacock/5 text-brand-peacock flex items-center justify-center shrink-0 mt-0.5 shadow-xs border border-brand-peacock/10">
                                                        <FiMapPin size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Resolved Physical Address</span>
                                                        <p className="text-xs font-semibold text-slate-700 leading-normal mt-0.5 break-words">
                                                            {currentEmployee.endAddress}
                                                        </p>
                                                    </div>
                                                </div>

                                                {currentEmployee.endLatitude && currentEmployee.endLongitude && (
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 sm:pt-3 border-t border-slate-200/50">
                                                        <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 font-mono break-all">
                                                            COORD: {currentEmployee.endLatitude.toFixed(6)}, {currentEmployee.endLongitude.toFixed(6)}
                                                        </div>
                                                        <button
                                                            onClick={() => window.open(`https://www.google.com/maps?q=${currentEmployee.endLatitude},${currentEmployee.endLongitude}`, "_blank")}
                                                            className="py-2 px-3 rounded-xl bg-brand-peacock text-white font-extrabold text-[9px] uppercase tracking-wider hover:bg-brand-peacock/90 hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer outline-none border-none flex items-center justify-center gap-1.5 w-full sm:w-auto"
                                                        >
                                                            <FiMapPin size={10} /> View on Google Maps
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Submitted daily Tasks Board */}
                                    <div className="space-y-3 sm:space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-50 pb-2">
                                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                <FiCheckSquare size={14} className="text-green-500" />
                                                Assigned WFH Tasks & Shifts
                                            </h4>
                                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${currentEmployee.pdfReport ? "text-green-500" : "text-amber-500 animate-pulse"}`}>
                                                {currentEmployee.pdfReport ? "Submission Completed" : "Shift Report Pending"}
                                            </span>
                                        </div>

                                        {/* Task items list */}
                                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                                            {currentEmployee.tasks.map((task, index) => (
                                                <div 
                                                    key={index}
                                                    className={`flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all duration-300 ${
                                                        task.completed 
                                                            ? "bg-green-50/20 border-green-100" 
                                                            : "border-slate-100 bg-white"
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                                                        task.completed 
                                                            ? "bg-green-500 border-green-500 text-white" 
                                                            : "border-slate-300 bg-white"
                                                    }`}>
                                                        {task.completed && <FiCheck size={12} className="stroke-[3]" />}
                                                    </div>
                                                    <span className={`text-xs font-semibold leading-tight min-w-0 flex-1 break-words ${task.completed ? "text-slate-500 line-through" : "text-slate-700"}`}>
                                                        {task.text}
                                                    </span>
                                                    {task.completed && task.completedAt && (
                                                        <span className="text-[8px] font-bold text-green-500 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 ml-auto uppercase shrink-0">
                                                            {task.completedAt.replace("Completed at ", "")}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* PDF Work report section display */}
                                        {currentEmployee.pdfReport ? (
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mt-4 shadow-xs animate-fade-in">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-green-500 text-white flex items-center justify-center shadow-xs shrink-0">
                                                        <FiFileText size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h5 className="text-xs font-bold text-slate-700 truncate leading-tight">{currentEmployee.pdfReport.name}</h5>
                                                        <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">{currentEmployee.pdfReport.size} • {currentEmployee.pdfReport.uploadedAt}</p>
                                                    </div>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => currentEmployee.pdfReport?.name && window.open(`${API_BASE_URL}/api/files/download/reports/${currentEmployee.pdfReport.name}?token=${sessionStorage.getItem("wfh_auth_token")}`, "_blank")}
                                                    className="py-2.5 px-4 rounded-xl bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-slate-900 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-xs text-center w-full sm:w-auto"
                                                >
                                                    Audit PDF Document
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 sm:p-4.5 flex items-center gap-3 text-slate-400 mt-4 shadow-inner">
                                                <FiShield size={20} className="text-amber-500 shrink-0" />
                                                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full leading-normal">
                                                    🚨 Compliance Alert: Missing Shift Report submission for today!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LIVE SCREENS SURVEILLANCE TAB */}
                    {activeMenu === "Live Screens" && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Live Screen Header Panel */}
                            <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-2.5 w-2.5 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                                            LIVE SURVEILLANCE & STREAMING
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 mt-2">Team Realtime Live Screen Monitor</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Live desktop streams of all employees with active clocked-in WFH shifts. Click any screen to view fullscreen live stream.</p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-50/70 border border-emerald-100 px-4 py-2 rounded-2xl flex items-center gap-2">
                                        <FiTv className="text-emerald-600" size={16} />
                                        <span className="text-xs font-bold text-emerald-800">
                                            {employees.filter(e => e.isWfhActive || e.currentStatus === "Active" || e.currentStatus === "On Break").length} Employees Live
                                        </span>
                                    </div>

                                    <button 
                                        onClick={() => fetchFeed()}
                                        className="py-2.5 px-4 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-200 font-bold text-xs flex items-center gap-2 transition-all duration-300 shadow-sm cursor-pointer"
                                        title="Refresh all streams"
                                    >
                                        <FiRefreshCw size={14} className={isLoading ? "animate-spin text-emerald-600" : ""} />
                                        <span>Sync All</span>
                                    </button>
                                </div>
                            </div>

                            {/* Live Screens Grid */}
                            {employees.filter(e => e.isWfhActive || e.currentStatus === "Active" || e.currentStatus === "On Break").length === 0 ? (
                                <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center space-y-4 shadow-sm">
                                    <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                                        <FiTv size={32} />
                                    </div>
                                    <h4 className="text-base font-bold text-slate-700">No Active Shift Streams Right Now</h4>
                                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                                        When an employee logs in and clicks "Start Shift" with screen sharing enabled, their live workstation screen will appear here automatically.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {employees
                                        .filter(e => e.isWfhActive || e.currentStatus === "Active" || e.currentStatus === "On Break")
                                        .map((emp) => {
                                            const liveData = liveFrames[emp.employeeId];
                                            const isStreaming = liveData && (Date.now() - liveData.timestamp < 12000);
                                            const displayImage = (isStreaming && liveData?.frame) || emp.latestScreenshot?.imageUrl;
                                            const activeWinTitle = (isStreaming && liveData?.activeWindow) || emp.latestScreenshot?.activeWindow || "Active Workspace";
                                            return (
                                                <div 
                                                    key={emp.employeeId}
                                                    onClick={() => setSelectedLiveScreenEmp(emp)}
                                                    className="group bg-white border border-slate-200/80 rounded-3xl p-4 space-y-3 shadow-sm hover:shadow-xl hover:border-emerald-400 transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between"
                                                >
                                                    {/* Card Header */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                                                {emp.avatar}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="text-xs font-bold text-slate-800 truncate leading-tight">{mapName(emp.name)}</h4>
                                                                <span className="text-[10px] font-bold text-emerald-600">{emp.employeeId}</span>
                                                            </div>
                                                        </div>

                                                        {isStreaming ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm shrink-0">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                                                                LIVE STREAM
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                                                LIVE
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Screen Frame Box */}
                                                    <div className="w-full aspect-[16/10] rounded-2xl bg-slate-900 border border-slate-100 overflow-hidden relative flex items-center justify-center group-hover:scale-[1.01] transition-transform">
                                                        {displayImage ? (
                                                            <img 
                                                                src={displayImage} 
                                                                alt={`${mapName(emp.name)} Live Screen`} 
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
                                                                <FiTv size={24} className="text-emerald-400 animate-pulse" />
                                                                <span className="text-[10px] font-bold text-slate-400">Syncing screen stream...</span>
                                                            </div>
                                                        )}

                                                        {/* Active Window Pill */}
                                                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                                                            <span className="text-[9px] font-bold bg-black/70 backdrop-blur-md text-white px-2 py-0.5 rounded-lg truncate max-w-[80%] shadow">
                                                                {activeWinTitle}
                                                            </span>
                                                        </div>

                                                        {/* Hover View Button Overlay */}
                                                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1.5 text-white">
                                                            <span className="p-2.5 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-90 group-hover:scale-100 transition-transform">
                                                                <FiMaximize2 size={18} />
                                                            </span>
                                                            <span className="text-[11px] font-bold tracking-wide">Open Fullscreen Live</span>
                                                        </div>
                                                    </div>

                                                    {/* Card Bottom Meta */}
                                                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-semibold border-t border-slate-50">
                                                        <span className="flex items-center gap-1 text-slate-600 font-semibold">
                                                            <FiClock size={12} className="text-emerald-500" />
                                                            {formatShiftTime(emp.shiftStartTimeRaw, emp.shiftStartTime)}
                                                        </span>
                                                        <span className="text-emerald-600 font-bold">
                                                            {isStreaming ? "⚡ Real-Time Live" : (emp.isWfhActive ? "Active Shift" : "Offline")}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SCREENSHOTS COMPLIANCE TAB */}
                    {activeMenu === "Screenshots" && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-peacock bg-brand-peacock/5 border border-brand-peacock/10 px-3 py-1 rounded-full">
                                                TELEMETRY COMPLIANCE PANEL
                                            </span>
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                                                Max 2-Day History (48h)
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800 mt-2">Remote Screenshots Compliance Captures</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Automated desktop screenshot captures synchronized from employee workstations every 30 minutes, stored for max 2 days (48 hours).</p>
                                    </div>
                                </div>

                                {/* Filter Pills */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <button
                                        onClick={() => setScreenshotTabFilter("all")}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            screenshotTabFilter === "all"
                                                ? "bg-brand-blue text-white shadow-sm"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                    >
                                        All Team ({employees.length})
                                    </button>
                                    <button
                                        onClick={() => setScreenshotTabFilter("active")}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            screenshotTabFilter === "active"
                                                ? "bg-emerald-600 text-white shadow-sm"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                        Currently Active ({employees.filter(e => e.isWfhActive).length})
                                    </button>
                                    <button
                                        onClick={() => setScreenshotTabFilter("completed")}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            screenshotTabFilter === "completed"
                                                ? "bg-slate-700 text-white shadow-sm"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                    >
                                        Completed / Offline ({employees.filter(e => !e.isWfhActive).length})
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {employees
                                    .filter((emp: EmployeeAuditData) => {
                                        if (screenshotTabFilter === "active") return emp.isWfhActive;
                                        if (screenshotTabFilter === "completed") return !emp.isWfhActive;
                                        return true;
                                    })
                                    .length === 0 ? (
                                    <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-50 border border-slate-100 rounded-3xl">
                                        No employees found matching the "{screenshotTabFilter}" filter.
                                    </div>
                                ) : (
                                    employees
                                        .filter((emp: EmployeeAuditData) => {
                                            if (screenshotTabFilter === "active") return emp.isWfhActive;
                                            if (screenshotTabFilter === "completed") return !emp.isWfhActive;
                                            return true;
                                        })
                                        .map((emp: EmployeeAuditData) => {
                                            const isExpanded = expandedEmpIds.includes(emp.employeeId);
                                            const data = expandedScreenshots[emp.employeeId] || { screenshots: [], skip: 0, hasMore: false, isLoading: false };
                                            
                                            return (
                                                <div 
                                                    key={emp.employeeId} 
                                                    className="border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm bg-white hover:border-slate-200 transition-all duration-300"
                                                >
                                                    {/* Row Header */}
                                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-sm shadow">
                                                                {emp.avatar}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className="text-sm font-bold text-slate-800 leading-tight">{mapName(emp.name)}</h4>
                                                                    {emp.isWfhActive ? (
                                                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live Active
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold uppercase tracking-wider">
                                                                            Completed / Offline
                                                                        </span>
                                                                    )}
                                                                    {data.totalCount !== undefined && data.totalCount > 0 && (
                                                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold">
                                                                            {data.totalCount} captures (2 days)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">ID: {emp.employeeId} • Shift: {emp.shiftStartTimeRaw ? formatShiftTime(emp.shiftStartTimeRaw, emp.shiftStartTime) : (emp.shiftStartTime || "Not Started")}</p>
                                                            </div>
                                                        </div>

                                                        <button 
                                                            onClick={() => toggleKeepAnEye(emp.employeeId)}
                                                            className={`py-2.5 px-5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 shrink-0 ${
                                                                isExpanded 
                                                                    ? "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200" 
                                                                    : "bg-brand-blue/10 text-brand-blue border border-brand-blue/10 hover:bg-brand-blue hover:text-white hover:shadow-md hover:shadow-brand-blue/15"
                                                            }`}
                                                        >
                                                            <FiEye size={14} />
                                                            {isExpanded ? "Hide 2-Day History" : "View 2-Day History"}
                                                        </button>
                                                    </div>

                                                    {/* Expanded Screenshots Log Grid */}
                                                    {isExpanded && (
                                                        <div className="border-t border-slate-50 pt-5 space-y-4 animate-fade-in">
                                                            {data.isLoading && data.screenshots.length === 0 ? (
                                                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                                    <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Syncing 2-day screenshots from database...</p>
                                                                </div>
                                                            ) : data.screenshots.length === 0 ? (
                                                                <p className="text-xs text-slate-400 text-center py-6 font-semibold bg-slate-50/50 rounded-xl">
                                                                    No screenshot uploads captured in the last 2 days for this employee.
                                                                </p>
                                                            ) : (
                                                                <div className="space-y-6">
                                                                    <div className="flex items-center justify-between px-1">
                                                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                                                            Showing {data.screenshots.length} of {data.totalCount ?? data.screenshots.length} captures (Last 48 Hours)
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-brand-peacock">
                                                                            Every 30 Min Interval
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                                        {data.screenshots.map((ss: any) => (
                                                                            <div 
                                                                                key={ss.id} 
                                                                                onClick={() => setZoomedScreenshot(ss.imageUrl)}
                                                                                className="group bg-slate-50 border border-slate-100 rounded-2xl p-2.5 hover:shadow-md hover:border-slate-200/80 transition-all duration-300 cursor-pointer flex flex-col gap-2 relative overflow-hidden"
                                                                            >
                                                                                {/* Image container */}
                                                                                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-200 border border-slate-100 flex items-center justify-center relative">
                                                                                    <img 
                                                                                        src={ss.imageUrl} 
                                                                                        alt="Work Capture" 
                                                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-brand-blue/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                                                        <span className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-bold text-brand-blue uppercase tracking-widest shadow-md">
                                                                                            Zoom View
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                
                                                                                {/* App and capture time */}
                                                                                <div className="px-1 flex flex-col gap-0.5">
                                                                                    <span className="text-[9px] font-bold text-slate-800 truncate" title={ss.activeWindow}>
                                                                                        {ss.activeWindow}
                                                                                    </span>
                                                                                    <span className="text-[8px] font-black text-brand-peacock uppercase tracking-widest">
                                                                                        {ss.timestamp}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {/* View More Option */}
                                                                    {data.hasMore && (
                                                                        <div className="flex justify-center pt-2">
                                                                            <button 
                                                                                onClick={() => fetchScreenshotsForEmp(emp.employeeId, true)}
                                                                                disabled={data.isLoading}
                                                                                className="py-2.5 px-6 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600 hover:text-slate-800 font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all duration-300 disabled:opacity-50"
                                                                            >
                                                                                {data.isLoading ? (
                                                                                    <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                                                                ) : (
                                                                                    "View More Captures"
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>
                    )}

                    {activeMenu === "Task Logs" && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4">
                                <h3 className="text-lg font-black text-slate-800">Assigned Team Task Logs</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Global overview of today's assigned, completed, and checked WFH shift tasks.</p>
                            </div>

                            <div className="space-y-4">
                                {employees.map((emp: EmployeeAuditData) => {
                                    const assigned = emp.tasks.filter(t => t.text.trim() !== "");
                                    if (assigned.length === 0) return null;
                                    return (
                                        <div key={emp.employeeId} className="border border-slate-100 rounded-2xl p-5 space-y-3">
                                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-800">{mapName(emp.name)}</span>
                                                    <span className="text-[10px] text-slate-400">({emp.employeeId})</span>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-wider ${emp.pdfReport ? "text-green-500" : "text-amber-500"}`}>
                                                    {emp.pdfReport ? "Report Uploaded" : "Report Pending"}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {assigned.map((t: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-3 text-xs text-slate-600 font-semibold">
                                                        <FiCheck className={t.completed ? "text-green-500 stroke-[3]" : "text-slate-200"} size={14} />
                                                        <span className={t.completed ? "line-through text-slate-400" : ""}>{t.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeMenu === "Shifts Log" && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-peacock bg-brand-peacock/5 border border-brand-peacock/10 px-3 py-1 rounded-full">
                                        HISTORICAL COMPLIANCE LOGS
                                    </span>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight mt-2">Historical WFH Shift Log</h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Chronological audit trail of remote employee clock-in and clock-out coordinates.</p>
                                </div>
                                <button 
                                    onClick={fetchShiftsLog}
                                    className="px-4 py-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm"
                                >
                                    Refresh Logs
                                </button>
                            </div>

                            {isLoadingShiftsLog ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-3">
                                    <div className="w-8 h-8 rounded-full border-4 border-brand-blue border-t-transparent animate-spin" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Syncing historical logs...</span>
                                </div>
                            ) : shiftsLog.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-50/50 border border-slate-100 rounded-2xl">
                                    No historical WFH shift sessions found.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                                                <th className="py-4 px-5">Employee</th>
                                                <th className="py-4 px-5">Date</th>
                                                <th className="py-4 px-5">Shift Start</th>
                                                <th className="py-4 px-5">Shift End</th>
                                                <th className="py-4 px-5">Start Location</th>
                                                <th className="py-4 px-5">End Location</th>
                                                <th className="py-4 px-5 text-center">Tasks</th>
                                                <th className="py-4 px-5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                                            {shiftsLog.map((log) => {
                                                const initials = log.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "EM";
                                                return (
                                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4.5 px-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                                                    {initials}
                                                                </div>
                                                                <div>
                                                                    <h5 className="font-bold text-slate-800 leading-tight">{log.name}</h5>
                                                                    <span className="text-[10px] text-slate-400 mt-0.5 block">{log.employeeId}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4.5 px-5 tabular-nums text-slate-500">{log.shiftDate}</td>
                                                        <td className="py-4.5 px-5 text-slate-700 tabular-nums">{formatShiftTime((log as any).shiftStartTimeRaw, log.shiftStartTime)}</td>
                                                        <td className="py-4.5 px-5">
                                                            {log.shiftEndTime ? (
                                                                <span className="text-slate-700 tabular-nums">{formatShiftTime((log as any).shiftEndTimeRaw, log.shiftEndTime)}</span>
                                                            ) : (
                                                                <span className="text-green-500 font-bold uppercase text-[9px] px-2 py-0.5 rounded-md bg-green-50 border border-green-200">Active</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4.5 px-5">
                                                            <p className="max-w-[150px] truncate text-[10px] text-slate-500" title={log.startAddress}>
                                                                {log.startAddress || "N/A"}
                                                            </p>
                                                        </td>
                                                        <td className="py-4.5 px-5">
                                                            <p className="max-w-[150px] truncate text-[10px] text-slate-500" title={log.endAddress}>
                                                                {log.endAddress || "--"}
                                                            </p>
                                                        </td>
                                                        <td className="py-4.5 px-5 text-center text-slate-500">
                                                            <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                                {log.tasksCompletedCount}/{log.tasksCount}
                                                            </span>
                                                        </td>
                                                        <td className="py-4.5 px-5 text-right">
                                                            <button
                                                                onClick={() => {
                                                                    const auditData: EmployeeAuditData = {
                                                                        employeeId: log.employeeId,
                                                                        name: log.name,
                                                                        avatar: initials,
                                                                        role: log.role,
                                                                        isWfhActive: log.status === "Active",
                                                                        wfhDaysCount: 1,
                                                                        currentStatus: log.status === "Active" ? "Active" : "Offline",
                                                                        cursorStatus: "Offline",
                                                                        shiftStartTime: log.shiftStartTime,
                                                                        shiftEndTime: log.shiftEndTime,
                                                                        shiftStatus: log.status,
                                                                        breaks: {
                                                                            shortBreaksLeft: Math.max(0, 3 - log.breaks.filter((b: any) => b.name.includes("Short")).length),
                                                                            lunchBreakUsed: log.breaks.some((b: any) => b.name.includes("Lunch")),
                                                                            totalDuration: "0m",
                                                                            history: log.breaks
                                                                        },
                                                                        tasks: log.tasks,
                                                                        pdfReport: log.pdfReportName ? {
                                                                            name: log.pdfReportName,
                                                                            size: log.pdfReportSize || "0.00 MB",
                                                                            uploadedAt: "Uploaded upon completion"
                                                                        } : null,
                                                                        activityLogs: [
                                                                            `Shift started at ${log.shiftStartTime}`,
                                                                            log.shiftEndTime ? `Shift ended at ${log.shiftEndTime}` : "Shift is still active"
                                                                        ],
                                                                        latestCoordinate: { x: 0, y: 0 },
                                                                        latitude: log.latitude,
                                                                        longitude: log.longitude,
                                                                        startAddress: log.startAddress,
                                                                        locationFetchedAt: log.shiftStartTime,
                                                                        endLatitude: log.endLatitude,
                                                                        endLongitude: log.endLongitude,
                                                                        endAddress: log.endAddress,
                                                                        endLocationFetchedAt: log.shiftEndTime
                                                                    };
                                                                    setDetailsModalEmp(auditData);
                                                                }}
                                                                className="px-3 py-1.5 bg-brand-blue/5 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg text-[10px] font-bold tracking-wider uppercase cursor-pointer transition-all duration-200"
                                                            >
                                                                Audit
                                                            </button>
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

                    {activeMenu === "PDF Reports" && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-peacock bg-brand-peacock/5 border border-brand-peacock/10 px-3 py-1 rounded-full">
                                        EMPLOYEE DOCUMENT ARCHIVE
                                    </span>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight mt-2">Daily PDF Work Reports</h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Audit files uploaded chronologically by employees upon shift completion.</p>
                                </div>
                                <button 
                                    onClick={fetchDailyPdfReports}
                                    className="px-4 py-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm"
                                >
                                    Refresh Reports
                                </button>
                            </div>

                            {isLoadingReports ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-3">
                                    <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs font-semibold text-slate-400">Loading daily reports archive...</span>
                                </div>
                            ) : pdfReports.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                                    <FiFileText size={32} className="text-slate-300" />
                                    <span>No daily PDF reports have been uploaded today.</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {pdfReports.map((report) => (
                                        <div 
                                            key={report.shiftId}
                                            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-brand-blue/30 transition-all duration-300 flex flex-col justify-between gap-4 relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-blue to-brand-peacock opacity-60" />
                                            
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-bold text-brand-blue bg-brand-blue/5 border border-brand-blue/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                        {report.employeeId}
                                                    </span>
                                                    <h4 className="text-sm font-bold text-slate-800 tracking-tight mt-2 truncate">
                                                        {report.employeeName}
                                                    </h4>
                                                    <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                                        {report.employeeEmail}
                                                    </p>
                                                </div>
                                                <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                                    <FiFileText size={20} />
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 text-xs font-semibold text-slate-500">
                                                <div className="flex justify-between">
                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Shift Date</span>
                                                    <span className="text-slate-700 font-bold">{report.date}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Upload Time</span>
                                                    <span className="text-slate-700 font-bold tabular-nums">{report.uploadedAt}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">File Size</span>
                                                    <span className="text-slate-700 font-bold tabular-nums">{report.pdfReportSize}</span>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => window.open(`${API_BASE_URL}/api/files/download/reports/${report.pdfReportName}?token=${sessionStorage.getItem("wfh_auth_token")}`, "_blank")}
                                                className="w-full bg-gradient-to-r from-brand-blue to-brand-peacock text-white py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest text-center shadow-md shadow-brand-blue/10 hover:shadow-lg active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer outline-none border-none"
                                            >
                                                <FiFileText size={12} /> Audit PDF Document
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </main>
 
                {/* Footer */}
                <footer className="h-12 border-t border-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-auto select-none pointer-events-none flex-shrink-0">
                    © 2026 company@demo
                </footer>
            </div>
 
            {/* Elegant Glassmorphic VIEW DETAILS MODAL POPUP */}
            {detailsModalEmp && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto transition-all transform scale-100">
                        {/* Header Color Band */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-blue to-brand-peacock" />
                        
                        {/* Close button */}
                        <button 
                            onClick={() => setDetailsModalEmp(null)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-2 rounded-xl outline-none cursor-pointer"
                        >
                            <FiX size={18} />
                        </button>
 
                        {/* Modal Header */}
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-6">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-black text-lg shadow">
                                {detailsModalEmp.avatar}
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 leading-tight">{detailsModalEmp.name}</h3>
                                <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5 tracking-wider">{detailsModalEmp.role} • ID: {detailsModalEmp.employeeId}</p>
                            </div>
                        </div>

                        {/* WFH Shift Timing Overview Card */}
                        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 grid grid-cols-3 gap-4 shadow-sm animate-fade-in">
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Shift Start Time</span>
                                <p className="text-xs font-black text-slate-700 mt-1 tabular-nums">
                                    {formatShiftTime(detailsModalEmp.shiftStartTimeRaw, detailsModalEmp.shiftStartTime)}
                                </p>
                                {detailsModalEmp.isWfhActive && detailsModalEmp.shiftStartTimeRaw && (
                                    <p className="text-[9px] font-bold text-emerald-600 tabular-nums mt-0.5 animate-pulse">
                                        ⏱ {getElapsedShiftTime(detailsModalEmp.shiftStartTimeRaw)}
                                    </p>
                                )}
                            </div>
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Shift End Time</span>
                                <p className="text-xs font-black text-slate-700 mt-1 tabular-nums">
                                    {detailsModalEmp.isWfhActive ? (
                                        <span className="text-emerald-600 font-bold text-[10px] animate-pulse">● Active Now</span>
                                    ) : (
                                        formatShiftTime(detailsModalEmp.shiftEndTimeRaw, detailsModalEmp.shiftEndTime) || "--:--"
                                    )}
                                </p>
                            </div>
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Shift Status</span>
                                <span className={`inline-block mt-1 text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                    detailsModalEmp.isWfhActive 
                                        ? (detailsModalEmp.currentStatus === "On Break" ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse" : "bg-green-50 border-green-200 text-green-600 animate-pulse")
                                        : (detailsModalEmp.shiftStatus === "Completed" ? "bg-blue-50 border-blue-200 text-blue-600" :
                                           detailsModalEmp.shiftStatus === "Half Day" ? "bg-amber-50 border-amber-200 text-amber-600" :
                                           detailsModalEmp.shiftStatus === "Absent" ? "bg-red-50 border-red-200 text-red-600" :
                                           "bg-slate-50 border-slate-200 text-slate-400")
                                }`}>
                                    {detailsModalEmp.isWfhActive 
                                        ? (detailsModalEmp.currentStatus === "On Break" ? "On Break" : "Active") 
                                        : (detailsModalEmp.shiftStatus || (detailsModalEmp.shiftStartTime ? "Completed" : "Not Started"))}
                                </span>
                            </div>
                        </div>
 
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Breaks logs inside Modal */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-50 pb-2">
                                    <FiCoffee size={14} className="text-amber-500" />
                                    Clocked Breaks Log
                                </h4>
                                <div className="space-y-2">
                                    {detailsModalEmp.breaks.history.map((brk, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 border border-slate-100/50 rounded-xl p-2.5 font-semibold">
                                            <span className="text-slate-600">{brk.name}</span>
                                            <span className={brk.status === "Used" ? "text-amber-600" : "text-slate-400"}>
                                                {brk.status === "Used" ? `Clocked at ${brk.time}` : brk.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Live coordinates inside Modal */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-50 pb-2">
                                    <FiMonitor size={14} className="text-brand-blue" />
                                    Live Heartbeats Telemetry
                                </h4>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-2.5 font-mono text-[9px] font-semibold text-slate-500 max-h-[140px] overflow-y-auto">
                                    {detailsModalEmp.activityLogs.map((log, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-brand-peacock shrink-0" />
                                            <span className="truncate">{log}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* WFH Shift Start Geolocation Card */}
                        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <FiCompass className="text-brand-blue" size={15} />
                                    WFH Clock-In Geolocation Audit
                                </h4>
                                {detailsModalEmp.locationFetchedAt && (
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        Synced at {new Date(detailsModalEmp.locationFetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                    </span>
                                )}
                            </div>

                            {detailsModalEmp.startAddress ? (
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-brand-blue/5 text-brand-blue flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-brand-blue/10">
                                            <FiMapPin size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Resolved Physical Address</span>
                                            <p className="text-xs font-semibold text-slate-700 leading-normal mt-0.5">
                                                {detailsModalEmp.startAddress}
                                            </p>
                                        </div>
                                    </div>

                                    {detailsModalEmp.latitude && detailsModalEmp.longitude && (
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200/50">
                                            <div className="text-[10px] font-bold text-slate-500 font-mono">
                                                COORDINATES: {detailsModalEmp.latitude.toFixed(6)}, {detailsModalEmp.longitude.toFixed(6)}
                                            </div>
                                            <button
                                                onClick={() => window.open(`https://www.google.com/maps?q=${detailsModalEmp.latitude},${detailsModalEmp.longitude}`, "_blank")}
                                                className="py-2 px-3.5 rounded-xl bg-brand-blue text-white font-extrabold text-[9px] uppercase tracking-wider hover:bg-brand-blue/90 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer outline-none border-none flex items-center gap-1.5"
                                            >
                                                <FiMapPin size={10} /> View on Google Maps
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2.5 text-xs text-slate-400 bg-white border border-slate-100 rounded-xl p-3.5">
                                    <FiCompass size={16} />
                                    <span>Location auditing telemetry was offline for this shift session.</span>
                                </div>
                            )}
                        </div>

                        {/* WFH Shift End Geolocation Card */}
                        {detailsModalEmp.endAddress && (
                            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 space-y-4 shadow-sm animate-fade-in">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                        <FiCompass className="text-brand-peacock" size={15} />
                                        WFH Clock-Out Geolocation Audit
                                    </h4>
                                    {detailsModalEmp.endLocationFetchedAt && (
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            Synced at {new Date(detailsModalEmp.endLocationFetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-brand-peacock/5 text-brand-peacock flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-brand-peacock/10">
                                            <FiMapPin size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Resolved Physical Address</span>
                                            <p className="text-xs font-semibold text-slate-700 leading-normal mt-0.5">
                                                {detailsModalEmp.endAddress}
                                            </p>
                                        </div>
                                    </div>

                                    {detailsModalEmp.endLatitude && detailsModalEmp.endLongitude && (
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200/50">
                                            <div className="text-[10px] font-bold text-slate-500 font-mono">
                                                COORDINATES: {detailsModalEmp.endLatitude.toFixed(6)}, {detailsModalEmp.endLongitude.toFixed(6)}
                                            </div>
                                            <button
                                                onClick={() => window.open(`https://www.google.com/maps?q=${detailsModalEmp.endLatitude},${detailsModalEmp.endLongitude}`, "_blank")}
                                                className="py-2 px-3.5 rounded-xl bg-brand-peacock text-white font-extrabold text-[9px] uppercase tracking-wider hover:bg-brand-peacock/90 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer outline-none border-none flex items-center gap-1.5"
                                            >
                                                <FiMapPin size={10} /> View on Google Maps
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
  
                        {/* Tasks assigned inside Modal */}
                        <div className="space-y-3 border-t border-slate-100 pt-5 mb-6">
                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-50 pb-2">
                                <FiCheckSquare size={14} className="text-green-500" />
                                Assigned WFH Planner Checklist
                            </h4>
                            <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                                {detailsModalEmp.tasks.map((task, index) => (
                                    <div key={index} className="flex items-center gap-3 text-xs bg-slate-50/50 border border-slate-100 rounded-xl p-2.5 font-semibold text-slate-600">
                                        <FiCheck className={task.completed ? "text-green-500 stroke-[3]" : "text-slate-200"} size={14} />
                                        <span className={task.completed ? "line-through text-slate-400" : ""}>{task.text}</span>
                                        {task.completed && task.completedAt && (
                                            <span className="text-[8px] font-bold text-green-500 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 ml-auto">
                                                {task.completedAt.replace("Completed at ", "")}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
 
                        {/* PDF Uploader card inside Modal */}
                        {detailsModalEmp.pdfReport ? (
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm mb-6 animate-fade-in">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center shadow shrink-0">
                                        <FiFileText size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <h5 className="text-xs font-bold text-slate-700 truncate leading-tight">{detailsModalEmp.pdfReport.name}</h5>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{detailsModalEmp.pdfReport.size} • {detailsModalEmp.pdfReport.uploadedAt}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => detailsModalEmp.pdfReport?.name && window.open(`${API_BASE_URL}/api/files/download/reports/${detailsModalEmp.pdfReport.name}?token=${sessionStorage.getItem("wfh_auth_token")}`, "_blank")}
                                    className="py-2.5 px-4 rounded-xl bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-slate-900 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-sm text-center"
                                >
                                    Audit PDF Document
                                </button>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 rounded-xl mb-6">
                                🚨 Missing Compliance PDF Report submission for today!
                            </div>
                        )}

                        {/* Screenshots Timeline inside Modal */}
                        <div className="space-y-3 border-t border-slate-100 pt-5 mb-6">
                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-50 pb-2">
                                <FiMonitor size={14} className="text-brand-blue" />
                                Screenshots & Window Timeline (30m Interval)
                            </h4>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[220px] overflow-y-auto pr-1 py-1">
                                {isLoadingScreenshots ? (
                                    <div className="col-span-3 py-10 flex flex-col items-center justify-center text-slate-400">
                                        <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-[10px] font-bold mt-2 uppercase tracking-wider">Syncing screen telemetry...</span>
                                    </div>
                                ) : employeeScreenshots.length === 0 ? (
                                    <div className="col-span-3 py-10 text-center text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-50 border border-slate-100 rounded-2xl">
                                        No screenshot logs registered for this shift.
                                    </div>
                                ) : (
                                    employeeScreenshots.map((ss, idx) => (
                                        <div 
                                            key={ss.id || idx} 
                                            onClick={() => setZoomedScreenshot(ss.imageUrl)}
                                            className="relative bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm group cursor-zoom-in hover:border-brand-blue transition-all duration-300 animate-fade-in"
                                        >
                                            <div className="h-24 relative overflow-hidden bg-slate-900 flex items-center justify-center">
                                                <img 
                                                    src={ss.imageUrl} 
                                                    alt="Telemetry screenshot" 
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    onError={(e) => {
                                                        // Fallback in case of static asset load error
                                                        e.currentTarget.src = "/vscode_screenshot.png";
                                                    }}
                                                />
                                                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-all flex items-center justify-center">
                                                    <FiSearch className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={18} />
                                                </div>
                                            </div>
                                            <div className="p-2.5 space-y-1 bg-white">
                                                <p className="text-[9px] font-black text-slate-700 truncate leading-tight" title={ss.activeWindow}>{ss.activeWindow}</p>
                                                <div className="flex justify-between items-center text-[8px] font-extrabold text-slate-400">
                                                    <span>{ss.timestamp}</span>
                                                    <span className="text-brand-peacock">{ss.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
 
                        <button 
                            onClick={() => setDetailsModalEmp(null)}
                            className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-900 active:scale-[0.98] transition-all text-xs cursor-pointer shadow-sm shadow-slate-900/10 text-center"
                        >
                            Dismiss Audit Report
                        </button>
                    </div>
                </div>
            )}

            {/* FULLSCREEN LIVE SCREEN VIEWER MODAL */}
            {selectedLiveScreenEmp && (() => {
                const modalLiveData = liveFrames[selectedLiveScreenEmp.employeeId];
                const modalIsStreaming = modalLiveData && (Date.now() - modalLiveData.timestamp < 12000);
                const modalImage = (modalIsStreaming && modalLiveData?.frame) || liveScreenStreamUrl || selectedLiveScreenEmp.latestScreenshot?.imageUrl;
                const modalActiveWindow = (modalIsStreaming && modalLiveData?.activeWindow) || selectedLiveScreenEmp.latestScreenshot?.activeWindow || "Active Desktop Workspace";

                return (
                    <div className={`fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 animate-fade-in ${isModalFullscreen ? "p-0" : ""}`}>
                        <div className={`bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isModalFullscreen ? "w-screen h-screen max-w-none max-h-none rounded-none" : "rounded-3xl max-w-5xl w-full max-h-[95vh]"}`}>
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-sm shadow shrink-0">
                                        {selectedLiveScreenEmp.avatar}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base font-bold text-slate-800">{mapName(selectedLiveScreenEmp.name)}</h3>
                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                {selectedLiveScreenEmp.employeeId}
                                            </span>
                                            {modalIsStreaming ? (
                                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                                    ⚡ REAL-TIME STREAM
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                                    STANDBY
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                                            <span ref={modalActiveBadgeRef}>{modalActiveWindow} • Shift started at: {formatShiftTime(selectedLiveScreenEmp.shiftStartTimeRaw, selectedLiveScreenEmp.shiftStartTime)}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button 
                                        onClick={() => setIsModalFullscreen(!isModalFullscreen)}
                                        title={isModalFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
                                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm"
                                    >
                                        <FiMaximize2 size={14} />
                                        <span className="hidden sm:inline">{isModalFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                                    </button>

                                    <button 
                                        onClick={() => {
                                            setSelectedLiveScreenEmp(null);
                                            setIsModalFullscreen(false);
                                        }}
                                        className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                                    >
                                        <FiX size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body: Large Screen View */}
                            <div className="flex-1 bg-slate-950 p-4 sm:p-6 flex items-center justify-center overflow-hidden min-h-[350px] sm:min-h-[500px] relative">
                                {modalImage ? (
                                    <div className="relative flex items-center justify-center w-full h-full">
                                        <img 
                                            ref={modalImgRef}
                                            src={modalImage} 
                                            alt="Live Desktop" 
                                            className={`${isModalFullscreen ? "max-h-[85vh]" : "max-h-[70vh]"} w-auto max-w-full object-contain rounded-xl shadow-2xl border border-slate-800`}
                                        />
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 space-y-3 py-20">
                                        <FiTv size={48} className="text-emerald-400 animate-pulse mx-auto" />
                                        <p className="text-sm font-bold">Waiting for live video screen frame from employee workstation...</p>
                                    </div>
                                )}

                                {/* Floating Stream Badge */}
                                <div className="absolute bottom-6 right-6 bg-slate-900/85 backdrop-blur-md border border-slate-700 text-slate-300 text-[10px] font-bold px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-lg pointer-events-none">
                                    <span className={`h-2 w-2 rounded-full ${modalIsStreaming ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`}></span>
                                    <span>{modalIsStreaming ? "⚡ Real-Time Live Screen Stream" : "Latest Screen Snapshot"}</span>
                                </div>
                            </div>

                            {/* Modal Footer: Live Telemetry */}
                            <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-4 text-slate-600 font-medium">
                                    <span className="flex items-center gap-1.5">
                                        <FiActivity className="text-emerald-500" size={14} />
                                        <span>Status: <strong className="text-emerald-600">{selectedLiveScreenEmp.currentStatus || "Active"}</strong></span>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span>Monitoring: <strong className="text-emerald-600">Continuous Screen Active</strong></span>
                                    </span>
                                    {selectedLiveScreenEmp.startAddress && (
                                        <span className="flex items-center gap-1.5 truncate max-w-xs text-slate-500">
                                            <FiMapPin className="text-slate-400" size={14} />
                                            <span className="truncate">{selectedLiveScreenEmp.startAddress}</span>
                                        </span>
                                    )}
                                </div>

                                <button 
                                    onClick={() => {
                                        setSelectedLiveScreenEmp(null);
                                        setIsModalFullscreen(false);
                                    }}
                                    className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                                >
                                    Close Live View
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Lightbox Zoom Modal Overlay */}
            {zoomedScreenshot && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 animate-fade-in animate-duration-200">
                    <button 
                        onClick={() => setZoomedScreenshot(null)}
                        className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all outline-none cursor-pointer border border-white/10"
                    >
                        <FiX size={24} />
                    </button>
                    
                    <div className="max-w-4xl w-full max-h-[80vh] overflow-hidden rounded-3xl border border-white/10 shadow-2xl relative bg-slate-900 flex items-center justify-center">
                        <img 
                            src={zoomedScreenshot} 
                            alt="Zoomed Telemetry Capture" 
                            className="w-full h-auto object-contain max-h-[80vh]"
                        />
                    </div>
                    
                    <p className="text-xs text-white/60 font-bold uppercase tracking-widest mt-6">
                        🔍 Double-Click Image or click top close button to exit telemetry review
                    </p>
                </div>
            )}
        </div>
    );
};
 
export default AdminDashboard;
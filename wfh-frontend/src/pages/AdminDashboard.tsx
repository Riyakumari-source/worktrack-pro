import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
    FiMapPin
} from "react-icons/fi";
import { API_BASE_URL } from "../config";

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
    shiftEndTime?: string;
    shiftStatus?: string;
    shiftDateRaw?: string;      // YYYY-MM-DD for date grouping
    shiftDateLabel?: string;    // e.g. "Sep 8, 2026" for display
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
 
    // Selected employee details modal popup
    const [detailsModalEmp, setDetailsModalEmp] = useState<EmployeeAuditData | null>(null);

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
    const [expandedEmpIds, setExpandedEmpIds] = useState<string[]>([]);
    const [expandedScreenshots, setExpandedScreenshots] = useState<Record<string, {
        screenshots: any[];
        skip: number;
        hasMore: boolean;
        isLoading: boolean;
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

                    setExpandedScreenshots(prev => {
                        const existing = prev[employeeId]?.screenshots || [];
                        const newList = isLoadMore ? [...existing, ...formatted] : formatted;
                        return {
                            ...prev,
                            [employeeId]: {
                                screenshots: newList,
                                skip: skip,
                                hasMore: data.hasMore || false,
                                isLoading: false
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
                    setEmployees(data.feed);
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
            setCurrentTime(now.toLocaleTimeString("en-US", { hour12: true }));
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
        { name: "Employees", icon: <FiUser size={18} /> },
        { name: "Shifts Log", icon: <FiCalendar size={18} /> },
        { name: "Screenshots", icon: <FiMonitor size={18} /> },
        { name: "Task Logs", icon: <FiCheckSquare size={18} /> },
        { name: "PDF Reports", icon: <FiFileText size={18} /> }
    ];
 
    return (
        <div className="min-h-screen bg-[#F8F7FF] flex relative overflow-hidden font-[Inter,sans-serif] select-none">
            {/* Background Accent Blobs */}
            <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-blue/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-peacock/4 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
 
            {/* Sidebar (Matching EmployeeSidebar Theme exactly) */}
            <div className="w-64 min-h-screen bg-white border-r border-slate-100 p-6 flex flex-col justify-between flex-shrink-0 z-20">
                <div>
                    {/* Logo Section */}
                    <div className="flex items-center gap-3 mb-10 px-2">
                        <img 
                            src="/logo.png" 
                            alt="Company Logo" 
                            className="h-9 w-auto object-contain animate-fade-in"
                        />
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
                                    <span>{item.name}</span>
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
            </div>
 
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-y-auto z-10">
                {/* Navbar (Same clean style) */}
                <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between shadow-sm flex-shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-blue bg-brand-blue/5 border border-brand-blue/10 px-3 py-1 rounded-full">
                            ADMIN CONTROL BOARD
                        </span>
                    </div>
 
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                            <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl shadow-sm">
                                <FiCalendar className="text-brand-blue" size={16} />
                                <span>{currentDate || "Loading..."}</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl shadow-sm min-w-[110px]">
                                <FiClock className="text-brand-peacock" size={16} />
                                <span className="tabular-nums">{currentTime || "Loading..."}</span>
                            </div>
                        </div>
 
                        <div className="h-6 w-px bg-slate-200" />
 
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
                            className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300 cursor-pointer shadow-sm"
                            title="Log Out"
                        >
                            <FiLogOut size={18} />
                        </button>
                    </div>
                </header>
 
                {/* Dashboard body */}
                <main className="flex-1 p-8 flex flex-col gap-8 max-w-7xl mx-auto w-full relative">
                    
                    {/* Header welcome banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                                {activeMenu === "Overview" ? "WFH Shift Realtime Overview" : "Remote Work Compliance Audits"}
                            </h2>
                            <p className="text-sm text-slate-400 mt-1 font-medium">
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
                                                    <div 
                                                        key={emp.employeeId}
                                                        className="bg-white rounded-2xl border px-5 py-4 shadow-sm border-brand-blue ring-2 ring-brand-blue/5 shadow-brand-blue/5 shadow-md flex items-center justify-between gap-4"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)] shrink-0" />
                                                            <div className="min-w-0">
                                                                <h4 className="text-sm font-bold text-slate-800 leading-tight truncate">{emp.name}</h4>
                                                                <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5 uppercase">{emp.employeeId}</p>
                                                            </div>
                                                        </div>
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
                                                        <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">{emp.name}</h4>
                                                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{emp.employeeId} • {emp.role.replace(/\s*\(.*?\)\s*/g, "")}</p>
                                                    </div>
                                                </div>

                                                {/* Status badge */}
                                                <div className="lg:w-1/5 shrink-0">
                                                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 w-fit ${
                                                        isActiveShift
                                                            ? (emp.currentStatus === "On Break" ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse" : "bg-green-50 border-green-200 text-green-600 animate-pulse")
                                                            : (emp.shiftStatus === "Completed" ? "bg-indigo-50 border-indigo-200 text-indigo-600" :
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
                                                        {emp.shiftStartTime
                                                            ? emp.shiftStartTime.replace(/\s*\(.*?\)\s*/, "")
                                                            : "--:--"}
                                                    </span>
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
                                                                        <h4 className="text-xs font-bold text-slate-600 leading-tight truncate">{emp.name}</h4>
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
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
                            {/* KPI cards grid for context */}
                            <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 text-brand-blue flex items-center justify-center">
                                        <FiUser size={22} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Total Employees</span>
                                        <h4 className="text-xl font-black text-slate-800 mt-0.5">{employees.length} Users</h4>
                                    </div>
                                </div>
 
                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-green-500/5 text-green-500 flex items-center justify-center font-bold">
                                        <FiActivity size={22} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">WFH Active Today</span>
                                        <h4 className="text-xl font-black text-slate-800 mt-0.5">{employees.filter(e => e.isWfhActive).length} Online</h4>
                                    </div>
                                </div>
 
                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/5 text-amber-500 flex items-center justify-center">
                                        <FiCoffee size={22} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Active Break Logs</span>
                                        <h4 className="text-xl font-black text-slate-800 mt-0.5">{employees.filter(e => e.currentStatus === "On Break").length} On Break</h4>
                                    </div>
                                </div>
 
                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-peacock/5 text-brand-peacock flex items-center justify-center">
                                        <FiFileText size={22} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Task Submissions</span>
                                        <h4 className="text-xl font-black text-slate-800 mt-0.5">{employees.reduce((acc, curr) => acc + (curr.tasks ? curr.tasks.filter((t: any) => t.completed).length : 0), 0)} Completed</h4>
                                    </div>
                                </div>
                            </div>
 
                            {/* LEFT COLUMN: Search & Filterable employee list (col-span-4) */}
                            <div className="lg:col-span-4 space-y-4">
                                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                                    <h3 className="text-sm font-bold text-slate-700">Search Remote Team</h3>
                                    
                                    {/* Sleek Search Bar */}
                                    <div className="relative flex items-center">
                                        <input 
                                            type="text" 
                                            placeholder="Search by name, ID, or role..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-300 outline-none focus:border-brand-blue transition-all duration-200 text-xs font-semibold"
                                        />
                                        <FiSearch className="absolute left-3.5 text-slate-300" size={16} />
                                    </div>
 
                                    {/* Employee listings */}
                                    <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                                        {filteredEmployees.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-6 font-medium">No active employees match search query.</p>
                                        ) : (
                                            filteredEmployees.map((emp) => {
                                                const isSelected = emp.employeeId === selectedEmpId;
                                                const isActive = emp.isWfhActive && emp.currentStatus !== "Offline";
                                                return (
                                                    <div 
                                                        key={emp.employeeId}
                                                        onClick={() => setSelectedEmpId(emp.employeeId)}
                                                        className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between cursor-pointer ${
                                                            isSelected 
                                                                ? "border-brand-blue ring-4 ring-brand-blue/5 bg-brand-blue/5 shadow-sm" 
                                                                : "border-slate-100 hover:border-slate-200 bg-white"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-xs shadow shrink-0">
                                                                {emp.avatar}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h5 className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                                                                    {emp.name}
                                                                    {isActive && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Working from Home" />
                                                                    )}
                                                                </h5>
                                                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-tight">{emp.role} • {emp.employeeId}</p>
                                                            </div>
                                                        </div>
 
                                                        {/* Status Pill */}
                                                        <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                                            isActive ? "bg-green-50 border-green-200 text-green-600" :
                                                            emp.currentStatus === "On Break" ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse" :
                                                            "bg-slate-50 border-slate-200 text-slate-400"
                                                        }`}>
                                                            {isActive ? "Working" : emp.currentStatus}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
 
                            {/* RIGHT COLUMN: Selected Employee Analytics Dashboard Details (col-span-8) */}
                            <div className="lg:col-span-8 space-y-6">
                                
                                {/* Employee summary analytics overview */}
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-blue to-brand-peacock" />
                                    
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-black text-lg shadow-lg">
                                                {currentEmployee.avatar}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-800 leading-tight">{currentEmployee.name}</h3>
                                                <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5 tracking-wider">{currentEmployee.role} • WFH Code: {currentEmployee.employeeId}</p>
                                            </div>
                                        </div>
 
                                        {/* WFH status details */}
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 shadow-sm text-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">WFH Taken</span>
                                                <span className="text-xs font-black text-brand-blue mt-0.5 block">{currentEmployee.wfhDaysCount} Days</span>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 shadow-sm text-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Today Shift Status</span>
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
                                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 grid grid-cols-2 gap-4 shadow-sm animate-fade-in">
                                        <div>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Shift Start Time</span>
                                            <span className="text-xs font-black text-slate-700 mt-1 block tabular-nums">
                                                {currentEmployee.shiftStartTime ? (currentEmployee.shiftStartTime.includes(" ") ? `${currentEmployee.shiftStartTime.split(" ")[0]} ${currentEmployee.shiftStartTime.split(" ")[1]}` : currentEmployee.shiftStartTime) : "--:--"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Shift End Time</span>
                                            <span className="text-xs font-black text-slate-700 mt-1 block tabular-nums">
                                                {currentEmployee.shiftEndTime ? (currentEmployee.shiftEndTime.includes(" ") ? `${currentEmployee.shiftEndTime.split(" ")[0]} ${currentEmployee.shiftEndTime.split(" ")[1]}` : currentEmployee.shiftEndTime) : (currentEmployee.isWfhActive ? "Active Now" : "--:--")}
                                            </span>
                                        </div>
                                    </div>
 
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* 1. Breaks Audit Widget */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                    <FiCoffee size={14} className="text-amber-500" />
                                                    Breaks Audit Logs
                                                </h4>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Total Break: {currentEmployee.breaks.totalDuration}
                                                </span>
                                            </div>
 
                                            <div className="grid grid-cols-2 gap-3.5">
                                                {currentEmployee.breaks.history.map((brk, idx) => (
                                                    <div 
                                                        key={idx}
                                                        className={`rounded-2xl border p-3 flex flex-col justify-between h-20 transition-all duration-300 ${
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
                                                            <h5 className="text-[10px] font-bold text-slate-800 leading-tight">{brk.name}</h5>
                                                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{brk.time}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
 
                                        {/* 2. Remote tracking telemetry */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                    <FiMonitor size={14} className="text-brand-blue" />
                                                    Telemetry Signals
                                                </h4>
                                            </div>
 
                                            {/* Mock Active tracking logs */}
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3 font-mono text-[9px] font-semibold text-slate-500 max-h-[160px] overflow-y-auto">
                                                {currentEmployee.activityLogs.map((log, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 border-b border-slate-200/30 pb-2 last:border-b-0 last:pb-0">
                                                        <span className="w-1 h-1 rounded-full bg-brand-peacock shrink-0" />
                                                        <span className="truncate">{log}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {currentEmployee.isWfhActive && currentEmployee.currentStatus !== "Offline" && (
                                                <div className="flex items-center justify-between bg-brand-peacock/5 border border-brand-peacock/10 rounded-xl px-3 py-2 text-[9px] font-extrabold text-brand-peacock uppercase tracking-wider">
                                                    <span>Live Telemetry Coordinates</span>
                                                    <span className="tabular-nums">X: {currentEmployee.latestCoordinate.x}px • Y: {currentEmployee.latestCoordinate.y}px</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* WFH Shift Start Geolocation Card */}
                                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 space-y-4 shadow-sm">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                <FiCompass className="text-brand-blue" size={15} />
                                                WFH Clock-In Geolocation Audit
                                            </h4>
                                            {currentEmployee.locationFetchedAt && (
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Synced at {new Date(currentEmployee.locationFetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                                </span>
                                            )}
                                        </div>

                                        {currentEmployee.startAddress ? (
                                            <div className="space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-brand-blue/5 text-brand-blue flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-brand-blue/10">
                                                        <FiMapPin size={18} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Resolved Physical Address</span>
                                                        <p className="text-xs font-semibold text-slate-700 leading-normal mt-0.5">
                                                            {currentEmployee.startAddress}
                                                        </p>
                                                    </div>
                                                </div>

                                                {currentEmployee.latitude && currentEmployee.longitude && (
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200/50">
                                                        <div className="text-[10px] font-bold text-slate-500 font-mono">
                                                            COORDINATES: {currentEmployee.latitude.toFixed(6)}, {currentEmployee.longitude.toFixed(6)}
                                                        </div>
                                                        <button
                                                            onClick={() => window.open(`https://www.google.com/maps?q=${currentEmployee.latitude},${currentEmployee.longitude}`, "_blank")}
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
                                    {currentEmployee.endAddress && (
                                        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 space-y-4 shadow-sm animate-fade-in">
                                            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                                                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                    <FiCompass className="text-brand-peacock" size={15} />
                                                    WFH Clock-Out Geolocation Audit
                                                </h4>
                                                {currentEmployee.endLocationFetchedAt && (
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Synced at {new Date(currentEmployee.endLocationFetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
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
                                                            {currentEmployee.endAddress}
                                                        </p>
                                                    </div>
                                                </div>
 
                                                {currentEmployee.endLatitude && currentEmployee.endLongitude && (
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200/50">
                                                        <div className="text-[10px] font-bold text-slate-500 font-mono">
                                                            COORDINATES: {currentEmployee.endLatitude.toFixed(6)}, {currentEmployee.endLongitude.toFixed(6)}
                                                        </div>
                                                        <button
                                                            onClick={() => window.open(`https://www.google.com/maps?q=${currentEmployee.endLatitude},${currentEmployee.endLongitude}`, "_blank")}
                                                            className="py-2 px-3.5 rounded-xl bg-brand-peacock text-white font-extrabold text-[9px] uppercase tracking-wider hover:bg-brand-peacock/90 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer outline-none border-none flex items-center gap-1.5"
                                                        >
                                                            <FiMapPin size={10} /> View on Google Maps
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
 
                                    {/* 3. Submitted daily Tasks Board */}
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                <FiCheckSquare size={14} className="text-green-500" />
                                                Assigned WFH Tasks & Shifts
                                            </h4>
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${currentEmployee.pdfReport ? "text-green-500" : "text-amber-500 animate-pulse"}`}>
                                                {currentEmployee.pdfReport ? "Submission Completed" : "Shift Report Pending"}
                                            </span>
                                        </div>
 
                                        {/* Task items list */}
                                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                                            {currentEmployee.tasks.map((task, index) => (
                                                <div 
                                                    key={index}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
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
                                                    <span className={`text-xs font-semibold leading-tight ${task.completed ? "text-slate-500 line-through" : "text-slate-700"}`}>
                                                        {task.text}
                                                    </span>
                                                    {task.completed && task.completedAt && (
                                                        <span className="text-[8px] font-bold text-green-500 bg-green-50 border border-green-100 rounded-full px-2.5 py-0.5 ml-auto uppercase">
                                                            {task.completedAt.replace("Completed at ", "")}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
 
                                        {/* PDF Work report section display */}
                                        {currentEmployee.pdfReport ? (
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 shadow-sm animate-fade-in">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center shadow shrink-0">
                                                        <FiFileText size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h5 className="text-xs font-bold text-slate-700 truncate leading-tight">{currentEmployee.pdfReport.name}</h5>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{currentEmployee.pdfReport.size} • {currentEmployee.pdfReport.uploadedAt}</p>
                                                    </div>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => currentEmployee.pdfReport?.name && window.open(`${API_BASE_URL}/api/files/download/reports/${currentEmployee.pdfReport.name}?token=${sessionStorage.getItem("wfh_auth_token")}`, "_blank")}
                                                    className="py-2.5 px-4 rounded-xl bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-slate-900 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer shadow-sm text-center"
                                                >
                                                    Audit PDF Document
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-3 text-slate-400 mt-4 shadow-inner">
                                                <FiShield size={22} className="text-amber-500" />
                                                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full">
                                                    🚨 Compliance Alert: Missing Shift Report submission for today!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
 
                    {/* SCREENSHOTS COMPLIANCE TAB */}
                    {activeMenu === "Screenshots" && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in">
                            <div className="border-b border-slate-100 pb-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-peacock bg-brand-peacock/5 border border-brand-peacock/10 px-3 py-1 rounded-full">
                                    LIVE MONITOR PANEL
                                </span>
                                <h3 className="text-xl font-black text-slate-800 mt-2">Remote Screenshots Compliance Captures</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Real-time desktop screenshot captures synchronized from employee desktop companions (2-minute intervals).</p>
                            </div>

                            <div className="space-y-4">
                                {employees.filter((emp: EmployeeAuditData) => emp.isWfhActive).length === 0 ? (
                                    <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-50 border border-slate-100 rounded-3xl">
                                        No active WFH employees are currently clocked in.
                                    </div>
                                ) : (
                                    employees
                                        .filter((emp: EmployeeAuditData) => emp.isWfhActive)
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
                                                                <h4 className="text-sm font-bold text-slate-800 leading-tight">{emp.name}</h4>
                                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">{emp.employeeId} • WFH Active</p>
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
                                                            {isExpanded ? "Close Eye" : "Keep an Eye"}
                                                        </button>
                                                    </div>

                                                    {/* Expanded Screenshots Log Grid */}
                                                    {isExpanded && (
                                                        <div className="border-t border-slate-50 pt-5 space-y-4 animate-fade-in">
                                                            {data.isLoading && data.screenshots.length === 0 ? (
                                                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                                                    <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Syncing screens from database...</p>
                                                                </div>
                                                            ) : data.screenshots.length === 0 ? (
                                                                <p className="text-xs text-slate-400 text-center py-6 font-semibold bg-slate-50/50 rounded-xl">
                                                                    No screenshot uploads captured from companion agent yet.
                                                                </p>
                                                            ) : (
                                                                <div className="space-y-6">
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
                                                                                        Captured at {ss.timestamp}
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
                                                    <span className="text-xs font-bold text-slate-800">{emp.name}</span>
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
                                                        <td className="py-4.5 px-5 text-slate-700">{log.shiftStartTime.split(" ")[0]} {log.shiftStartTime.split(" ")[1]}</td>
                                                        <td className="py-4.5 px-5">
                                                            {log.shiftEndTime ? (
                                                                <span className="text-slate-700">{log.shiftEndTime.split(" ")[0]} {log.shiftEndTime.split(" ")[1]}</span>
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
                                    {detailsModalEmp.shiftStartTime || "--:--"}
                                </p>
                            </div>
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Shift End Time</span>
                                <p className="text-xs font-black text-slate-700 mt-1 tabular-nums">
                                    {detailsModalEmp.shiftEndTime || "--:--"}
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
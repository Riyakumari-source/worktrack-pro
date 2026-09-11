import { FiGrid, FiCheckSquare, FiCoffee, FiUser, FiMonitor, FiCalendar, FiX } from "react-icons/fi";

interface EmployeeSidebarProps {
    activeMenu?: string;
    onMenuChange?: (menu: string) => void;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

const EmployeeSidebar = ({ activeMenu = "Dashboard", onMenuChange, mobileOpen = false, onMobileClose }: EmployeeSidebarProps) => {
    const menuItems = [
        { name: "Dashboard", icon: <FiGrid size={18} /> },
        { name: "My Tasks", icon: <FiCheckSquare size={18} /> },
        { name: "Break", icon: <FiCoffee size={18} /> },
        { name: "Screen Telemetry", icon: <FiMonitor size={18} /> },
        { name: "Attendance Logs", icon: <FiCalendar size={18} /> },
        { name: "Profile", icon: <FiUser size={18} /> },
    ];

    const userName = sessionStorage.getItem("wfh_user_name") || "Employee User";
    const userRole = sessionStorage.getItem("wfh_user_role") || "Employee";
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "EM";

    const handleMenuClick = (name: string) => {
        onMenuChange?.(name);
        onMobileClose?.();
    };

    return (
        <>
            {/* Mobile Backdrop Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden animate-fade-in"
                    onClick={onMobileClose}
                />
            )}

            {/* Sidebar Panel */}
            <aside className={`
                w-72 max-w-[85vw] min-h-screen bg-white border-r border-slate-100 p-6 flex flex-col justify-between flex-shrink-0 z-40
                transition-transform duration-300
                md:translate-x-0 md:static md:w-64 md:z-20 md:flex
                ${mobileOpen
                    ? "fixed inset-y-0 left-0 shadow-2xl translate-x-0"
                    : "fixed inset-y-0 left-0 -translate-x-full md:translate-x-0 hidden md:flex"
                }
            `}>
                <div>
                    {/* Logo Section */}
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <img
                            src="/logo.png"
                            alt="Company Logo"
                            className="h-9 w-auto object-contain"
                        />
                        {mobileOpen && (
                            <button
                                className="ml-auto p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                                onClick={onMobileClose}
                                title="Close Menu"
                            >
                                <FiX size={20} />
                            </button>
                        )}
                    </div>

                    {/* Navigation Links */}
                    <div className="flex flex-col gap-2">
                        {menuItems.map((item) => {
                            const isActive = activeMenu === item.name;
                            return (
                                <button
                                    key={item.name}
                                    onClick={() => handleMenuClick(item.name)}
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

                {/* Profile Brief Info footer */}
                <div className="border-t border-slate-100 pt-6 px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 leading-tight truncate">{userName}</p>
                            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{userRole}</p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default EmployeeSidebar;

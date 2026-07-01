import { Link, useLocation } from "react-router-dom";

interface SidebarProps {
    role: "admin" | "employee";
}

const Sidebar = ({ role }: SidebarProps) => {
    const { pathname } = useLocation();

    const adminMenu = [
        "Dashboard",
        "Employees",
        "Tasks",
        "Reports",
        "Settings",
    ];

    const employeeMenu = [
        "Dashboard",
        "My Tasks",
        "Breaks",
        "Profile",
    ];

    const menu = role === "admin" ? adminMenu : employeeMenu;

    return (
        <div className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 text-white p-6 flex flex-col justify-between">
            <div>
                {/* Logo Section (Text Removed) */}
                <div className="flex items-center gap-3 mb-10 px-2">
                    <img 
                        src="/logo.png" 
                        alt="Company Logo" 
                        className="h-9 w-auto object-contain"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    {menu.map((item, index) => {
                        const isActive = index === 0; // Temp simulation for active state
                        return (
                            <Link
                                key={index}
                                to="#"
                                className={`flex items-center gap-3 p-3.5 rounded-xl font-medium transition-all duration-300 ${
                                    isActive
                                        ? "bg-gradient-to-r from-brand-blue to-brand-peacock text-white shadow-lg shadow-brand-blue/20"
                                        : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                                }`}
                            >
                                {item}
                            </Link>
                        );
                    })}
                </div>
            </div>
            
            <div className="border-t border-slate-800 pt-6 px-2">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-300">
                        {role === "admin" ? "AD" : "EM"}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">{role === "admin" ? "Admin User" : "Employee User"}</p>
                        <p className="text-xs text-slate-500 capitalize">{role}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff, FiArrowRight, FiShield, FiAlertCircle, FiUser, FiLock, FiCheck } from "react-icons/fi";
import { API_BASE_URL, DEFAULT_PUBLIC_CONFIG, fetchAppConfig, type PublicAppConfig } from "../config";

const LoginPage = () => {
    const navigate = useNavigate();
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [appCfg, setAppCfg] = useState<PublicAppConfig>(DEFAULT_PUBLIC_CONFIG);

    useEffect(() => {
        fetchAppConfig().then(setAppCfg);
        const savedEmp = localStorage.getItem("wfh_saved_employee_code");
        if (savedEmp) {
            setEmployeeId(savedEmp);
        }
    }, []);

    const handleLogin = async () => {
        setError("");
        if (!employeeId.trim() || !password) {
            setError("Please enter your Employee Code and Password.");
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: employeeId.trim(), password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Invalid credentials. Please try again.");
                setIsLoading(false);
                return;
            }

            if (rememberMe) {
                localStorage.setItem("wfh_saved_employee_code", employeeId.trim());
            } else {
                localStorage.removeItem("wfh_saved_employee_code");
            }

            const user = data.user;
            sessionStorage.setItem("wfh_auth_token", data.token);
            sessionStorage.setItem("wfh_logged_in_user", user.employeeId || user.email);
            sessionStorage.setItem("wfh_user_name", user.name);
            sessionStorage.setItem("wfh_user_role", user.role);

            if (user.role.toUpperCase() === "ADMIN") {
                navigate("/admin");
            } else {
                sessionStorage.setItem("wfh_session_active", "true");
                navigate("/employee");
            }
        } catch {
            setError("Unable to connect to server. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] text-slate-800 flex flex-col justify-center items-center p-4 relative overflow-x-hidden font-[Inter,sans-serif] select-none">
            {/* Ambient Background Gradient Blobs */}
            <div className="fixed -top-32 -right-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
            <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
            <div 
                className="fixed inset-0 pointer-events-none -z-10 opacity-60"
                style={{
                    backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                }}
            />

            {/* Main Centered Login Card */}
            <div className="w-full max-w-[420px] bg-white border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 flex flex-col gap-5 relative z-10 animate-fade-in my-auto">
                {/* Brand Header */}
                <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                        <img 
                            src="/logo.png" 
                            alt="Logo" 
                            className="w-7 h-7 object-contain rounded-lg"
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                const next = e.currentTarget.nextElementSibling;
                                if (next) (next as HTMLElement).style.display = "block";
                            }}
                        />
                        <FiShield size={20} className="hidden text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none truncate">
                            {appCfg.companyName || "WorkTrack Pro"}
                        </h1>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 mt-1 truncate">
                            {appCfg.appSubtitle || "Enterprise Workforce Portal"}
                        </p>
                    </div>
                </div>

                {/* Subtitle / Intro */}
                <div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                        Sign In
                    </h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                        Enter your employee code and password to continue.
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200/80 text-red-600 text-xs font-semibold animate-fade-in">
                        <FiAlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span className="leading-tight">{error}</span>
                    </div>
                )}

                {/* Form Fields */}
                <div className="space-y-3.5">
                    {/* Employee Code */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                            Employee Code
                        </label>
                        <div className="relative flex items-center">
                            <FiUser className="absolute left-3.5 text-slate-400" size={16} />
                            <input
                                id="login-employee-id"
                                type="text"
                                placeholder="e.g. EMP001"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-xs font-semibold placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 transition-all"
                                autoComplete="username"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                            Password
                        </label>
                        <div className="relative flex items-center">
                            <FiLock className="absolute left-3.5 text-slate-400" size={16} />
                            <input
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-xs font-semibold placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 transition-all"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                            </button>
                        </div>
                    </div>

                    {/* Row: Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between text-xs pt-0.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <div 
                                onClick={() => setRememberMe(!rememberMe)}
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                    rememberMe 
                                        ? "bg-emerald-600 border-emerald-600 text-white" 
                                        : "border-slate-300 bg-white"
                                }`}
                            >
                                {rememberMe && <FiCheck size={11} className="stroke-[3]" />}
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500">Remember ID</span>
                        </label>

                        <button
                            type="button"
                            onClick={() => alert("Password reset is managed by HR Admin. Please contact HR to reset credentials.")}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors cursor-pointer"
                        >
                            Forgot password?
                        </button>
                    </div>
                </div>

                {/* Sign In Button */}
                <button
                    id="login-submit-btn"
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            <span>Authenticating...</span>
                        </>
                    ) : (
                        <>
                            <span>Sign In</span>
                            <FiArrowRight size={15} />
                        </>
                    )}
                </button>

                {/* Secure Notice Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    <FiShield size={12} className="text-emerald-600" />
                    <span>Protected By Enterprise Security</span>
                </div>
            </div>

            {/* Bottom Copyright */}
            <p className="text-[10px] font-semibold text-slate-400 mt-4 text-center tracking-wider">
                © {new Date().getFullYear()} {appCfg.companyName || "WorkTrack Pro"} • All Rights Reserved
            </p>
        </div>
    );
};

export default LoginPage;

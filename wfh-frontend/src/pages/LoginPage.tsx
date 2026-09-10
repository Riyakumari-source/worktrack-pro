import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { API_BASE_URL, DEFAULT_PUBLIC_CONFIG, fetchAppConfig, type PublicAppConfig } from "../config";

const LoginPage = () => {
    const navigate = useNavigate();

    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [appCfg, setAppCfg] = useState<PublicAppConfig>(DEFAULT_PUBLIC_CONFIG);

    useEffect(() => {
        fetchAppConfig().then(setAppCfg);
    }, []);

    const handleLogin = async () => {
        if (!employeeId.trim() || !password) {
            alert("Please enter your employee code and password.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    employeeId: employeeId,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "Invalid Credentials");
                setIsLoading(false);
                return;
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
        } catch (error) {
            console.error("Login connection error:", error);
            alert(`Unable to connect to the backend server. Please verify the server is running on ${API_BASE_URL}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center bg-[#F8F7FF] font-[Inter,sans-serif] p-6 overflow-hidden">
            <div className="absolute -bottom-24 -left-24 w-[450px] h-[450px] bg-brand-peacock opacity-[0.08] rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="absolute top-1/3 -left-24 w-[400px] h-[400px] bg-violet-300 opacity-[0.06] rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-brand-blue opacity-[0.08] rounded-full blur-[110px] -z-10 pointer-events-none"></div>

            <div className="flex flex-col items-center mb-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1 w-16 h-16 flex items-center justify-center mb-4 transition-all duration-300 hover:shadow-md">
                    <img
                        src="/logo.png"
                        alt="Company Logo"
                        className="w-full h-full object-contain rounded-xl"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight text-center mb-1">
                    {appCfg.companyName}
                </h1>
                <p className="text-xs text-slate-400 font-semibold text-center uppercase tracking-wider">
                    {appCfg.appSubtitle}
                </p>
            </div>

            <div className="w-full max-w-[440px] bg-white rounded-3xl border border-slate-100/80 shadow-xl shadow-slate-200/40 p-8 sm:p-10 mb-6">
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                            Employee Code
                        </label>
                        <input
                            type="text"
                            placeholder="Employee ID"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 placeholder-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/5 transition-all duration-200 text-sm font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                            Password
                        </label>
                        <div className="relative flex items-center">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                                className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 placeholder-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/5 transition-all duration-200 text-sm font-medium"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer focus:outline-none"
                            >
                                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end mt-1">
                        <button
                            type="button"
                            onClick={() => alert("Password resets are handled by HR. Please contact HR with your employee code.")}
                            className="text-xs font-semibold text-brand-blue hover:underline cursor-pointer transition-colors duration-200 bg-transparent border-none"
                        >
                            Forgot Password?
                        </button>
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-brand-blue to-brand-peacock text-white py-3.5 rounded-xl font-bold shadow-md shadow-brand-blue/15 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 cursor-pointer text-center text-sm flex items-center justify-center outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            "Sign In"
                        )}
                    </button>

                    <p className="text-[11px] text-slate-400 font-medium text-center mt-4">
                        Contact HR for login credentials
                    </p>
                </div>
            </div>

            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-center pointer-events-none">
                © {new Date().getFullYear()} {appCfg.companyName}
            </div>
        </div>
    );
};

export default LoginPage;

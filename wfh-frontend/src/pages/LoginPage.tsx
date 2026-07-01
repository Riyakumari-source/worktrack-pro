import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const LoginPage = () => {
    const navigate = useNavigate();

    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
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
        <div className="min-h-screen relative flex flex-col items-center justify-center bg-[#f8fafc] font-sans p-6 overflow-hidden">
            {/* Blurry Pastel Fluid Blobs */}
            <div className="absolute -bottom-24 -left-24 w-[450px] h-[450px] bg-brand-peacock opacity-12 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="absolute top-1/3 -left-24 w-[400px] h-[400px] bg-pink-300 opacity-6 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-brand-blue opacity-10 rounded-full blur-[110px] -z-10 pointer-events-none"></div>

            {/* Header Logo & Title */}
            <div className="flex flex-col items-center mb-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1 w-16 h-16 flex items-center justify-center mb-4 transition-all duration-300 hover:shadow-md">
                    <img
                        src="/logo.png"
                        alt="Company Logo"
                        className="w-full h-full object-contain rounded-xl"
                    />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight text-center mb-1">
                    company@demo
                </h1>
                <p className="text-xs text-slate-400 font-semibold text-center uppercase tracking-wider">
                    Workforce Monitoring & Productivity Platform
                </p>
            </div>

            {/* Centered White Card */}
            <div className="w-full max-w-[440px] bg-white rounded-3xl border border-slate-100/80 shadow-xl shadow-slate-200/40 p-8 sm:p-10 mb-6">
                <div className="space-y-5">
                    {/* Employee Code Field */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                            Employee Code
                        </label>
                        <input
                            type="text"
                            placeholder="IA00001"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 placeholder-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/5 transition-all duration-200 text-sm font-medium"
                        />
                    </div>

                    {/* Password Field */}
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

                    {/* Forgot Password */}
                    <div className="flex justify-end mt-1">
                        <span className="text-xs font-semibold text-brand-blue hover:underline cursor-pointer transition-colors duration-200">
                            Forgot Password?
                        </span>
                    </div>

                    {/* Sign In Button */}
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

                    {/* Contact HR Text */}
                    <p className="text-[11px] text-slate-400 font-medium text-center mt-4">
                        Contact HR for login credentials
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-center pointer-events-none">
                © 2026 company@demo
            </div>
        </div>
    );
};

export default LoginPage;

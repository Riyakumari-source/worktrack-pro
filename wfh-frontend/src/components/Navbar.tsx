import React from "react";

const Navbar = () => {
    const userName = sessionStorage.getItem("wfh_user_name") || "User";
    const initial = userName.charAt(0).toUpperCase() || "U";

    return (
        <div className="w-full h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 shadow-sm">
            <div className="flex items-center gap-3">
                <img 
                    src="/logo.png" 
                    alt="Company Logo" 
                    className="h-10 w-auto object-contain"
                />
            </div>

            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-peacock text-white flex items-center justify-center font-bold shadow-md hover:scale-105 transition-transform duration-300 cursor-pointer">
                    {initial}
                </div>
            </div>
        </div>
    );
};


export default Navbar;
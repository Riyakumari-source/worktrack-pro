import { Navigate } from "react-router-dom";
import React from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: "ADMIN" | "EMPLOYEE";
}

export const ProtectedRoute = ({ children, allowedRole }: ProtectedRouteProps) => {
  const token = sessionStorage.getItem("wfh_auth_token");
  const role = sessionStorage.getItem("wfh_user_role");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && role?.toUpperCase() !== allowedRole.toUpperCase()) {
    if (role?.toUpperCase() === "ADMIN") {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/employee" replace />;
    }
  }

  return <>{children}</>;
};

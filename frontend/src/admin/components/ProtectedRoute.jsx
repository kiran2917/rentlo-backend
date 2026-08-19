import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../shared/context/AuthContext";

export const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  const userRoles = user.roles || [user.role];
  if (!userRoles.some(r => allowedRoles.includes(r))) {
    return <Navigate to="/admin/unauthorized" replace />;
  }

  return <Outlet />;
};

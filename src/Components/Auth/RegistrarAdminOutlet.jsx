import { Navigate, Outlet, useLocation } from "react-router-dom";

const REGISTRAR_ALLOWED_PATHS = ["/admin/dashboard", "/admin/pending-tasks", "/admin/profile", "/admin/inventory"];

const RegistrarAdminOutlet = () => {
  const location = useLocation();
  const role = (localStorage.getItem("userRole") || "").toLowerCase();

  if (role === "registrar") {
    const isAllowed = REGISTRAR_ALLOWED_PATHS.some(
      (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
    );

    if (!isAllowed) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return <Outlet />;
};

export default RegistrarAdminOutlet;

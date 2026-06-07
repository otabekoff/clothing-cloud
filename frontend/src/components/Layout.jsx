import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Icon } from "./icons.jsx";

const NAV = [
  { to: "/app", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/app/products", label: "Products (ERP)", icon: "box" },
  { to: "/app/stock", label: "Stock (WMS)", icon: "warehouse" },
  { to: "/app/customers", label: "Customers (CRM)", icon: "users" },
  { to: "/app/orders", label: "Orders (CRM)", icon: "cart" },
  { to: "/app/users", label: "User Management", icon: "shield", minRole: "admin" },
];

const TITLES = {
  "/app": ["Dashboard", "Operations overview"],
  "/app/products": ["Products", "ERP · product master data"],
  "/app/stock": ["Warehouse Stock", "WMS · inventory by location"],
  "/app/customers": ["Customers", "CRM · wholesale accounts"],
  "/app/orders": ["Orders", "CRM · sales orders"],
  "/app/users": ["User Management", "Admin · accounts & roles"],
  "/app/profile": ["My Profile", "Account settings"],
};

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [node, setNode] = useState("…");
  const [healthy, setHealthy] = useState(true);

  useEffect(() => {
    api.whoami().then((w) => { setNode(w.instance); setHealthy(true); }).catch(() => setHealthy(false));
  }, [pathname]);

  const [title, crumb] = TITLES[pathname] || ["NIMBUS", ""];
  const initials = (user?.full_name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("");

  const doLogout = () => { logout(); navigate("/", { replace: true }); };

  return (
    <div className="app">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <div className="mark">N</div>
          <div>
            <div className="name">NIMBUS</div>
            <div className="sub">ERP · CRM · WMS</div>
          </div>
        </NavLink>

        <nav>
          <div className="group">Modules</div>
          {NAV.map((item) => {
            if (item.minRole && !can(item.minRole)) return null;
            const Ico = Icon[item.icon];
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}>
                <Ico className="ico" />
                {item.label}
              </NavLink>
            );
          })}
          <div className="group">Account</div>
          <NavLink to="/app/profile" className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}>
            <Icon.users className="ico" />
            My Profile
          </NavLink>
        </nav>

        <div className="side-foot">
          <div className="node">served by replica <b>{node}</b></div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="page-title">{title}</div>
            <div className="crumb">{crumb}</div>
          </div>
          <div className="user-box">
            <span className={`health-dot ${healthy ? "" : "down"}`}>
              {healthy ? "system live" : "backend down"}
            </span>
            <NavLink to="/app/profile" className="avatar">
              <div className="who">
                <div className="n">{user?.full_name}</div>
                <div className="r">{user?.role}</div>
              </div>
              <div className="pic">
                {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials.toUpperCase()}
              </div>
            </NavLink>
            <button className="btn ghost sm" onClick={doLogout} title="Sign out">
              <Icon.logout width={15} height={15} />
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

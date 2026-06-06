import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Icon } from "./icons.jsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/products", label: "Products (ERP)", icon: "box" },
  { to: "/stock", label: "Stock (WMS)", icon: "warehouse" },
  { to: "/customers", label: "Customers (CRM)", icon: "users" },
  { to: "/orders", label: "Orders (CRM)", icon: "cart" },
  { to: "/users", label: "User Management", icon: "shield", minRole: "admin" },
];

const TITLES = {
  "/": ["Dashboard", "Operations overview"],
  "/products": ["Products", "ERP · product master data"],
  "/stock": ["Warehouse Stock", "WMS · inventory by location"],
  "/customers": ["Customers", "CRM · wholesale accounts"],
  "/orders": ["Orders", "CRM · sales orders"],
  "/users": ["User Management", "Admin · accounts & roles"],
};

export default function Layout() {
  const { user, logout, can } = useAuth();
  const { pathname } = useLocation();
  const [node, setNode] = useState("…");
  const [healthy, setHealthy] = useState(true);

  useEffect(() => {
    api.whoami().then((w) => { setNode(w.instance); setHealthy(true); }).catch(() => setHealthy(false));
  }, [pathname]);

  const [title, crumb] = TITLES[pathname] || ["NIMBUS", ""];
  const initials = (user?.full_name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">N</div>
          <div>
            <div className="name">NIMBUS</div>
            <div className="sub">ERP · CRM · WMS</div>
          </div>
        </div>

        <nav>
          <div className="group">Modules</div>
          {NAV.map((item) => {
            if (item.minRole && !can(item.minRole)) return null;
            const Ico = Icon[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `navlink ${isActive ? "active" : ""}`}
              >
                <Ico className="ico" />
                {item.label}
              </NavLink>
            );
          })}
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
            <div className="avatar">
              <div className="who">
                <div className="n">{user?.full_name}</div>
                <div className="r">{user?.role}</div>
              </div>
              <div className="pic">{initials.toUpperCase()}</div>
            </div>
            <button className="btn ghost sm" onClick={logout} title="Sign out">
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

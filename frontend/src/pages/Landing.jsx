import { Link, Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext.jsx";
import { Icon } from "../components/icons.jsx";

const FEATURES = [
  { icon: "box", title: "ERP", color: "#16a34a", text: "Product master data, pricing, suppliers and cost margins in one catalogue." },
  { icon: "warehouse", title: "WMS", color: "#d97706", text: "Track inventory across every warehouse with reorder alerts and bin locations." },
  { icon: "users", title: "CRM", color: "#0ea5b7", text: "Manage wholesale accounts, contacts and the full order lifecycle." },
  { icon: "dashboard", title: "Analytics", color: "#4f46e5", text: "Live KPIs and charts for revenue, stock and pipeline at a glance." },
  { icon: "shield", title: "Role-based access", color: "#7c3aed", text: "Admin, manager and viewer grades keep the right people in control." },
  { icon: "cart", title: "Cloud-native", color: "#ec4899", text: "Load-balanced, auto-scaling containers deployed via CI/CD to AWS." },
];

const STATS = [
  { v: "3", l: "integrated systems" },
  { v: "99.9%", l: "designed uptime" },
  { v: "<5s", l: "scale-out time" },
  { v: "24/7", l: "operations view" },
];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;

  return (
    <div className="landing">
      <header className="lp-nav">
        <div className="lp-brand">
          <div className="mark">N</div>
          <span>NIMBUS</span>
        </div>
        <nav className="lp-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <Link className="btn ghost sm" to="/login">Sign in</Link>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-inner">
          <span className="lp-eyebrow">Cloud ERP · CRM · WMS</span>
          <h1>Run your wholesale business on one secure cloud platform.</h1>
          <p>
            NIMBUS unifies your products, inventory, customers and orders into a single
            load-balanced cloud application — with live analytics and role-based access
            built in.
          </p>
          <div className="lp-cta">
            <Link className="btn primary lg" to="/login">Get started</Link>
            <a className="btn ghost lg" href="#features">Explore features</a>
          </div>
          <div className="lp-stats">
            {STATS.map((s) => (
              <div key={s.l} className="lp-stat">
                <div className="v">{s.v}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="lp-hero-art" aria-hidden="true">
          <div className="lp-card lp-card-1">
            <div className="k">Total revenue</div>
            <div className="v">$15,779</div>
            <div className="spark"><span /><span /><span /><span /><span /><span /></div>
          </div>
          <div className="lp-card lp-card-2">
            <div className="k">Units in stock</div>
            <div className="v">9,230</div>
          </div>
          <div className="lp-card lp-card-3">
            <div className="dot" /> system live
          </div>
        </div>
      </section>

      <section id="features" className="lp-section">
        <div className="lp-section-head">
          <h2>Everything your operations team needs</h2>
          <p>One platform, three integrated systems, zero spreadsheets.</p>
        </div>
        <div className="lp-features">
          {FEATURES.map((f) => {
            const I = Icon[f.icon];
            return (
              <div key={f.title} className="lp-feature">
                <div className="lp-feature-ico" style={{ background: `${f.color}1a`, color: f.color }}>
                  <I width={22} height={22} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="how" className="lp-section lp-how">
        <div className="lp-section-head">
          <h2>How it works</h2>
          <p>From sign-in to insight in three steps.</p>
        </div>
        <div className="lp-steps">
          <div className="lp-step"><span className="n">1</span><h3>Sign in by role</h3><p>Admins, managers and viewers each get the right level of access.</p></div>
          <div className="lp-step"><span className="n">2</span><h3>Manage your data</h3><p>Create and update products, stock, customers and orders with rich forms.</p></div>
          <div className="lp-step"><span className="n">3</span><h3>Watch it live</h3><p>Dashboards update in real time as your business moves.</p></div>
        </div>
      </section>

      <section className="lp-final">
        <h2>Ready to see it in action?</h2>
        <p>Sign in with a demo account — admin, manager or viewer.</p>
        <Link className="btn primary lg" to="/login">Sign in to NIMBUS</Link>
      </section>

      <footer className="lp-footer">
        <div className="lp-brand"><div className="mark">N</div><span>NIMBUS</span></div>
        <span className="muted">Cloud ERP · CRM · WMS — reference platform</span>
      </footer>
    </div>
  );
}

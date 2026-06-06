import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext.jsx";

const DEMO = [
  { role: "admin", email: "admin@nimbus.dev", password: "admin123" },
  { role: "manager", email: "manager@nimbus.dev", password: "manager123" },
  { role: "viewer", email: "viewer@nimbus.dev", password: "viewer123" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (d) => {
    setEmail(d.email);
    setPassword(d.password);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-row">
          <div className="mark">N</div>
          <div>
            <div className="t">NIMBUS</div>
            <div className="s">Cloud ERP · CRM · WMS</div>
          </div>
        </div>

        <h1>Welcome back</h1>
        <p className="lead">Sign in to the operations console.</p>

        <form onSubmit={submit}>
          {error && <div className="err">{error}</div>}
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@nimbus.dev"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="demo">
          <div className="demo-h">Demo accounts — click to fill</div>
          <div className="demo-row">
            {DEMO.map((d) => (
              <button key={d.role} type="button" className="demo-btn" onClick={() => fillDemo(d)}>
                <div className="dn">{d.role}</div>
                <div className="de">{d.password}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

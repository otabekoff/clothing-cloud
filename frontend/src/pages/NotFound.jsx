import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="center-state">
      <div style={{ fontSize: 44, fontWeight: 800, color: "#4f46e5" }}>404</div>
      <div className="t" style={{ fontWeight: 600, color: "#515862", margin: "6px 0 14px" }}>
        That page does not exist.
      </div>
      <Link className="btn primary" to="/app">Back to dashboard</Link>
    </div>
  );
}

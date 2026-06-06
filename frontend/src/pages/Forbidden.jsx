import { Link } from "react-router";

export default function Forbidden() {
  return (
    <div className="center-state">
      <div style={{ fontSize: 40, fontWeight: 800, color: "#dc2626" }}>403</div>
      <div className="t" style={{ fontWeight: 600, color: "#515862", margin: "6px 0 14px" }}>
        You do not have permission to view this page.
      </div>
      <Link className="btn primary" to="/">Back to dashboard</Link>
    </div>
  );
}

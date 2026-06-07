import { useEffect } from "react";

// Right-side slide-over panel used for entity detail views.
export default function Drawer({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>
  );
}

// Small labelled key/value row for detail panels.
export function Detail({ label, children }) {
  return (
    <div className="detail-row">
      <div className="detail-k">{label}</div>
      <div className="detail-v">{children ?? <span className="muted">—</span>}</div>
    </div>
  );
}

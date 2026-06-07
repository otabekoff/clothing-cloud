import { Icon } from "./icons.jsx";

// Standard list-page toolbar. The page title/breadcrumb already live in the
// topbar, so this row carries a row count on the left and the search + "New"
// action on the right. The "New" button only renders when `canWrite` is true
// (RBAC-aware UI), and a hint explains the disabled state for viewers.
export default function PageToolbar({ count, search, onSearch, canWrite, onNew, newLabel }) {
  return (
    <div className="section-head">
      <div>
        {count != null && <div className="desc">{count} {count === 1 ? "record" : "records"}</div>}
        {!canWrite && <div className="desc">Read-only — your role cannot make changes.</div>}
      </div>
      <div className="toolbar">
        {onSearch && (
          <input
            className="input search"
            placeholder="Search…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        )}
        {canWrite && onNew && (
          <button className="btn primary" onClick={onNew}>
            <Icon.plus width={16} height={16} />
            {newLabel || "New"}
          </button>
        )}
      </div>
    </div>
  );
}

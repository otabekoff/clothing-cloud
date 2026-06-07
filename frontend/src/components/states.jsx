// Shared loading / empty / error UI used across pages.

export function Loading({ label = "Loading…" }) {
  return (
    <div className="center-state">
      <div className="spinner" />
      <div>{label}</div>
    </div>
  );
}

export function Empty({ title = "Nothing here yet", hint }) {
  return (
    <div className="empty">
      <div className="t">{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="banner" role="alert">
      <div>
        <strong>Something went wrong.</strong> {message}
        <span className="hint">
          If the backend is not running, start it with <code>docker compose up --build</code>.
        </span>
      </div>
      {onRetry && <button className="btn ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

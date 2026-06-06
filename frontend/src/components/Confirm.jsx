import { createContext, useCallback, useContext, useState } from "react";

const ConfirmContext = createContext(null);

// Provides an async confirm() that resolves true/false from a styled dialog,
// replacing the browser's native confirm().
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { opts, resolve }

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setState({ opts: typeof opts === "string" ? { message: opts } : opts, resolve });
      }),
    []
  );

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  const o = state?.opts || {};

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-backdrop" onMouseDown={() => close(false)}>
          <div className="modal confirm" onMouseDown={(e) => e.stopPropagation()}>
            <h3>{o.title || "Are you sure?"}</h3>
            <p className="confirm-msg">{o.message}</p>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => close(false)}>
                {o.cancelLabel || "Cancel"}
              </button>
              <button
                className={`btn ${o.danger === false ? "primary" : "danger-solid"}`}
                onClick={() => close(true)}
                autoFocus
              >
                {o.confirmLabel || "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

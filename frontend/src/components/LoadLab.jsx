import { useState, useRef } from "react";
import { api } from "../api/client.js";

// Fires a burst of /api/load requests through the load balancer and tallies
// how many landed on each backend replica. This is the on-screen proof of
// load balancing; when paired with `docker compose up --scale backend=N` (or
// the auto-scaler script) the spread widens across more replicas.
export default function LoadLab() {
  const [hits, setHits] = useState({});
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const stop = useRef(false);

  const burst = async (rounds = 60, concurrency = 8) => {
    setRunning(true);
    setHits({});
    setTotal(0);
    stop.current = false;
    let done = 0;
    const tally = {};

    const worker = async () => {
      while (done < rounds && !stop.current) {
        done += 1;
        try {
          const r = await api.hammer(120);
          tally[r.instance] = (tally[r.instance] || 0) + 1;
          setHits({ ...tally });
          setTotal(Object.values(tally).reduce((a, b) => a + b, 0));
        } catch {
          /* replica busy / scaling — ignore */
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    setRunning(false);
  };

  const max = Math.max(1, ...Object.values(hits));
  const replicas = Object.entries(hits).sort();

  return (
    <div className="loadlab">
      <header>
        <h2>Load Balancer · Auto-Scaling Lab</h2>
        <span className="tag">C.M3 / D.M4 — SCALABILITY TEST</span>
      </header>

      <div className="controls">
        <button onClick={() => burst()} disabled={running}>
          {running ? "Generating load…" : "Send 60-request burst"}
        </button>
        <button className="ghost" onClick={() => (stop.current = true)} disabled={!running}>
          Stop
        </button>
        <span style={{ fontFamily: "var(--mono)", color: "#8a948c", fontSize: 12, alignSelf: "center" }}>
          served: {total}
        </span>
      </div>

      <div className="replicas">
        {replicas.length === 0 && (
          <div className="replica">
            <span className="id">—</span>
            <span className="muted" style={{ color: "#8a948c", fontSize: 12 }}>
              Run a burst to see traffic distribute across replicas.
            </span>
            <span className="pct" />
          </div>
        )}
        {replicas.map(([id, n]) => (
          <div className="replica" key={id}>
            <span className="id">{id}</span>
            <span className="bar"><i style={{ width: `${(n / max) * 100}%` }} /></span>
            <span className="pct">{n}</span>
          </div>
        ))}
      </div>

      <p className="note">
        Each replica is an independent FastAPI container. Nginx round-robins requests
        across them, so a single burst spreads over every running replica. Scale the
        pool with <code>docker compose up --scale backend=4</code> or run{" "}
        <code>scripts/autoscale.sh</code> to add replicas automatically once CPU passes
        the threshold — the bars below will redistribute live.
      </p>
    </div>
  );
}

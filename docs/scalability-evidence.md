# Capturing the scalability screenshots (criteria C.M3 / D.M4)

This guide maps each screenshot the assignment asks for to **where it actually
exists in NIMBUS**, with the exact command and what the capture should show.

> **Architecture note (read first, cite in your report).** The assignment text
> assumes AWS **EC2 Auto Scaling Groups** + an **Application Load Balancer with
> target groups**. NIMBUS uses an equivalent, self-contained model:
>
> | Assignment term            | NIMBUS equivalent                                      |
> |----------------------------|--------------------------------------------------------|
> | Load balancer / ALB        | **Nginx container** (Layer-7) inside the instance      |
> | Auto Scaling Group         | **`scripts/autoscale.sh`** scaling Docker replicas     |
> | "instances" 1 → 2 → 3      | **backend container replicas** rising 2 → 3 → …         |
> | Target group "Healthy"     | replicas reporting **`(healthy)`** + LB round-robin    |
> | CloudWatch monitoring      | **`docker stats`** + the Prometheus **`/metrics`** endpoint |
>
> This is a valid horizontal-scaling design; state the mapping in your report so
> the evidence below clearly satisfies C.M3 (test for performance & scalability)
> and D.M4 (re-test the enhancement).

Run everything from the project root on the EC2 instance (SSH in), unless noted.
Use three terminals.

---

## Figure 1 — Load-test command and its output

**Terminal 1** — generate sustained load and record throughput / failures.

Option A (Locust, matches `loadtest/locustfile.py`):

```bash
pip install locust
locust -f loadtest/locustfile.py --host https://vestro.dev
# open http://localhost:8089, set e.g. 200 users / spawn 20, run ~1 min
```

📷 **Screenshot:** the Locust **Statistics** tab — it shows requests/sec,
# total requests, **# fails**, and p50/p95 latency (the equivalent of `ab`'s
"Requests per second" and "Failed requests").

Option B (Apache Bench, closest to the assignment wording):

```bash
ab -n 5000 -c 200 https://vestro.dev/health
```

📷 **Screenshot:** the terminal output showing **Requests per second**,
**Time per request**, and **Failed requests**.

---

## Figure 2 — Monitoring graph (CPU + request count) during the test

**Terminal 2** — watch per-replica CPU live while Figure 1's load runs.

```bash
docker stats $(docker compose -f docker-compose.prod.yml ps -q backend)
```

📷 **Screenshot:** the `docker stats` table with each `backend` replica's
**CPU %** climbing under load (this is the "CPU" half of the graph).

For the **request-count** half, either:

- screenshot Locust's **"Total Requests per Second"** chart (Charts tab), or
- hit the Prometheus counter and screenshot it:
  ```bash
  curl -s https://vestro.dev/metrics | grep app_requests_total
  ```
  📷 **Screenshot:** the `app_requests_total{...}` lines (request volume per
  replica), captured before vs during the test to show the jump.

---

## Figure 3 — Instance (replica) count rising 1 → 2 → 3 under load

**Terminal 3** — start the CPU-driven auto-scaler, then watch the replica count.
On the EC2 instance, point it at the production compose file:

```bash
cd ~/nimbus
COMPOSE_FILE=docker-compose.prod.yml ./scripts/autoscale.sh
```

(Locally during dev it's just `./scripts/autoscale.sh`.) Drive CPU with the
burn endpoint so the autoscaler actually reacts (a plain `/health` flood is too
cheap to raise CPU):

```bash
ab -n 20000 -c 200 "http://localhost:8080/api/load?ms=200"
```

While Figure 1's load runs, the autoscaler logs lines like:

```
[14:02:11] replicas=2 avg_cpu=18%
[14:02:31] replicas=2 avg_cpu=64%
  ↑ scaling UP to 3
[14:02:41] replicas=3 avg_cpu=71%
  ↑ scaling UP to 4
```

📷 **Screenshot:** the autoscaler output showing `replicas=` increasing and the
`↑ scaling UP` lines — this is the NIMBUS equivalent of the ASG count 1→2→3.

For a cleaner "instance list" view, in a fourth terminal:

```bash
watch -n 2 'docker compose -f docker-compose.prod.yml ps backend'
```

📷 **Screenshot:** the `ps` list growing from `backend-1, backend-2` to
`backend-3, backend-4, …` as load ramps.

---

## Figure 4 — Load balancer showing all replicas Healthy

NIMBUS has no ALB target group; the equivalent is the Nginx LB distributing
across **healthy** replicas.

**Health status:**

```bash
docker compose -f docker-compose.prod.yml ps backend
```

📷 **Screenshot:** the **STATUS** column showing every backend replica as
`Up … (healthy)`.

**Live load-balancing proof** (round-robin across the healthy pool):

```bash
for i in $(seq 1 8); do curl -s https://vestro.dev/whoami | grep -o '"instance":"[^"]*"'; done
```

📷 **Screenshot:** the output listing **different `instance` IDs** — proof the
LB is spreading traffic across multiple healthy replicas.

---

## Suggested before/after comparison (for C.D2 / D.D3)

Run Figure 1 **twice** and screenshot both:

1. **Before:** fixed at 2 replicas (autoscaler off) — record p95 latency + fails.
2. **After:** autoscaler on — record p95 latency + fails under the same load.

The drop in p95 latency / failures with scaling on is the justification those
distinction criteria ask for.

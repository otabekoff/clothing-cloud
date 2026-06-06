"""
Load test for criterion C.M3 / C.D2 (performance & scalability).

Run against the load balancer:

    pip install locust
    locust -f loadtest/locustfile.py --host http://localhost:8080

Then open http://localhost:8089 and ramp up users. Watch:
  * request throughput and latency in the Locust UI
  * `docker stats` for backend CPU climbing
  * `/whoami` rotating across replicas as scripts/autoscale.sh adds them

Each simulated user logs in once (JWT) and reuses the token, since the ERP/WMS
read endpoints now require authentication.
"""

from locust import HttpUser, between, task


class ErpUser(HttpUser):
    wait_time = between(0.1, 0.5)

    def on_start(self):
        # Authenticate once; reuse the token for every subsequent request.
        self.token = None
        res = self.client.post(
            "/api/auth/login",
            data={"username": "viewer@nimbus.dev", "password": "viewer123"},
            name="/api/auth/login",
        )
        if res.ok:
            self.token = res.json()["access_token"]

    @property
    def auth(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(3)
    def hammer_cpu(self):
        # CPU-bound endpoint (no auth) — this is what drives the scaling signal.
        self.client.get("/api/load?ms=200", name="/api/load")

    @task(2)
    def read_stock(self):
        self.client.get("/api/wms/stock", name="/api/wms/stock", headers=self.auth)

    @task(2)
    def read_products(self):
        self.client.get("/api/erp/products", name="/api/erp/products", headers=self.auth)

    @task(1)
    def whoami(self):
        self.client.get("/whoami", name="/whoami")

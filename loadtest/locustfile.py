"""
Load test for criterion C.M3 / C.D2 (performance & scalability).

Run against the load balancer:

    pip install locust
    locust -f loadtest/locustfile.py --host http://localhost:8080

Then open http://localhost:8089 and ramp up users. Watch:
  * request throughput and latency in the Locust UI
  * `docker stats` for backend CPU climbing
  * the on-screen Load Lab redistributing as scripts/autoscale.sh adds replicas
"""
from locust import HttpUser, between, task


class ErpUser(HttpUser):
    wait_time = between(0.1, 0.5)

    @task(3)
    def hammer_cpu(self):
        # CPU-bound endpoint — this is what drives the scaling signal.
        self.client.get("/api/load?ms=200", name="/api/load")

    @task(2)
    def read_stock(self):
        self.client.get("/api/wms/stock", name="/api/wms/stock")

    @task(2)
    def read_products(self):
        self.client.get("/api/erp/products", name="/api/erp/products")

    @task(1)
    def whoami(self):
        self.client.get("/whoami", name="/whoami")

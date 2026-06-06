// Thin fetch wrapper. All requests hit the same origin, which in every
// environment is fronted by the Nginx load balancer / reverse proxy.
const json = async (res) => {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

export const api = {
  products: () => fetch("/api/erp/products").then(json),
  stock: () => fetch("/api/wms/stock").then(json),
  customers: () => fetch("/api/crm/customers").then(json),
  orders: () => fetch("/api/crm/orders").then(json),
  whoami: () => fetch("/whoami").then(json),
  hammer: (ms = 250) => fetch(`/api/load?ms=${ms}`).then(json),
};

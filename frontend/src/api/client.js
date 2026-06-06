// Thin fetch wrapper. All requests hit the same origin, which in every
// environment is fronted by the Nginx load balancer / reverse proxy.
//
// The JWT is kept in localStorage and attached as a Bearer header. A 401
// clears it and bubbles up so the auth layer can redirect to /login.

const TOKEN_KEY = "nimbus_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = new URLSearchParams(form).toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, { method, headers, body: payload });

  if (res.status === 401) {
    tokenStore.clear();
    throw new ApiError(401, "Session expired — please sign in again.");
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.detail) detail = typeof data.detail === "string" ? data.detail : detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // auth
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", form: { username: email, password } }),
  me: () => request("/api/auth/me"),

  // dashboard
  dashboard: () => request("/api/dashboard"),

  // ERP — products
  products: () => request("/api/erp/products"),
  createProduct: (body) => request("/api/erp/products", { method: "POST", body }),
  updateProduct: (id, body) => request(`/api/erp/products/${id}`, { method: "PATCH", body }),
  deleteProduct: (id) => request(`/api/erp/products/${id}`, { method: "DELETE" }),

  // WMS — stock
  stock: () => request("/api/wms/stock"),
  createStock: (body) => request("/api/wms/stock", { method: "POST", body }),
  updateStock: (id, body) => request(`/api/wms/stock/${id}`, { method: "PATCH", body }),
  deleteStock: (id) => request(`/api/wms/stock/${id}`, { method: "DELETE" }),

  // CRM — customers
  customers: () => request("/api/crm/customers"),
  createCustomer: (body) => request("/api/crm/customers", { method: "POST", body }),
  updateCustomer: (id, body) => request(`/api/crm/customers/${id}`, { method: "PATCH", body }),
  deleteCustomer: (id) => request(`/api/crm/customers/${id}`, { method: "DELETE" }),

  // CRM — orders
  orders: () => request("/api/crm/orders"),
  createOrder: (body) => request("/api/crm/orders", { method: "POST", body }),
  updateOrder: (id, body) => request(`/api/crm/orders/${id}`, { method: "PATCH", body }),
  deleteOrder: (id) => request(`/api/crm/orders/${id}`, { method: "DELETE" }),

  // users (admin)
  users: () => request("/api/users"),
  createUser: (body) => request("/api/users", { method: "POST", body }),
  updateUser: (id, body) => request(`/api/users/${id}`, { method: "PATCH", body }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: "DELETE" }),

  // ops
  whoami: () => request("/whoami"),
};

import { useEffect, useState } from "react";
import { api } from "./api/client.js";
import LoadLab from "./components/LoadLab.jsx";

export default function App() {
  const [products, setProducts] = useState([]);
  const [stock, setStock] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [node, setNode] = useState("…");
  const [err, setErr] = useState(null);

  useEffect(() => {
    Promise.all([api.products(), api.stock(), api.customers(), api.orders(), api.whoami()])
      .then(([p, s, c, o, w]) => {
        setProducts(p); setStock(s); setCustomers(c); setOrders(o); setNode(w.instance);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const totalStock = stock.reduce((a, s) => a + s.quantity, 0);
  const revenue = orders.reduce((a, o) => a + o.total, 0);

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <div className="mark">N</div>
          <div>
            <h1>NIMBUS <span>/ cloud ops console</span></h1>
            <p>ERP · CRM · WMS — wholesale apparel</p>
          </div>
        </div>
        <div className="meta">
          <span className="live">system live</span>
          <span className="node">served by replica <b>{node}</b></span>
        </div>
      </div>

      {err && <p className="error">backend unreachable: {err}</p>}

      <div className="metrics">
        <div className="metric">
          <div className="k">SKUs (ERP)</div>
          <div className="v">{products.length}</div>
          <div className="s">active product lines</div>
        </div>
        <div className="metric">
          <div className="k">Units in stock (WMS)</div>
          <div className="v">{totalStock.toLocaleString()}</div>
          <div className="s">across all warehouses</div>
        </div>
        <div className="metric">
          <div className="k">Customers (CRM)</div>
          <div className="v">{customers.length}</div>
          <div className="s">wholesale accounts</div>
        </div>
        <div className="metric">
          <div className="k">Open revenue</div>
          <div className="v">${(revenue / 1000).toFixed(1)}k</div>
          <div className="s">{orders.length} orders</div>
        </div>
      </div>

      <div className="grid">
        <div>
          <div className="card">
            <header><h2>Warehouse Stock</h2><span className="tag wms">WMS</span></header>
            <table>
              <thead><tr><th>SKU</th><th>Product</th><th>Warehouse</th><th className="num">Qty</th></tr></thead>
              <tbody>
                {stock.map((s) => (
                  <tr key={s.id}>
                    <td className="muted">{s.product.sku}</td>
                    <td>{s.product.name}</td>
                    <td className="muted">{s.warehouse}</td>
                    <td className="num">{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <header><h2>Product Catalogue</h2><span className="tag erp">ERP</span></header>
            <table>
              <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th className="num">Unit £</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="muted">{p.sku}</td>
                    <td>{p.name}</td>
                    <td className="muted">{p.category}</td>
                    <td className="num">{p.unit_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card">
            <header><h2>Recent Orders</h2><span className="tag crm">CRM</span></header>
            <table>
              <thead><tr><th>#</th><th>Customer</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>
                {orders.map((o) => {
                  const c = customers.find((x) => x.id === o.customer_id);
                  return (
                    <tr key={o.id}>
                      <td className="muted">{o.id}</td>
                      <td>{c ? c.name : o.customer_id}</td>
                      <td><span className={`status ${o.status}`}>{o.status}</span></td>
                      <td className="num">${o.total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <LoadLab />
        </div>
      </div>
    </div>
  );
}

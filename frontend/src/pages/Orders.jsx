import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import DataTable from "../components/DataTable.jsx";
import Drawer, { Detail } from "../components/Drawer.jsx";
import { Icon } from "../components/icons.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const STATUSES = ["pending", "processing", "shipped", "cancelled"];
const money = (n) => `$${Number(n).toFixed(2)}`;

export default function Orders() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canWrite = can("manager");
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([api.orders(), api.customers(), api.products()]).then(
        ([orders, customers, products]) => ({ orders, customers, products })
      ),
    []
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({ customer_id: "", status: "pending", notes: "", items: [] });
  const [saving, setSaving] = useState(false);

  const customerName = (id) => data?.customers.find((c) => c.id === id)?.name || `#${id}`;
  const productById = (id) => data?.products.find((p) => p.id === id);

  const rows = useMemo(() => {
    const list = data?.orders || [];
    const q = query.toLowerCase();
    return q
      ? list.filter((o) => `${customerName(o.customer_id)} ${o.status}`.toLowerCase().includes(q))
      : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query]);

  const formTotal = useMemo(
    () => form.items.reduce((sum, it) => {
      const p = productById(it.product_id);
      return sum + (p ? p.unit_price * it.quantity : 0);
    }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.items, data]
  );

  const openNew = () => {
    setForm({ customer_id: data?.customers?.[0]?.id || "", status: "pending", notes: "", items: [] });
    setEditing({});
  };
  const openEdit = (o) => {
    setForm({
      customer_id: o.customer_id, status: o.status, notes: o.notes || "",
      items: o.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    });
    setEditing(o);
    setViewing(null);
  };

  const addItem = () => {
    const first = data?.products?.[0]?.id;
    if (!first) return;
    setForm({ ...form, items: [...form.items, { product_id: first, quantity: 1 }] });
  };
  const updateItem = (idx, patch) => {
    const items = form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setForm({ ...form, items });
  };
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const save = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) { toast("Add at least one line item", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: parseInt(form.customer_id, 10),
        status: form.status,
        notes: form.notes || null,
        items: form.items.map((i) => ({ product_id: i.product_id, quantity: parseInt(i.quantity, 10) })),
      };
      if (editing.id) { await api.updateOrder(editing.id, payload); toast("Order updated"); }
      else { await api.createOrder(payload); toast("Order created"); }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (o) => {
    if (!(await confirm({ title: "Delete order", message: `Delete order #${o.id}?` }))) return;
    try { await api.deleteOrder(o.id); toast("Order deleted"); setViewing(null); reload(); }
    catch (err) { toast(err.message, "error"); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const columns = [
    { key: "id", header: "#", render: (o) => <span className="mono">{o.id}</span> },
    { key: "customer", header: "Customer", sortValue: (o) => customerName(o.customer_id), render: (o) => <span className="strong">{customerName(o.customer_id)}</span> },
    { key: "items", header: "Items", sortValue: (o) => o.items.length, render: (o) => `${o.items.length} item${o.items.length === 1 ? "" : "s"}` },
    { key: "status", header: "Status", render: (o) => <span className={`status-${o.status}`}>{o.status}</span> },
    { key: "created_at", header: "Date", render: (o) => new Date(o.created_at).toLocaleDateString() },
    { key: "total", header: "Total", align: "right", render: (o) => money(o.total) },
  ];
  if (canWrite) {
    columns.push({ key: "actions", header: "", sortable: false, align: "right", render: (o) => (
      <span className="actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost sm" onClick={() => openEdit(o)}><Icon.edit width={14} height={14} /></button>
        <button className="btn danger sm" onClick={() => remove(o)}><Icon.trash width={14} height={14} /></button>
      </span>
    ) });
  }

  return (
    <>
      <PageToolbar count={rows.length} search={query} onSearch={setQuery}
        canWrite={canWrite} onNew={openNew} newLabel="New order" />

      <DataTable columns={columns} rows={rows} onRowClick={setViewing} emptyTitle="No orders" />

      {editing && (
        <Modal title={editing.id ? `Edit order #${editing.id}` : "New order"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <div className="row2">
              <div className="field"><label>Customer</label>
                <select className="select" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
                  {(data?.customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div className="field"><label>Status</label>
                <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select></div>
            </div>

            <div className="field">
              <label>Line items</label>
              <div className="line-items">
                {form.items.length === 0 && <div className="muted line-empty">No items yet — add a product below.</div>}
                {form.items.map((it, idx) => {
                  const p = productById(it.product_id);
                  return (
                    <div className="line-item" key={idx}>
                      <select className="select" value={it.product_id}
                        onChange={(e) => updateItem(idx, { product_id: parseInt(e.target.value, 10) })}>
                        {(data?.products || []).map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                      </select>
                      <input className="input qty" type="number" min="1" value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value || 1, 10)) })} />
                      <span className="line-sub">{p ? money(p.unit_price * it.quantity) : "—"}</span>
                      <button type="button" className="btn danger sm" onClick={() => removeItem(idx)}><Icon.trash width={13} height={13} /></button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn ghost sm add-line" onClick={addItem}>
                <Icon.plus width={14} height={14} /> Add item
              </button>
            </div>

            <div className="field"><label>Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

            <div className="order-total-row">
              <span>Order total</span>
              <strong>{money(formTotal)}</strong>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Drawer title={`Order #${viewing.id}`} onClose={() => setViewing(null)}
          footer={canWrite && (
            <>
              <button className="btn danger" onClick={() => remove(viewing)}>Delete</button>
              <button className="btn primary" onClick={() => openEdit(viewing)}>Edit</button>
            </>
          )}>
          <Detail label="Customer">{customerName(viewing.customer_id)}</Detail>
          <Detail label="Status"><span className={`status-${viewing.status}`}>{viewing.status}</span></Detail>
          <Detail label="Date">{new Date(viewing.created_at).toLocaleString()}</Detail>
          <Detail label="Notes">{viewing.notes}</Detail>
          <div className="detail-row">
            <div className="detail-k">Line items</div>
            <div className="detail-v">
              <table className="mini-table">
                <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Subtotal</th></tr></thead>
                <tbody>
                  {viewing.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.product?.name || `#${it.product_id}`}</td>
                      <td className="num">{it.quantity}</td>
                      <td className="num">{money(it.unit_price)}</td>
                      <td className="num">{money(it.unit_price * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="order-total-row"><span>Total</span><strong>{money(viewing.total)}</strong></div>
        </Drawer>
      )}
    </>
  );
}

import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Icon } from "../components/icons.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { Empty, ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const STATUSES = ["pending", "processing", "shipped", "cancelled"];

export default function Orders() {
  const { can } = useAuth();
  const toast = useToast();
  const canWrite = can("manager");
  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([api.orders(), api.customers()]).then(([orders, customers]) => ({
        orders,
        customers,
      })),
    []
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ customer_id: "", total: "", status: "pending" });
  const [saving, setSaving] = useState(false);

  const customerName = (id) => data?.customers.find((c) => c.id === id)?.name || `#${id}`;

  const rows = useMemo(() => {
    const list = data?.orders || [];
    const q = query.toLowerCase();
    return q
      ? list.filter((o) => `${customerName(o.customer_id)} ${o.status}`.toLowerCase().includes(q))
      : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query]);

  const openNew = () => {
    setForm({ customer_id: data?.customers?.[0]?.id || "", total: "", status: "pending" });
    setEditing({});
  };
  const openEdit = (o) => {
    setForm({ customer_id: o.customer_id, total: o.total, status: o.status });
    setEditing(o);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        await api.updateOrder(editing.id, { status: form.status, total: parseFloat(form.total) });
        toast("Order updated");
      } else {
        await api.createOrder({
          customer_id: parseInt(form.customer_id, 10),
          total: parseFloat(form.total),
          status: form.status,
        });
        toast("Order created");
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (o) => {
    if (!confirm(`Delete order #${o.id}?`)) return;
    try { await api.deleteOrder(o.id); toast("Order deleted"); reload(); }
    catch (err) { toast(err.message, "error"); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  return (
    <>
      <PageToolbar
        count={rows.length}
        search={query}
        onSearch={setQuery}
        canWrite={canWrite}
        onNew={openNew}
        newLabel="New order"
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>#</th><th>Customer</th><th>Status</th><th>Date</th>
              <th className="num">Total</th>
              {canWrite && <th className="num">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="placeholder" colSpan={canWrite ? 6 : 5}><Empty title="No orders" /></td></tr>
            )}
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="mono">{o.id}</td>
                <td className="strong">{customerName(o.customer_id)}</td>
                <td><span className={`status-${o.status}`}>{o.status}</span></td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="num">${o.total.toFixed(2)}</td>
                {canWrite && (
                  <td className="actions">
                    <button className="btn ghost sm" onClick={() => openEdit(o)}><Icon.edit width={14} height={14} /></button>
                    <button className="btn danger sm" onClick={() => remove(o)}><Icon.trash width={14} height={14} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit order" : "New order"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            {!editing.id && (
              <div className="field">
                <label>Customer</label>
                <select className="select" value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
                  {(data?.customers || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="row2">
              <div className="field">
                <label>Total ($)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.total} required
                  onChange={(e) => setForm({ ...form, total: e.target.value })} />
              </div>
              <div className="field">
                <label>Status</label>
                <select className="select" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

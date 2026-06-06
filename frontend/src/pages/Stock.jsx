import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Icon } from "../components/icons.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { Empty, ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const LOW = 150;
const WAREHOUSES = ["Tashkent-Central", "Samarkand-RDC", "Almaty-Hub"];

export default function Stock() {
  const { can } = useAuth();
  const toast = useToast();
  const canWrite = can("manager");
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([api.stock(), api.products()]).then(([stock, products]) => ({ stock, products })),
    []
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ product_id: "", warehouse: WAREHOUSES[0], quantity: "" });
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data?.stock || [];
    const q = query.toLowerCase();
    return q
      ? list.filter((s) => `${s.product.sku} ${s.product.name} ${s.warehouse}`.toLowerCase().includes(q))
      : list;
  }, [data, query]);

  const openNew = () => {
    setForm({ product_id: data?.products?.[0]?.id || "", warehouse: WAREHOUSES[0], quantity: "" });
    setEditing({});
  };
  const openEdit = (s) => {
    setForm({ product_id: s.product.id, warehouse: s.warehouse, quantity: s.quantity });
    setEditing(s);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        await api.updateStock(editing.id, {
          warehouse: form.warehouse,
          quantity: parseInt(form.quantity, 10),
        });
        toast("Stock updated");
      } else {
        await api.createStock({
          product_id: parseInt(form.product_id, 10),
          warehouse: form.warehouse,
          quantity: parseInt(form.quantity, 10),
        });
        toast("Stock added");
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (!confirm(`Delete stock record for ${s.product.sku} at ${s.warehouse}?`)) return;
    try {
      await api.deleteStock(s.id);
      toast("Stock record deleted");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
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
        newLabel="Add stock"
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>SKU</th><th>Product</th><th>Warehouse</th>
              <th className="num">Quantity</th><th>Status</th>
              {canWrite && <th className="num">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="placeholder" colSpan={canWrite ? 6 : 5}>
                <Empty title="No stock records" />
              </td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.product.sku}</td>
                <td className="strong">{s.product.name}</td>
                <td>{s.warehouse}</td>
                <td className="num">{s.quantity}</td>
                <td>
                  <span className={`chip ${s.quantity < LOW ? "low" : "ok"}`}>
                    {s.quantity < LOW ? "low" : "ok"}
                  </span>
                </td>
                {canWrite && (
                  <td className="actions">
                    <button className="btn ghost sm" onClick={() => openEdit(s)}><Icon.edit width={14} height={14} /></button>
                    <button className="btn danger sm" onClick={() => remove(s)}><Icon.trash width={14} height={14} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit stock" : "Add stock"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            {!editing.id && (
              <div className="field">
                <label>Product</label>
                <select className="select" value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
                  {(data?.products || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="row2">
              <div className="field">
                <label>Warehouse</label>
                <select className="select" value={form.warehouse}
                  onChange={(e) => setForm({ ...form, warehouse: e.target.value })}>
                  {WAREHOUSES.map((w) => <option key={w}>{w}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Quantity</label>
                <input className="input" type="number" min="0" value={form.quantity} required
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

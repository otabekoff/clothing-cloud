import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Icon } from "../components/icons.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { Empty, ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const BLANK = { sku: "", name: "", category: "Tops", unit_price: "" };
const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Accessories"];

export default function Products() {
  const { can } = useAuth();
  const toast = useToast();
  const canWrite = can("manager");
  const { data, loading, error, reload } = useAsync(() => api.products(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // null | {} (new) | product (edit)
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data || [];
    const q = query.toLowerCase();
    return q
      ? list.filter((p) => `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q))
      : list;
  }, [data, query]);

  const openNew = () => { setForm(BLANK); setEditing({}); };
  const openEdit = (p) => {
    setForm({ sku: p.sku, name: p.name, category: p.category, unit_price: p.unit_price });
    setEditing(p);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, unit_price: parseFloat(form.unit_price) };
      if (editing.id) {
        await api.updateProduct(editing.id, payload);
        toast("Product updated");
      } else {
        await api.createProduct(payload);
        toast("Product created");
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!confirm(`Delete product ${p.sku}?`)) return;
    try {
      await api.deleteProduct(p.id);
      toast("Product deleted");
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
        newLabel="New product"
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>SKU</th><th>Name</th><th>Category</th>
              <th className="num">Unit price</th>
              {canWrite && <th className="num">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="placeholder" colSpan={canWrite ? 5 : 4}>
                <Empty title="No products" hint={query ? "Try a different search." : "Add your first product."} />
              </td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.sku}</td>
                <td className="strong">{p.name}</td>
                <td><span className="chip">{p.category}</span></td>
                <td className="num">${p.unit_price.toFixed(2)}</td>
                {canWrite && (
                  <td className="actions">
                    <button className="btn ghost sm" onClick={() => openEdit(p)}><Icon.edit width={14} height={14} /></button>
                    <button className="btn danger sm" onClick={() => remove(p)}><Icon.trash width={14} height={14} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit product" : "New product"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <div className="row2">
              <div className="field">
                <label>SKU</label>
                <input className="input" value={form.sku} required
                  onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="field">
                <label>Category</label>
                <select className="select" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Name</label>
              <input className="input" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Unit price ($)</label>
              <input className="input" type="number" step="0.01" min="0" value={form.unit_price} required
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
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

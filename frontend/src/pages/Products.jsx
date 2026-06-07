import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import DataTable from "../components/DataTable.jsx";
import Drawer, { Detail } from "../components/Drawer.jsx";
import { Icon } from "../components/icons.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const BLANK = {
  sku: "", name: "", category: "Tops", description: "",
  unit_price: "", cost_price: "", supplier: "", reorder_level: 100,
  image_url: null, is_active: true,
};
const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Accessories", "Footwear"];
const money = (n) => `$${Number(n).toFixed(2)}`;

export default function Products() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canWrite = can("manager");
  const { data, loading, error, reload } = useAsync(() => api.products(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data || [];
    const q = query.toLowerCase();
    return q
      ? list.filter((p) => `${p.sku} ${p.name} ${p.category} ${p.supplier || ""}`.toLowerCase().includes(q))
      : list;
  }, [data, query]);

  const openNew = () => { setForm(BLANK); setEditing({}); };
  const openEdit = (p) => {
    setForm({
      sku: p.sku, name: p.name, category: p.category, description: p.description || "",
      unit_price: p.unit_price, cost_price: p.cost_price, supplier: p.supplier || "",
      reorder_level: p.reorder_level, image_url: p.image_url, is_active: p.is_active,
    });
    setEditing(p);
    setViewing(null);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        unit_price: parseFloat(form.unit_price),
        cost_price: parseFloat(form.cost_price || 0),
        reorder_level: parseInt(form.reorder_level || 0, 10),
        supplier: form.supplier || null,
        description: form.description || null,
      };
      if (editing.id) { await api.updateProduct(editing.id, payload); toast("Product updated"); }
      else { await api.createProduct(payload); toast("Product created"); }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!(await confirm({ title: "Delete product", message: `Delete “${p.name}” (${p.sku})? This also removes its stock records.` }))) return;
    try { await api.deleteProduct(p.id); toast("Product deleted"); setViewing(null); reload(); }
    catch (err) { toast(err.message, "error"); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const columns = [
    { key: "image_url", header: "", sortable: false, render: (p) => (
      <div className="cell-thumb">{p.image_url ? <img src={p.image_url} alt="" /> : <span>{p.name[0]}</span>}</div>
    ) },
    { key: "sku", header: "SKU", render: (p) => <span className="mono">{p.sku}</span> },
    { key: "name", header: "Name", render: (p) => <span className="strong">{p.name}</span> },
    { key: "category", header: "Category", render: (p) => <span className="chip">{p.category}</span> },
    { key: "supplier", header: "Supplier", render: (p) => p.supplier || <span className="muted">—</span> },
    { key: "unit_price", header: "Price", align: "right", render: (p) => money(p.unit_price) },
    { key: "is_active", header: "Status", render: (p) => (
      <span className={`chip ${p.is_active ? "ok" : "low"}`}>{p.is_active ? "active" : "inactive"}</span>
    ) },
  ];
  if (canWrite) {
    columns.push({ key: "actions", header: "", sortable: false, align: "right", render: (p) => (
      <span className="actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost sm" onClick={() => openEdit(p)}><Icon.edit width={14} height={14} /></button>
        <button className="btn danger sm" onClick={() => remove(p)}><Icon.trash width={14} height={14} /></button>
      </span>
    ) });
  }

  return (
    <>
      <PageToolbar count={rows.length} search={query} onSearch={setQuery}
        canWrite={canWrite} onNew={openNew} newLabel="New product" />

      <DataTable columns={columns} rows={rows} onRowClick={setViewing}
        emptyTitle="No products" emptyHint={query ? "Try a different search." : "Add your first product."} />

      {editing && (
        <Modal title={editing.id ? "Edit product" : "New product"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="Product image" />
            <div className="row2">
              <div className="field"><label>SKU</label>
                <input className="input" value={form.sku} required onChange={set("sku")} /></div>
              <div className="field"><label>Category</label>
                <select className="select" value={form.category} onChange={set("category")}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select></div>
            </div>
            <div className="field"><label>Name</label>
              <input className="input" value={form.name} required onChange={set("name")} /></div>
            <div className="field"><label>Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={set("description")} /></div>
            <div className="row2">
              <div className="field"><label>Unit price ($)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.unit_price} required onChange={set("unit_price")} /></div>
              <div className="field"><label>Cost price ($)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.cost_price} onChange={set("cost_price")} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>Supplier</label>
                <input className="input" value={form.supplier} onChange={set("supplier")} /></div>
              <div className="field"><label>Reorder level</label>
                <input className="input" type="number" min="0" value={form.reorder_level} onChange={set("reorder_level")} /></div>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active (available for sale)
            </label>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Drawer title={viewing.name} onClose={() => setViewing(null)}
          footer={canWrite && (
            <>
              <button className="btn danger" onClick={() => remove(viewing)}>Delete</button>
              <button className="btn primary" onClick={() => openEdit(viewing)}>Edit</button>
            </>
          )}>
          <div className="drawer-hero">
            <div className="cell-thumb lg">{viewing.image_url ? <img src={viewing.image_url} alt="" /> : <span>{viewing.name[0]}</span>}</div>
            <div>
              <div className="mono muted">{viewing.sku}</div>
              <span className="chip">{viewing.category}</span>
            </div>
          </div>
          <Detail label="Description">{viewing.description}</Detail>
          <Detail label="Unit price">{money(viewing.unit_price)}</Detail>
          <Detail label="Cost price">{money(viewing.cost_price)}</Detail>
          <Detail label="Margin">
            {viewing.unit_price > 0
              ? `${Math.round(((viewing.unit_price - viewing.cost_price) / viewing.unit_price) * 100)}%`
              : "—"}
          </Detail>
          <Detail label="Supplier">{viewing.supplier}</Detail>
          <Detail label="Reorder level">{viewing.reorder_level}</Detail>
          <Detail label="Status">
            <span className={`chip ${viewing.is_active ? "ok" : "low"}`}>{viewing.is_active ? "active" : "inactive"}</span>
          </Detail>
        </Drawer>
      )}
    </>
  );
}

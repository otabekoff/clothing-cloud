import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import DataTable from "../components/DataTable.jsx";
import { Icon } from "../components/icons.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const WAREHOUSES = ["Tashkent-Central", "Samarkand-RDC", "Almaty-Hub"];

export default function Stock() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canWrite = can("manager");
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([api.stock(), api.products()]).then(([stock, products]) => ({ stock, products })),
    []
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ product_id: "", warehouse: WAREHOUSES[0], bin_location: "", quantity: "", reorder_level: 150 });
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data?.stock || [];
    const q = query.toLowerCase();
    return q
      ? list.filter((s) => `${s.product.sku} ${s.product.name} ${s.warehouse} ${s.bin_location || ""}`.toLowerCase().includes(q))
      : list;
  }, [data, query]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const openNew = () => {
    setForm({ product_id: data?.products?.[0]?.id || "", warehouse: WAREHOUSES[0], bin_location: "", quantity: "", reorder_level: 150 });
    setEditing({});
  };
  const openEdit = (s) => {
    setForm({ product_id: s.product.id, warehouse: s.warehouse, bin_location: s.bin_location || "", quantity: s.quantity, reorder_level: s.reorder_level });
    setEditing(s);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const common = {
        warehouse: form.warehouse,
        bin_location: form.bin_location || null,
        quantity: parseInt(form.quantity, 10),
        reorder_level: parseInt(form.reorder_level || 0, 10),
      };
      if (editing.id) { await api.updateStock(editing.id, common); toast("Stock updated"); }
      else { await api.createStock({ product_id: parseInt(form.product_id, 10), ...common }); toast("Stock added"); }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (!(await confirm({ title: "Delete stock record", message: `Remove ${s.product.sku} at ${s.warehouse}?` }))) return;
    try { await api.deleteStock(s.id); toast("Stock record deleted"); reload(); }
    catch (err) { toast(err.message, "error"); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const columns = [
    { key: "sku", header: "SKU", sortValue: (s) => s.product.sku, render: (s) => <span className="mono">{s.product.sku}</span> },
    { key: "name", header: "Product", sortValue: (s) => s.product.name, render: (s) => <span className="strong">{s.product.name}</span> },
    { key: "warehouse", header: "Warehouse" },
    { key: "bin_location", header: "Bin", render: (s) => s.bin_location || <span className="muted">—</span> },
    { key: "quantity", header: "Qty", align: "right" },
    { key: "status", header: "Status", sortValue: (s) => s.quantity - s.reorder_level, render: (s) => (
      <span className={`chip ${s.quantity < s.reorder_level ? "low" : "ok"}`}>{s.quantity < s.reorder_level ? "reorder" : "ok"}</span>
    ) },
  ];
  if (canWrite) {
    columns.push({ key: "actions", header: "", sortable: false, align: "right", render: (s) => (
      <span className="actions">
        <button className="btn ghost sm" onClick={() => openEdit(s)}><Icon.edit width={14} height={14} /></button>
        <button className="btn danger sm" onClick={() => remove(s)}><Icon.trash width={14} height={14} /></button>
      </span>
    ) });
  }

  return (
    <>
      <PageToolbar count={rows.length} search={query} onSearch={setQuery}
        canWrite={canWrite} onNew={openNew} newLabel="Add stock" />

      <DataTable columns={columns} rows={rows} emptyTitle="No stock records" />

      {editing && (
        <Modal title={editing.id ? "Edit stock" : "Add stock"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            {!editing.id && (
              <div className="field"><label>Product</label>
                <select className="select" value={form.product_id} onChange={set("product_id")} required>
                  {(data?.products || []).map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select></div>
            )}
            <div className="row2">
              <div className="field"><label>Warehouse</label>
                <select className="select" value={form.warehouse} onChange={set("warehouse")}>
                  {WAREHOUSES.map((w) => <option key={w}>{w}</option>)}
                </select></div>
              <div className="field"><label>Bin location</label>
                <input className="input" value={form.bin_location} placeholder="e.g. A-04" onChange={set("bin_location")} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>Quantity</label>
                <input className="input" type="number" min="0" value={form.quantity} required onChange={set("quantity")} /></div>
              <div className="field"><label>Reorder level</label>
                <input className="input" type="number" min="0" value={form.reorder_level} onChange={set("reorder_level")} /></div>
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

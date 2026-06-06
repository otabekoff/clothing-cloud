import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Icon } from "../components/icons.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { Empty, ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const BLANK = { name: "", region: "", email: "" };

export default function Customers() {
  const { can } = useAuth();
  const toast = useToast();
  const canWrite = can("manager");
  const { data, loading, error, reload } = useAsync(() => api.customers(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data || [];
    const q = query.toLowerCase();
    return q ? list.filter((c) => `${c.name} ${c.region} ${c.email}`.toLowerCase().includes(q)) : list;
  }, [data, query]);

  const openNew = () => { setForm(BLANK); setEditing({}); };
  const openEdit = (c) => { setForm({ name: c.name, region: c.region, email: c.email }); setEditing(c); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) { await api.updateCustomer(editing.id, form); toast("Customer updated"); }
      else { await api.createCustomer(form); toast("Customer created"); }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!confirm(`Delete customer ${c.name}?`)) return;
    try { await api.deleteCustomer(c.id); toast("Customer deleted"); reload(); }
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
        newLabel="New customer"
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th><th>Region</th><th>Email</th>
              {canWrite && <th className="num">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="placeholder" colSpan={canWrite ? 4 : 3}><Empty title="No customers" /></td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="strong">{c.name}</td>
                <td><span className="chip">{c.region}</span></td>
                <td className="mono">{c.email}</td>
                {canWrite && (
                  <td className="actions">
                    <button className="btn ghost sm" onClick={() => openEdit(c)}><Icon.edit width={14} height={14} /></button>
                    <button className="btn danger sm" onClick={() => remove(c)}><Icon.trash width={14} height={14} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit customer" : "New customer"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <div className="field">
              <label>Company name</label>
              <input className="input" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="row2">
              <div className="field">
                <label>Region</label>
                <input className="input" value={form.region} required
                  onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={form.email} required
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
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

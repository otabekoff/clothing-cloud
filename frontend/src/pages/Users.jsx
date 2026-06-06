import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Icon } from "../components/icons.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { Empty, ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const ROLES = ["viewer", "manager", "admin"];

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.users(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", full_name: "", role: "viewer", password: "" });
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data || [];
    const q = query.toLowerCase();
    return q ? list.filter((u) => `${u.full_name} ${u.email} ${u.role}`.toLowerCase().includes(q)) : list;
  }, [data, query]);

  const openNew = () => { setForm({ email: "", full_name: "", role: "viewer", password: "" }); setEditing({}); };
  const openEdit = (u) => { setForm({ email: u.email, full_name: u.full_name, role: u.role, password: "" }); setEditing(u); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        const patch = { full_name: form.full_name, role: form.role };
        if (form.password) patch.password = form.password;
        await api.updateUser(editing.id, patch);
        toast("User updated");
      } else {
        await api.createUser(form);
        toast("User created");
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (!confirm(`Delete user ${u.email}?`)) return;
    try { await api.deleteUser(u.id); toast("User deleted"); reload(); }
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
        canWrite
        onNew={openNew}
        newLabel="New user"
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="placeholder" colSpan={5}><Empty title="No users" /></td></tr>
            )}
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="strong">{u.full_name}{u.id === me.id && <span className="chip" style={{ marginLeft: 8 }}>you</span>}</td>
                <td className="mono">{u.email}</td>
                <td><span className={`chip role-${u.role}`}>{u.role}</span></td>
                <td><span className={`chip ${u.is_active ? "ok" : "low"}`}>{u.is_active ? "active" : "disabled"}</span></td>
                <td className="actions">
                  <button className="btn ghost sm" onClick={() => openEdit(u)}><Icon.edit width={14} height={14} /></button>
                  <button className="btn danger sm" onClick={() => remove(u)} disabled={u.id === me.id}>
                    <Icon.trash width={14} height={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? "Edit user" : "New user"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <div className="field">
              <label>Full name</label>
              <input className="input" value={form.full_name} required
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={form.email} required disabled={!!editing.id}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="row2">
              <div className="field">
                <label>Role</label>
                <select className="select" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{editing.id ? "New password (optional)" : "Password"}</label>
                <input className="input" type="password" value={form.password}
                  required={!editing.id} minLength={6}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
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

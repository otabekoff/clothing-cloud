import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import DataTable from "../components/DataTable.jsx";
import { Icon } from "../components/icons.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import Modal from "../components/Modal.jsx";
import PageToolbar from "../components/PageToolbar.jsx";
import { ErrorBanner, Loading } from "../components/states.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAsync } from "../hooks/useAsync.js";

const ROLES = ["viewer", "manager", "admin"];
const BLANK = { email: "", full_name: "", role: "viewer", password: "", avatar_url: null, is_active: true };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useAsync(() => api.users(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data || [];
    const q = query.toLowerCase();
    return q ? list.filter((u) => `${u.full_name} ${u.email} ${u.role}`.toLowerCase().includes(q)) : list;
  }, [data, query]);

  const openNew = () => { setForm(BLANK); setEditing({}); };
  const openEdit = (u) => {
    setForm({ email: u.email, full_name: u.full_name, role: u.role, password: "", avatar_url: u.avatar_url, is_active: u.is_active });
    setEditing(u);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        const patch = { full_name: form.full_name, role: form.role, is_active: form.is_active, avatar_url: form.avatar_url };
        if (form.password) patch.password = form.password;
        await api.updateUser(editing.id, patch);
        toast("User updated");
      } else {
        await api.createUser({ email: form.email, full_name: form.full_name, role: form.role, password: form.password, avatar_url: form.avatar_url });
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
    if (!(await confirm({ title: "Delete user", message: `Delete ${u.email}? This cannot be undone.` }))) return;
    try { await api.deleteUser(u.id); toast("User deleted"); reload(); }
    catch (err) { toast(err.message, "error"); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const columns = [
    { key: "avatar", header: "", sortable: false, render: (u) => (
      <div className="cell-thumb round sm">{u.avatar_url ? <img src={u.avatar_url} alt="" /> : <span>{u.full_name[0]}</span>}</div>
    ) },
    { key: "full_name", header: "Name", render: (u) => (
      <span className="strong">{u.full_name}{u.id === me.id && <span className="chip you">you</span>}</span>
    ) },
    { key: "email", header: "Email", render: (u) => <span className="mono">{u.email}</span> },
    { key: "role", header: "Role", render: (u) => <span className={`chip role-${u.role}`}>{u.role}</span> },
    { key: "is_active", header: "Status", render: (u) => <span className={`chip ${u.is_active ? "ok" : "low"}`}>{u.is_active ? "active" : "disabled"}</span> },
    { key: "actions", header: "", sortable: false, align: "right", render: (u) => (
      <span className="actions">
        <button className="btn ghost sm" onClick={() => openEdit(u)}><Icon.edit width={14} height={14} /></button>
        <button className="btn danger sm" onClick={() => remove(u)} disabled={u.id === me.id}><Icon.trash width={14} height={14} /></button>
      </span>
    ) },
  ];

  return (
    <>
      <PageToolbar count={rows.length} search={query} onSearch={setQuery} canWrite onNew={openNew} newLabel="New user" />

      <DataTable columns={columns} rows={rows} emptyTitle="No users" />

      {editing && (
        <Modal title={editing.id ? "Edit user" : "New user"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <ImageUpload value={form.avatar_url} onChange={(url) => setForm({ ...form, avatar_url: url })} label="Avatar" shape="round" />
            <div className="field"><label>Full name</label>
              <input className="input" value={form.full_name} required onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="field"><label>Email</label>
              <input className="input" type="email" value={form.email} required disabled={!!editing.id}
                onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="row2">
              <div className="field"><label>Role</label>
                <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select></div>
              <div className="field"><label>{editing.id ? "New password (optional)" : "Password"}</label>
                <input className="input" type="password" value={form.password} required={!editing.id} minLength={6}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            </div>
            {editing.id && (
              <label className="checkbox">
                <input type="checkbox" checked={form.is_active} disabled={editing.id === me.id}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active account
              </label>
            )}
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

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
  name: "", region: "", email: "", phone: "", contact_person: "",
  address: "", status: "active", notes: "", logo_url: null,
};
const STATUSES = ["active", "prospect", "inactive"];

export default function Customers() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canWrite = can("manager");
  const { data, loading, error, reload } = useAsync(() => api.customers(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data || [];
    const q = query.toLowerCase();
    return q
      ? list.filter((c) => `${c.name} ${c.region} ${c.email} ${c.contact_person || ""}`.toLowerCase().includes(q))
      : list;
  }, [data, query]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const openNew = () => { setForm(BLANK); setEditing({}); };
  const openEdit = (c) => {
    setForm({
      name: c.name, region: c.region, email: c.email, phone: c.phone || "",
      contact_person: c.contact_person || "", address: c.address || "",
      status: c.status, notes: c.notes || "", logo_url: c.logo_url,
    });
    setEditing(c);
    setViewing(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      for (const k of ["phone", "contact_person", "address", "notes"]) payload[k] = form[k] || null;
      if (editing.id) { await api.updateCustomer(editing.id, payload); toast("Customer updated"); }
      else { await api.createCustomer(payload); toast("Customer created"); }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!(await confirm({ title: "Delete customer", message: `Delete “${c.name}”? Their orders will also be removed.` }))) return;
    try { await api.deleteCustomer(c.id); toast("Customer deleted"); setViewing(null); reload(); }
    catch (err) { toast(err.message, "error"); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const columns = [
    { key: "logo_url", header: "", sortable: false, render: (c) => (
      <div className="cell-thumb round">{c.logo_url ? <img src={c.logo_url} alt="" /> : <span>{c.name[0]}</span>}</div>
    ) },
    { key: "name", header: "Company", render: (c) => <span className="strong">{c.name}</span> },
    { key: "region", header: "Region", render: (c) => <span className="chip">{c.region}</span> },
    { key: "contact_person", header: "Contact", render: (c) => c.contact_person || <span className="muted">—</span> },
    { key: "email", header: "Email", render: (c) => <span className="mono">{c.email}</span> },
    { key: "status", header: "Status", render: (c) => <span className={`status-${c.status === "active" ? "shipped" : c.status === "prospect" ? "processing" : "cancelled"}`}>{c.status}</span> },
  ];
  if (canWrite) {
    columns.push({ key: "actions", header: "", sortable: false, align: "right", render: (c) => (
      <span className="actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost sm" onClick={() => openEdit(c)}><Icon.edit width={14} height={14} /></button>
        <button className="btn danger sm" onClick={() => remove(c)}><Icon.trash width={14} height={14} /></button>
      </span>
    ) });
  }

  return (
    <>
      <PageToolbar count={rows.length} search={query} onSearch={setQuery}
        canWrite={canWrite} onNew={openNew} newLabel="New customer" />

      <DataTable columns={columns} rows={rows} onRowClick={setViewing} emptyTitle="No customers" />

      {editing && (
        <Modal title={editing.id ? "Edit customer" : "New customer"} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <ImageUpload value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url })} label="Company logo" shape="round" />
            <div className="field"><label>Company name</label>
              <input className="input" value={form.name} required onChange={set("name")} /></div>
            <div className="row2">
              <div className="field"><label>Region</label>
                <input className="input" value={form.region} required onChange={set("region")} /></div>
              <div className="field"><label>Status</label>
                <select className="select" value={form.status} onChange={set("status")}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select></div>
            </div>
            <div className="row2">
              <div className="field"><label>Email</label>
                <input className="input" type="email" value={form.email} required onChange={set("email")} /></div>
              <div className="field"><label>Phone</label>
                <input className="input" value={form.phone} onChange={set("phone")} /></div>
            </div>
            <div className="field"><label>Contact person</label>
              <input className="input" value={form.contact_person} onChange={set("contact_person")} /></div>
            <div className="field"><label>Address</label>
              <textarea className="input" rows={2} value={form.address} onChange={set("address")} /></div>
            <div className="field"><label>Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} /></div>
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
            <div className="cell-thumb lg round">{viewing.logo_url ? <img src={viewing.logo_url} alt="" /> : <span>{viewing.name[0]}</span>}</div>
            <div>
              <span className="chip">{viewing.region}</span>{" "}
              <span className={`status-${viewing.status === "active" ? "shipped" : viewing.status === "prospect" ? "processing" : "cancelled"}`}>{viewing.status}</span>
            </div>
          </div>
          <Detail label="Contact person">{viewing.contact_person}</Detail>
          <Detail label="Email">{viewing.email}</Detail>
          <Detail label="Phone">{viewing.phone}</Detail>
          <Detail label="Address">{viewing.address}</Detail>
          <Detail label="Notes">{viewing.notes}</Detail>
        </Drawer>
      )}
    </>
  );
}

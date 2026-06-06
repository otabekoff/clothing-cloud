import { useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import ImageUpload from "../components/ImageUpload.jsx";
import { useToast } from "../components/Toast.jsx";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user.full_name);
  const [avatar, setAvatar] = useState(user.avatar_url);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api.updateProfile({ full_name: fullName, avatar_url: avatar });
      updateUser(updated);
      toast("Profile updated");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw !== pw2) { toast("Passwords do not match", "error"); return; }
    setSavingPw(true);
    try {
      await api.updateProfile({ password: pw });
      setPw(""); setPw2("");
      toast("Password changed");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="profile-grid">
      <div className="card">
        <div className="section-head"><div><h2>Profile</h2><div className="desc">Update your name and avatar</div></div></div>
        <form onSubmit={saveProfile}>
          <ImageUpload value={avatar} onChange={setAvatar} label="Avatar" shape="round" />
          <div className="field"><label>Full name</label>
            <input className="input" value={fullName} required onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="field"><label>Email</label>
            <input className="input" value={user.email} disabled /></div>
          <div className="field"><label>Role</label>
            <input className="input" value={user.role} disabled /></div>
          <button className="btn primary" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</button>
        </form>
      </div>

      <div className="card">
        <div className="section-head"><div><h2>Password</h2><div className="desc">Choose a strong new password</div></div></div>
        <form onSubmit={savePassword}>
          <div className="field"><label>New password</label>
            <input className="input" type="password" minLength={6} value={pw} required onChange={(e) => setPw(e.target.value)} /></div>
          <div className="field"><label>Confirm password</label>
            <input className="input" type="password" minLength={6} value={pw2} required onChange={(e) => setPw2(e.target.value)} /></div>
          <button className="btn primary" disabled={savingPw}>{savingPw ? "Saving…" : "Change password"}</button>
        </form>
      </div>
    </div>
  );
}

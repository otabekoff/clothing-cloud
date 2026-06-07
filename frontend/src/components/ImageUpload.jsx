import { useRef, useState } from "react";
import { api } from "../api/client.js";

// Image picker that uploads to the backend and returns a /media URL via onChange.
// Shows a live preview of the current value (existing or freshly uploaded).
export default function ImageUpload({ value, onChange, label = "Image", shape = "square" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = () => inputRef.current?.click();

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.upload(file);
      onChange(url);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div className="image-upload">
        <div className={`preview ${shape}`}>
          {value ? <img src={value} alt="" /> : <span className="ph">No image</span>}
        </div>
        <div className="iu-actions">
          <button type="button" className="btn ghost sm" onClick={pick} disabled={busy}>
            {busy ? "Uploading…" : value ? "Replace" : "Upload image"}
          </button>
          {value && (
            <button type="button" className="btn danger sm" onClick={() => onChange(null)} disabled={busy}>
              Remove
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={handle}
            hidden
          />
        </div>
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

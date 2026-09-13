import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

// Halaman publik untuk share link /s/:token — tanpa login.
export default function PublicViewer() {
  const { token } = useParams();
  const meta = useQuery({
    queryKey: ["share", token],
    queryFn: () => fetch(`/s/${token}/meta`).then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).error ?? "link tidak valid");
      return r.json();
    }),
    retry: false,
  });

  if (meta.isLoading) return <p style={{ padding: 24 }}>Memuat…</p>;
  if (meta.isError) return <p style={{ padding: 24 }}>Link tidak valid atau kedaluwarsa.</p>;

  const m = meta.data as { name: string; mime: string; size: number };
  const top = (m.mime ?? "").split("/")[0];
  const url = `/s/${token}`;

  return (
    <div className="modal-bg" style={{ position: "static", padding: 24 }}>
      <div className="modal" style={{ margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <strong>{m.name}</strong>
          <a className="btn" href={`${url}?download=1`}>Download</a>
        </div>
        {top === "image" && <img className="preview-img" src={url} alt={m.name} />}
        {top === "video" && <video className="preview-img" src={url} controls />}
        {top === "audio" && <audio src={url} controls style={{ width: "100%" }} />}
        {m.mime === "application/pdf" && (
          <iframe src={url} style={{ width: "80vw", height: "75vh", border: 0 }} />
        )}
        {!["image", "video", "audio"].includes(top) && m.mime !== "application/pdf" && (
          <p className="muted">Preview tidak tersedia untuk tipe ini. Silakan download.</p>
        )}
      </div>
    </div>
  );
}

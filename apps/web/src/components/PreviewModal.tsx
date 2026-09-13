import { contentUrl } from "../api";
import type { NodeDto } from "@nas/shared";
import { X } from "lucide-react";

// Preview inline: gambar/video/audio/pdf native browser; lainnya → tawarkan download.
export default function PreviewModal({ node, onClose }: { node: NodeDto; onClose: () => void }) {
  const mime = node.mime ?? "";
  const top = mime.split("/")[0];
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <strong>{node.name}</strong>
          <div>
            <a className="btn" href={contentUrl(node.id, true)}>Download</a>{" "}
            <button className="btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        {top === "image" && <img className="preview-img" src={contentUrl(node.id)} alt={node.name} />}
        {top === "video" && <video className="preview-img" src={contentUrl(node.id)} controls />}
        {top === "audio" && <audio src={contentUrl(node.id)} controls style={{ width: "100%" }} />}
        {mime === "application/pdf" && (
          <iframe src={contentUrl(node.id)} style={{ width: "80vw", height: "75vh", border: 0 }} />
        )}
        {!["image", "video", "audio"].includes(top) && mime !== "application/pdf" && (
          <p className="muted">Tipe ini tidak bisa di-preview. Silakan download.</p>
        )}
      </div>
    </div>
  );
}

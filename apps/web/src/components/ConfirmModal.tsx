import { useEffect } from "react";
import { AlertTriangle, Trash2, ShieldAlert, X } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  variant = "danger",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="custom-confirm-backdrop" onClick={onCancel}>
      <div className="custom-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="confirm-close-btn" onClick={onCancel} title="Tutup (Esc)">
          <X size={16} />
        </button>

        <div className="confirm-body">
          <div className={`confirm-icon-bubble ${variant}`}>
            {variant === "danger" && <Trash2 size={24} />}
            {variant === "warning" && <AlertTriangle size={24} />}
            {variant === "primary" && <ShieldAlert size={24} />}
          </div>

          <div className="confirm-text">
            <h3 className="confirm-title">{title}</h3>
            <p className="confirm-message">{message}</p>
          </div>
        </div>

        <div className="confirm-actions">
          <button
            type="button"
            className="btn-confirm-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn-confirm-action ${variant}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Memproses..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Edit3, X } from "lucide-react";

export interface PromptModalProps {
  isOpen: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function PromptModal({
  isOpen,
  title,
  initialValue,
  placeholder = "Masukkan nama...",
  confirmText = "Simpan",
  cancelText = "Batal",
  onConfirm,
  onCancel,
  isLoading = false,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Select file name without extension if possible
          const dotIdx = initialValue.lastIndexOf(".");
          if (dotIdx > 0) {
            inputRef.current.setSelectionRange(0, dotIdx);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }

  return (
    <div className="custom-confirm-backdrop" onClick={onCancel}>
      <div className="custom-confirm-dialog prompt-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="confirm-close-btn" onClick={onCancel} title="Tutup (Esc)">
          <X size={16} />
        </button>

        <form onSubmit={handleSubmit}>
          <div className="confirm-body">
            <div className="confirm-icon-bubble primary">
              <Edit3 size={22} />
            </div>

            <div className="confirm-text">
              <h3 className="confirm-title">{title}</h3>
            </div>
          </div>

          <div className="prompt-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="prompt-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              required
            />
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
              type="submit"
              className="btn-confirm-action primary"
              disabled={isLoading || !value.trim()}
            >
              {isLoading ? "Menyimpan..." : confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { contentUrl } from "../api";
import type { NodeDto } from "@nas/shared";
import {
  X,
  Download,
  ExternalLink,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react";

function fmtSize(n: number): string {
  if (!n || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(1)} ${u[i]}`;
}

function fmtTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function PreviewModal({
  node,
  onClose,
}: {
  node: NodeDto;
  onClose: () => void;
}) {
  const mime = node.mime ?? "";
  const top = mime.split("/")[0];
  const isPdf = mime === "application/pdf" || node.name.toLowerCase().endsWith(".pdf");
  const isText =
    top === "text" ||
    mime === "application/json" ||
    mime === "application/javascript" ||
    node.name.match(/\.(txt|md|json|js|ts|tsx|jsx|css|html|py|sql|sh|log|env|yml|yaml)$/i);

  const url = contentUrl(node.id);
  const downloadUrl = contentUrl(node.id, true);

  // States
  const [copied, setCopied] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  // Image Controls
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Audio Controls
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(1);
  const [audioMuted, setAudioMuted] = useState(false);

  // Load Text Preview if text file
  useEffect(() => {
    if (isText) {
      setTextLoading(true);
      fetch(url)
        .then((r) => r.text())
        .then((txt) => {
          setTextContent(txt);
          setTextLoading(false);
        })
        .catch(() => {
          setTextContent("Gagal memuat pratinjau teks.");
          setTextLoading(false);
        });
    }
  }, [isText, url]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function copyShareLink() {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="studio-preview-backdrop" onClick={onClose}>
      <div
        className={`studio-preview-dialog ${isPdf ? "is-pdf" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Studio Modal Header */}
        <header className="studio-preview-header">
          <div className="studio-header-left">
            <div className="studio-file-icon-bubble">
              {top === "image" && <ImageIcon size={18} className="text-plasma" />}
              {top === "video" && <Film size={18} className="text-copper" />}
              {top === "audio" && <Music size={18} className="text-pink" />}
              {isPdf && <FileText size={18} className="text-amber" />}
              {!["image", "video", "audio"].includes(top) && !isPdf && (
                <FileText size={18} className="text-muted" />
              )}
            </div>
            <div className="studio-title-block">
              <h2 className="studio-file-title" title={node.name}>
                {node.name}
              </h2>
              <div className="studio-file-meta-badge">
                <span className="badge-mime-tag">
                  {isPdf ? "PDF Document" : mime || "Binary"}
                </span>
                <span className="dot-sep">•</span>
                <span>{fmtSize(node.size)}</span>
              </div>
            </div>
          </div>

          <div className="studio-header-actions">
            <button
              className="btn-studio-action"
              onClick={copyShareLink}
              title="Salin tautan file"
            >
              {copied ? <Check size={15} className="text-plasma" /> : <Copy size={15} />}
              <span className="btn-label-desktop">{copied ? "Tersalin!" : "Salin Link"}</span>
            </button>

            <a
              className="btn-studio-action"
              href={url}
              target="_blank"
              rel="noreferrer"
              title="Buka file di tab baru"
            >
              <ExternalLink size={15} />
              <span className="btn-label-desktop">Buka Tab</span>
            </a>

            <a
              className="btn-studio-download"
              href={downloadUrl}
              download={node.name}
              title="Unduh file"
            >
              <Download size={15} />
              <span>Download</span>
            </a>

            <button
              className="btn-studio-close"
              onClick={onClose}
              title="Tutup pratinjau (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Studio Content Body */}
        <div className="studio-preview-body">
          {/* 1. IMAGE PREVIEW */}
          {top === "image" && (
            <div className="studio-image-stage">
              <div className="studio-floating-toolbar">
                <button
                  className="toolbar-pill-btn"
                  onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                  title="Perkecil (-)"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="toolbar-zoom-label">{Math.round(zoom * 100)}%</span>
                <button
                  className="toolbar-pill-btn"
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  title="Perbesar (+)"
                >
                  <ZoomIn size={16} />
                </button>
                <div className="toolbar-sep" />
                <button
                  className="toolbar-pill-btn"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Putar 90°"
                >
                  <RotateCw size={16} />
                </button>
                <button
                  className="toolbar-pill-btn"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  title="Reset Ukuran"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              <div className="image-viewport-scroll">
                <img
                  className="studio-interactive-img"
                  src={url}
                  alt={node.name}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 2. VIDEO PREVIEW */}
          {top === "video" && (
            <div className="studio-video-container">
              <video
                className="studio-video-player"
                src={url}
                controls
                autoPlay
                playsInline
              />
            </div>
          )}

          {/* 3. AUDIO PREVIEW */}
          {top === "audio" && (
            <div className="studio-audio-container">
              <div className="audio-player-card">
                {/* Vinyl / Cover Art */}
                <div className={`audio-vinyl-art ${audioPlaying ? "spinning" : ""}`}>
                  <div className="vinyl-grooves">
                    <Music size={32} className="text-amber" />
                  </div>
                </div>

                <div className="audio-track-details">
                  <h3 className="audio-track-title">{node.name}</h3>
                  <span className="audio-track-mime">{mime} • {fmtSize(node.size)}</span>
                </div>

                {/* Animated Sound Wave Bars */}
                <div className={`audio-soundwave-bars ${audioPlaying ? "active" : ""}`}>
                  {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65, 90, 40, 75].map(
                    (h, idx) => (
                      <span
                        key={idx}
                        className="wave-bar"
                        style={{
                          height: audioPlaying ? `${h}%` : "15%",
                          animationDelay: `${idx * 0.08}s`,
                        }}
                      />
                    )
                  )}
                </div>

                {/* Scrubber Bar */}
                <div className="audio-scrubber-wrap">
                  <input
                    type="range"
                    min="0"
                    max={audioDuration || 100}
                    value={audioCurrentTime}
                    className="audio-range-slider"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAudioCurrentTime(val);
                      if (audioRef.current) audioRef.current.currentTime = val;
                    }}
                  />
                  <div className="audio-time-row">
                    <span>{fmtTime(audioCurrentTime)}</span>
                    <span>{fmtTime(audioDuration)}</span>
                  </div>
                </div>

                {/* Player Controls Bar */}
                <div className="audio-controls-row">
                  <button
                    className="audio-vol-btn"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.muted = !audioMuted;
                        setAudioMuted(!audioMuted);
                      }
                    }}
                  >
                    {audioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>

                  <button
                    className="audio-play-pill-btn"
                    onClick={() => {
                      if (!audioRef.current) return;
                      if (audioPlaying) {
                        audioRef.current.pause();
                        setAudioPlaying(false);
                      } else {
                        audioRef.current.play();
                        setAudioPlaying(true);
                      }
                    }}
                  >
                    {audioPlaying ? <Pause size={22} /> : <Play size={22} style={{ marginLeft: 2 }} />}
                  </button>

                  <div className="audio-vol-slider-wrap">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={audioMuted ? 0 : audioVolume}
                      className="vol-slider"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setAudioVolume(v);
                        if (audioRef.current) {
                          audioRef.current.volume = v;
                          audioRef.current.muted = false;
                          setAudioMuted(false);
                        }
                      }}
                    />
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  src={url}
                  onPlay={() => setAudioPlaying(true)}
                  onPause={() => setAudioPlaying(false)}
                  onTimeUpdate={() => {
                    if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (audioRef.current) setAudioDuration(audioRef.current.duration);
                  }}
                  onEnded={() => setAudioPlaying(false)}
                />
              </div>
            </div>
          )}

          {/* 4. PDF DOCUMENT PREVIEW */}
          {isPdf && (
            <div className="studio-pdf-container">
              <object
                data={`${url}#view=FitH`}
                type="application/pdf"
                className="studio-pdf-iframe"
              >
                <div className="studio-fallback-box">
                  <div className="fallback-icon-bubble">
                    <FileText size={42} strokeWidth={1.5} />
                  </div>
                  <h3>Dokumen PDF</h3>
                  <p>Pratinjau langsung tidak didukung di perangkat ini.</p>
                  <a className="btn-upload-pill" href={url} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                    <span>Buka PDF di Tab Baru</span>
                  </a>
                </div>
              </object>
            </div>
          )}

          {/* 5. TEXT / CODE PREVIEW */}
          {isText && !isPdf && (
            <div className="studio-code-container">
              <div className="code-viewer-header">
                <span className="code-viewer-lang">
                  {node.name.split(".").pop()?.toUpperCase() || "TEXT"}
                </span>
                <button
                  className="btn-code-copy"
                  onClick={() => {
                    if (textContent) {
                      navigator.clipboard.writeText(textContent);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                >
                  {copied ? <Check size={14} className="text-plasma" /> : <Copy size={14} />}
                  <span>{copied ? "Disalin!" : "Salin Isi"}</span>
                </button>
              </div>
              <div className="code-viewer-body">
                {textLoading ? (
                  <p className="code-loading-text">Memuat pratinjau teks...</p>
                ) : (
                  <pre className="code-viewer-pre">
                    <code>{textContent}</code>
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* 6. UNSUPPORTED BINARY FILE */}
          {!["image", "video", "audio"].includes(top) && !isPdf && !isText && (
            <div className="studio-fallback-box">
              <div className="fallback-icon-bubble">
                <FileText size={42} strokeWidth={1.5} />
              </div>
              <h3>Pratinjau tidak tersedia langsung</h3>
              <p>
                File berformat <b>{mime || "biner"}</b> dapat Anda unduh langsung ke komputer atau ponsel.
              </p>
              <a className="btn-upload-pill" href={downloadUrl} download={node.name}>
                <Download size={16} />
                <span>Unduh File ({fmtSize(node.size)})</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

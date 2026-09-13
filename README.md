# NAS-Orangepi4A

Modern, minimalist personal cloud storage & NAS drive designed for Orange Pi 4A and SBCs.

## Features
- 🚀 **Fast & Lightweight**: Built with Vite + React on frontend, Node.js + Express backend, and PostgreSQL database.
- 🎨 **Warm Dark Aesthetic**: Custom UI with dashboard widgets, system monitoring (CPU/Uptime/Disk/IP), and glowing amber accents.
- 📂 **Smart File Management**: Drag & Drop upload, folder navigation, breadcrumbs, search, and Multi-Select Batch Actions (batch trash, move, download, restore).
- 🔗 **Public Share Links**: Share files/folders with expiration dates and direct preview.
- 🐳 **Docker-Ready**: Simple single-command deployment via Docker & Docker Compose.

## Tech Stack
- **Frontend**: React 18, Vite, TanStack Query, Lucide Icons, Vanilla CSS.
- **Backend**: Express, TypeScript, PostgreSQL (`pg`), chunked upload deduplication.
- **Hardware Target**: Orange Pi 4A (Linux / RK3588S) via Tailscale.

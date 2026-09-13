import "./styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Login from "./pages/Login";
import Files from "./pages/Files";
import SharedByMe from "./pages/SharedByMe";
import PublicViewer from "./pages/PublicViewer";

import { UploadProvider } from "./context/UploadContext";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000, // 10 detik cache segar (tidak loading ulang saat klik cepat)
      gcTime: 5 * 60_000, // 5 menit garbage collection
      refetchOnWindowFocus: false, // jangan refetch berlebih saat ganti window
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <UploadProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Files />} />
            <Route path="/files" element={<Files />} />
            <Route path="/f/:folderId" element={<Files />} />
            <Route path="/trash" element={<Files trash />} />
            <Route path="/search" element={<Files search />} />
            <Route path="/shared" element={<SharedByMe />} />
            <Route path="/s/:token" element={<PublicViewer />} />
          </Routes>
        </BrowserRouter>
      </UploadProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

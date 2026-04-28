"use client";

import { useAppStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertCircle, Info, XCircle, X } from "lucide-react";

/**
 * Modern, premium Toast Container for UI notifications.
 * It uses framer-motion for smooth entry/exit animations.
 */

const TOAST_ICONS = {
  success: <CheckCircle size={18} style={{ color: "#10b981" }} />,
  error: <XCircle size={18} style={{ color: "#f43f5e" }} />,
  info: <Info size={18} style={{ color: "#0ea5e9" }} />,
  warning: <AlertCircle size={18} style={{ color: "#f59e0b" }} />,
};

const TOAST_BG = {
  success: "rgba(16, 185, 129, 0.08)",
  error: "rgba(244, 63, 94, 0.08)",
  info: "rgba(14, 165, 233, 0.08)",
  warning: "rgba(245, 158, 11, 0.08)",
};

const TOAST_BORDER = {
  success: "rgba(16, 185, 129, 0.2)",
  error: "rgba(244, 63, 94, 0.2)",
  info: "rgba(14, 165, 233, 0.2)",
  warning: "rgba(245, 158, 11, 0.2)",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
            style={{
              pointerEvents: "auto",
              minWidth: 320,
              maxWidth: 450,
              background: "#fff",
              backdropFilter: "blur(8px)",
              border: `1px solid ${TOAST_BORDER[toast.type]}`,
              borderRadius: 16,
              padding: "16px 20px",
              boxShadow: "0 12px 30px -10px rgba(0,0,0,0.12), 0 4px 12px -4px rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Background Accent */}
            <div 
              style={{ 
                position: "absolute", 
                inset: 0, 
                background: TOAST_BG[toast.type],
                zIndex: -1 
              }} 
            />

            <div style={{ flexShrink: 0, display: "flex" }}>
              {TOAST_ICONS[toast.type]}
            </div>

            <div style={{ flex: 1, color: "#1e293b", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              {toast.message}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              style={{
                padding: 4,
                borderRadius: 8,
                color: "#94a3b8",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

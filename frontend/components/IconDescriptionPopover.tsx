"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom";

type Props = {
  label?: string;
  description: string;
  side?: Side;
  align?: "start" | "center" | "end";
  triggerClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
};

export default function IconDescriptionPopover({
  label,
  description,
  side = "bottom",
  align = "center",
  triggerClassName,
  panelClassName,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label ? `${label}: description` : "Show description"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={cn(
          "inline-flex items-center justify-center cursor-pointer transition-transform active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pes-orange)]/10",
          triggerClassName,
        )}
      >
        {children}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          className={cn(
            "absolute z-50 w-56 rounded-2xl border border-black/10 bg-[var(--surface-container-low)] px-4 py-3 text-[11px] font-semibold text-[var(--on-surface)] shadow-xl backdrop-blur-xl",
            side === "bottom" ? "top-full mt-3" : "bottom-full mb-3",
            align === "start"
              ? "left-0"
              : align === "end"
                ? "right-0"
                : "left-1/2 -translate-x-1/2",
            panelClassName,
          )}
        >
          {label && (
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">
              {label}
            </p>
          )}
          <p className="leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  );
}

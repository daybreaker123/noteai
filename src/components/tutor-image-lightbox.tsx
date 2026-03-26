"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type TutorImageLightboxProps = {
  src: string | null;
  onClose: () => void;
};

export function TutorImageLightbox({ src, onClose }: TutorImageLightboxProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [src]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {src ? (
        <motion.div
          key={src}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 pt-16"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Dark blurred backdrop — click to close */}
          <motion.div
            role="presentation"
            className="absolute inset-0 z-0 cursor-zoom-out bg-[var(--scrim-heavy)] backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onCloseRef.current()}
          />

          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="absolute right-4 top-4 z-[20] flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--chrome-50)] text-[var(--text)] shadow-lg backdrop-blur-md transition hover:bg-[var(--scrim-heavy)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>

          {/* Click outside image (padding area) still hits the backdrop button above — image stops propagation */}
          <motion.div
            className="relative z-[10] flex max-h-full max-w-full items-center justify-center"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- lightbox displays arbitrary chat URLs / data URLs */}
            <img
              src={src}
              alt=""
              className="max-h-[min(90vh,calc(100dvh-5rem))] max-w-[min(92vw,100%)] rounded-lg object-contain shadow-2xl ring-1 ring-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

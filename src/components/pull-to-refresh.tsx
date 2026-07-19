"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode, type TouchEvent } from "react";

const PULL_THRESHOLD = 70;
const MAX_PULL = 100;

/** Deslizar hacia abajo estando en el tope de la lista dispara
 * `router.refresh()`. `overscroll-behavior: none` ya está seteado
 * globalmente, así que no compite con el bounce nativo de iOS. */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pullDistance, setPullDistance] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
    let node = el?.parentElement ?? null;
    while (node) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function onTouchStart(e: TouchEvent) {
    if (isPending) return;
    const scrollParent = scrollParentOf(wrapperRef.current);
    startY.current = (scrollParent?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null;
  }

  function onTouchMove(e: TouchEvent) {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    setPullDistance(delta > 0 ? Math.min(MAX_PULL, delta * 0.5) : 0);
  }

  function onTouchEnd() {
    if (startY.current === null) return;
    startY.current = null;
    if (pullDistance >= PULL_THRESHOLD) {
      startTransition(() => router.refresh());
    }
    setPullDistance(0);
  }

  const spinnerSize = isPending ? 40 : pullDistance;
  const spinnerOpacity = isPending ? 1 : Math.min(1, pullDistance / PULL_THRESHOLD);

  return (
    <div ref={wrapperRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: spinnerSize }}
      >
        <div
          aria-hidden
          className={`h-[22px] w-[22px] rounded-full border-[2.5px] border-[#003366]/15 border-t-[#003366] dark:border-[#7bb0e0]/20 dark:border-t-[#7bb0e0] ${
            isPending ? "animate-spin" : ""
          }`}
          style={{
            opacity: spinnerOpacity,
            transform: isPending ? undefined : `rotate(${pullDistance * 3}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}

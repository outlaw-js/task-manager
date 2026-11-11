"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Marks the current choice inside a submenu. */
  checked?: boolean;
  /** Opens a nested menu on hover / click instead of running onClick. */
  children?: MenuItem[];
}
export type MenuEntry = MenuItem | "separator";

type OpenMenu = (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuEntry[]) => void;

const ContextMenuContext = createContext<OpenMenu>(() => {});

/** Returns `open(event, items)`: call it from onContextMenu (or a ⋯ button's onClick). */
export const useContextMenu = () => useContext(ContextMenuContext);

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);

  const open = useCallback<OpenMenu>((e, items) => {
    e.preventDefault?.();
    if (items.length) setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);
  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
    };
  }, [menu, close]);

  return (
    <ContextMenuContext.Provider value={open}>
      {children}
      {menu && (
        <div
          className="fixed inset-0 z-[90]"
          onMouseDown={close}
          onContextMenu={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <MenuPanel x={menu.x} y={menu.y} items={menu.items} onDone={close} />
        </div>
      )}
    </ContextMenuContext.Provider>
  );
}

/**
 * A menu panel at (x, y), flipped back inside the viewport when it would overflow.
 * In RTL the panel opens to the left of the cursor, and submenus to the left of their row.
 */
function MenuPanel({ x, y, items, onDone, anchor }: { x: number; y: number; items: MenuEntry[]; onDone: () => void; anchor?: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });
  const [sub, setSub] = useState<{ index: number; rect: DOMRect } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    let left = anchor ? anchor.left - width + 4 : x - width;
    if (left < pad) left = anchor ? anchor.right - 4 : x;
    left = Math.min(Math.max(pad, left), window.innerWidth - width - pad);
    let top = anchor ? anchor.top - 6 : y;
    if (top + height > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - height - pad);
    setPos({ left, top, ready: true });
  }, [x, y, anchor]);

  // Keyboard: arrow keys move focus between rows.
  function onKeyDown(e: React.KeyboardEvent) {
    const rows = [...(ref.current?.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled)") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length;
      rows[next]?.focus();
    }
  }

  useEffect(() => {
    if (pos.ready && !anchor) ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [pos.ready, anchor]);

  return (
    <>
      <div
        ref={ref}
        role="menu"
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={onKeyDown}
        className="fixed min-w-48 max-w-72 rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-xl outline-none"
        style={{ left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden" }}
      >
        {items.map((item, index) =>
          item === "separator" ? (
            <div key={index} className="my-1 h-px bg-slate-100" />
          ) : (
            <button
              key={index}
              role="menuitem"
              disabled={item.disabled}
              onMouseEnter={(e) => setSub(item.children ? { index, rect: e.currentTarget.getBoundingClientRect() } : null)}
              onFocus={(e) => setSub(item.children ? { index, rect: e.currentTarget.getBoundingClientRect() } : null)}
              onClick={(e) => {
                if (item.children) {
                  setSub({ index, rect: e.currentTarget.getBoundingClientRect() });
                  return;
                }
                onDone();
                item.onClick?.();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-right outline-none transition disabled:cursor-not-allowed disabled:opacity-40 ${
                item.danger ? "text-red-600 hover:bg-red-50 focus-visible:bg-red-50" : "hover:bg-slate-100 focus-visible:bg-slate-100"
              } ${sub?.index === index ? "bg-slate-100" : ""}`}
            >
              <span className="flex w-4 shrink-0 justify-center text-slate-400">{item.checked ? "✓" : item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.children && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              )}
            </button>
          ),
        )}
      </div>
      {sub && (() => {
        const parent = items[sub.index];
        return parent !== "separator" && parent.children ? (
          <MenuPanel key={sub.index} x={0} y={0} anchor={sub.rect} items={parent.children} onDone={onDone} />
        ) : null;
      })()}
    </>
  );
}

/** Small "⋯" button that opens the same menu as right-click, for touch screens and discoverability. */
export function MenuButton({ items, label = "گزینه‌ها", className = "" }: { items: () => MenuEntry[]; label?: string; className?: string }) {
  const open = useContextMenu();
  return (
    <button
      type="button"
      aria-label={label}
      className={`btn-ghost !p-1 ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        open({ clientX: r.right, clientY: r.bottom + 4 }, items());
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
      </svg>
    </button>
  );
}

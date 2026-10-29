// PaneLayout.tsx — the product / steps / proof columns as resizable, collapsible panes.
// The banking demo's draggable split, generalized: drag the edge between two panes to
// trade width (arrow keys work too), double-click it to reset, and put any pane away
// to a labelled rail that brings it back.
//
// Every pane but one has a defaultWidth; the one without takes whatever is left. The
// widths and which panes are collapsed persist in localStorage under storageKey, so a
// presenter's arrangement survives a reload. A collapsed pane stays mounted, so its
// state and scroll position are still there when it comes back.
//
// A pane's content places its own collapse control in its header. Give a phone frame
// a header too; a button floating over the pane would sit on the phone's bezel.
// .pane-stack stacks a header over content that fills the rest of the pane:
//
//   <PaneLayout storageKey="tacos:panes" panes={[
//     { id: "phone", title: "Customer app", defaultWidth: 380, minWidth: 260,
//       content: (
//         <div className="pane-stack">
//           <div className="card-head"><h2 className="heading">Customer app</h2><PaneCollapseButton /></div>
//           <PhoneFrame>…</PhoneFrame>
//         </div>
//       ) },
//     { id: "backstage", title: "Behind the scenes", defaultWidth: 420, minWidth: 260,
//       content: <BackstagePanel steps={steps} /> },
//     { id: "code", title: "Workflow code", minWidth: 320, content: <CodePanel /> },
//   ]} />
//
// The last open pane can't be collapsed, so the screen is never only rails.
// Styling is the .pane-* rules in css/temporal-components.css.

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { PaneContext, usePane } from "./usePane";

export interface PaneSpec {
  id: string;
  /** Names the pane on its collapsed rail, its collapse button and its resize handle. */
  title: string;
  /** Starting width in px. Leave it off exactly one pane, which takes the remaining space. */
  defaultWidth?: number;
  /** No drag or window size squeezes the pane below this. */
  minWidth: number;
  content: ReactNode;
}

export interface PaneLayoutProps {
  panes: PaneSpec[];
  /** localStorage key for the widths and collapsed panes. */
  storageKey: string;
  className?: string;
}

interface Arrangement {
  widths: Record<string, number>;
  collapsed: string[];
}

const KEY_STEP = 24;

export function PaneLayout({ panes, storageKey, className }: PaneLayoutProps) {
  const fillPanes = panes.filter((p) => p.defaultWidth === undefined);
  if (fillPanes.length !== 1) {
    throw new Error(`PaneLayout needs exactly one pane without a defaultWidth; got ${fillPanes.length}`);
  }

  const [arrangement, setArrangement] = useState(() => loadArrangement(storageKey, panes));
  const elements = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<string | null>(null);
  const dragStart = useRef({ width: 0, room: 0 });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(arrangement));
    } catch {
      // Persisting is a convenience only.
    }
  }, [storageKey, arrangement]);

  // Collapsing or expanding removes the focused control, so focus follows to what replaced it.
  useEffect(() => {
    if (pendingFocus.current === null) return;
    elements.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const isOpen = (pane: PaneSpec) => !arrangement.collapsed.includes(pane.id);
  const open = panes.filter(isOpen);
  // A collapsed fill pane hands the remaining space to the last open pane.
  const fill = isOpen(fillPanes[0]) ? fillPanes[0] : open[open.length - 1];

  const collapse = (id: string) => {
    pendingFocus.current = `rail:${id}`;
    setArrangement((a) => ({ ...a, collapsed: [...a.collapsed, id] }));
  };
  const expand = (id: string) => {
    pendingFocus.current = id;
    setArrangement((a) => ({ ...a, collapsed: a.collapsed.filter((c) => c !== id) }));
  };

  // A handle resizes the pane beside it that isn't the fill pane; the fill pane gives
  // or takes the difference, down to its own minimum.
  const beginDrag = (target: PaneSpec) => {
    const width = elements.current.get(target.id)?.getBoundingClientRect().width ?? 0;
    const fillWidth = elements.current.get(fill.id)?.getBoundingClientRect().width ?? 0;
    dragStart.current = { width, room: Math.max(0, fillWidth - fill.minWidth) };
  };
  const drag = (target: PaneSpec, delta: number) => {
    const { width, room } = dragStart.current;
    const next = Math.max(target.minWidth, Math.min(width + delta, width + room));
    setArrangement((a) => ({ ...a, widths: { ...a.widths, [target.id]: next } }));
  };
  const reset = (target: PaneSpec) => {
    setArrangement((a) => ({ ...a, widths: { ...a.widths, [target.id]: target.defaultWidth ?? 0 } }));
  };

  const children: ReactNode[] = [];
  let previousOpen: PaneSpec | null = null;
  for (const pane of panes) {
    if (!isOpen(pane)) {
      children.push(
        <button
          key={`rail:${pane.id}`}
          ref={register(elements, `rail:${pane.id}`)}
          type="button"
          className="pane-rail"
          onClick={() => expand(pane.id)}
          aria-label={`Show ${pane.title}`}
          title={`Show ${pane.title}`}
        >
          <ExpandIcon />
          <span>{pane.title}</span>
        </button>,
      );
    } else if (previousOpen) {
      const left = previousOpen;
      const target = left.id === fill.id ? pane : left;
      const direction = target === left ? 1 : -1;
      children.push(
        <PaneHandle
          key={`handle:${left.id}:${pane.id}`}
          label={`Resize ${target.title}`}
          value={arrangement.widths[target.id]}
          onDragStart={() => beginDrag(target)}
          onDrag={(deltaX) => drag(target, deltaX * direction)}
          onReset={() => reset(target)}
        />,
      );
    }

    const style =
      pane.id === fill.id
        ? { flex: "1 1 0", minWidth: pane.minWidth }
        : { flex: `0 1 ${arrangement.widths[pane.id]}px`, minWidth: pane.minWidth };
    children.push(
      <div
        key={pane.id}
        ref={register(elements, pane.id)}
        className="pane"
        style={style}
        hidden={!isOpen(pane)}
        tabIndex={-1}
        aria-label={pane.title}
        role="region"
      >
        <PaneContext.Provider
          value={{ title: pane.title, collapse: () => collapse(pane.id), canCollapse: open.length > 1 }}
        >
          {pane.content}
        </PaneContext.Provider>
      </div>,
    );
    if (isOpen(pane)) previousOpen = pane;
  }

  return <div className={className ? `pane-layout ${className}` : "pane-layout"}>{children}</div>;
}

/** Collapses the enclosing pane. Renders nothing outside a PaneLayout. */
export function PaneCollapseButton() {
  const pane = usePane();
  if (!pane) return null;
  return (
    <button
      type="button"
      className="pane-collapse"
      onClick={pane.collapse}
      disabled={!pane.canCollapse}
      aria-label={`Hide ${pane.title}`}
      title={pane.canCollapse ? `Hide ${pane.title}` : "The last open panel stays open"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12h7M7 9l3 3-3 3M21 12h-7M17 9l-3 3 3 3" />
      </svg>
    </button>
  );
}

interface PaneHandleProps {
  label: string;
  value: number | undefined;
  onDragStart: () => void;
  /** Called with the total horizontal drag distance (px) since the drag began. */
  onDrag: (deltaX: number) => void;
  onReset: () => void;
}

function PaneHandle({ label, value, onDragStart, onDrag, onReset }: PaneHandleProps) {
  const startX = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const endDrag = () => {
    startX.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startX.current = event.clientX;
    setDragging(true);
    onDragStart();
    // Keep the resize cursor and stop text selection while the pointer is over the panes.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    onDrag(event.clientX - startX.current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    onDragStart();
    onDrag(event.key === "ArrowLeft" ? -KEY_STEP : KEY_STEP);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value === undefined ? undefined : Math.round(value)}
      tabIndex={0}
      title={`${label}: drag to resize, double-click to reset`}
      className="pane-handle"
      data-dragging={dragging || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
    />
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 12H3M6 9l-3 3 3 3M14 12h7M18 9l3 3-3 3" />
    </svg>
  );
}

function register(elements: RefObject<Map<string, HTMLElement>>, key: string) {
  return (element: HTMLElement | null) => {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  };
}

function loadArrangement(storageKey: string, panes: PaneSpec[]): Arrangement {
  const widths: Record<string, number> = {};
  for (const pane of panes) {
    if (pane.defaultWidth !== undefined) widths[pane.id] = pane.defaultWidth;
  }

  let saved: unknown = null;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
  } catch {
    // Storage unavailable or corrupt: start from the defaults.
  }
  if (!saved || typeof saved !== "object") return { widths, collapsed: [] };

  const { widths: savedWidths, collapsed: savedCollapsed } = saved as Partial<Arrangement>;
  for (const id of Object.keys(widths)) {
    const width = savedWidths?.[id];
    if (typeof width === "number" && Number.isFinite(width)) widths[id] = width;
  }
  const collapsed = Array.isArray(savedCollapsed)
    ? panes.filter((p) => savedCollapsed.includes(p.id)).map((p) => p.id)
    : [];
  // Never restore a screen of nothing but rails.
  return { widths, collapsed: collapsed.length < panes.length ? collapsed : [] };
}

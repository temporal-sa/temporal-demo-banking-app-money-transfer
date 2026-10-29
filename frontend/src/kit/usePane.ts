// usePane.ts — what a pane's content can do to the PaneLayout pane it sits in.
// Separate from PaneLayout.tsx so that file exports only components (fast refresh).

import { createContext, useContext } from "react";

export interface PaneControls {
  title: string;
  collapse: () => void;
  /** False for the last open pane, which can't be collapsed. */
  canCollapse: boolean;
}

export const PaneContext = createContext<PaneControls | null>(null);

/** The enclosing pane's controls, or null outside a PaneLayout. */
export function usePane(): PaneControls | null {
  return useContext(PaneContext);
}

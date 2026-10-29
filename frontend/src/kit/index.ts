// Copy-in React components for a Tailwind-based demo UI. See README.md in this folder.
export { PhoneFrame, type PhoneFrameProps } from "./PhoneFrame";
export { StepList, type Step, type StepListProps } from "./StepList";
export { BackstagePanel, type BackstagePanelProps } from "./BackstagePanel";
export { PaneLayout, PaneCollapseButton, type PaneLayoutProps, type PaneSpec } from "./PaneLayout";
export { usePane, type PaneControls } from "./usePane";
export { useLiveEvents, type LiveEvents, type LiveEventNames, type StreamState } from "./useLiveEvents";
export {
  STATUSES,
  type Status,
  normalizeStatus,
  statusLabel,
  isTerminal,
  aliasStatus,
  summarizeStatus,
} from "./status";

// StepList.tsx — the Workflow's steps, as a live timeline.
// React form of assets/js/steps.js, sharing the .steps classes in
// css/temporal-components.css so both render the same thing.
//
//   <StepList steps={[
//     { key: "validate", label: "Validate transfer", status: "completed", time: "0.4s" },
//     { key: "deposit", label: "Deposit funds", status: "retrying", attempt: 3,
//       detail: "Receiving bank timed out", note: "Next attempt in 4s" },
//   ]} />

import { normalizeStatus, statusLabel, isTerminal, type Status } from "./status";

export interface Step {
  /** Stable identity, so React keeps the element across renders. */
  key: string;
  label: string;
  /** Anything normalizeStatus() understands. */
  status?: string;
  /** One quiet line under the label. */
  detail?: string;
  /** A line in the status colour: a countdown, an attempt count, a reason. */
  note?: string;
  /** Right-hand column. Use "\n" for a second line, for a span that is still open. */
  time?: string;
  attempt?: number;
  icon?: string;
}

/** Finished states get a mark in the dot. Held states stay empty and pulse instead. */
const MARKS: Partial<Record<Status, string>> = {
  completed: "\u2713",
  failed: "!",
  skipped: "\u2013",
};

export interface StepListProps {
  steps: Step[];
  /** Announce changes as they arrive. Off for a list that updates constantly. */
  live?: boolean;
  className?: string;
}

export function StepList({ steps, live = true, className }: StepListProps) {
  return (
    <ol
      className={className ? `steps ${className}` : "steps"}
      aria-live={live ? "polite" : undefined}
    >
      {steps.map((step) => {
        const status = normalizeStatus(step.status);
        // An attempt count belongs on a step that is still trying; once it has
        // succeeded the retries are part of its history, not its state.
        const attempts = step.attempt && step.attempt > 1 && !isTerminal(status)
          ? ` \u00b7 attempt ${step.attempt}`
          : "";

        return (
          <li
            key={step.key}
            className="step"
            data-status={status}
            // The colour never carries the state on its own (guide 04).
            aria-label={`${step.label}: ${statusLabel(status)}`}
          >
            <span className="dot">{step.icon ?? MARKS[status] ?? ""}</span>
            <span className="step-label">{step.label + attempts}</span>
            {step.time ? <span className="step-time">{step.time}</span> : null}
            {step.detail ? <span className="step-detail">{step.detail}</span> : null}
            {step.note ? <span className="step-note">{step.note}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

// BackstagePanel.tsx — what Temporal is doing behind the product screen.
// The middle column of the product / steps / proof layout (guide 11). The tacos and
// banking demos each carried a copy; this is the shared one, with the domain nouns
// taken out.
//
// It collapses, because an audience that only wants the product experience should be
// able to put it away, and a presenter should be able to bring it back mid-sentence.
// Inside a PaneLayout the layout owns that, and the panel's button collapses its pane.
//
//   <BackstagePanel
//     steps={steps}
//     workflowId={order.workflowId}
//     executionUrl={order.temporalUrl}
//     empty="Place an order to see what happens behind the scenes"
//   />

import { useState, type ReactNode } from "react";
import { PaneCollapseButton } from "./PaneLayout";
import { usePane } from "./usePane";
import { StepList, type Step } from "./StepList";
import { summarizeStatus, statusLabel } from "./status";

export interface BackstagePanelProps {
  steps: Step[];
  /** Shown when nothing has started yet. */
  empty?: string;
  title?: string;
  subtitle?: string;
  workflowId?: string | null;
  /** Link to this execution in the Temporal Web UI, when the server has supplied one. */
  executionUrl?: string | null;
  /** A state worth explaining in words: no Worker, a compensation, a person deciding. */
  banner?: ReactNode;
  /** Anything extra below the steps: variables, a decision card, raw events. */
  children?: ReactNode;
  defaultCollapsed?: boolean;
}

export function BackstagePanel({
  steps,
  empty = "Nothing running yet",
  title = "Behind the scenes",
  subtitle = "Temporal Workflow",
  workflowId,
  executionUrl,
  banner,
  children,
  defaultCollapsed = false,
}: BackstagePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const inPane = usePane() !== null;
  const overall = summarizeStatus(steps.map((s) => s.status));

  if (collapsed && !inPane) {
    return (
      <button
        type="button"
        className="backstage-reveal"
        onClick={() => setCollapsed(false)}
        title="Show what Temporal is doing"
      >
        {title}
      </button>
    );
  }

  return (
    <section className="card backstage" aria-label={title}>
      <div className="card-head">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2 className="heading">{title}</h2>
        </div>
        <div className="backstage-head-actions">
          {steps.length > 0 ? (
            <span className="status-badge" data-status={overall}>
              {statusLabel(overall)}
            </span>
          ) : null}
          {inPane ? (
            <PaneCollapseButton />
          ) : (
            <button
              type="button"
              className="backstage-collapse"
              onClick={() => setCollapsed(true)}
              aria-label="Hide what Temporal is doing"
            >
              {"\u2715"}
            </button>
          )}
        </div>
      </div>

      {banner}

      {steps.length === 0 ? (
        <p className="empty muted">{empty}</p>
      ) : (
        <StepList steps={steps} />
      )}

      {children}

      {workflowId ? (
        <div className="execution-foot">
          <span className="mono muted wfid" title={workflowId}>
            {workflowId}
          </span>
          {/* Inert rather than absent until the server supplies the URL, so the
              control doesn't appear and disappear mid-demo. */}
          <a
            className="button secondary green small"
            href={executionUrl || undefined}
            aria-disabled={executionUrl ? undefined : true}
            target={executionUrl ? "_blank" : undefined}
            rel="noopener"
            title={executionUrl ? "Open this execution in the Temporal UI" : "Available once the Workflow has started"}
          >
            Open execution &#8599;
          </a>
        </div>
      ) : null}
    </section>
  );
}

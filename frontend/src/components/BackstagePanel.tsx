import type { Settings, TransferEvent } from '../types'
import { PaneCollapseButton } from './PaneLayout'
import { WorkflowDiagram } from './WorkflowDiagram'

interface BackstagePanelProps {
  events: TransferEvent[]
  settings: Settings
  finalStatus: string | null
  temporalWorkflowUrl?: string | null
}

export function BackstagePanel({
  events,
  settings,
  finalStatus,
  temporalWorkflowUrl,
}: BackstagePanelProps) {
  return (
    <div className="w-full h-full bg-(--deepest-blue) flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--line)">
        <div>
          <h2 className="eyebrow">Behind the Scenes</h2>
          <p className="text-xs text-(--gray-300) mt-0.5">Temporal Workflow</p>
        </div>
        <PaneCollapseButton />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {events.length === 0 ? (
          <p className="empty">Initiate a transfer to see what happens behind the scenes</p>
        ) : (
          <WorkflowDiagram
            events={events}
            settings={settings}
            finalStatus={finalStatus}
            temporalWorkflowUrl={temporalWorkflowUrl}
          />
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-(--line) flex flex-wrap gap-3 text-xs font-(family-name:--mono) uppercase text-(--gray-300)">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-(--gray-500)" /> Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-(--ultraviolet) animate-pulse" /> Running
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-(--mint)" /> Done
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-(--mustard) animate-pulse" /> Retrying
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-(--coral)" /> Failed
        </span>
      </div>
    </div>
  )
}

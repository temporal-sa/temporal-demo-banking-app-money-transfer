// status.ts — the status vocabulary, typed, for a React or Svelte demo.
// Mirrors assets/js/status.js so a TypeScript UI and a plain-CSS one agree on what
// "waiting" looks like. See the vocabulary comment in css/temporal-components.css.

export const STATUSES = [
  "pending",
  "active",
  "waiting",
  "retrying",
  "completed",
  "failed",
  "skipped",
] as const;

export type Status = (typeof STATUSES)[number];

/** Whatever a backend calls it, mapped to the vocabulary. */
const ALIASES: Record<string, Status> = {
  pending: "pending", queued: "pending", scheduled: "pending", not_started: "pending",

  active: "active", running: "active", in_progress: "active", started: "active",
  executing: "active", continuedasnew: "active",

  waiting: "waiting", blocked: "waiting", awaiting_approval: "waiting",
  pending_approval: "waiting", awaiting_signal: "waiting", sleeping: "waiting", timer: "waiting",

  retrying: "retrying", retry: "retrying", backoff: "retrying",

  // "recovered" belongs with the successes: it succeeded. Say that it took several
  // attempts in the step's own text, not by colouring a success as a problem.
  completed: "completed", complete: "completed", done: "completed", success: "completed",
  succeeded: "completed", ok: "completed", recovered: "completed",

  failed: "failed", failure: "failed", error: "failed", timedout: "failed",
  timed_out: "failed", terminated: "failed",

  // A cancellation is deliberate, so it is not a failure.
  skipped: "skipped", cancelled: "skipped", canceled: "skipped", not_applicable: "skipped",
};

const LABELS: Record<Status, string> = {
  pending: "Pending",
  active: "Running",
  waiting: "Waiting",
  retrying: "Retrying",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
};

const TERMINAL: Partial<Record<Status, true>> = { completed: true, failed: true, skipped: true };

export function normalizeStatus(raw: string | null | undefined): Status {
  if (!raw) return "pending";
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ALIASES[key] ?? ALIASES[key.replace(/_/g, "")] ?? "pending";
}

export function statusLabel(raw: string | null | undefined): string {
  return LABELS[normalizeStatus(raw)];
}

export function isTerminal(raw: string | null | undefined): boolean {
  return !!TERMINAL[normalizeStatus(raw)];
}

/** Teach the vocabulary a name this demo's API uses. */
export function aliasStatus(map: Record<string, Status>): void {
  for (const [from, to] of Object.entries(map)) {
    ALIASES[from.trim().toLowerCase().replace(/[\s-]+/g, "_")] = to;
  }
}

/** The furthest-along state in a set of steps, for a summary badge. */
export function summarizeStatus(raw: Array<string | null | undefined>): Status {
  const states = raw.map(normalizeStatus);
  if (states.includes("failed")) return "failed";
  if (states.includes("retrying")) return "retrying";
  if (states.includes("waiting")) return "waiting";
  if (states.includes("active")) return "active";
  if (states.length && states.every((s) => TERMINAL[s])) return "completed";
  if (states.some((s) => TERMINAL[s])) return "active";
  return "pending";
}

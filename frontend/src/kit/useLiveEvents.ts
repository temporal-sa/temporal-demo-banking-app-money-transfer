// useLiveEvents.ts — a Workflow's progress, streamed to one browser.
// Generalized from the useSSE hooks in the tacos and banking demos, which were the
// same file with the nouns changed.
//
// Server-sent events suit a per-session stream the server already has: one Workflow's
// progress, pushed as it happens, with no polling and no extra Temporal Actions.
// For a screen that shows shared state to many viewers, poll one API that reads
// Temporal once and fans the result out (guide 15, guide 16).
//
//   const { events, status, reset } = useLiveEvents<TransferEvent>(
//     transferId ? `/api/transfers/${transferId}/events` : null,
//     { update: "transfer_update", done: "transfer_complete" },
//   );

import { useCallback, useEffect, useRef, useState } from "react";

export type StreamState = "idle" | "live" | "stale";

export interface LiveEventNames {
  /** Event name carrying an incremental update. */
  update: string;
  /** Event name carrying the final outcome; the server closes the stream after it. */
  done?: string;
}

export interface LiveEvents<T> {
  events: T[];
  /** Whatever the done event reported, once it has arrived. */
  finalStatus: string | null;
  /** Connection health, for a freshness indicator. */
  state: StreamState;
  reset: () => void;
}

const MAX_BACKOFF_MS = 8000;

export function useLiveEvents<T>(
  url: string | null,
  names: LiveEventNames,
  options?: { onDone?: (payload: unknown) => void },
): LiveEvents<T> {
  const [events, setEvents] = useState<T[]>([]);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const [state, setState] = useState<StreamState>("idle");
  const sourceRef = useRef<EventSource | null>(null);
  const onDone = options?.onDone;

  useEffect(() => {
    setEvents([]);
    setFinalStatus(null);
    setState("idle");

    if (!url) return;

    let closed = false;
    let failures = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      const source = new EventSource(url);
      sourceRef.current = source;

      source.onopen = () => {
        failures = 0;
        setState("live");
      };

      source.addEventListener(names.update, (event) => {
        setEvents((prev) => [...prev, parse<T>((event as MessageEvent).data)]);
        setState("live");
      });

      if (names.done) {
        source.addEventListener(names.done, (event) => {
          const payload = parse<{ final_status?: string; status?: string }>((event as MessageEvent).data);
          setFinalStatus(payload?.final_status ?? payload?.status ?? "completed");
          onDone?.(payload);
          // The work is finished, so the stream is too. Close it here rather than
          // letting EventSource reconnect to an endpoint with nothing left to send.
          closed = true;
          source.close();
        });
      }

      source.onerror = () => {
        source.close();
        if (closed) return;
        failures++;
        setState("stale");
        retry = setTimeout(connect, Math.min(2 ** failures * 1000, MAX_BACKOFF_MS));
      };
    };

    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [url, names.update, names.done, onDone]);

  const reset = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setEvents([]);
    setFinalStatus(null);
    setState("idle");
  }, []);

  return { events, finalStatus, state, reset };
}

function parse<T>(data: string): T {
  try {
    return JSON.parse(data) as T;
  } catch {
    // A server that sends a plain string is still saying something useful.
    return data as unknown as T;
  }
}

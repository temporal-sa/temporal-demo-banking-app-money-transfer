// live.js — keeping a demo screen live without lying about it.
// Five demos each wrote this loop. It polls on an interval, abandons a request that
// is overtaken by the next tick, stops while the tab is hidden, backs off when the
// server is unreachable, and reports freshness so a stalled source is never mistaken
// for a calm system (guide 04, Metric meaning and freshness).
//
//   <script src="assets/js/live.js"></script>
//   <script>
//     const feed = Live.poll({
//       url: "/api/view",
//       interval: 1000,
//       onData: render,
//       onState: Live.freshness(document.getElementById("freshness")),
//     });
//     // feed.refresh() after an action, feed.stop() on teardown.
//   </script>
//
// Before polling Temporal itself: read it once in the API and fan the result out to
// every viewer. A Query is a billable Action per call and fails while the Worker is
// down, so Describe, memo or Search Attributes usually serve a UI better
// (guide 15, Choose Temporal calls by what they wait on; guide 16, UI polling).
//
// No dependencies.
(function () {
  "use strict";

  const MAX_BACKOFF = 8;  // multiples of the base interval

  // Poll a URL, or any function returning a promise.
  //   url | load(signal)   what to fetch
  //   interval            milliseconds between the end of one tick and the next
  //   onData(data)        called with parsed JSON, or load()'s resolved value
  //   onState(state)      { state: "idle"|"live"|"stale", ageMs, failures }
  //   onError(err)        optional; the loop keeps going either way
  //   immediate           fetch at once (default true)
  //   pauseWhenHidden     skip ticks while the tab is hidden (default true)
  function poll(options) {
    const base = options.interval || 1000;
    const pauseWhenHidden = options.pauseWhenHidden !== false;
    const load = options.load || ((signal) => fetch(options.url, { signal }).then(readJson));

    let timer = null, controller = null, stopped = false;
    let failures = 0, lastOk = 0, inFlight = false;

    function report(state) {
      if (options.onState) options.onState({ state, ageMs: lastOk ? Date.now() - lastOk : 0, failures });
    }

    async function tick() {
      if (stopped || inFlight) return;
      if (pauseWhenHidden && document.hidden) return schedule();
      inFlight = true;
      // One request at a time: a tick that is still running when the next one starts
      // is already out of date, so drop it rather than render it late.
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await load(controller.signal);
        if (stopped) return;
        failures = 0;
        lastOk = Date.now();
        options.onData?.(data);
        report("live");
      } catch (err) {
        if (err.name === "AbortError" || stopped) return;
        failures++;
        options.onError?.(err);
        report("stale");
      } finally {
        inFlight = false;
        schedule();
      }
    }

    function schedule() {
      if (stopped) return;
      clearTimeout(timer);
      // Back off while the server is unreachable so a dead backend doesn't generate
      // a request per second for the rest of the demo.
      const factor = Math.min(2 ** failures, MAX_BACKOFF);
      timer = setTimeout(tick, base * (failures ? factor : 1));
    }

    function onVisible() {
      if (!document.hidden) tick();
    }
    document.addEventListener("visibilitychange", onVisible);

    report("idle");
    if (options.immediate !== false) tick(); else schedule();

    return {
      refresh: tick,
      get failures() { return failures; },
      stop() {
        stopped = true;
        clearTimeout(timer);
        controller?.abort();
        document.removeEventListener("visibilitychange", onVisible);
      },
    };
  }

  // Server-sent events, for a per-session stream the server already pushes: one
  // Workflow's progress, say. Reconnects with backoff; falls back to nothing if the
  // browser lacks EventSource. The tacos and banking demos use this shape.
  //
  //   const stream = Live.stream({
  //     url: `/api/orders/${id}/events`,
  //     events: { order_update: onUpdate, order_complete: onDone },
  //     onState: Live.freshness(el),
  //   });
  function stream(options) {
    let source = null, stopped = false, failures = 0, retry = null, lastOk = 0;

    function report(state) {
      options.onState?.({ state, ageMs: lastOk ? Date.now() - lastOk : 0, failures });
    }

    function connect() {
      if (stopped) return;
      source = new EventSource(options.url);

      source.onopen = () => { failures = 0; lastOk = Date.now(); report("live"); };

      for (const [name, handler] of Object.entries(options.events || {})) {
        source.addEventListener(name, (event) => {
          lastOk = Date.now();
          report("live");
          let payload = event.data;
          try { payload = JSON.parse(event.data); } catch { /* a plain string is fine */ }
          handler(payload, event);
        });
      }

      source.onerror = () => {
        // EventSource retries on its own, but not after the server closes the stream,
        // and not on a backoff we control. Take it over.
        source.close();
        if (stopped) return;
        failures++;
        report("stale");
        retry = setTimeout(connect, Math.min(2 ** failures, MAX_BACKOFF) * 1000);
      };
    }

    report("idle");
    if (typeof EventSource === "function") connect();
    else options.onError?.(new Error("EventSource is unavailable"));

    return {
      close() {
        stopped = true;
        clearTimeout(retry);
        source?.close();
      },
    };
  }

  // Bind an onState callback to a .freshness element, so the screen says how old what
  // it shows actually is. Pass serverAge() to add an age the API reports, for data
  // the API itself polls from somewhere slower.
  function freshness(el, serverAge) {
    if (!el) return () => {};
    const dot = el.querySelector(".dot") || el.appendChild(document.createElement("i"));
    dot.className = "dot";
    let text = el.querySelector(".freshness-text");
    if (!text) {
      text = document.createElement("span");
      text.className = "freshness-text";
      el.appendChild(text);
    }
    return ({ state, ageMs }) => {
      el.dataset.state = state;
      const age = Math.round((ageMs + (serverAge ? serverAge() * 1000 : 0)) / 1000);
      if (state === "idle") text.textContent = "Connecting";
      else if (state === "stale") text.textContent = `Reconnecting · ${age}s old`;
      else text.textContent = age <= 1 ? "Live" : `Live · ${age}s ago`;
    };
  }

  function readJson(response) {
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  window.Live = { poll, stream, freshness };
})();

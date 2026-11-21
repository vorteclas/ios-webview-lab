// Runs a site adapter and the client pipeline (from a private checkout at ./holmes, never
// committed here) inside the iOS shell. The pipeline's worker messages go to the app through
// the "holmes" handler, which calls the API. Reports counts only, never post content.
import { redditAdapter as adapter } from "../holmes/extension/src/adapters/reddit";
import { startPipeline } from "../holmes/extension/src/core/pipeline";
import { mergeSettings } from "../holmes/extension/src/shared/settings";

type Handler = { postMessage(body: string): Promise<string> | void };
const handlers = (window as any).webkit.messageHandlers as { lab: Handler; holmes: Handler };

// The test person: consent given, ads and politics hidden, nothing else asked.
const settings = mergeSettings({
  consent: true,
  categories: { ads: "hide", politics: "hide", nsfw: "off", spoilers: "off", ai_slop: "off" },
});

let sends = 0;
let statusSeen = "";
const pipeline = startPipeline({
  adapter,
  settings,
  active: true,
  send: async (msg) => {
    sends += 1;
    const reply = await handlers.holmes.postMessage(JSON.stringify(msg));
    return typeof reply === "string" ? JSON.parse(reply) : undefined;
  },
  setStatus: (s) => {
    statusSeen = s.status + (s.error ? ":" + s.error : "");
  },
});

function report(tag: string): void {
  const snap = pipeline.snapshot();
  const count = (f: (s: (typeof snap)[number]) => boolean) => snap.filter(f).length;
  const bars = Array.from(document.querySelectorAll<HTMLElement>("shreddit-post, shreddit-ad-post")).filter(
    (el) => (el.shadowRoot ?? el).querySelector("holmes-bar"),
  );
  const msg = {
    tag, mode: "holmes-pipeline", site: adapter.site, path: location.pathname, width: innerWidth,
    cells: adapter.findPosts(document).length,
    known: snap.length,
    done: count((s) => s.phase === "done"),
    rule: count((s) => s.phase === "rule"),
    failed: count((s) => s.phase === "failed"),
    pending: count((s) => s.phase === "queued" || s.phase === "inflight" || s.phase === "idle"),
    collapsed: count((s) => s.applied === "collapsed"),
    // A post in view when its verdict lands is badged, not collapsed (no layout jump).
    badged: count((s) => s.applied === "badged"),
    bars: bars.length,
    barHeights: Array.from(new Set(bars.map((el) => Math.round(el.getBoundingClientRect().height)))),
    sends, status: statusSeen,
    // Per cell in feed order: its feedindex and what Holmes shows (bar, note/badge, nothing).
    // Positions only, never content; on the synthetic feed they map to invented titles.
    byIndex: adapter.findPosts(document).map((el) => {
      const host = el.shadowRoot ?? el;
      const has = (tag: string) => Array.from(host.children).some((c) => c.localName === tag);
      return el.getAttribute("feedindex") + (has("holmes-bar") ? "bar" : has("holmes-note") ? "note" : "-");
    }).join(" "),
  };
  handlers.lab.postMessage(JSON.stringify(msg));
}

let n = 0;
const timer = setInterval(() => {
  n += 1;
  window.scrollBy(0, 900);
  if (n % 3 === 0) report("tick" + n);
  if (n >= 12) {
    clearInterval(timer);
    window.scrollTo(0, 0);
    setTimeout(() => report("final"), 2500);
  }
}, 1500);

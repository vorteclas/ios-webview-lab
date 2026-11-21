// Runs a site adapter and the client pipeline (from a private checkout at ./holmes, never
// committed here) inside the iOS shell. The pipeline's worker messages go to the app through
// the "holmes" handler, which calls the API. Reports counts only, never post content.
import { redditAdapter } from "../holmes/extension/src/adapters/reddit";
import { X_SELECTORS, xAdapter } from "../holmes/extension/src/adapters/x";
import { startPipeline } from "../holmes/extension/src/core/pipeline";
import type { SiteAdapter } from "../holmes/extension/src/core/types";
import { mergeSettings } from "../holmes/extension/src/shared/settings";

type Handler = { postMessage(body: string): Promise<string> | void };
const handlers = (window as any).webkit.messageHandlers as { lab: Handler; holmes: Handler };

// X logged out has no home or search timeline, only public profiles. For a test there, only
// findPosts is widened to the profile timeline (same cell shape, no data-index on the li);
// keys, extraction, collapse and the pipeline are the adapter's own.
// Logged out, the cell's data-href is absolute (https://<sub>.x.com/<handle>/status/<id>?...)
// where the adapter expects the logged-in relative path: the key reads the URL's path and
// applies the adapter's own pattern.
const X_PROFILE_POST = 'div[id^="urt:profile"] > ul > li > div[role="link"][data-href*="/status/"]';
const xProfile: SiteAdapter = {
  ...xAdapter,
  findPosts: (root) => Array.from((root as ParentNode).querySelectorAll<HTMLElement>(X_PROFILE_POST)),
  postKey: (el) => {
    let path = "";
    try {
      path = new URL(el.getAttribute("data-href") ?? "", location.href).pathname;
    } catch {
      return null;
    }
    const m = new RegExp(X_SELECTORS.statusHref).exec(path);
    return m ? `x:${m[1]}` : null;
  },
};
const onX = location.hostname === "x.com";
const adapter: SiteAdapter = onX ? (xAdapter.matches(new URL(location.href)) ? xAdapter : xProfile) : redditAdapter;

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
  const cells = adapter.findPosts(document);
  const shows = (el: HTMLElement) => {
    const host = el.shadowRoot ?? el;
    const has = (tag: string) => Array.from(host.children).some((c) => c.localName === tag);
    return has("holmes-bar") ? "bar" : has("holmes-note") ? "note" : "-";
  };
  const bars = cells.filter((el) => shows(el) === "bar");
  const msg = {
    tag, mode: "holmes-pipeline", site: adapter.site, path: location.pathname, width: innerWidth,
    adapterView: adapter === xProfile ? "x-profile" : "own",
    cells: cells.length,
    keys: cells.filter((el) => adapter.postKey(el) !== null).length,
    withText: cells.filter((el) => {
      const p = adapter.extract(el).payload;
      return Boolean(p.title || p.text);
    }).length,
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
    // Per cell in feed order: its position (feedindex on Reddit) and what Holmes shows (bar,
    // note/badge, nothing). Positions only, never content.
    byIndex: cells.map((el, i) => (el.getAttribute("feedindex") ?? String(i)) + shows(el)).join(" "),
  };
  handlers.lab.postMessage(JSON.stringify(msg));
}

// Lab only: lets the local check collapse and restore one cell by hand on a live page.
(window as any).__labAdapter = adapter;

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

// Bridge between the iOS shell and a site adapter. In CI the adapter comes from a private
// checkout at ./holmes (never committed here) and this file is bundled into Resources/inject.js.
// The decision to hide is a stand-in (ads by platform flag, posts by a test word); the real
// product asks a classifier. Reports counts only, never post content.
import { redditAdapter as adapter } from "../holmes/extension/src/adapters/reddit";

const TEST_WORD = /politic|election|vote|senate/i;
const seen = new WeakSet<HTMLElement>();
const decided = { ads: 0, politics: 0, kept: 0, noKey: 0, withTitle: 0 };
const collapsedEls: HTMLElement[] = [];

function pass(): void {
  for (const el of adapter.findPosts(document)) {
    if (seen.has(el)) continue;
    seen.add(el);
    const key = adapter.postKey(el);
    const x = adapter.extract(el);
    if (x.payload.title) decided.withTitle += 1;
    if (x.flags.promoted) {
      adapter.collapse(el, "ads", () => adapter.restore(el));
      decided.ads += 1;
      collapsedEls.push(el);
    } else if (key === null) {
      decided.noKey += 1;
    } else if (TEST_WORD.test(x.payload.title ?? "")) {
      adapter.collapse(el, "politics", () => adapter.restore(el));
      decided.politics += 1;
      collapsedEls.push(el);
    } else {
      decided.kept += 1;
    }
  }
}

function report(tag: string): void {
  pass();
  const posts = adapter.findPosts(document);
  const heights = collapsedEls.map((el) => Math.round(el.getBoundingClientRect().height));
  const msg = {
    tag, mode: "holmes-adapter", site: adapter.site, path: location.pathname, width: innerWidth,
    posts: posts.length,
    keys: posts.filter((el) => adapter.postKey(el) !== null).length,
    ...decided,
    collapsed: collapsedEls.length,
    stripHeights: Array.from(new Set(heights)),
  };
  (window as any).webkit.messageHandlers.lab.postMessage(JSON.stringify(msg));
}

new MutationObserver(pass).observe(document.documentElement, { childList: true, subtree: true });
let n = 0;
const timer = setInterval(() => {
  n += 1;
  window.scrollBy(0, 900);
  if (n % 3 === 0) report("tick" + n);
  if (n >= 12) {
    clearInterval(timer);
    window.scrollTo(0, 0);
    setTimeout(() => report("final"), 1500);
  }
}, 1500);

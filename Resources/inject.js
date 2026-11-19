// Generic probe, public on purpose. Finds Reddit feed cells, hides ads and posts whose title
// mentions a test word, checks they collapse, and reports counts only (never post content).
(function () {
  const SEL = 'shreddit-post[feedindex]:not([view-context="CommentsPage"]), ' +
    'shreddit-ad-post[feedindex]:not([view-context="CommentsPage"])';
  const HIDE_WORD = /politic|election|vote|senate/i;
  let n = 0;

  function hide(el) { el.style.display = "none"; el.dataset.labHidden = "1"; }

  function pass() {
    for (const p of document.querySelectorAll(SEL)) {
      if (p.dataset.labSeen) continue;
      p.dataset.labSeen = "1";
      const isAd = p.tagName.toLowerCase() === "shreddit-ad-post";
      const title = p.getAttribute("post-title") || "";
      if (isAd || HIDE_WORD.test(title)) hide(p);
    }
  }

  function report(tag) {
    pass();
    const posts = Array.from(document.querySelectorAll(SEL));
    const ads = posts.filter((p) => p.tagName.toLowerCase() === "shreddit-ad-post");
    const organic = posts.filter((p) => !ads.includes(p));
    const hidden = posts.filter((p) => p.dataset.labHidden);
    const collapsed = hidden.filter((p) => p.getBoundingClientRect().height === 0).length;
    const visibleOrganic = organic.filter((p) => !p.dataset.labHidden && p.getBoundingClientRect().height > 0).length;
    const idOk = organic.filter((p) => /^t3_[a-z0-9]+$/.test(p.id)).length;
    const msg = {
      tag, host: location.host, path: location.pathname, width: innerWidth,
      title: document.title.slice(0, 60),
      posts: posts.length, organic: organic.length, idOk, ads: ads.length,
      hidden: hidden.length, collapsed, visibleOrganic,
      commentsPostMatched: !!document.querySelector('shreddit-post[view-context="CommentsPage"][data-lab-seen]'),
    };
    if (posts.length === 0 && document.body) msg.head = document.body.innerText.slice(0, 160);
    window.webkit.messageHandlers.lab.postMessage(JSON.stringify(msg));
  }

  // React to cells added later (infinite scroll), as the extension does.
  new MutationObserver(pass).observe(document.documentElement, { childList: true, subtree: true });

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
})();

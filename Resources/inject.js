// Generic probe, public on purpose. Counts Reddit feed posts, hides ad posts, reports counts
// only (never post content). In CI this file can be replaced by a private bundle at build time.
(function () {
  const SEL = "shreddit-post[feedindex], shreddit-ad-post[feedindex]";
  let n = 0;
  function report(tag) {
    const posts = Array.from(document.querySelectorAll(SEL));
    const ads = posts.filter((p) => p.tagName.toLowerCase() === "shreddit-ad-post");
    ads.forEach((a) => { a.style.display = "none"; });
    const hidden = ads.filter((a) => a.getBoundingClientRect().height === 0).length;
    window.webkit.messageHandlers.lab.postMessage(JSON.stringify({
      tag, host: location.host, path: location.pathname, width: innerWidth,
      posts: posts.length, ads: ads.length, adsHidden: hidden,
    }));
  }
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

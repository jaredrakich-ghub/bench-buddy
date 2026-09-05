// Bench Buddy marketing site — vanilla JS, no build step.
// Two behaviours, per SPEC.md section 8: video autoplay wiring +
// visibility-gated playback, and the one reveal-on-scroll effect.

// ---------------------------------------------------------------------
// Video sources — the ONE place every clip's path lives. Swapping to a
// CDN later (per the handoff's own "before launch" checklist) means
// editing this object only; nothing in index.html or the rest of this
// file names a file path directly. Currently pointing at the real clips
// already in the repo (docs/Marketing Videos/) — a staging arrangement
// exactly like the reference build's own raw.githubusercontent.com URLs,
// just local. Encoded with encodeURI() at use so the spaces/apostrophes
// in these filenames are never a problem regardless of host.
// ---------------------------------------------------------------------
const VIDEO_SOURCES = {
  hero: "../docs/Marketing Videos/Scene 10 - Coach Dave - Celebrating the action.mp4",
  act1_01: "../docs/Marketing Videos/Coach Dave - Happy with Static paper plan lower quality.mp4",
  act1_02: "../docs/Marketing Videos/Scene 2 - Coach Dave - Child asking when they're going on.mp4",
  act1_03: "../docs/Marketing Videos/Scene 3 - Coach Dave - Child asking why he's been subbed. He just came on.mp4",
  act1_04: "../docs/Marketing Videos/Scene 5 - Coach Dave - Unexpected Event - Injury to player.mp4",
  act1_05: "../docs/Marketing Videos/Scene 4 - Coach Dave - Kid asking if they have been in goal - Dave looks uncertain.mp4",
  act1_06: "../docs/Marketing Videos/Scene 7 - Coach Dave - Asking the whole sideline of parents for help.mp4",
  act1_07: "../docs/Marketing Videos/Scene 8 - Coach Dave - Turning point - Looking for alternative to paper.mp4",
  turn: "../docs/Marketing Videos/Parent Emma - Coach Dave asks if Emma can cover subs.mp4",
  act2_01: "../docs/Marketing Videos/Parent Emma - Lily asks when she is going on.mp4",
  act2_02: "../docs/Marketing Videos/Parent Emma - Asks about his position.mp4",
  act2_03: "../docs/Marketing Videos/Parent Emma - Leo arrives late.mp4",
  act2_04: "../docs/Marketing Videos/Parent Emma - Jack going back on.mp4",
  act2_05: "../docs/Marketing Videos/Parent Emma - Coach Dave thanks Emma for running the subs.mp4",
  act2_close: "../docs/Marketing Videos/Parent Emma - Mother and Daughter after game - Lily asks if she enjoyed doing the subs.mp4",
  saturday: "../docs/Marketing Videos/Scene 11 - Coach Dave - Successful Sub.mp4",
};

// ---------------------------------------------------------------------
// Video autoplay + visibility-gated playback (spec section 8, and the
// README's "three things most likely to be got wrong" #1 and #2).
// ---------------------------------------------------------------------
function wireVideos() {
  const vids = Array.from(document.querySelectorAll("video[data-video]"));
  if (!vids.length) return;

  // Only play what's on screen — the whole point of this observer is
  // that sixteen 720p clips must not all download/play at once.
  const playIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const v = entry.target;
        if (entry.isIntersecting) v.play().catch(() => {});
        else if (!v.paused) v.pause();
      });
    },
    { rootMargin: "25% 0px 25% 0px", threshold: 0.01 }
  );

  vids.forEach((v) => {
    const key = v.dataset.video;
    const src = VIDEO_SOURCES[key];
    if (src) v.src = encodeURI(src);

    // Do not skip: bare `muted`/`loop` markup attributes are not enough on
    // every browser — set as DOM properties, or autoplay can be refused.
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.defaultMuted = true;

    // A broken video paints opaque over whatever sits behind it (the
    // section's own near-black-green video-well background, in this
    // design) — hide it on error so that background shows through instead
    // of a browser's broken-media chrome.
    const fail = () => { v.style.visibility = "hidden"; };
    const ok = () => { v.style.visibility = "visible"; };
    v.addEventListener("error", fail);
    v.addEventListener("loadeddata", ok);
    setTimeout(() => { if (v.error || v.readyState === 0) fail(); }, 4000);

    playIo.observe(v);
  });
}

// ---------------------------------------------------------------------
// Reveal motion (spec section 8) — one effect on the whole site: fade up
// 18px over 700ms, once per element, fully suppressed under
// prefers-reduced-motion. A 1200ms failsafe reveals anything the
// observer never got to, so the page never gets stuck blank.
// ---------------------------------------------------------------------
function scrollRootFor(node) {
  let n = node;
  while (n && n !== document.body) {
    const style = getComputedStyle(n);
    if (/(auto|scroll)/.test(style.overflowY) && n.scrollHeight > n.clientHeight + 8) return n;
    n = n.parentElement;
  }
  return null;
}

function reveal(node) {
  node.dataset.revealed = "1";
  node.style.opacity = "1";
  node.style.transform = "none";
}

function wireReveal() {
  const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!nodes.length) return;

  const wantsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!wantsMotion) return; // CSS's own reduced-motion rule already shows everything

  nodes.forEach((n) => {
    n.style.transition = "opacity .7s cubic-bezier(.22,.7,.25,1), transform .7s cubic-bezier(.22,.7,.25,1)";
    n.style.opacity = "0";
    n.style.transform = "translateY(18px)";
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        io.unobserve(entry.target);
      });
    },
    { root: scrollRootFor(nodes[0]), rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
  );
  nodes.forEach((n) => io.observe(n));

  // Keeps the page legible if the observer never fires (print, an odd
  // embed, a host-owned scroll container) — not a workaround, a backstop.
  setTimeout(() => {
    nodes.forEach((n) => { if (n.dataset.revealed !== "1") reveal(n); });
  }, 1200);
}

document.addEventListener("DOMContentLoaded", () => {
  wireVideos();
  wireReveal();
});

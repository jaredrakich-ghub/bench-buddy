// Bench Buddy marketing site — vanilla JS, no build step.
// Two behaviours, per SPEC.md section 8: video autoplay wiring +
// visibility-gated playback, and the one reveal-on-scroll effect.

// ---------------------------------------------------------------------
// Video sources — the ONE place every clip's path lives. Swapping to a
// CDN later (per the handoff's own "before launch" checklist) means
// editing this object only; nothing in index.html or the rest of this
// file names a file path directly. Currently pointing at the real clips,
// moved into marketing/assets/videos/ (not docs/Marketing Videos/, where
// they started out) — Firebase Hosting only serves what's inside its own
// `public` directory (marketing/, per firebase.json), so a path reaching
// outside it (../docs/...) 404s the instant this deploys for real, even
// though it resolved fine testing against a server rooted one level up at
// the whole repo. This is still a staging arrangement, exactly like the
// reference build's own raw.githubusercontent.com URLs, just local and
// actually reachable from where this site is hosted. Encoded with
// encodeURI() at use so the spaces/apostrophes in these filenames are
// never a problem regardless of host.
// ---------------------------------------------------------------------
// poster: a real first-ish frame extracted from each clip (ffmpeg, ~1s in —
// past any opening fade-from-black), served instantly while the clip itself
// is still fetching/decoding. Matters most for `hero`, which preloads
// eagerly and paints above the fold; for every lazy (preload="none") story
// clip it's what shows instead of a blank video box until it scrolls into
// view and IntersectionObserver starts it playing.
const VIDEO_SOURCES = {
  hero: { src: "assets/videos/Scene 10 - Coach Dave - Celebrating the action.mp4", poster: "assets/posters/hero.jpg" },
  act1_01: { src: "assets/videos/Coach Dave - Happy with Static paper plan lower quality.mp4", poster: "assets/posters/act1_01.jpg" },
  act1_02: { src: "assets/videos/Scene 2 - Coach Dave - Child asking when they're going on.mp4", poster: "assets/posters/act1_02.jpg" },
  act1_03: { src: "assets/videos/Scene 3 - Coach Dave - Child asking why he's been subbed. He just came on.mp4", poster: "assets/posters/act1_03.jpg" },
  act1_04: { src: "assets/videos/Scene 5 - Coach Dave - Unexpected Event - Injury to player.mp4", poster: "assets/posters/act1_04.jpg" },
  act1_05: { src: "assets/videos/Scene 4 - Coach Dave - Kid asking if they have been in goal - Dave looks uncertain.mp4", poster: "assets/posters/act1_05.jpg" },
  act1_06: { src: "assets/videos/Scene 7 - Coach Dave - Asking the whole sideline of parents for help.mp4", poster: "assets/posters/act1_06.jpg" },
  act1_07: { src: "assets/videos/Scene 8 - Coach Dave - Turning point - Looking for alternative to paper.mp4", poster: "assets/posters/act1_07.jpg" },
  turn: { src: "assets/videos/Parent Emma - Coach Dave asks if Emma can cover subs.mp4", poster: "assets/posters/turn.jpg" },
  act2_01: { src: "assets/videos/Parent Emma - Lily asks when she is going on.mp4", poster: "assets/posters/act2_01.jpg" },
  act2_02: { src: "assets/videos/Parent Emma - Asks about his position.mp4", poster: "assets/posters/act2_02.jpg" },
  act2_03: { src: "assets/videos/Parent Emma - Leo arrives late.mp4", poster: "assets/posters/act2_03.jpg" },
  act2_04: { src: "assets/videos/Parent Emma - Jack going back on.mp4", poster: "assets/posters/act2_04.jpg" },
  act2_05: { src: "assets/videos/Parent Emma - Coach Dave thanks Emma for running the subs.mp4", poster: "assets/posters/act2_05.jpg" },
  act2_close: { src: "assets/videos/Parent Emma - Mother and Daughter after game - Lily asks if she enjoyed doing the subs.mp4", poster: "assets/posters/act2_close.jpg" },
  saturday: { src: "assets/videos/Scene 11 - Coach Dave - Successful Sub.mp4", poster: "assets/posters/saturday.jpg" },
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
  const makePlayObserver = (root) => new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const v = entry.target;
        // NOT entry.isIntersecting: that's true the instant ANY sliver is
        // visible (even 1%), regardless of the threshold option below —
        // threshold only controls how often the callback fires, not what
        // isIntersecting means. For a carousel's "peek" slide (the next
        // one sitting ~15% visible at the track's edge) that meant it
        // still started playing, which is exactly the distracting
        // "two videos going at once" a real coach hit. Checking the
        // actual ratio against the intended cutoff is what makes a peek
        // NOT count as focused.
        const visible = root ? entry.intersectionRatio >= 0.6 : entry.isIntersecting;
        if (visible) v.play().catch(() => {});
        else if (!v.paused) v.pause();
      });
    },
    // Carousel clips (root set) use a tighter threshold scoped to the
    // track's own visible width, not the page viewport — otherwise every
    // slide in a horizontally-clipped-but-vertically-on-screen carousel
    // would register as "visible" at once and all seven/five clips would
    // play simultaneously side by side. Both 0 and 0.6 listed so the
    // callback reliably fires at both "just appeared" and "now focused"
    // (and the reverse) rather than only once near the far end.
    root
      ? { root, threshold: [0, 0.6] }
      : { rootMargin: "25% 0px 25% 0px", threshold: 0.01 }
  );
  const pageObserver = makePlayObserver(null);
  const trackObservers = new Map(); // carousel track element -> its own observer

  vids.forEach((v) => {
    const key = v.dataset.video;
    const entry = VIDEO_SOURCES[key];
    if (entry) {
      v.src = encodeURI(entry.src);
      // Plain markup `poster="…"` would work too, but this keeps every
      // path for a given clip (video AND its poster) in the one place
      // VIDEO_SOURCES already exists for — nothing in index.html names a
      // poster file directly, same rule as the video src itself.
      if (entry.poster) v.poster = encodeURI(entry.poster);
    }

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

    const track = v.closest(".bb-carousel__track");
    if (track) {
      if (!trackObservers.has(track)) trackObservers.set(track, makePlayObserver(track));
      trackObservers.get(track).observe(v);
    } else {
      pageObserver.observe(v);
    }
  });
}

// ---------------------------------------------------------------------
// Carousel navigation (Act one/two's moments) — native horizontal
// scroll-snap does the actual swiping/scrolling for free; this just adds
// the optional arrow/dot controls on top and keeps them in sync with
// wherever a visitor's own swipe has left the track scrolled to.
// ---------------------------------------------------------------------
function wireCarousels() {
  document.querySelectorAll(".bb-carousel").forEach((carousel) => {
    const track = carousel.querySelector(".bb-carousel__track");
    const slides = track ? Array.from(track.children) : [];
    const prevBtn = carousel.querySelector(".bb-carousel__arrow--prev");
    const nextBtn = carousel.querySelector(".bb-carousel__arrow--next");
    const dotsWrap = carousel.querySelector(".bb-carousel__dots");
    if (!track || slides.length === 0) return;

    // One dot per slide, built from the actual slide count rather than
    // hand-authored in markup — the two can never drift out of sync.
    const dots = slides.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "bb-carousel__dot";
      dot.setAttribute("aria-label", `Go to slide ${i + 1} of ${slides.length}`);
      dot.addEventListener("click", () => scrollToSlide(i));
      dotsWrap.appendChild(dot);
      return dot;
    });

    slides.forEach((s, i) => {
      s.setAttribute("role", "group");
      s.setAttribute("aria-roledescription", "slide");
      s.setAttribute("aria-label", `Slide ${i + 1} of ${slides.length}`);
    });

    let current = 0;
    const setCurrent = (i) => {
      current = i;
      dots.forEach((d, idx) => d.setAttribute("aria-current", String(idx === i)));
      if (prevBtn) prevBtn.disabled = i === 0;
      if (nextBtn) nextBtn.disabled = i === slides.length - 1;
    };

    function scrollToSlide(i) {
      slides[i].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }

    prevBtn?.addEventListener("click", () => scrollToSlide(Math.max(0, current - 1)));
    nextBtn?.addEventListener("click", () => scrollToSlide(Math.min(slides.length - 1, current + 1)));

    // Keeps the dots/arrows accurate when a visitor swipes or drags the
    // track directly, not just when they use the buttons above.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setCurrent(slides.indexOf(entry.target));
          }
        });
      },
      { root: track, threshold: [0.6] }
    );
    slides.forEach((s) => io.observe(s));

    setCurrent(0);
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
  wireCarousels();
  wireVideos();
  wireReveal();
});

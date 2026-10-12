// Bench Buddy home page: the journey player, the mobile menu and the club form. Vanilla JS, no build step.

(function () {
  "use strict";

  // Where the form is sent. Set once here.
  var FORM_ENDPOINT = "https://australia-southeast1-benchbuddycricket.cloudfunctions.net/clubInterest";

  var JOURNEYS = [
    { video: "assets/cricket/journey-1-scoring.mp4", poster: "assets/cricket/poster-1-scoring.webp" },
    { video: "assets/cricket/journey-2-parents.mp4", poster: "assets/cricket/poster-2-parents.webp" },
    { video: "assets/cricket/journey-3-coach-setup.mp4", poster: "assets/cricket/poster-3-coach-setup.webp" },
    { video: "assets/cricket/journey-4-changes.mp4", poster: "assets/cricket/poster-4-changes.webp" },
    { video: "assets/cricket/journey-5-admin-fixtures.mp4", poster: "assets/cricket/poster-5-admin-fixtures.webp" }
  ];

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ---- Mobile menu ------------------------------------------------------
  var menuButton = document.getElementById("cb-menu");
  var nav = document.getElementById("cb-nav");
  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
  }
  menuButton.addEventListener("click", function () { setMenu(menuButton.getAttribute("aria-expanded") !== "true"); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  // ---- Journeys ---------------------------------------------------------
  var section = document.getElementById("journeys");
  var video = document.getElementById("cb-video");
  var playButton = document.getElementById("cb-play");
  var items = Array.prototype.slice.call(document.querySelectorAll(".cb-journey"));
  var current = 0;
  var loaded = -1;     // index whose file is currently set on the video
  var visible = false; // is the section on screen

  video.muted = true;
  video.playsInline = true;

  function load(index) {
    if (loaded === index) return;
    loaded = index;
    video.poster = JOURNEYS[index].poster;
    video.src = JOURNEYS[index].video;
    video.preload = "auto";
  }

  function showPlayButton(show) { playButton.hidden = !show; }

  function play() {
    var p = video.play();
    if (p && p.then) p.then(function () { showPlayButton(false); }, function () { showPlayButton(true); });
    else showPlayButton(false);
  }

  function select(index, userChosen) {
    current = index;
    items.forEach(function (el, i) {
      var on = i === index;
      el.classList.toggle("is-active", on);
      if (on) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current");
    });
    load(index);
    video.currentTime = 0;
    if (reduceMotion.matches) {
      // Reduced motion: never start on its own. Show the poster with a play button.
      video.pause();
      showPlayButton(true);
    } else if (userChosen || visible) {
      play();
    }
  }

  items.forEach(function (el, i) {
    el.addEventListener("click", function () {
      // A tap on a journey is a request to watch it, even with reduced motion.
      select(i, true);
      if (reduceMotion.matches) play();
    });
  });

  playButton.addEventListener("click", function () { play(); });

  video.addEventListener("ended", function () {
    var next = (current + 1) % JOURNEYS.length;
    select(next, false);
  });

  // Only start (and keep playing) while the section is on screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) {
        load(current);
        if (reduceMotion.matches) showPlayButton(video.paused);
        else if (video.paused) play();
      } else {
        video.pause();
      }
    }, { threshold: 0.35 }).observe(section);
  } else {
    visible = true;
  }

  if (reduceMotion.matches) showPlayButton(true);
  reduceMotion.addEventListener && reduceMotion.addEventListener("change", function () {
    if (reduceMotion.matches) { video.pause(); showPlayButton(true); }
  });

  // ---- Club form --------------------------------------------------------
  var form = document.getElementById("cb-form");
  var thanks = document.getElementById("cb-thanks");
  var submit = document.getElementById("cb-submit");
  var emailInput = form.elements.email;
  var emailError = document.getElementById("cb-email-error");
  var sendError = document.getElementById("cb-send-error");
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  emailInput.addEventListener("input", function () {
    emailInput.removeAttribute("aria-invalid");
    emailError.hidden = true;
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    sendError.hidden = true;
    var email = emailInput.value.trim();
    if (!EMAIL.test(email)) {
      emailInput.setAttribute("aria-invalid", "true");
      emailError.hidden = false;
      emailInput.focus();
      return;
    }
    var teams = form.querySelector('input[name="teams"]:checked');
    var payload = {
      club: form.elements.club.value.trim(),
      role: form.elements.role.value.trim(),
      email: email,
      teams: teams ? teams.value : "",
      website: form.elements.website.value // a hidden trap field: people leave it empty
    };
    submit.disabled = true;
    submit.textContent = "Sending…";
    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (res) { if (!res.ok) throw new Error("bad status " + res.status); })
      .then(function () {
        form.hidden = true;
        thanks.hidden = false;
        thanks.focus();
      })
      .catch(function () {
        sendError.hidden = false;
        submit.disabled = false;
        submit.textContent = "Get your club started";
      });
  });
})();

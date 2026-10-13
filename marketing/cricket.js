// Bench Buddy home page: the mobile menu, the FAQ and the club form. Vanilla JS, no build step.

(function () {
  "use strict";

  // Where the form is sent. Set once here.
  var FORM_ENDPOINT = "https://australia-southeast1-benchbuddycricket.cloudfunctions.net/clubInterest";

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

  // ---- FAQ: one answer open at a time; tapping the open one closes it ----
  var faq = document.getElementById("cb-faq");
  if (faq) {
    faq.addEventListener("click", function (e) {
      var button = e.target.closest(".cb-faq__q");
      if (!button) return;
      var wasOpen = button.getAttribute("aria-expanded") === "true";
      Array.prototype.forEach.call(faq.querySelectorAll(".cb-faq__item"), function (item) {
        var q = item.querySelector(".cb-faq__q");
        var open = q === button && !wasOpen;
        q.setAttribute("aria-expanded", open ? "true" : "false");
        q.querySelector(".cb-faq__sign").textContent = open ? "−" : "+";
        item.querySelector(".cb-faq__a").hidden = !open;
        item.classList.toggle("is-open", open);
      });
    });
  }

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

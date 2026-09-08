# Build order — Match Link

Seven steps. Send one per request, in order. Each names the spec section to read first; you do not
need the rest of the README for that step.

Steps 1–2 are model and plumbing with no UI. Do not start step 3 until they are agreed.

---

## Step 1 — Data model and permissions (no UI)

Read: README > Overview, Two handover levels, Behaviour and rules.

Design and implement the model for a handover session:

- a match handover with: match id, handover level (`subs` | `full`), created-at, expiry, revoked-at;
- a claim record per holder: email, token, claimed-at, device binding, revoked-at;
- a permission check used by every write path, keyed on (session, capability). Capabilities:
  `make_sub`, `mark_injury`, `control_clock`.

Rules to encode:
- `control_clock` is **single-owner**. At the `subs` level the coach owns it and a clock write from
  the parent's session must be rejected server-side, not merely hidden in the UI.
- A parent session is scoped to one match: no squad editing, no season data, no other matches, no
  team settings.
- Expiry: at full time, or a hard cap of kickoff + 4 hours if full time is never recorded.
- Revocation takes effect immediately for the holder.

Give me the model and the capability table before code. Include the test for the rejected clock
write.

---

## Step 2 — Claim URL and magic-link exchange (no UI)

Read: README > Behaviour and rules > Link and token.

- One link per match. Regenerating invalidates the previous link and any claims against it.
- Shared URL is a **claim** URL. Opening it collects an email; that address is mailed a single-use
  token which binds to the device that opens it. A forwarded claim URL must fail once claimed.
- With "Ask for an email first" off, the shared URL grants access on open.
- The email address is used once, to send the link: not stored on any list, no account created.
- Coach push notification when a link is claimed.

---

## Step 3 — 2a · Match Link screen (coach)

Read: README > Screens > 2a. Render: `screens/01-coach-share.png`.

Build the coach-side screen: explainer card, link card with the two toggles, holder list, Share to
WhatsApp and Copy link.

Two things the frame does not draw, both specified in the README:
- the **handover-level control** (subs / full game) goes directly above the link card, as a
  two-option segmented row in the interval-chip style; the explainer card's title and body change
  with the selection;
- the holder list needs a **revoke** affordance per row.

Gate the whole screen behind Pro using the app's existing pattern.

---

## Step 4 — 2b · Claim screen (parent, web)

Read: README > Screens > 2b. Render: `screens/02-magic-link-email.png`.

This is a web page, not an app screen — no app chrome. Two states in one route: the email form, and
the confirmation sheet over it. Include "Send it again" and "Wrong address? Start over".

The match name stays visible behind the sheet.

---

## Step 5 — 2c · Parent match session, subs level

Read: README > Screens > 2c, then README > Layout budget.

Reuse the coach's match screen component. The differences are exactly:
- the header sub-line states the handover ("You're on subs for Dave today");
- a `#F1E9D2` handover banner under the header;
- sub and injury controls live; **no clock controls at all**;
- "Today's Minutes" opens read-only;
- nothing else on the screen is reachable — no cog, no squad, no season.

The frame is drawn with a Pause button, which belongs to the full-game level; at this level use the
sub action the app already shows at the 60-second mark and keep the bar's geometry identical.

Check after: pitch ≥ 193px tall, and `scrollWidth <= clientWidth` for both header rows and the
action bar.

---

## Step 6 — 2d · Parent match session, full-game level

Read: README > Screens > 2d.

Same session with `control_clock` granted:
- sub-line states why they have it ("Dave is off sick · you have the game");
- no handover banner (the sub-line carries it, and the banner does not fit alongside the bar);
- stopped state: digits `#7F7C50`, stat "Clock stopped", gold Resume button with a ▶ glyph;
- running state: digits `#1C3A2E`, stat "Next sub 4:28", cream Pause button with a ❙❙ glyph;
- half time goes in the existing settings/overflow, not the header.

---

## Step 7 — Two-people-one-game sync

Read: README > Behaviour and rules > Permissions during the match.

- Every sub event attributed and broadcast to both screens; last write wins per player.
- Revocation lands on the parent's screen mid-match as a "Dave has taken the game back" state.
- Offline: the parent's clock keeps running locally from the last known state and sub events queue;
  on reconnect the server's clock wins and queued subs replay in order.
- The parent gets the same 60-second sub warning the coach's app gives.
- Coach gets a push when a sub is made while the app is backgrounded.

Tests worth keeping: a rejected clock write at the subs level; a queued-then-replayed sub after
reconnect; a revoked holder's next write failing.

---

## Not in this handoff

The reference file also contains availability links (`1a`–`1d`), Pro lock patterns (`3a`, `3b`) and
the upgrade screen (`4a`, `4b`). Those are separate features with their own decisions still open.
Do not build them from this bundle.

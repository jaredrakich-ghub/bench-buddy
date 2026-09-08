# Build order — Availability link

Six steps. Send one per request, in order. Each names the spec section to read first; you do not
need the rest of the README for that step.

Step 0 is a decision, not code. Steps 1–2 are model and plumbing with no UI. Do not start step 3
until they are agreed.

---

## Step 0 — Pick the parent-side design

Read: README > The one open decision.

Tell me which of `1b` (whole squad visible, social nudge) or `1c` (one child at a time, private)
you are building, and why. Default to `1c` if the decision is not obvious from the codebase or any
club policy you find in the repo.

Do not build both. Everything from step 4 onwards depends on this answer.

---

## Step 1 — Data model (no UI)

Read: README > Overview, Behaviour and rules.

Design and implement the model for an availability request:

- a request per match: match id, token, created-at, closing time, reopened-at;
- an answer per child: status (`in` | `out` | `unanswered`), note chips (multi), free text,
  answered-at, changed-at;
- the derived summary the coach sees: counts by status, and the sentence in `1d`.

Rules to encode:
- one request per match, one token, shared with everyone;
- re-answering is always allowed and updates `changed-at`; last write wins per child;
- the closing time never refuses an answer — it only changes the page's framing;
- `Can keep goal` must be readable by the goalkeeper rotation the app already builds;
- `Arriving late` / `Leaving early` must surface at rotation-build time, not be buried.

Give me the model before code.

---

## Step 2 — Public link surface (no UI)

Read: README > Behaviour and rules > The link, and > Identity, and its limits.

- Resolve the token to a match and squad with no session and no account.
- Serve only child first names and shirt numbers. No phone numbers, emails, addresses, parent names
  or any other family data may reach this route — assert that in a test.
- Accept an answer per child; idempotent, re-answerable, rate-limited per token to something sane.
- Regenerating a link invalidates the old token; the coach can reopen or resend and keep the same
  URL otherwise.
- Handle an expired or revoked token with a page that explains it and names the team, not a 404.

---

## Step 3 — 1a · Who's playing? (coach)

Read: README > Screens > 1a. Render: `screens/01-coach-compose.png`.

Build the coach-side compose screen: match card, message preview, squad card with reply state,
Share to WhatsApp and Copy link.

Two things the frame does not draw, both specified in the README:
- the **closing time** needs to be editable — put a tap target on that line opening the app's
  existing date/time picker;
- the squad card's reply state must update ("Nobody has answered yet." → "6 of 9 answered").

The preview well is the message: what ships to WhatsApp must be byte-identical, with no share-sheet
template, footer or tracking suffix. Gate the screen behind Pro using the app's existing pattern.

---

## Step 4 — Parent page (web)

Read: README > Screens > 1b **or** 1c, whichever you chose in step 0. Renders:
`screens/02-parent-squad-list.png`, `screens/03-parent-single-child.png`.

A public web page, not an app screen — no app chrome. Answer buttons, the three note chips
(multi-select), the optional free-text field, and the sticky "Send to coach" footer.

Non-negotiable: works at 320px wide, at 200% text size, and by keyboard. Answer state is conveyed
in text as well as colour. The free-text field states that only the coach sees it.

Include the confirmation state after sending, and make it obvious the parent can come back and
change the answer.

---

## Step 5 — 1d · Answers land in Set up new game

Read: README > Screens > 1d, then README > Layout budget.

Fold the result into the existing setup screen:
- children who answered *in* are pre-selected in *Who's here*, with the count pill reflecting it;
- the summary line states the shape ("Six answered your link. Sarah is out, two haven't replied.");
- *out* and *waiting* children appear greyed at the end, **still tappable** — one tap to add a child
  who said no and then turned up;
- a child with a note carries a gold-bordered chip and a short tag ("late");
- notes are visible at rotation-build time, and `Can keep goal` feeds the goalkeeper rotation;
- the "Nudge the two waiting" row carries the `PRO` badge.

Nothing is locked. The link fills the screen in; the coach still decides.

---

## Step 6 — Reminders and the loop back

Read: README > Behaviour and rules.

- "Nudge the two waiting" sends a reminder to the non-repliers, Pro-gated.
- Coach push when answers arrive, batched — not one notification per parent.
- A parent changing their answer after the coach has built a rotation must surface as a change the
  coach can see, not a silent edit.

Tests worth keeping: no family data on the public route; a late answer still accepted after the
closing time; a re-answer updating rather than duplicating; an *out* child still selectable in `1d`.

---

## Not in this handoff

The reference file also contains Match Link (`2a`–`2d`), Pro lock patterns (`3a`, `3b`) and the
upgrade screen (`4a`, `4b`). Match Link has its own bundle. Do not build any of them from here.

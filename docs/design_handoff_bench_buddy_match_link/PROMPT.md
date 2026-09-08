# Paste this into Claude Code first

> Send this block, then work through `INSTRUCTIONS.md` — one request per step, in order.

Put this whole folder inside the bench-buddy repo as
`docs/design_handoff_bench_buddy_match_link/`. Then copy everything between the two `---` lines
below as your first message to Claude Code.

---

The folder `docs/design_handoff_bench_buddy_match_link/` contains a design handoff for a new
feature called **Match Link**.

- `README.md` — the spec: what the feature is, the flow, the behaviour rules, and every screen's
  exact colours, type and spacing.
- `INSTRUCTIONS.md` — the build order, one step per request.
- `Bench Buddy Features.dc.html` — the design reference. Open it in a browser. It is a prototype,
  NOT code to copy: do not import it, do not port its markup.
- `screens/*.png` — a render of each of the four screens.

What Match Link does: a coach hands the running of one match to another adult, usually a parent.
The coach builds the rotation plan as normal, sends a link to the one person who agreed to help, and
that person runs the subs on their own phone. There are two handover levels — subs only (coach keeps
the clock) or the full game including the clock (for when the coach cannot be there at all).

Read `README.md` in full before writing any code, then give me a plan for the data model and the
token/permission layer before you touch UI. I will send you one step at a time from
`INSTRUCTIONS.md`.

Rules for this work:
1. This is **not** a spectator feature. There is no browse-the-team view and no "follow the match"
   mode. If a piece of copy you are writing uses "follow", "watch" or "live for parents", stop and
   re-read README > Overview.
2. The parent uses the **same match screen the coach already sees**, with different controls live.
   Do not build a second match UI.
3. Only the four frames listed in README > About the design file are in scope. The other frames in
   the reference (availability links, Pro locks, upgrade screen) are separate features — do not
   build them.
4. Match Link is a **Pro** feature. Gate it the way the app already gates Pro; do not invent a new
   paywall pattern.
5. Add new tokens to the existing style module **alongside** current values. Never find-and-replace
   a shared hex value.
6. Existing tests encode current behaviour and should keep passing. If a change alters copy a test
   asserts on, update that test deliberately and tell me.
7. One step per request. Show me each one before moving on, and give me a plan before code on
   anything larger than a single component.

Wait for my first step before writing anything.

---

## Where the real work is

**The token and permission layer, not the screens.** Three screens are restyles of things that
exist; the parent's session is new ground:

- a claim URL that trades an email for a single-use, device-bound token;
- a session scoped to **one match** — no squad, no season, no other games, no settings;
- **two permission levels** over the same screen, where the clock is single-owner and the subs are
  not;
- revocation that lands on the parent's screen mid-match;
- offline behaviour: the parent's clock keeps running locally, sub events queue, the server's clock
  wins on reconnect.

Give that its own request, before any UI work. Ask for the data model first.

## Two-people-one-game is the risk

Everything else is recoverable; a game where the coach and the parent disagree about who is on the
pitch is not. Settle it in the model:

- every sub event is attributed and broadcast to both screens;
- last write wins per player;
- the clock has exactly one owner, and the non-owner cannot write it at all — not "should not",
  cannot.

Worth a test: with a parent at the subs level, a clock write from the parent's session must be
rejected server-side even if the client sends one.

## The screens have a height budget

The match frame is 380×844 and the pitch card is the only flexible element, so every pixel added
above or below it comes out of the pitch and clips the bottom row of players. This bit the design
four times during review — see README > Layout budget for the four specific rows that are already
full. After any change to the header or the action bar, check the pitch still renders at least
193px tall.

## Why change requests go wrong, and how to phrase them

Claude Code cannot see your screen. Anchor every request to a file and a name from the spec.

Weaker: "the parent screen should look like the coach's"
Stronger: "Reuse the match screen component for the parent session. Per README > 2c, the only
differences are: header sub-line text, the `#F1E9D2` handover banner, and which controls are live.
See README > Screens > 2c."

Weaker: "make the link more secure"
Stronger: "Per README > Behaviour and rules > Link and token: the shared URL is a claim URL. On
open it collects an email and mails that address a single-use token which binds to the device. A
forwarded claim URL must fail once claimed."

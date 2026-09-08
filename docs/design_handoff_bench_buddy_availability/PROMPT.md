# Paste this into Claude Code first

> Send this block, then work through `INSTRUCTIONS.md` — one request per step, in order.

Put this whole folder inside the bench-buddy repo as
`docs/design_handoff_bench_buddy_availability/`. Then copy everything between the two `---` lines
below as your first message to Claude Code.

---

The folder `docs/design_handoff_bench_buddy_availability/` contains a design handoff for a new
feature called **Availability link**.

- `README.md` — the spec: what the feature is, the flow, the behaviour rules, and every screen's
  exact colours, type and spacing.
- `INSTRUCTIONS.md` — the build order, one step per request.
- `Bench Buddy Features.dc.html` — the design reference. Open it in a browser. It is a prototype,
  NOT code to copy: do not import it, do not port its markup.
- `screens/*.png` — a render of each of the four screens.

What Availability link does: a coach asks a whole team who is playing, using one link posted into
the existing WhatsApp group. Parents tap the link, answer for their own child, and can add a note
("arriving late", "can keep goal"). On Saturday morning the coach opens Set up new game and
*Who's here* is already filled in, with the notes attached.

Read `README.md` in full before writing any code. **Start by telling me which parent-side design
you are building** — `README.md > The one open decision` describes two alternatives, `1b` and `1c`.
Then give me a plan for the data model and the public link surface before you touch UI. I will send
you one step at a time from `INSTRUCTIONS.md`.

Rules for this work:

1. **One link per match**, shared with the whole group — never one link per child. If your design
   has the coach copying a link per family, it is wrong.
2. There is **no login and no account** on the parent side. Anyone with the link can answer. That is
   deliberate; do not add authentication to "fix" it. See README > Identity, and its limits.
3. The parent pages are **public web pages on unknown devices**. They must work at 320px wide, at
   200% text size, and by keyboard. They must expose nothing about a family beyond child first names
   and shirt numbers.
4. Answers **fill in** Set up new game; they never lock it. Every child stays tappable, including
   the ones who said no.
5. Availability links are a **Pro** feature. Gate them the way the app already gates Pro; do not
   invent a new paywall pattern.
6. Add new tokens to the existing style module **alongside** current values. Never find-and-replace
   a shared hex value.
7. Existing tests encode current behaviour and should keep passing. If a change alters copy a test
   asserts on, update that test deliberately and tell me.
8. One step per request. Show me each one before moving on, and give me a plan before code on
   anything larger than a single component.

Wait for my first step before writing anything.

---

## Where the real work is

**The public link surface, not the coach's screen.** `1a` and `1d` are additions to screens that
exist; the parent page is a new, unauthenticated, publicly-reachable surface with its own rules:

- one token per match, no session, no account, answers keyed to a child;
- re-answering allowed indefinitely, with a changed-at time the coach can see;
- last write wins when two parents of one child both answer;
- closing time changes the page's framing but never refuses an answer;
- nothing about a family exposed beyond first name and shirt number.

Give that its own request, before any UI work. Ask for the data model first.

## The decision to settle before step 3

`1b` (whole squad visible) versus `1c` (one child at a time) is a real product choice with a
privacy cost on one side and a reply-rate cost on the other. README > The one open decision lays
out both. Make the call explicitly and tell me which you built — do not build both.

## The screens have a height budget

The frames are 380×844 with a sticky 64px footer button on the parent pages, and the content column
between header and footer is the only flexible element. Every pixel added above or below it comes
out of that column. `1c`'s answer buttons had to come down from 84px to 68px, and `1d` fits its
chips, nudge row, stat trio and fairness line with nothing spare. After any change, confirm the
footer button is fully inside the frame.

## Why change requests go wrong, and how to phrase them

Claude Code cannot see your screen. Anchor every request to a file and a name from the spec.

Weaker: "the message should look better in WhatsApp"
Stronger: "Per README > Screens > 1a: the preview well IS the message. What is shared must be
byte-identical to what the coach sees — no share-sheet template, no footer, no tracking suffix."

Weaker: "handle people who reply late"
Stronger: "Per README > Behaviour and rules > The link: after the closing time the page keeps
accepting answers and only changes its framing. Never refuse a late answer."

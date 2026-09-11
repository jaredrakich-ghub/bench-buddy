// MatchView.jsx's own styles — the live match screen: pitch/shirts,
// bench, injuries, header/timer/action bar, cog menu, tap-to-act popovers.
// Moved out of the old monolithic styles.js as-is.
import { tokens, colors, paperTexture } from "./tokens.js";

export const matchViewStyles = {
  // header/headerInner/headerLogoGroup/logoMark/logoMarkImg/headerTitle/
  // teamSwitcherTrigger/seasonBtn/headerBtnGroup (below) all removed —
  // this was the pre-match/first-time-setup screen's own app-level
  // header, the one screen never touched by the match-day redesign: a
  // leftover dark-green gradient bar with tiny caps text sitting right
  // above SquadSettingsForm's own already-redesigned cream/gold content.
  // Real-use feedback caught the seam ("a lot of the old UI appearing").
  // Replaced in SubRotationPlanner.jsx with MatchView's own header shape
  // (mdHeader/mdCogBtn) instead of a bespoke design, so the two read as
  // the same screen family.
  //
  // teamRow/teamRowMeta stay — SeasonSummaryModal's game-history list
  // reuses them. teamList/teamRowBtn/teamRowBtnActive were TeamSwitcher-
  // exclusive; removed alongside it (superseded by TeamAccountScreen.jsx
  // and its own mdTeamAcct* styles).
  teamRow: { display: "flex", alignItems: "center", gap: 6 },
  teamRowMeta: { fontWeight: 600, fontSize: 11, color: "#7C8983" },
  // addRow was TeamSwitcher-exclusive; removed alongside it.
  input: { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid " + colors.border, fontSize: 14 },
  primaryBtn: {
    display: "flex", alignItems: "center", gap: 6, justifyContent: "center", padding: "10px 16px", borderRadius: 10,
    border: "none", background: colors.grass, color: colors.chalk, fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  iconBtn: {
    border: "none", background: colors.border, borderRadius: 8, padding: 8, cursor: "pointer", color: colors.ink,
    display: "flex", alignItems: "center", justifyContent: "center", minWidth: 40, minHeight: 40,
  },

  subTitle: { fontSize: 15, fontWeight: 700, color: colors.ink, margin: 0 },
  subTitleRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 10, flexWrap: "wrap" },
  countBadge: { fontSize: 11, fontWeight: 700, color: colors.field, background: "#E9F5EE", padding: "2px 8px", borderRadius: 999 },

  // Kept for the match-complete banner only now (see matchCompleteBanner
  // below) — the running timer's own countdown/warning UI was replaced by
  // the match-day redesign's action bar (see the tokens/mdXxx styles
  // further down).
  matchCompleteBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: colors.field, color: "#fff",
    fontWeight: 700, fontSize: 13, padding: "10px 12px", borderRadius: 10, marginBottom: 8,
  },
  confirmBtn: {
    flex: "0 0 auto", background: "rgba(255,255,255,0.9)", color: colors.ink, border: "none", borderRadius: 8,
    padding: "7px 11px", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  },
  // Conversion nudge (MatchView.jsx, isMatchComplete && isAnonymous) — its
  // own row below matchCompleteBanner, deliberately not sharing that
  // banner's own pre-redesign colour tokens (colors.field/colors.ink
  // above) — this uses the current tokens.color.* system instead.
  mdEndOfGameNudge: {
    display: "flex", alignItems: "center", gap: 10, background: tokens.color.mint, borderRadius: 14,
    padding: "10px 12px", marginBottom: 8,
  },
  mdEndOfGameNudgeText: {
    flex: 1, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13, color: tokens.color.deepGreen, lineHeight: 1.35,
  },
  mdEndOfGameNudgeBtn: {
    flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, background: tokens.color.pitchGreen,
    color: tokens.color.creamPaper, border: "none", borderRadius: 12, padding: "9px 13px",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
    boxShadow: tokens.shadow.solid(3, tokens.color.greenShadow),
  },
  intervalTabsWrap: { position: "relative", marginBottom: 8 },
  // Once a game has enough intervals to overflow a phone-width screen, this
  // row scrolls horizontally. Two things make that read as an intentional
  // "swipe for more" affordance instead of a broken/clipped layout:
  //   - maskImage fades the row's own trailing pixels (including any
  //     partially-cut tab text) to transparent, rather than layering a
  //     translucent color wash on top — a wash alone still leaves crisp dark
  //     text on white visibly legible even at high opacity. Standard +
  //     -webkit- prefixed for iOS Safari, which has long-standing solid
  //     support for this.
  //   - scrollSnapType makes the row always settle with a full tab flush at
  //     the left edge after a swipe, rather than resting mid-tab.
  intervalTabs: {
    display: "flex", gap: 6, overflowX: "auto", paddingRight: 16, paddingBottom: 2, scrollSnapType: "x mandatory",
    WebkitMaskImage: "linear-gradient(to right, black calc(100% - 40px), transparent 100%)",
    maskImage: "linear-gradient(to right, black calc(100% - 40px), transparent 100%)",
  },
  // Reverted back to the pre-redesign bordered-card look on real-device
  // feedback ("I prefer your styling previously on the interval buttons")
  // — the match-day redesign had switched these to borderless pills
  // (tokens.color.creamDeep/deepGreen), but that didn't hold up in
  // practice. Border kept as separate longhand properties (not the border
  // shorthand) specifically so intervalTabBreakStart below can override
  // just borderLeftColor/borderLeftWidth without React's "removing a style
  // property during rerender" warning — breakBoundaries can toggle a given
  // tab in or out of that style across renders (settings change, browsing
  // a different game), which is exactly the case that bites.
  intervalTab: {
    flex: "0 0 auto", padding: "9px 12px", borderRadius: 8,
    borderWidth: 1, borderStyle: "solid", borderColor: colors.border,
    background: colors.cardBg, fontSize: 12, fontWeight: 700, cursor: "pointer", color: colors.ink,
    scrollSnapAlign: "start",
  },
  intervalTabActive: { background: colors.grass, color: colors.chalk, borderColor: colors.grass },
  // Purely visual grouping for a half-time/third-time/quarter-time break
  // (see computeBreakBoundaries, rotation.js) — extra gap plus a colored
  // left edge reads as "a new section starts here".
  intervalTabBreakStart: { marginLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.field },

  // ---- Match-day redesign (Direction A) — pitch, shirts, bench, action
  // bar. See design_handoff_bench_buddy_match_day/README.md and the
  // `tokens` export above. Header styles for this same screen live further
  // down (mdHeader onward), grouped with the action bar rather than here,
  // since they were added later — token names throughout are prefixed
  // `md` to keep them unambiguous next to the unprefixed styles other,
  // not-yet-redesigned screens still use.
  pitchInner: {
    position: "relative", width: "100%", background: tokens.color.pitchGreen, borderRadius: tokens.radius.card,
    backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 34px, rgba(0,0,0,.05) 34px 68px)",
    marginBottom: tokens.spacing.rhythm, overflow: "hidden",
  },
  formationToken: {
    position: "absolute", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 3, width: 76,
  },
  mdShirtBtn: { border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "flex" },
  mdShirtBtnSwapTarget: { filter: "drop-shadow(0 0 0 3px rgba(255,255,255,.85))" },
  // Swap-animation gold hold marker (Backlog: motion for committed
  // swaps) — a separate decorative ring drawn outside the shirt/chip
  // artwork, never touching either one's own border/background/shadow.
  // Concentric with the shirt's own disc; see MatchView.jsx's beginSwap
  // for exactly when/how long these render. mdSwapGoldRingBench's
  // borderRadius intentionally reuses mdBenchChip's own pill shape.
  mdSwapGoldRingPitch: {
    position: "absolute", top: "50%", left: "50%", width: 62, height: 62,
    transform: "translate(-50%, -50%)", borderRadius: "50%",
    border: "3.5px solid #F5B93B", boxShadow: "0 0 0 5px rgba(245,185,59,.22)",
    pointerEvents: "none",
  },
  mdSwapGoldRingBench: {
    position: "absolute", inset: -5, borderRadius: tokens.radius.chip,
    border: "3px solid #F5B93B", boxShadow: "0 0 0 4px rgba(245,185,59,.2)",
    pointerEvents: "none",
  },
  // The on-pitch shirt's own "GK" tag (bottom-left overlay) was removed
  // by explicit request — the yellow shirt fill is already a clear
  // enough goalkeeper indicator on its own, and the badge was sitting
  // awkwardly over the shirt. mdGkTagInline (below) is unrelated and
  // stays — it's a standalone chip label in the final60 sheet's swap
  // rows, not an overlay on a shirt.
  mdGkTagInline: {
    background: tokens.color.deepGreen, color: tokens.color.yellow, fontFamily: tokens.font.body, fontWeight: 800,
    fontSize: 12, padding: "1px 6px", borderRadius: tokens.radius.chip,
  },
  // Bumped from 12px on real-device feedback ("the badges and names are
  // too small") — goes with computeTokenSize's own bump (formation.js).
  mdShirtPlayerName: { color: "#fff", fontFamily: tokens.font.body, fontSize: 14, fontWeight: 800, textAlign: "center" },
  // Everyone leaving the pitch next interval, regardless of whether it's a
  // regular sub or a keeper stepping down. Same 18px circle as nextOnBadge
  // (real-device feedback: the two should read as the same size/shape,
  // just red vs green) — was a slightly larger pill before.
  mdOutgoingBadge: {
    position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%",
    background: tokens.color.alertRed, display: "flex", alignItems: "center", justifyContent: "center",
    pointerEvents: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },
  // Becoming-keeper and staying-on-as-outfield aren't covered by the
  // handoff's own badge spec — kept as the small circle badges the app
  // already had, just recolored to the new palette (gold for keeper, green
  // for "arriving/staying outfield") and moved to the opposite corner from
  // mdOutgoingBadge so a token showing both never has them collide.
  nextOnBadge: {
    position: "absolute", left: -6, top: -6, width: 18, height: 18, borderRadius: "50%",
    background: tokens.color.pitchGreen, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    pointerEvents: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },
  nextKeeperBadge: {
    position: "absolute", left: -6, top: -6, width: 18, height: 18, borderRadius: "50%",
    background: tokens.color.yellow, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, lineHeight: 1, pointerEvents: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },
  // display:flex/alignItems (not the old stacked block) so BENCH sits
  // inline with the chip row instead of on its own line above it — real-
  // device feedback wanting to reclaim that line's height for the pitch/
  // action-bar below. alignItems:"flex-start" (not "center") so the label
  // stays pinned to the first line if the chip row ever wraps to a second.
  mdBenchStrip: {
    background: tokens.color.creamDeep, borderRadius: tokens.radius.benchStrip, padding: "12px 14px",
    marginBottom: tokens.spacing.rhythm, display: "flex", alignItems: "flex-start", gap: 10,
  },
  mdBenchLabel: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 15, color: tokens.color.mutedText,
    flexShrink: 0, paddingTop: 5, // roughly centers the label on the chip row's own first line
  },
  // Block 8, part D — available players first, then a divider, then
  // anyone injured (replaces the old separate "Injured" sub-label + second
  // row — mdBenchSubLabel, now dead — the pink-tinted chip and cross badge
  // already read as "injured" without a text label).
  //
  // Two rows only once there are enough chips to actually need it — see
  // MatchView.jsx's own benchChipCount switch between this and
  // mdBenchChipRowCompact below. Real-use feedback: plain flex-wrap packed
  // row 1 greedily and only spilled the remainder to row 2 — on a narrow
  // phone with a few longer names that could leave 3 bench players stacked
  // as three separate single-chip rows even though two would clearly fit
  // side by side. Grid with 2 explicit row tracks and column auto-flow
  // fixes that: it fills column-by-column (up to 2 chips per column)
  // instead of row-by-row, so it actively packs toward 2 rows rather than
  // leaving the split up to whatever happened to fit on row 1 first.
  // overflowX:auto is the escape valve for a bench too big to fit 2 rows'
  // worth of columns on screen — scrolls rather than ever clipping or
  // shrinking a chip.
  mdBenchChipRow: {
    display: "grid", gridTemplateRows: "repeat(2, auto)", gridAutoFlow: "column",
    // justifyItems:"start" — a grid cell's own width matches its column's
    // widest occupant (e.g. a short name sharing a column with a much
    // longer one); without this a shorter chip stretches to fill that
    // width, leaving dead space baked inside its own pill shape. Left-
    // aligning instead keeps every pill its own natural size, so any
    // leftover width reads as ordinary gutter space between columns.
    alignItems: "stretch", justifyItems: "start", columnGap: 8, rowGap: 8, flex: 1, minWidth: 0, overflowX: "auto",
  },
  // The grid above always reserves 2 full row-tracks worth of height even
  // for just one or two chips (grid-auto-flow:column fills straight down
  // a column before starting a new one, so 2 chips land one above the
  // other instead of side by side) — fine once there's a real 2-row's
  // worth of content, wasted space when there isn't. A plain single-line
  // flex row stays exactly as compact as the common small-bench case
  // always was; it only ever needs its own wrap as a last-resort safety
  // net, not as the normal way of finding a second row.
  mdBenchChipRowCompact: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  // gridRow spans both row tracks (plus the row-gap between them) so this
  // reads as one continuous vertical rule regardless of which column the
  // auto-placement lands it in — alignItems:"stretch" above is what lets
  // it actually fill that full height instead of centering at a fixed one.
  mdBenchDivider: { width: 2, gridRow: "1 / span 2", borderRadius: 1, background: "#DCD2B6", margin: "0 2px" },
  mdBenchChip: {
    display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: tokens.radius.chip,
    padding: "4px 12px 4px 4px", border: "none", cursor: "pointer", font: "inherit",
  },
  mdBenchChipSwapTarget: { boxShadow: "0 0 0 2px " + tokens.color.pitchGreen },
  mdBenchChipNumber: {
    width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 14, flexShrink: 0,
    background: tokens.color.pitchGreen, color: "#fff",
  },
  // A bench player's number disc flips to gold specifically when they're
  // who's actually coming on as keeper — matches the on-pitch keeper's
  // gold shirt, so "this player is going in goal" reads the same color
  // wherever they're shown. Not a blanket "keeper-eligible" indicator —
  // see MatchView.jsx's renderBenchToken for why that reading was
  // misleading (most players default to eligible, so almost every chip
  // read gold regardless of what was actually about to happen).
  mdBenchChipNumberGk: { background: tokens.color.yellow, color: tokens.color.deepGreen },
  // whiteSpace:nowrap — a chip's own name must never wrap internally onto
  // a second line (it has no overflow/ellipsis protection to fall back on
  // if it did); a grid column's width is driven by its widest cell, so a
  // long name just makes its own column wider rather than ever needing to.
  mdBenchChipName: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 16, color: tokens.color.deepGreen, whiteSpace: "nowrap",
  },
  mdBenchChipUpArrow: { color: tokens.color.pitchGreen, display: "flex", alignItems: "center" },
  mdBenchEmpty: { color: tokens.color.mutedText, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13 },

  // ---- Injured bench chip (A2h-Injured) + the back-from-injury popover
  // (A2i-Back-from-injury). The chip is its own distinct look (not just a
  // recolored mdBenchChip) — a tinted pink pill with a cross badge, "the
  // same read as an injury flag on a football-game card" per the handoff.
  mdInjuredChip: {
    display: "flex", alignItems: "center", gap: 6, background: tokens.color.injuryTint,
    border: `2px solid ${tokens.color.injuryBorder}`, borderRadius: tokens.radius.chip,
    padding: "3px 12px 3px 4px", cursor: "pointer", font: "inherit", position: "relative",
  },
  mdInjuredChipNumber: {
    width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 14, flexShrink: 0,
    background: tokens.color.injuryRed, color: "#fff",
  },
  mdInjuredChipName: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 16, color: tokens.color.injuryText, whiteSpace: "nowrap",
  },
  mdInjuredCrossBadge: {
    position: "absolute", top: -7, right: -5, width: 20, height: 20, borderRadius: "50%",
    background: tokens.color.injuryRed, border: `2px solid ${tokens.color.creamPaper}`,
    display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
  },
  // Block 8, part C — the injury sheet (A2i-Back-from-injury) uses the
  // exact same mdSheet/mdSheetInjury/mdSheetGrabHandle shell as the
  // player-tap sheet above, in place of its own former anchored-popover
  // shell (mdBackPopover, now folded into mdSheet).
  mdBackPopoverHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 2 },
  mdBackPopoverCrossBadge: {
    width: 38, height: 38, borderRadius: "50%", background: tokens.color.injuryRed, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  mdBackPopoverName: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 23, color: tokens.color.deepGreen },
  mdBackPopoverMeta: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12.5, color: tokens.color.mutedText },
  mdBackPopoverBtnRow: { display: "flex", gap: 10 },
  mdBackPopoverBtnPrimary: {
    flex: 1.3, height: 60, borderRadius: 22, border: "none", background: tokens.color.pitchGreen,
    color: tokens.color.creamPaper, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20,
    boxShadow: tokens.shadow.solid(4, tokens.color.greenShadow), cursor: "pointer",
  },
  mdBackPopoverBtnSecondary: {
    flex: 1, height: 60, borderRadius: 22, border: "none", background: tokens.color.creamDeep,
    color: tokens.color.actionBar, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20, cursor: "pointer",
  },
  // Persistent inline note (not the fixed action sheet below) — shown
  // while browsing a past interval, which stays true the whole time a
  // coach is reviewing it, not just for a moment after a tap.
  swapBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: colors.field,
    color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, marginBottom: 10,
  },
  swapCancelBtn: {
    background: "rgba(255,255,255,0.9)", color: colors.ink, border: "none", borderRadius: 8,
    padding: "5px 10px", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  },
  // Fixed to the bottom of the screen — not anchored to whichever token
  // was tapped or wherever the coach happens to be scrolled — so tapping a
  // forward at the top of the pitch or a bench player at the bottom always
  // gets a response in the exact same thumb-reachable spot. Holds the
  // action menu, the "pick a swap target" hint, and the post-swap
  // confirmation toast — only ever one of the three at a time, one shared
  // container so they don't jump around independently.
  actionSheet: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
    background: colors.cardBg, borderRadius: "16px 16px 0 0", boxShadow: "0 -6px 24px rgba(0,0,0,0.3)",
    padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
    maxWidth: 640, margin: "0 auto",
  },
  actionSheetSwapRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    fontSize: 13, fontWeight: 700, color: colors.ink,
  },
  // Auto-dismisses itself after a couple of seconds (see the timeout in
  // MatchView) rather than needing its own Cancel/dismiss action — it's
  // confirming something that already happened, not asking for a decision.
  actionSheetConfirm: { fontSize: 13, fontWeight: 700, color: colors.field, textAlign: "center", padding: "4px 0" },
  // Same slot/weight as actionSheetConfirm, danger-red instead of
  // field-green — a swap the coach tried to make that performSwap would
  // silently decline (see findFieldSwapKeeperBlock, rotation.js), explained
  // instead of just doing nothing.
  actionSheetBlocked: { fontSize: 13, fontWeight: 700, color: colors.danger, textAlign: "center", padding: "4px 0" },

  // ---- Match-day redesign (Direction A) — header + action bar. See the
  // `tokens` export above and the pitch/shirt/bench styles further up.
  // Block 8, part A: inset card, not edge-to-edge/squared-off-at-the-top.
  // `main` (SubRotationPlanner.jsx) already provides the 16px horizontal
  // gutter and ~12px top gap this sits in — the only real change here is
  // rounding all four corners instead of just the bottom two.
  // Bottom padding (20 -> 12) and marginBottom (12 -> 8) both trimmed on
  // real-device feedback ("take a bit of padding from the top yellow
  // section, below the timer") — reclaiming header height to help the
  // action bar/timer actually fit on screen. Top/side padding (18/20)
  // untouched — that's the crest/name/cog row's own breathing room, not
  // what was reported as excess.
  mdHeader: { background: tokens.color.headerYellow, padding: "18px 20px 12px", borderRadius: 28, marginBottom: 8 },
  mdHeaderTopRow: { display: "flex", alignItems: "center", gap: 10 },
  // Backlog #9: real-use feedback that the team name wasn't obviously a
  // team name — a small "TEAM" eyebrow above it now, on both places this
  // crest+name pairing appears (MatchView's own header and
  // SquadSettingsForm's first-team-setup header, which already share
  // mdHeader/mdCrestOuter/mdTeamName). Two independent alignment anchors,
  // confirmed across several rounds of real-use feedback: the label sits
  // a deliberate few px below the crest's own top (not flush with it —
  // real-use feedback that flush-top read as the label and name not
  // looking connected to each other), AND the name's own centre lines up
  // with the crest's centre. Chaining the label above the name (bottom:
  // 100% + a margin) could only ever satisfy one of those at a time — the
  // gap between them would silently steal from whichever wasn't pinned.
  // So each is now independently absolutely-positioned against this
  // wrapper instead, and the wrapper itself is given the crest's own
  // height (62 — must stay in sync with mdCrestOuter's) so that when the
  // row's usual alignItems:center centres this wrapper exactly like it
  // centres the crest, "top" on the label and "top:50%" on the name are
  // both measured from the crest's own top, for real, regardless of
  // exactly how tall either line of text renders.
  mdTeamNameStack: { flex: 1, minWidth: 0, position: "relative", height: 62 },
  mdTeamNameLabel: {
    // 4px, not 0 — see the comment above: sitting exactly flush with the
    // crest's top read as disconnected from the name below it. Splits the
    // "3-6px" the real-use feedback asked for.
    position: "absolute", top: 4, left: 0,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11, color: tokens.color.mutedText,
    textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap",
    // lineHeight:1, not the font's own default (~1.3) — shrinks the
    // label's own box from the bottom, independent of its top offset
    // above, so this and the top:4 tweak don't fight each other.
    lineHeight: 1,
  },
  mdTeamName: {
    position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 21, color: tokens.color.deepGreen,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  // README > A2-Match-actionbar > Header: "Cog button top right: 54x54
  // white disc inside a matching 4px solid #2E7D53 ring, so it balances
  // the crest on the left" — confirmed by the handoff's own "What
  // changed" annotation: "The cog matches the crest — same circle, same
  // 4px green ring — so the two things in the header read as a pair."
  // Supersedes an interim deepGreen-filled version from earlier
  // real-device feedback ("shouldn't look like Reset") — the README was
  // updated after that and this is the current spec, confirmed explicitly.
  mdCogBtn: {
    width: 54, height: 54, borderRadius: tokens.radius.chip, border: `4px solid ${tokens.color.pitchGreen}`,
    background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    flexShrink: 0,
  },
  // Just the clock digits + caption now — the Start/Pause/Resume control
  // moved back down to the action bar (README > A2-Match-actionbar >
  // Action bar: "single clock button" on the same row as the countdown,
  // not up here). An earlier round of real-device feedback had put it
  // here instead; the README was updated after that and this reverts to
  // the current spec, confirmed explicitly.
  // "of 45 min" sits beside the timer now, not stacked underneath it
  // (align-items:flex-end + the caption's own padding-bottom, straight
  // from the reference HTML) — frees up header height for a taller pitch
  // below, per real-device feedback.
  mdTimerRow: { marginTop: 14, display: "flex", alignItems: "flex-end", gap: 14 },
  // README: "Timer: Baloo 2 800 66px #1C3A2E".
  mdTimerDisplay: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 66, lineHeight: 0.95, color: tokens.color.deepGreen,
    fontVariantNumeric: "tabular-nums",
  },
  // Paused greys the timer out — same digits, no longer counting, reads at
  // a glance as "not live right now" even before spotting the chip beside it.
  mdTimerDisplayPaused: { color: "rgba(28,58,46,.45)" },
  mdTimerCaption: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.goldText, whiteSpace: "nowrap",
    paddingBottom: 10,
  },
  // Shared shell for all four action-bar states (pre-kickoff, running,
  // paused, and the final-60 sheet reuses these same status/button styles
  // too) — only the label text and which buttons render change per state.
  //
  // Block 8, part B — a real bug fix, not a redesign for its own sake: the
  // bar used to be position:fixed, pinned to the viewport regardless of
  // scroll, on the theory that "always reachable" mattered more than
  // "never overlaps content". In practice that meant a long bench/squad
  // list could scroll content *underneath* it — the fixed bar doesn't
  // reserve real document space, it just floats on top, and `main`'s own
  // paddingBottom guess at how much space to reserve for it could
  // mismatch the bar's actual rendered height. Normal flow, as the last
  // child of the screen, makes that physically impossible: the bar takes
  // up real space, so nothing can ever render underneath it. `main` no
  // longer needs (or has) a special bottom-padding reservation for this.
  //
  // Still an outer/inner split (not because of positioning anymore — a
  // plain single div would do that job now — but so every action-bar call
  // site keeps the same two-level JSX shape it already had, minimizing
  // the diff). Outer now only carries the margin/gutter; inner carries
  // the visible card.
  //
  // Vertical margin only — no horizontal margin. Both places this renders
  // (`main` and mdFullScreenTakeoverInner) already provide their own 16px
  // horizontal inset; adding another 16px here doubled it, real-device
  // feedback: the bar visibly narrower than the header/pitch/bench cards
  // above it, not flush with their left/right edges the way every other
  // section is.
  mdActionBarOuter: { margin: "12px 0 16px" },
  mdActionBar: {
    background: tokens.color.actionBar, borderRadius: tokens.radius.card, padding: 16,
    boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
  },
  // For a bar whose content stacks in a column instead of one row (Squad
  // change's own action bar) — tighter vertical padding than the
  // inline-row bars get. The match screen's pre-kickoff bar used to be
  // stacked too (its own status line + full-width button) but now uses
  // the same inline-row shape as every other match-screen bar state.
  mdActionBarStacked: { padding: "14px 16px" },
  mdActionBarStatusRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  // 26px per the reference HTML's own markup for this element (the
  // README's prose text says 24px elsewhere — the HTML is more reliable
  // here since it's the actual rendered value, not a transcription).
  // whiteSpace:nowrap — this app's actual font metrics (Baloo 2/Nunito via
  // Google Fonts, not whatever the static mockup rendered with) made
  // "Next sub 3:30" wrap onto two lines at this width. Trimmed to 22px
  // (from the reference markup's 26px) after "Resume" (the longest clock
  // button label) measured as pushing the button ~26px past the right
  // edge of the viewport at 26px/full padding — verified by measuring
  // actual rendered rects, not by eye.
  mdActionBarCountdown: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 22, color: tokens.color.yellow, whiteSpace: "nowrap",
  },
  // The compact single-row layout (label left, action button right) used
  // by the pre-kickoff/paused/running bars — the final-60 sheet keeps its
  // own taller stacked layout (mdActionBarStatusRow + row list + buttons)
  // since it's a full takeover with real detail to show, not this bar.
  mdActionBarInlineRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  mdActionBarBtnRow: { display: "flex", gap: 10 },
  mdActionBarBtnPause: {
    flex: 1, height: 66, borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.creamDeep,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
  },
  mdActionBarBtnPrimary: {
    flex: 1.25, height: 66, borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.yellow,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18,
    boxShadow: tokens.shadow.solid(5, tokens.color.yellowShadow),
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
  },
  // README > A2-Match-actionbar > Action bar: the single clock button
  // (Start/Pause/Resume), content-width and pinned to the row's right
  // edge next to the countdown — not a full-width row of its own.
  // "Sub done" is confirmed removed from this bar entirely (explicit
  // call): the final-60 sheet is now the only place a sub gets confirmed.
  // Height 66 straight from the reference HTML's own markup for this
  // control; padding/font-size trimmed from that markup's 30px/24px —
  // this app's actual font rendering (Baloo 2/Nunito via Google Fonts,
  // not whatever the static mockup used) pushed "Resume" (the longest of
  // the three labels) past the right edge of a 375px screen at those
  // values, verified by measuring the actual rendered rects.
  mdActionBarClockBtn: {
    height: 66, padding: "0 14px", borderRadius: tokens.radius.buttonMd, border: "none",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", flexShrink: 0,
    whiteSpace: "nowrap",
  },
  // "yellow #F5B93B ... when it starts or resumes the clock" (Start/Resume).
  mdActionBarClockBtnPrimary: {
    background: tokens.color.yellow, color: tokens.color.deepGreen, boxShadow: tokens.shadow.solid(5, tokens.color.yellowShadow),
  },
  // "cream #F1E9D2 with dark text ... while running" (Pause).
  mdActionBarClockBtnRunning: { background: tokens.color.creamDeep, color: tokens.color.deepGreen },
  // Shared full-screen dim layer — final60, the cog menu, and the
  // player-tap popover are mutually exclusive (never shown two at once,
  // see MatchView.jsx), so one scrim style serves all three rather than
  // three near-identical copies.
  mdScrim: { position: "fixed", inset: 0, background: tokens.color.scrim, zIndex: 45 },
  // The four icon-tile tints reused across both popovers (README: "yellow
  // #FBE3A6, green #CBE8D6, neutral #F1E9D2, red #FAD3C8") — background
  // only, text/icon color is set per row alongside whichever of these is used.
  mdTintYellow: { background: tokens.color.headerYellow },
  mdTintGreen: { background: tokens.color.mint },
  mdTintNeutral: { background: tokens.color.creamDeep },
  mdTintRed: { background: tokens.color.injuryTint2 },

  // ---- A2d-Menu-trimmed (#10a) — the cog menu cut from 8 rows in 3
  // labelled groups down to 4 rows with no group headers, "holding only
  // what a coach touches during a game." Same mdPopover shell (reused
  // directly — its own radius/border already match this spec exactly);
  // new row shapes here rather than resizing the existing mdPopoverRow
  // family, since that's also used by TeamAccountScreen's Records/Account
  // rows, which this trim doesn't touch.
  mdCogMenuRow: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#fff",
    borderRadius: tokens.radius.rowMd, border: "none", padding: "9px 13px 9px 9px", marginBottom: 7,
    boxShadow: "0 3px 0 rgba(28,58,46,.10)", cursor: "pointer", textAlign: "left", font: "inherit",
  },
  mdCogMenuIconTile: {
    width: 34, height: 34, borderRadius: tokens.radius.iconTile, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  // The Team & account row's icon is the team's own crest thumbnail, not a
  // tinted glyph tile — same ring treatment as every other crest chip in
  // the app, just sized for this row.
  mdCogMenuCrestIcon: {
    width: 34, height: 34, borderRadius: tokens.radius.iconTile, flexShrink: 0, overflow: "hidden",
    border: `2px solid ${tokens.color.pitchGreen}`, background: "#fff",
  },
  mdCogMenuCrestImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)" },
  // white-space: nowrap on both the label and the value chip — "so all
  // four rows come out the same height (53px); the chip copy is long
  // enough to wrap otherwise."
  mdCogMenuLabel: {
    flex: 1, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, color: tokens.color.deepGreen,
    whiteSpace: "nowrap",
  },
  // Conversion nudge, anonymous-only — the Team & account cog-menu row
  // only, not the cog button itself (real-use feedback: that one read as
  // "too much before we've shown value"; this one only ever shows once a
  // coach has deliberately opened the menu). Yellow, not literally red —
  // red is reserved for injury everywhere else in this app
  // (SquadSettingsForm.jsx has the same rule stated explicitly).
  mdCogMenuRowDot: {
    display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: tokens.color.yellow,
    marginLeft: 6, verticalAlign: "middle",
  },
  mdCogMenuValue: {
    background: tokens.color.creamDeep, color: tokens.color.mutedText, fontFamily: tokens.font.body, fontWeight: 800,
    fontSize: 13, borderRadius: tokens.radius.chip, padding: "4px 10px", whiteSpace: "nowrap",
  },
  mdCogMenuChevron: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 22, color: tokens.color.chevron, paddingLeft: 2 },
  mdCogMenuDivider: { height: 3, background: tokens.color.rule, margin: "3px 6px", borderRadius: 2 },

  // ---- Block 8, part C — A2g-Player-tap and A2i-Back-from-injury replace
  // their old anchored popover (grew from the tapped element's own
  // getBoundingClientRect, mdPopover/mdBackPopover) with a bottom sheet.
  // Real bug fix, not a redesign for its own sake: a popover anchored to
  // the tap point can get pushed off the bottom of the screen entirely
  // when the tapped player is low on the pitch, with no flip-and-clamp
  // logic to catch it. A sheet pinned to the bottom of the viewport
  // cannot go out of view no matter where the tap happened, and sits
  // exactly in thumb reach besides.
  //
  // position:fixed, not the reference file's literal position:absolute —
  // its canvas is a fixed-height (844px), non-scrolling phone frame,
  // where absolute-relative-to-that-frame and fixed-relative-to-the-
  // viewport are the same thing. Our real page actually scrolls (a long
  // squad list, say), so only `fixed` genuinely delivers "cannot go out
  // of view" here — `absolute` would inherit the exact class of bug this
  // is fixing, just relative to the page instead of the tap point.
  mdSheet: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 47,
    maxWidth: 640, margin: "0 auto",
    background: tokens.color.creamPaper, backgroundImage: paperTexture,
    borderRadius: "32px 32px 0 0", boxShadow: "0 -16px 44px rgba(20,32,28,.42)",
    padding: "12px 16px 22px", display: "flex", flexDirection: "column", gap: 10,
    maxHeight: "calc(100vh - 24px)", overflowY: "auto",
  },
  mdSheetPlayerTap: { borderTop: `3px solid ${tokens.color.yellow}` },
  mdSheetInjury: { borderTop: `3px solid ${tokens.color.injuryRed}` },
  // Header row: the tapped player's own shirt glyph (small, fixed 40x38 —
  // not the pitch token's own dynamic tokenSize) with their number, name,
  // and how long they've played so far pushed to the right.
  mdPlayerPopoverHeader: { display: "flex", alignItems: "center", gap: 11, padding: "0 4px 2px" },
  mdPlayerPopoverHeaderShirt: { position: "relative", width: 40, height: 38, flexShrink: 0 },
  mdPlayerPopoverName: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.deepGreen, lineHeight: 1.1,
  },
  mdPlayerPopoverMeta: {
    marginLeft: "auto", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: tokens.color.mutedText,
    whiteSpace: "nowrap",
  },
  // No marginBottom on the row itself now — mdSheet's own flex gap (10)
  // spaces the rows instead, now that they're direct children of the
  // sheet rather than a separate popover body.
  mdPlayerPopoverRow: {
    display: "flex", alignItems: "center", gap: 13, width: "100%", background: "#fff", borderRadius: 22,
    border: "none", padding: "13px 15px", boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)"),
    cursor: "pointer", textAlign: "left", font: "inherit",
  },
  mdPlayerPopoverIconTile: {
    width: 44, height: 44, borderRadius: 16, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 21,
  },
  mdPlayerPopoverRowLabel: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20, color: tokens.color.deepGreen, lineHeight: 1.1,
  },
  mdPlayerPopoverRowConsequence: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12.5, color: tokens.color.mutedText },

  // "Lit above the scrim" treatment for whichever control opened the
  // popover it's paired with — position:relative lets zIndex actually
  // apply (a static-position element ignores it). 46: above mdScrim's 45
  // (so it isn't dimmed along with everything else behind the scrim), but
  // below mdSheet/mdPopover's 47 — real-device feedback found an injured
  // chip's own lit highlight rendering *in front of* the bottom sheet it
  // had just opened, when it should stay tucked behind it; the sheet's
  // own header already identifies who it's about, so the lit chip only
  // needs to clear the scrim, never the sheet itself.
  mdOriginLit: { position: "relative", zIndex: 46 },
  mdCogBtnLit: { background: tokens.color.headerYellow, border: `3px solid ${tokens.color.yellow}` },
  // Same idea for a tapped shirt/chip, but via drop-shadow/box-shadow
  // rather than a border — a shirt's own SVG stroke is part of the icon
  // itself, not something a wrapping border would sit flush against.
  mdShirtBtnLit: { filter: `drop-shadow(0 0 0 3px ${tokens.color.yellow})` },
  mdBenchChipLit: { boxShadow: `0 0 0 3px ${tokens.color.yellow}` },
  // Same idea, injury-red instead of yellow — for an injured chip lit
  // above the back-from-injury popover's own injury-red-bordered scrim,
  // so the "what's this connected to" ring matches that popover's theme
  // rather than the generic yellow every other anchored surface uses.
  mdInjuredChipLit: { boxShadow: `0 0 0 3px ${tokens.color.injuryRed}` },

  // Match Link, Step 5 — 2c/2d's own "Today's Minutes" link, centred under
  // the action bar. The parent's only route there (no cog menu at all in
  // parentMode) — the coach reaches the identical screen via the cog's
  // existing row instead, so this never renders for them.
  mdParentMinutesLink: {
    display: "block", width: "100%", background: "transparent", border: "none", padding: "12px 0 4px",
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.pitchGreen,
    textAlign: "center", cursor: "pointer",
  },
};

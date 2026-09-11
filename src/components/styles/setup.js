// SquadSettingsForm.jsx (+ the handful ManageSquadScreen.jsx/
// SquadChangeScreen.jsx borrow) — game/roster setup screens.
// Moved out of the old monolithic styles.js as-is.
import { tokens, colors } from "./tokens.js";

export const setupStyles = {
  emptyState: { color: "#7C8983", fontSize: 14, padding: "16px 0" },

  // settingsGrid still used (SquadSettingsForm's three number tiles) —
  // the individual tile styling itself moved to the mdSetupXxx family
  // further down, alongside the rest of that screen's redesign.
  settingsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignItems: "start" },
  selectAllBtn: {
    background: "transparent", color: colors.field, border: "1px solid " + colors.field, borderRadius: 999,
    padding: "3px 9px", fontWeight: 700, fontSize: 11, cursor: "pointer", marginLeft: "auto",
  },

  // ---- Setup (A3-Setup for first-time setup, A4-Setup-collapsed/expanded
  // for editing an existing game's settings), SquadSettingsForm.jsx. Now a
  // real restyle including the design's tap-to-edit dark-flip number tiles
  // and the accordion (collapsed one-line row -> expanded dark card) used
  // by the edit/modal context — see the file-level comment on
  // SquadSettingsForm.jsx for which context uses which layout and why.
  // Reuses several pitch-screen patterns directly (mdBenchChip's
  // number-disc-plus-name pill for a squad/keeper chip) rather than
  // inventing parallel ones.
  // mdSetupHeaderRow/mdSetupTitle/mdSetupCloseBtn removed — the "inline"
  // variant's own plain title-row+✕ header they built, superseded by a
  // context-aware header shared with "edit" (see SquadSettingsForm.jsx's
  // own `header` const for the full story).
  //
  // "Who's here?" / "Squad" section header — count chip + "tap to drop
  // out" hint, shared by both layouts.
  mdSetupSectionTitle: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 22, color: tokens.color.deepGreen },
  mdSetupHeaderInRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 18, marginBottom: 11, flexWrap: "wrap" },
  mdSetupInChip: {
    background: tokens.color.mint, color: tokens.color.pitchGreen, fontFamily: tokens.font.body, fontWeight: 800,
    fontSize: 13, padding: "4px 10px", borderRadius: tokens.radius.chip,
  },
  mdSetupDropOutHint: { marginLeft: "auto", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: tokens.color.mutedText },
  // Available-player pill: same shape as mdBenchChip/mdBenchChipNumber
  // (the match-screen bench strip) reused directly in the component rather
  // than duplicated here — only the "not available" variant needs its own
  // dimmed look.
  mdSetupChipOut: { background: tokens.color.creamDeep, opacity: 0.6 },
  mdSetupChipOutNumber: { background: tokens.color.disabledBorder, color: tokens.color.benchText },
  mdSetupAddChip: {
    display: "inline-flex", alignItems: "center", gap: 6, border: `2px dashed ${tokens.color.disabledBorder}`,
    borderRadius: tokens.radius.chip, padding: "6px 14px", background: "transparent", cursor: "pointer",
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.mutedText,
  },
  // Real-use feedback: "edit"'s own Who's-here row used to be
  // mdBenchChipRow (a 2-row grid that grows sideways and scrolls once it
  // fills past two rows) with a position:sticky "+ Player" chip pinned to
  // the scroll viewport's right edge — real-device feedback found that
  // sticky chip visually overlapping real player chips scrolling
  // underneath it "looks very strange." Replaced with this plain wrapping
  // row instead: every chip (including "+ Player") just wraps to as many
  // rows as it needs, so there's no hidden horizontal scroll and nothing
  // needs sticky positioning to stay visible — the overlap problem is
  // gone by construction, not patched. Also brings this screen's own
  // visual shape in line with "inline"'s quick-add list (real-use
  // feedback: "Set up new team and Set up next game have the same
  // visuals here for who is here") — this row's own chips stay
  // interactive (tap to toggle availability), unlike quick-add's, since
  // toggling who's here today from an existing roster is still this
  // screen's actual job.
  mdSquadChipWrapRow: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },

  // ---- Quick-add squad (SquadSettingsForm.jsx, "inline" variant only —
  // a brand-new team's very first roster, before there's anything to
  // scan/toggle yet). Replaces mdBenchChipRow's 2-row scrolling grid for
  // this one moment: that grid is built for *scanning an existing
  // roster*, the wrong shape for *building one from nothing*. A plain
  // wrapping flex list just grows as you go instead. Individual chips
  // still reuse mdBenchChip/mdBenchChipNumber/mdBenchChipName directly —
  // same pill a coach already recognizes everywhere else, just not
  // tappable here (nothing to toggle mid-build; availability toggling
  // is a return-visit concern, handled by the existing grid instead).
  // Real-device feedback: too short/cramped at first — vertical padding
  // bumped 6->11 (horizontal untouched, only the height was flagged).
  mdQuickAddRow: {
    display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: tokens.radius.chip,
    padding: "11px 6px 11px 16px", boxShadow: "0 3px 0 rgba(28,58,46,.08)", marginBottom: 6,
  },
  mdQuickAddNextNum: {
    width: 30, height: 30, borderRadius: "50%", background: tokens.color.pitchGreen, color: "#fff", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13,
  },
  // fontSize 16, same iOS-zoom reason as mdSetupInput.
  mdQuickAddInput: {
    flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: tokens.font.body,
    fontWeight: 800, fontSize: 16, color: tokens.color.deepGreen,
  },
  mdQuickAddEnterHint: {
    flexShrink: 0, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 12, color: tokens.color.mutedText,
    background: tokens.color.creamPaper, borderRadius: tokens.radius.chip, padding: "5px 11px",
  },
  mdQuickAddHint: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12.5, color: tokens.color.mutedText, margin: "0 0 12px 4px" },
  mdQuickAddList: { display: "flex", flexWrap: "wrap", gap: 8, minHeight: 40, alignItems: "flex-start" },
  mdQuickAddEmpty: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13.5, color: tokens.color.placeholderText, padding: "8px 4px" },
  // Entrance only — real CSS @keyframes (see quickAddKeyframes,
  // SquadSettingsForm.jsx), same reasoning MatchView.jsx's own motion
  // uses: starts the instant the chip mounts, no JS trigger needed. A
  // stable per-player key means an existing chip never remounts when a
  // new one is added alongside it, so this naturally plays once per
  // player rather than replaying the whole list. Skipped under
  // prefers-reduced-motion (component checks, doesn't apply this style).
  mdQuickAddChipEnter: { animation: "sqQuickAddPopIn 260ms cubic-bezier(.22,.9,.3,1)" },

  // The three "on pitch / minutes / sub every" tiles. Resting = plain white
  // value; tapping flips ONE tile dark with a −/+ stepper either side of
  // the number (see activeTile state in the component) — "no keyboard,
  // whole numbers only" per the README, 5-minute steps for game length, 1
  // for the other two.
  mdSetupTile: {
    background: "#fff", borderRadius: tokens.radius.benchStrip, padding: "12px 8px", textAlign: "center", border: "none",
    cursor: "pointer", font: "inherit", width: "100%",
  },
  mdSetupTileLabel: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11, color: tokens.color.mutedText,
    textTransform: "uppercase", letterSpacing: "0.04em", display: "block",
  },
  mdSetupTileValue: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 34, color: tokens.color.deepGreen, lineHeight: 1.05,
  },
  mdSetupTileActive: {
    background: tokens.color.deepGreen, boxShadow: "0 0 0 4px rgba(28,58,46,.14)",
  },
  mdSetupTileActiveLabel: { color: tokens.color.mutedOnDark },
  mdSetupTileStepRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  mdSetupTileStepBtn: {
    width: 38, height: 38, borderRadius: tokens.radius.iconButton, border: "none",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
  },
  mdSetupTileStepBtnMinus: { background: tokens.color.creamPaper, color: tokens.color.deepGreen },
  mdSetupTileStepBtnPlus: { background: tokens.color.yellow, color: tokens.color.deepGreen },
  mdSetupTileStepValue: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 34, color: tokens.color.yellow, lineHeight: 1, minWidth: 48,
  },

  // Accordion row — the collapsed one-line summary used by the edit/modal
  // (A4-Setup-collapsed) layout: icon tile, label, current value in plain
  // text, and a chevron, all on one white row. Tapping expands it into
  // mdSetupCardDark below (only one section expanded at a time). Precise
  // spec from a design pass: gap 13 (was 12), radius 22 (was rowLg/20),
  // padding 13/15 (was 15/16), its own explicit shadow.
  mdSetupAccordionRow: {
    display: "flex", alignItems: "center", gap: 13, width: "100%", background: "#fff",
    borderRadius: 22, border: "none", padding: "13px 15px", cursor: "pointer",
    textAlign: "left", font: "inherit", boxShadow: "0 3px 0 rgba(28,58,46,.08)",
  },
  // 44x44, radius 16, flex:0 0 auto, centered — one drawn (stroke, not
  // solid-fill) SVG glyph per section. A different visual family from
  // matchDayIcons.jsx's icons on purpose — those are explicitly solid-fill
  // by design, these are line-drawn tags/badges, not match-day stickers.
  mdSetupRowIconTile: {
    width: 44, height: 44, borderRadius: 16, flex: "0 0 auto",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  // Label promoted to the display font (Baloo 2, matching mdSetupCardTitle)
  // and up to 19px — was the body font at 16px. flexShrink:0 — without it,
  // a flex row tight on space (the icon tile + a long label + value + the
  // chevron, all on one line) shrinks the label down towards its own
  // longest single word, wrapping it — real-device feedback ("Jack
  // starts" specifically triggered this once the icon tile was added). The
  // label should never wrap; the value is what gives way instead.
  mdSetupAccordionLabel: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, color: tokens.color.deepGreen, flexShrink: 0 },
  // minWidth:0 lets this actually shrink below its own content size (a
  // flex item's default min-width is auto, i.e. "never smaller than my
  // content" — without overriding that, overflow/ellipsis below can't
  // ever kick in); truncates with "…" rather than wrapping or overflowing
  // the row once the label/icon/chevron have claimed what they need.
  mdSetupAccordionValue: {
    marginLeft: "auto", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.mutedText,
    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  // Back to a plain text glyph — purely decorative here (sits inside the
  // already-full-row button, which is what's actually clickable), not its
  // own separate tap target. See mdSetupCardCollapseBtn below for the
  // *real* icon-button collapse control the expanded Breaks/Manage squad
  // cards use — a deliberately different style now that this one is back
  // to being non-interactive.
  mdSetupAccordionChevron: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, color: tokens.color.chevron },
  // The expanded Breaks/Manage squad cards' own collapse control — a real
  // icon button (Lucide ChevronDown, thicker via strokeWidth than a text
  // glyph can get), padded for an actual tap target rather than just a
  // bigger-looking glyph. mdSetupCardChevronOnDark is the dark-card
  // (First in goal today / Keeper changes) equivalent, just below.
  mdSetupCardCollapseBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: tokens.color.chevron, padding: 8, cursor: "pointer", flexShrink: 0,
  },

  // The expanded "In goal today" / "Keeper swaps" card. White + always-open
  // in the first-time (A3) layout; dark + only shown when its accordion row
  // is tapped in the edit (A4-expanded) layout — same shapes, background
  // and text color swap between the two via the OnDark variants.
  mdSetupCard: { background: "#fff", borderRadius: tokens.radius.buttonMd, padding: "14px 16px", marginBottom: 9 },
  mdSetupCardDark: { background: tokens.color.deepGreen },
  mdSetupCardHeaderRow: { display: "flex", alignItems: "center", gap: 12 },
  // flex:1 so whatever follows (a value badge, a stepper, a collapse
  // chevron) always lands flush against the card's own right edge,
  // regardless of how long this title's own text is — the mechanism that
  // keeps every section's collapse chevron sitting at the same X position
  // down the screen (real-device feedback: "all collapse arrows...should
  // be vertically aligned for consistency"). Inert wherever this isn't
  // inside a flex row (e.g. the inline layout's own plain Breaks card).
  mdSetupCardTitle: { flex: 1, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 21, color: tokens.color.deepGreen },
  mdSetupCardTitleOnDark: { color: tokens.color.creamPaper },
  // mdSetupCardHint/mdSetupCardHintOnDark removed — the far-right "👑
  // starts" note on "inline" (first-time setup)'s own old always-open
  // "First in goal today" card, before that card became the same
  // collapsed accordion row "edit" already used (see
  // renderGameSettingsAccordion, SquadSettingsForm.jsx).
  //
  // The edit layout's own bigger badge-styled version of the hint above —
  // real-device feedback wanted "First in goal today"'s own Random/{name}
  // starts value bigger and reading as a proper tag, not small muted text.
  // Neutral translucent pill for "Random"; flips solid gold (matching the
  // gold=keeper motif everywhere else in the app) once someone's actually
  // picked — mdSetupCardValueBadgeSet layered on top.
  mdSetupCardValueBadge: {
    display: "inline-block", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.creamPaper,
    background: "rgba(255,255,255,.16)", borderRadius: tokens.radius.chip, padding: "6px 13px",
    whiteSpace: "nowrap", flexShrink: 0,
  },
  mdSetupCardValueBadgeSet: { background: tokens.color.yellow, color: tokens.color.deepGreen },
  // Same bigger-tap-target treatment as mdSetupAccordionChevron above —
  // this is the "First in goal today" card's own collapse control.
  mdSetupCardChevronOnDark: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: tokens.color.mutedOnDark, padding: 8, cursor: "pointer", flexShrink: 0,
  },
  mdSetupCardCaptionOnDark: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13, color: tokens.color.mutedOnDark, marginTop: 8 },

  // The merged "Goal Keeper Options" card's own 3 sub-sections (Keepers /
  // First in goal today / Keeper changes) — smaller than mdSetupCardTitle
  // since it's a sub-heading inside that bigger title now, not a card
  // title of its own. mdSetupGkSelectAllOnDark exists because the shared
  // selectAllBtn style is dark-green-on-transparent, built for a light
  // card — invisible on this one's own dark-green background.
  mdSetupGkSubHeaderRow: { display: "flex", alignItems: "center", gap: 10 },
  mdSetupGkSubTitle: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.creamPaper, flex: 1 },
  mdSetupGkSelectAllOnDark: {
    background: "transparent", color: tokens.color.creamPaper, border: `1px solid ${tokens.color.creamPaper}`, borderRadius: 999,
    padding: "3px 9px", fontWeight: 700, fontSize: 11, cursor: "pointer",
  },
  mdSetupGkDivider: { height: 1, background: "rgba(255,255,255,0.15)", margin: "16px 0" },
  // The keeper-squeeze nudge (rotation.js: assessKeeperShift) — a caution,
  // not an error, so yellow (tokens.color.yellow, the same gold already
  // used for a picked keeper's own value badge on this dark card), not
  // red — red is reserved for injury everywhere else in this app.
  // Real-device feedback: the plain text version of this felt cramped —
  // now a real padded callout (same "tinted box, same accent as its own
  // border" shape mdSetupWarning uses for the red validation errors, just
  // yellow, this being a caution not an error), with its own genuinely
  // bigger, solid button below the text rather than a small inline link
  // squeezed onto the same line.
  mdSetupGkSqueezeBox: {
    marginTop: 10, background: "rgba(245,185,59,0.14)", border: "1px solid rgba(245,185,59,0.4)",
    borderRadius: 12, padding: "12px 14px",
  },
  mdSetupGkSqueezeText: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13, color: tokens.color.yellow, lineHeight: 1.4 },
  mdSetupGkSqueezeBtn: {
    marginTop: 10, background: tokens.color.yellow, color: tokens.color.deepGreen, border: "none", borderRadius: 999,
    padding: "9px 18px", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13.5, cursor: "pointer",
  },

  // Inline stepper — "Swap every" / "Keeper swaps", a smaller always-on
  // −/+ pair next to a label (not a flip-to-edit tile like mdSetupTile).
  mdSetupInlineStepRow: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 },
  mdSetupInlineStepBtn: {
    width: 36, height: 36, borderRadius: 13, border: "none", fontFamily: tokens.font.display, fontWeight: 800,
    fontSize: 24, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
  },
  mdSetupInlineStepBtnMinus: { background: tokens.color.creamDeep, color: tokens.color.deepGreen },
  mdSetupInlineStepBtnPlus: { background: tokens.color.pitchGreen, color: "#fff" },
  mdSetupInlineStepBtnMinusOnDark: { background: tokens.color.creamPaper, color: tokens.color.deepGreen },
  mdSetupInlineStepBtnPlusOnDark: { background: tokens.color.yellow, color: tokens.color.deepGreen },
  // minWidth was 64, sized for "5′" — "10 mins" (real-use feedback: word
  // out, not an apostrophe) needs real room not to wrap or crowd the +/-
  // buttons either side of it.
  mdSetupInlineStepValue: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.deepGreen, minWidth: 110,
    textAlign: "center", whiteSpace: "nowrap",
  },
  mdSetupInlineStepValueOnDark: { color: tokens.color.yellow },

  // Breaks: reuses the existing mdSetupChip/mdSetupChipActive pill row for
  // None/Halves/Thirds/Quarters, plus a live segment bar showing the sub
  // windows this produces, divided at each break.
  mdSetupBreakBar: { display: "flex", alignItems: "center", gap: 5, marginTop: 12 },
  mdSetupBreakSeg: { flex: 1, height: 22, borderRadius: 3, background: tokens.color.pitchGreen },
  mdSetupBreakSegFirst: { borderRadius: "8px 3px 3px 8px" },
  mdSetupBreakSegLast: { borderRadius: "3px 8px 8px 3px" },
  mdSetupBreakDivider: { width: 14, height: 22, borderRadius: 4, background: tokens.color.yellow, flexShrink: 0 },

  mdSetupHint: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.mutedText, marginTop: 6, lineHeight: 1.4 },
  // Progressive disclosure for the sub-interval fairness picker
  // (renderSubIntervalRecs, SquadSettingsForm.jsx) — real-use feedback:
  // showing the picker even when the current pick is already fair invites
  // solving a problem that doesn't exist.
  mdSetupFairnessOk: {
    display: "flex", alignItems: "center", gap: 5, marginTop: 6,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 12.5, color: tokens.color.pitchGreen, lineHeight: 1.3,
  },
  // Plain text button, not a card/pill — deliberately lighter-weight than
  // the chips it reveals, so it reads as an optional aside rather than
  // another control competing with the tiles/chips around it.
  mdSetupFairnessPrompt: {
    display: "block", width: "100%", marginTop: 8, padding: 0, background: "transparent", border: "none",
    cursor: "pointer", textAlign: "left", font: "inherit", lineHeight: 1.4,
  },
  mdSetupFairnessPromptLabel: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13.5, color: tokens.color.pitchGreen },
  mdSetupFairnessPromptHint: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.mutedText },
  mdSetupChipRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  mdSetupChip: {
    flex: "0 0 auto", padding: "8px 14px", borderRadius: tokens.radius.chip, border: "none",
    background: tokens.color.creamDeep, color: tokens.color.mutedText,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, cursor: "pointer",
  },
  mdSetupChipActive: { background: tokens.color.deepGreen, color: tokens.color.creamPaper },

  // The sub-interval recommendation's own chip row (edit layout) — a
  // design pass replacing the old two-line "For today's N players — tap a
  // fairer sub interval..." prose + generic ✓/✗ chips. Deliberately its
  // own style family, not mdSetupChip/mdSetupChipRow above — those are
  // still Breaks' own None/Halves/Thirds/Quarters chips, untouched here.
  // flexWrap stays on regardless of screen width — if these five chips
  // (4'-8') ever don't fit their one line, shrink the chip padding first;
  // never drop flex-wrap, or a genuinely narrow screen would push the row
  // off the right edge instead of wrapping.
  mdSetupEvenSplitsRow: { marginTop: 9, display: "flex", gap: 7, flexWrap: "wrap" },
  // Sit directly on the cream page — deliberately not inside a tinted
  // card (a white chip loses its contrast against creamDeep, the app's
  // usual card tint).
  mdSetupSplitChip: {
    display: "flex", alignItems: "center", gap: 5, background: "#fff", borderRadius: 999, border: "none",
    padding: "7px 13px", cursor: "pointer", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17,
    color: tokens.color.deepGreen,
  },
  // The single best-fitting interval (smallest spread across every
  // candidate, not just "any fair one") — filled so there's one obvious
  // thing to aim for, rather than every fair option looking the same.
  mdSetupSplitChipBest: { background: tokens.color.pitchGreen, boxShadow: "0 3px 0 #1C5B3A", padding: "7px 15px", color: "#fff" },

  mdSetupAddRow: { display: "flex", gap: 8, marginBottom: 8 },
  // fontSize 16 (not 14) matters here — iOS Safari auto-zooms the whole
  // page on focusing any text input whose font-size computes under 16px,
  // which is exactly what real-device feedback reported ("zooms in too
  // much, pushes the button to the side" — the Add button next to this
  // field, and the mismatched-looking cursor were both just symptoms of
  // that zoom). Same fix applied to mdTeamAcctInput/mdSetupNumberInput
  // below, the app's only other real text inputs.
  mdSetupInput: {
    flex: 1, padding: "10px 14px", borderRadius: tokens.radius.chip, border: `1px solid ${tokens.color.rule}`,
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 16, background: "#fff", color: tokens.color.deepGreen,
  },
  mdSetupAddBtn: {
    display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: tokens.radius.chip, border: "none",
    background: tokens.color.yellow, color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800,
    fontSize: 14, cursor: "pointer", boxShadow: tokens.shadow.solid(3, tokens.color.yellowShadow),
  },
  // Squad row: same white-card shape mdPopoverRow already established for
  // an anchored-popover row, reused here for a squad-list row — both are
  // "one item, several small controls" cards, no reason to invent a
  // second near-identical style for it.
  mdSetupRow: {
    display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: tokens.radius.rowSm,
    padding: "6px 10px", marginBottom: 6, boxShadow: "0 3px 0 rgba(28,58,46,.10)",
  },
  mdSetupRowName: { flex: 1, fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.deepGreen, minWidth: 0 },
  // The persistent squad-number editor — a small number disc (same visual
  // language as mdBenchChipNumber) that turns into a real input when tapped.
  //
  // Real-use feedback: this used to sit muted (cream/grey) until a real
  // number was actually set, showing a bare "–" the rest of the time —
  // "I don't really know what it means". Now always solid green/white,
  // the same treatment the Who's-here screen's own number discs use
  // (mdSquadCardDisc) — it displays `numberOf(p.id)` rather than the raw
  // `p.number` field, so it always shows *some* real number (a squad
  // number if one's set, otherwise that same roster-position fallback
  // Who's-here already relies on), never a placeholder dash.
  mdSetupNumberBadge: {
    width: 32, height: 32, borderRadius: "50%", border: "none", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13,
    background: tokens.color.pitchGreen, color: "#fff",
  },
  mdSetupNumberInput: {
    width: 32, height: 32, borderRadius: "50%", border: `2px solid ${tokens.color.pitchGreen}`, flexShrink: 0,
    textAlign: "center", padding: 0, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.deepGreen,
  },
  // Availability toggle, keeper-eligible toggle, and start-in-goal toggle
  // share one small round tinted-button shape, only the tint/icon differ.
  mdSetupToggle: {
    width: 32, height: 32, borderRadius: "50%", border: "none", flexShrink: 0, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", background: tokens.color.creamDeep, opacity: 0.5,
  },
  mdSetupToggleActive: { opacity: 1 },
  mdSetupRemoveBtn: {
    width: 32, height: 32, borderRadius: "50%", border: "none", flexShrink: 0, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: tokens.color.mutedText,
  },
  // marginBottom, not just marginTop — the submit button right after this
  // relies on margin-top:auto to sit at the bottom of the screen's flex
  // column (see mdSetupSubmitBtnPrimary's own comment), which only leaves
  // a gap if there's leftover space in the column to soak up. Real-device
  // feedback: on a screen tall enough to need this warning but not much
  // taller than that, the auto-margin had almost nothing left to claim,
  // so the button sat right against (visually "intersecting") the warning
  // below it. This guarantees a real minimum gap regardless of how much
  // room the auto-margin actually has to work with.
  mdSetupWarning: {
    marginTop: 14, marginBottom: 14, fontSize: 13, fontFamily: tokens.font.body, fontWeight: 700, color: tokens.color.injuryText,
    background: tokens.color.injuryTint, border: `1px solid ${tokens.color.injuryBorder}`, padding: "10px 14px", borderRadius: 14,
  },
  // mdSetupSubmitBtn (the old yellow "inline"-only submit) removed —
  // "inline" now shares this same green button, both style and copy, with
  // "edit" (real-use feedback: "appear exactly how it does the Game
  // settings screen"). Labeled "Build new rotation" regardless of entry
  // point (Game settings, Set up next game, or first-time setup), the
  // same phrase the confirm
  // sheet's own button below uses so a coach sees what they tapped
  // repeated back. margin-top:auto pushes it to the bottom of the
  // screen's own flex column (see the "edit" variant's wrapping div) on a
  // short roster/settings page instead of sitting right after the last
  // accordion row with a gap.
  //
  // Real-device feedback: this used to also carry flex:1, on the (wrong)
  // assumption that margin-top:auto alone claims the column's leftover
  // space, making flex-grow redundant here. It doesn't — flex-grow runs
  // first and margin:auto only soaks up whatever's left after that, so
  // flex:1 was the one actually inflating this button to fill the entire
  // rest of the (minHeight:100vh) column on a short settings page, making
  // it look like a giant slab instead of a normal button. Dropped in favor
  // of an explicit height:60, matching every other primary green button
  // in this file (mdBackPopoverBtnPrimary, mdCautionSheetBtnPrimary).
  //
  // Real-device feedback again: even at the right height, this still sat
  // partly below the visible screen — margin-top:auto pushes it flush
  // with the very bottom of its own flex column, and mobile Safari's own
  // collapsing toolbar meant the *actual* visible viewport was shorter
  // than that column reported. Fixed at the root (the wrapping div uses
  // minHeight:100dvh now, not 100vh — see its own comment), so
  // marginBottom below is back to being a plain, deliberate visual gap —
  // not a fudge factor propping the button up into view. No horizontal
  // margin either — it used to carry its own extra 16px on top of the
  // page's existing 16px padding, making it narrower than the accordion
  // rows above; removing it lines the button up edge-to-edge with them,
  // same width as every other row on this screen. The bottom margin comes
  // out of the same auto-margin's leftover space above, so the column's
  // total height is unaffected either way — more of it means more gap
  // below the button (and it settles higher); less means less gap (and
  // it settles lower, closer to the true bottom edge). Real-use feedback
  // moved this from 46 to 30 once the dvh fix meant it was a pure
  // preference again, not correcting for anything.
  mdSetupSubmitBtnPrimary: {
    display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
    // Longhand margins, not a shorthand `margin` + a `marginTop` override —
    // caught as a real console warning while testing this file's other
    // changes ("mixing shorthand and non-shorthand properties for the same
    // value can lead to styling bugs"), the exact footgun subIntervalChip/
    // intervalTab's own comments already warn about elsewhere in this file.
    marginTop: "auto", marginRight: 0, marginBottom: 30, marginLeft: 0, height: 60,
    background: tokens.color.pitchGreen, borderRadius: 24, padding: "0 17px", textAlign: "center",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 21, color: "#fff",
    boxShadow: "0 5px 0 #1C5B3A", border: "none", cursor: "pointer",
    // Real-device feedback: first tap after scrolling down to reach this
    // button did nothing, second tap worked — a known mobile Safari/Chrome
    // behavior where fast scroll momentum can absorb the first tap as a
    // stop-scrolling gesture rather than a real click, on a plain
    // whole-page scroll like this screen uses (no scroll listeners,
    // overlays, or touch-action rules found anywhere near this button, so
    // not something in this codebase causing it). touch-action:manipulation
    // tells the browser to skip its own tap-ambiguity handling on this
    // element — the standard mitigation for exactly this symptom.
    touchAction: "manipulation",
  },

  // ---- A5-Minutes (#11b) — README: "splits each child's time three ways
  // — pitch, in goal, bench — ... so the coach can audit the rotation
  // rather than take its word for it."
  // Right-hand context chip on the shared sub-header, showing elapsed
  // time — generalized off mdSubHeaderTitle's row (flex:1 there leaves
  // room for this to sit at the end).
  mdSubHeaderChip: {
    background: tokens.color.deepGreen, color: tokens.color.yellow, fontFamily: tokens.font.body, fontWeight: 800,
    fontSize: 14, borderRadius: tokens.radius.chip, padding: "6px 13px", flexShrink: 0, whiteSpace: "nowrap",
  },

  // ---- A7-Squad-change (#10d) — README: "Who's here?" — the only screen
  // that adds or removes a player from the game mid-match, without
  // touching the clock or the plan already played (see addArrival/
  // removeAvailability, rotation.js/useMatchState.js — deliberately NOT
  // built on the destructive "Save & Regenerate" path). Context chip
  // reuses mdSubHeaderChip directly (same shape, just "{N} in" instead of
  // an elapsed time). Row shell doesn't reuse mdMinutesRow/mdSeasonRow —
  // this screen's cards sit in a 2-column grid, not a single-column list.
  mdArrivalCallout: {
    display: "flex", alignItems: "center", gap: 12, background: tokens.color.mint,
    borderRadius: tokens.radius.rowLg, padding: "12px 14px", marginBottom: 12,
  },
  mdArrivalCalloutDisc: {
    width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 14,
    background: tokens.color.pitchGreen, color: tokens.color.creamPaper,
  },
  mdArrivalCalloutText: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0 },
  mdArrivalCalloutName: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, color: tokens.color.deepGreen },
  mdArrivalCalloutSub: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12.5, color: tokens.color.groupLabel },
  mdSquadGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 },
  // Base shape shared by both card states — background/shadow (the only
  // real difference besides text color) applied per state below, same
  // pattern as mdTeamAcctCard/mdTeamAcctCardActive.
  mdSquadCard: {
    display: "flex", alignItems: "center", gap: 9, width: "100%", border: "none",
    borderRadius: tokens.radius.rowLg, padding: "10px 11px", cursor: "pointer", textAlign: "left", font: "inherit",
  },
  mdSquadCardAvailable: { background: "#fff", boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)") },
  mdSquadCardUnavailable: { background: tokens.color.creamDeep },
  // Tap-to-select before the action bar's named button commits the change
  // — not in the README's own A7 spec (which only describes the two
  // Available/Unavailable resting states), but a two-step tap-then-confirm
  // flow reads safer than an instant add/remove on a single tap, especially
  // for the on-pitch removal case. Same yellow-ring "lit" language as
  // mdBenchChipLit, replacing rather than layering onto the resting shadow.
  mdSquadCardSelected: { boxShadow: `0 0 0 3px ${tokens.color.yellow}` },
  mdSquadCardDisc: {
    width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13,
    background: tokens.color.pitchGreen, color: tokens.color.creamPaper,
  },
  mdSquadCardDiscUnavailable: { background: tokens.color.disabledBorder, color: tokens.color.benchText },
  mdSquadCardInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 },
  mdSquadCardName: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.deepGreen },
  mdSquadCardNameUnavailable: { color: tokens.color.benchText },
  // "on pitch" / "bench" (available) vs "not here" (unavailable).
  mdSquadCardStatus: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 11.5, color: tokens.color.mutedText },
  mdSquadCardStatusUnavailable: { color: tokens.color.unavailableText },
  // Sits in the same fixed bottom shell as the match screen's action bar
  // (mdActionBarOuter/mdActionBar) — this screen replaces that bar rather
  // than showing both at once (see SquadChangeScreen.jsx), so no need for
  // a third near-identical fixed-shell pair.
  mdSquadChangeCaption: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13.5, color: tokens.color.mutedOnDark, marginBottom: 10,
  },
  mdSquadChangeBtn: {
    width: "100%", height: 66, borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.yellow,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 24,
    boxShadow: tokens.shadow.solid(5, tokens.color.yellowShadow), cursor: "pointer",
  },
  // Removing someone currently on the pitch — same red used for the
  // injury flow's own primary actions elsewhere on this screen family.
  mdSquadChangeBtnDanger: {
    background: tokens.color.injuryRed, color: "#fff", boxShadow: "none",
  },
  // "+ Player" — a brand-new roster entry, not just an existing player
  // toggling back to available. Same card footprint as mdSquadCard so it
  // sits naturally as one more tile in the 2-column grid; dashed border
  // language borrowed from mdTeamAcctAddCard ("not a record yet").
  mdSquadAddCard: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
    borderRadius: tokens.radius.rowLg, padding: "10px 11px", border: `3px dashed ${tokens.color.disabledBorder}`,
    background: "transparent", cursor: "pointer", fontFamily: tokens.font.display, fontWeight: 800,
    fontSize: 15, color: tokens.color.mutedText, minHeight: 54,
  },
  // Replaces the add card in place once tapped — spans both grid columns
  // (gridColumn set at the call site) so the name field isn't squeezed
  // into one card's width.
  mdSquadAddRow: { display: "flex", gap: 8 },
};

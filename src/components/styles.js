// All visual styling for Bench Buddy, kept as inline-style objects rather
// than CSS (this matches how the component was originally built as a
// self-contained Claude.ai artifact). Pulled into its own file so the
// component files can focus on structure/behavior — see the architecture
// notes for the trade-offs of this approach vs. a CSS framework.

// @import (not a <link> in index.html) so this stays self-contained with
// the rest of the app's styling approach — fontStyle is already injected
// as a real <style> tag in SubRotationPlanner, this just adds one more
// rule to it. Only the weights actually specified by the design tokens
// below (Baloo 2 800, Nunito 700/800) — no point loading unused weights.
export const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Nunito:wght@700;800&display=swap');
  * { box-sizing: border-box; }
`;

export const colors = {
  grass: "#1F4D36",
  grassLight: "#2A6146",
  pitchDark: "#173A28",
  chalk: "#F4F7F2",
  ink: "#0F241A",
  gk: "#E0A526",
  field: "#3E8E68",
  bench: "#8A9A93",
  danger: "#C1502E",
  cardBg: "#FFFFFF",
  border: "#DDE4E0",
};

// Design tokens for the match-day redesign (see
// design_handoff_bench_buddy_match_day/README.md — "Direction A", the
// sticker-book look: cream paper, chunky solid drop shadows, kit-shirt
// player tiles). Named straight from the README's own Design Tokens
// section rather than invented fresh, so this file and that doc stay
// readable side by side.
//
// Deliberately additive, not a replacement for `colors` above: this
// redesign covers match-day (MatchView, the cog menu, SquadSettingsForm)
// per the implementation plan, not every screen in the app. Anything not
// yet rebuilt (TeamSwitcher's own chrome, SummaryModal, SeasonSummaryModal,
// SignIn, LoadingScreen) still reads `colors`, so that has to keep working
// unchanged until — if ever — those get their own redesign pass.
export const tokens = {
  color: {
    creamPaper: "#FFF6E5",
    creamDeep: "#F1E9D2",
    rule: "#EDE3CB",
    canvas: "#EDEAE2",
    headerYellow: "#FBE3A6",
    yellow: "#F5B93B",
    yellowShadow: "#C9902A",
    goldText: "#96772F",
    pitchGreen: "#2E7D53",
    deepGreen: "#1C3A2E",
    actionBar: "#123F3D",
    greenShadow: "#1F5A3B",
    mint: "#CBE8D6",
    mutedText: "#6B7C72",
    mutedOnDark: "#8FB5AB",
    chevron: "#C9C4B6",
    alertRed: "#E8664A",
    injuryRed: "#C4482A",
    injuryTint: "#FBEDE9",
    injuryTint2: "#FAD3C8",
    injuryBorder: "#E8A899",
    injuryText: "#8A4634",
    scrim: "rgba(20,32,28,.55)",
  },
  // Baloo 2 800 for display type (timer, wordmark, buttons, popover
  // titles); Nunito for body copy (700 captions, 800 labels/chips/names)
  // — weight is picked per use, not baked in here, since the same family
  // is used at both weights depending on the element.
  font: {
    display: "'Baloo 2', system-ui, sans-serif",
    body: "'Nunito', system-ui, sans-serif",
  },
  // Named for what each radius is *for*, not just its pixel value, since
  // several different values share the same rough purpose (three "row"
  // radii for menu rows of different densities, two "button" radii for
  // primary vs secondary buttons) and picking the right one only makes
  // sense with that context in hand.
  radius: {
    phoneShell: 38,
    actionBarTop: 32,
    card: 28, // pitch card, anchored popovers' non-pointed corners
    buttonLg: 26,
    buttonMd: 24,
    benchStrip: 22,
    rowLg: 20,
    rowMd: 18,
    rowSm: 16,
    iconButton: 14,
    iconTile: 12,
    chip: 999,
    // An anchored popover (cog menu, player-tap menu) is otherwise `card`
    // radius on every corner, except the one pointing at the control it
    // grew from, which flattens to this instead. Which corner that is
    // varies per popover (top-left for the cog, bottom-left for a
    // bench-chip popover, etc.) so it's applied by hand at the call site
    // rather than baked into one fixed shorthand here.
    anchoredCorner: 10,
  },
  spacing: {
    screenMin: 14,
    screenMax: 20,
    cardGapMin: 8,
    cardGapMax: 12,
    rhythm: 12,
  },
  shadow: {
    // Solid (not blurred) drop shadows are this design's signature — a
    // flat color offset straight down, no blur radius, so it reads as a
    // sticker's paper edge rather than a soft elevation shadow. Offset and
    // color vary per element (e.g. a yellow button's shadow is a darker
    // yellow, a green button's is a darker green), so this takes both
    // rather than being a fixed string.
    solid: (px, color) => `0 ${px}px 0 ${color}`,
    // The one blurred shadow in the whole system — for a popover/sheet
    // lifted above the dark scrim, not a sticker sitting on the paper.
    overlay: "0 18px 44px rgba(20,32,28,.45)",
  },
};

export const styles = {
  // background was the old pre-redesign colors.chalk (pale grey) — the
  // match-day redesign's cards (bench strip, action bar, popovers) are all
  // designed against the warm "cream paper" page background instead, so
  // that stale chalk was showing through the header's rounded corners and
  // the gaps between cards, reading as a missing/unstyled background.
  app: { fontFamily: "system-ui, -apple-system, sans-serif", background: tokens.color.creamPaper, minHeight: 500, color: colors.ink },
  header: {
    background: `linear-gradient(135deg, ${colors.grass} 0%, ${colors.grassLight} 100%)`,
    borderBottom: "3px solid " + colors.gk, boxShadow: "0 2px 8px rgba(0,0,0,0.25)", padding: "10px 16px",
  },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerLogoGroup: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  // The source image (a licensed Vecteezy illustration — see README for
  // attribution) is a mascot on a yellow circle badge with white margin
  // around it. logoMark is a fixed-size clipping window (overflow:hidden is
  // what actually crops it — border-radius alone doesn't clip an oversized
  // transformed child); logoMarkImg is scaled up and repositioned inside it
  // so only the circular badge shows, cropping the white margin away.
  logoMark: {
    width: 34, height: 34, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.25)",
  },
  logoMarkImg: {
    width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)",
  },
  headerTitle: { color: colors.chalk, fontWeight: 900, letterSpacing: 2, fontSize: 16, textTransform: "uppercase" },
  teamSwitcherTrigger: {
    display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.12)", color: colors.chalk,
    border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer",
    maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0,
  },
  // Same pill treatment as teamSwitcherTrigger (same header, same dark-green
  // background) so the two read as a matched pair rather than one looking
  // like an afterthought next to the other.
  seasonBtn: {
    display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.12)", color: colors.chalk,
    border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer",
    flexShrink: 0,
  },
  teamList: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  teamRow: { display: "flex", alignItems: "center", gap: 6 },
  teamRowBtn: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left",
    background: colors.cardBg, border: "1px solid " + colors.border, borderRadius: 10, padding: "10px 12px",
    fontWeight: 700, fontSize: 14, color: colors.ink, cursor: "pointer",
  },
  teamRowBtnActive: { background: "#E9F5EE", border: "1px solid " + colors.field, color: colors.grass },
  teamRowMeta: { fontWeight: 600, fontSize: 11, color: "#7C8983" },
  // paddingBottom is deliberately generous: on mobile browsers the docked
  // bottom toolbar (back/forward/tabs) isn't reserved space the page knows
  // about — it just overlaps whatever content happens to end near the
  // bottom of the page. Without this, the last element on any screen (e.g.
  // MatchView's "Interval X of Y" nav) sits flush against that chrome.
  // 96px flat (not just env(safe-area-inset-bottom)) on purpose: that env()
  // value is really the home-indicator gesture-area inset, not toolbar
  // height, and while Safari's toolbar happens to roughly track it, Chrome
  // for iOS's toolbar doesn't — confirmed by a real phone screenshot still
  // showing the nav cut off in Chrome even with its toolbar auto-hidden. A
  // flat value that comfortably clears any mobile browser's toolbar is more
  // reliable than depending on that inset for this. env() is kept additive
  // on top for the safe-area itself; index.html's viewport-fit=cover is
  // what makes that env() value non-zero.
  main: { padding: "12px 16px", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))", maxWidth: 640, margin: "0 auto" },
  // marginTop: 0 matters here — without it, the browser's default <h2> top
  // margin (not otherwise reset anywhere in this file) throws off
  // align-items: center wherever this sits alongside something else in a
  // flex row with no margin of its own.
  sectionTitle: { fontSize: 17, fontWeight: 900, margin: 0, marginBottom: 8, color: colors.grass, textTransform: "uppercase", letterSpacing: 0.5 },
  headerBtnGroup: { display: "flex", gap: 6 },
  addRow: { display: "flex", gap: 8, marginBottom: 12 },
  input: { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid " + colors.border, fontSize: 14 },
  primaryBtn: {
    display: "flex", alignItems: "center", gap: 6, justifyContent: "center", padding: "10px 16px", borderRadius: 10,
    border: "none", background: colors.grass, color: colors.chalk, fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  iconBtn: {
    border: "none", background: colors.border, borderRadius: 8, padding: 8, cursor: "pointer", color: colors.ink,
    display: "flex", alignItems: "center", justifyContent: "center", minWidth: 40, minHeight: 40,
  },
  emptyState: { color: "#7C8983", fontSize: 14, padding: "16px 0" },

  // settingsGrid still used (SquadSettingsForm's three number tiles) —
  // the individual tile styling itself moved to the mdSetupXxx family
  // further down, alongside the rest of that screen's redesign.
  settingsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignItems: "start" },

  subTitle: { fontSize: 15, fontWeight: 700, color: colors.ink, margin: 0 },
  subTitleRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 10, flexWrap: "wrap" },
  countBadge: { fontSize: 11, fontWeight: 700, color: colors.field, background: "#E9F5EE", padding: "2px 8px", borderRadius: 999 },
  selectAllBtn: {
    background: "transparent", color: colors.field, border: "1px solid " + colors.field, borderRadius: 999,
    padding: "3px 9px", fontWeight: 700, fontSize: 11, cursor: "pointer", marginLeft: "auto",
  },

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
  // Absolutely positioned over the shirt SVG (see matchDayIcons.jsx) — top
  // offset and font size are both computed inline from the shirt's actual
  // rendered size (24/58 and 24/62 of the design's own 62x58 reference
  // shirt), so the number stays correctly placed as the shirt scales down
  // for busier games (see computeTokenSize, formation.js).
  mdShirtNumber: {
    position: "absolute", left: "50%", transform: "translateX(-50%)",
    fontFamily: tokens.font.display, fontWeight: 800, color: tokens.color.deepGreen, pointerEvents: "none",
  },
  mdGkTag: {
    position: "absolute", bottom: 2, left: -2, background: tokens.color.deepGreen, color: tokens.color.yellow,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 12, padding: "1px 6px", borderRadius: tokens.radius.chip,
    pointerEvents: "none",
  },
  // Same look as mdGkTag without the absolute positioning — for the
  // final60 sheet's swap-row chips, which aren't overlaid on a shirt.
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
  mdBenchStrip: {
    background: tokens.color.creamDeep, borderRadius: tokens.radius.benchStrip, padding: "12px 14px",
    marginBottom: tokens.spacing.rhythm,
  },
  mdBenchLabel: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 15, color: tokens.color.mutedText, marginBottom: 8 },
  mdBenchSubLabel: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.mutedText, marginBottom: 6 },
  mdBenchChipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
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
  // A keeper-eligible bench player's number disc flips to gold — matches
  // the on-pitch keeper's gold shirt, so "this player can go in goal"
  // reads the same color wherever they're shown.
  mdBenchChipNumberGk: { background: tokens.color.yellow, color: tokens.color.deepGreen },
  mdBenchChipName: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 16, color: tokens.color.deepGreen },
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
  mdInjuredChipName: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 16, color: tokens.color.injuryText },
  mdInjuredCrossBadge: {
    position: "absolute", top: -7, right: -5, width: 20, height: 20, borderRadius: "50%",
    background: tokens.color.injuryRed, border: `2px solid ${tokens.color.creamPaper}`,
    display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
  },
  // Same mdPopover shell as the cog/player-tap popovers, but with the
  // injury-red border and the flattened corner on the opposite side
  // (bottom-right, per the handoff's "28px 28px 10px 28px" — pointing
  // down at the bench chip it grew from, rather than up at a header
  // control) — a real, deliberate difference from those two, not an
  // inconsistency.
  mdBackPopover: {
    position: "fixed", left: 14, right: 14, zIndex: 46,
    background: tokens.color.creamPaper, borderRadius: "28px 28px 10px 28px",
    border: `3px solid ${tokens.color.injuryRed}`, boxShadow: tokens.shadow.overlay,
    padding: "14px 14px 12px", maxWidth: 640 - 28, margin: "0 auto",
  },
  mdBackPopoverHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  mdBackPopoverCrossBadge: {
    width: 40, height: 40, borderRadius: "50%", background: tokens.color.injuryRed, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  mdBackPopoverName: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 21, color: tokens.color.deepGreen },
  mdBackPopoverMeta: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.mutedText },
  mdBackPopoverBtnRow: { display: "flex", gap: 10 },
  mdBackPopoverBtnPrimary: {
    flex: 1, height: 52, borderRadius: 22, border: "none", background: tokens.color.pitchGreen,
    color: tokens.color.creamPaper, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19,
    boxShadow: tokens.shadow.solid(4, tokens.color.greenShadow), cursor: "pointer",
  },
  mdBackPopoverBtnSecondary: {
    flex: 1, height: 52, borderRadius: 22, border: "none", background: tokens.color.creamDeep,
    color: tokens.color.actionBar, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, cursor: "pointer",
  },

  // ---- Setup (A3/A4-Setup), SquadSettingsForm.jsx. A moderate restyle —
  // new tokens/shapes applied to the existing structure and interactions
  // (plain number inputs, not the design's dark tap-to-edit tiles with
  // inline +/-) rather than a full interaction rewrite, given how much of
  // this form's value is the validation/fairness logic underneath it,
  // not its chrome. Reuses several pitch-screen patterns directly
  // (mdPopoverRow's card shape for a squad row, mdBenchChip's number-disc
  // language for a player's number) rather than inventing parallel ones.
  mdSetupSectionLabel: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 15, color: tokens.color.mutedText,
    textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8, marginTop: 18,
  },
  mdSetupTile: { background: tokens.color.creamDeep, borderRadius: tokens.radius.rowLg, padding: "10px 12px", textAlign: "center" },
  mdSetupTileLabel: {
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 11, color: tokens.color.mutedText,
    textTransform: "uppercase", letterSpacing: 0.3, display: "block", marginBottom: 2, minHeight: 28,
  },
  mdSetupTileInput: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 24, color: tokens.color.deepGreen,
    background: "transparent", border: "none", textAlign: "center", width: "100%", padding: 0,
  },
  mdSetupHint: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.mutedText, marginTop: 6, lineHeight: 1.4 },
  mdSetupChipRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  mdSetupChip: {
    flex: "0 0 auto", padding: "8px 14px", borderRadius: tokens.radius.chip, border: "none",
    background: tokens.color.creamDeep, color: tokens.color.mutedText,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, cursor: "pointer",
  },
  mdSetupChipActive: { background: tokens.color.deepGreen, color: tokens.color.creamPaper },
  mdSetupChipFair: { color: tokens.color.pitchGreen },
  mdSetupAddRow: { display: "flex", gap: 8, marginBottom: 8 },
  mdSetupInput: {
    flex: 1, padding: "10px 14px", borderRadius: tokens.radius.chip, border: `1px solid ${tokens.color.rule}`,
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14, background: "#fff", color: tokens.color.deepGreen,
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
  mdSetupNumberBadge: {
    width: 32, height: 32, borderRadius: "50%", border: "none", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13,
    background: tokens.color.creamDeep, color: tokens.color.mutedText,
  },
  mdSetupNumberBadgeSet: { background: tokens.color.pitchGreen, color: "#fff" },
  mdSetupNumberInput: {
    width: 32, height: 32, borderRadius: "50%", border: `2px solid ${tokens.color.pitchGreen}`, flexShrink: 0,
    textAlign: "center", padding: 0, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13, color: tokens.color.deepGreen,
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
  mdSetupWarning: {
    marginTop: 14, fontSize: 13, fontFamily: tokens.font.body, fontWeight: 700, color: tokens.color.injuryText,
    background: tokens.color.injuryTint, border: `1px solid ${tokens.color.injuryBorder}`, padding: "10px 14px", borderRadius: 14,
  },
  mdSetupSubmitBtn: {
    display: "flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%", height: 60, marginTop: 20,
    borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.yellow, color: tokens.color.deepGreen,
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, cursor: "pointer",
    boxShadow: tokens.shadow.solid(5, tokens.color.yellowShadow),
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

  // ---- Match-day redesign (Direction A) — header + action bar. See the
  // `tokens` export above and the pitch/shirt/bench styles further up.
  mdHeader: { background: tokens.color.headerYellow, padding: "18px 20px 20px", borderRadius: "0 0 30px 30px", marginBottom: 12 },
  mdHeaderTopRow: { display: "flex", alignItems: "center", gap: 10 },
  mdCrestOuter: {
    width: 62, height: 62, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    border: "4px solid " + tokens.color.pitchGreen, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  mdCrestImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)" },
  mdTeamName: {
    flex: 1, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 21, color: tokens.color.deepGreen,
    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  mdCogBtn: {
    width: 38, height: 38, borderRadius: tokens.radius.iconButton, border: "none", background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
  },
  // The timer row: clock + the Start/Pause/Reset button group, centered as
  // one unit — real-device feedback asked for the clock and buttons to be
  // centre-aligned together, sized/placed so the buttons read as belonging
  // to the clock rather than floating separately.
  mdTimerRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 10 },
  mdTimerLeft: { display: "flex", alignItems: "baseline", gap: 8 },
  mdTimerBtnGroup: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  // Sized to match the timer digits' own visual weight (mdTimerDisplay is
  // 66px/0.95 line-height, so ~63px tall) rather than a small icon button —
  // this is meant to read as being exactly as important as the clock.
  mdTimerPrimaryBtn: {
    width: 62, height: 62, borderRadius: tokens.radius.iconButton, border: "none", background: tokens.color.yellow,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
    boxShadow: tokens.shadow.solid(4, tokens.color.yellowShadow),
  },
  // Reset stays secondary (plain white, smaller) — same visual hierarchy
  // as the cog button, just moved down to sit with the rest of the clock
  // controls instead of the crest/team-name row.
  mdTimerResetBtn: {
    width: 44, height: 44, borderRadius: tokens.radius.iconButton, border: "none", background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
  },
  mdTimerDisplay: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 66, lineHeight: 0.95, color: tokens.color.deepGreen,
    fontVariantNumeric: "tabular-nums",
  },
  // Paused greys the timer out — same digits, no longer counting, reads at
  // a glance as "not live right now" even before spotting the chip beside it.
  mdTimerDisplayPaused: { color: "rgba(28,58,46,.45)" },
  mdTimerCaption: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.goldText, whiteSpace: "nowrap",
  },
  // Shared shell for all four action-bar states (pre-kickoff, running,
  // paused, and the final-60 sheet reuses these same status/button styles
  // too) — only the label text and which buttons render change per state.
  // Pinned to the bottom of the viewport (thumb zone) rather than sitting
  // wherever it falls in document flow after the pitch/bench — real-device
  // feedback wanted it reachable without scrolling regardless of how far
  // down the page the coach happens to have scrolled. `main`'s own
  // pre-existing bottom padding (see the `main` style) already reserves
  // room below the page content for it, so MatchView.jsx doesn't need any
  // padding of its own.
  //
  // Split into an outer positioning shell + this inner visible card,
  // mirroring `main`'s own box model exactly (same maxWidth/margin/16px
  // horizontal padding) — a plain position:fixed;left:0;right:0 card would
  // span the full viewport edge-to-edge, wider than every other card on
  // the page (all of which sit inset inside `main`'s padding). The outer
  // shell carries the positioning/inset with a transparent background and
  // pointerEvents:none (so its side gutters don't swallow taps on
  // scrolled content behind them); this inner card carries the visible
  // background/radius/padding and pointerEvents:auto. All four corners
  // round now (not just the top) and it sits with a small gap off the
  // true bottom edge, reading as a floating card like the rest of the
  // screen rather than a flush edge-to-edge sheet.
  mdActionBarOuter: {
    position: "fixed", left: 0, right: 0, bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", zIndex: 10,
    maxWidth: 640, margin: "0 auto", padding: "0 16px", pointerEvents: "none",
  },
  mdActionBar: {
    background: tokens.color.actionBar, borderRadius: tokens.radius.card, padding: "14px 16px",
    pointerEvents: "auto", boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
  },
  mdActionBarStatusRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  mdActionBarCountdown: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 22, color: tokens.color.yellow },
  mdActionBarStatus: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.mutedOnDark },
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
  // Smaller than mdActionBarBtnPrimary, content-width rather than filling
  // the bar — used by the compact pre-kickoff/paused/running bars now that
  // the countdown sits right next to it in the same row instead of a full
  // row of its own above (real-device feedback: "make that Sub Button
  // smaller" + "put Next sub next to the sub done button").
  mdActionBarBtnCompact: {
    height: 48, padding: "0 22px", borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.yellow,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16,
    boxShadow: tokens.shadow.solid(4, tokens.color.yellowShadow),
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", flexShrink: 0,
    whiteSpace: "nowrap",
  },
  // Shared full-screen dim layer — final60, the cog menu, and the
  // player-tap popover are mutually exclusive (never shown two at once,
  // see MatchView.jsx), so one scrim style serves all three rather than
  // three near-identical copies.
  mdScrim: { position: "fixed", inset: 0, background: tokens.color.scrim, zIndex: 45 },

  // ---- Full-screen final-60 sheet (A2b-Match-final60). A genuinely modal
  // moment (dark scrim + a sheet that takes over as the primary confirm
  // surface) rather than another in-flow card, so — unlike the rest of
  // this screen so far — these two are position:fixed.
  mdFinal60Sheet: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 46,
    background: tokens.color.creamPaper, borderRadius: `${tokens.radius.actionBarTop}px ${tokens.radius.actionBarTop}px 0 0`,
    padding: "14px 16px calc(20px + env(safe-area-inset-bottom, 0px))",
    maxWidth: 640, margin: "0 auto",
  },
  mdFinal60Countdown: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.deepGreen },
  mdFinal60Status: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.mutedText },
  mdFinal60RowList: { display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" },
  mdFinal60Row: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 },
  mdFinal60Arrow: { color: tokens.color.pitchGreen, fontFamily: tokens.font.body, fontWeight: 800, fontSize: 18 },
  // Same pill-chip shape as the bench strip's own chips (mdBenchChip etc.)
  // but on tokens.color.creamDeep rather than white — the sheet itself is
  // already creamPaper, so a white chip would read almost the same as its
  // own background; creamDeep keeps them visibly distinct.
  mdFinal60Chip: {
    display: "flex", alignItems: "center", gap: 6, background: tokens.color.creamDeep, borderRadius: tokens.radius.chip,
    padding: "5px 12px 5px 5px",
  },
  // The outgoing half of a swap row gets a red number disc (leaving),
  // matching mdOutgoingBadge's color — the incoming half reuses
  // mdBenchChipNumber/mdBenchChipNumberGk directly (green, or gold for a
  // new keeper), same "arriving" language the bench strip already uses.
  mdFinal60ChipNumberOut: {
    width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13, flexShrink: 0,
    background: tokens.color.alertRed, color: "#fff",
  },

  // ---- Anchored popovers (A2d-Menu-anchored, A2g-Player-tap). Both grow
  // out of the control that opened them — position:fixed with `top`
  // computed from that control's own getBoundingClientRect() at the
  // moment it's tapped (see MatchView.jsx), one flattened corner (10px,
  // top-right) pointing back at it. Horizontal placement is simplified
  // from the design's own per-screen left/right values (14/14 for the
  // cog, 96/16 for a player tap, i.e. narrower and offset toward
  // wherever the tap happened) to one consistent full-width-within-
  // margins treatment for both — matching the same maxWidth:640-centered
  // pattern every other fixed surface on this screen already uses, rather
  // than reproducing the original 380px frame's exact offsets.
  mdPopover: {
    position: "fixed", left: 14, right: 14, zIndex: 46,
    background: tokens.color.creamPaper, borderRadius: "28px 10px 28px 28px",
    border: `3px solid ${tokens.color.yellow}`, boxShadow: tokens.shadow.overlay,
    padding: "10px 12px 12px", maxWidth: 640 - 28, margin: "0 auto",
    maxHeight: "calc(100vh - 24px)", overflowY: "auto",
  },
  mdPopoverGroup: { marginBottom: 6 },
  mdPopoverGroupHeader: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0 6px 6px" },
  mdPopoverGroupDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  mdPopoverGroupLabel: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.mutedText },
  mdPopoverGroupRule: { flex: 1, height: 1, background: tokens.color.rule },
  mdPopoverRow: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#fff", borderRadius: tokens.radius.rowSm,
    border: "none", padding: "3px 12px 3px 8px", marginBottom: 6, boxShadow: "0 3px 0 rgba(28,58,46,.10)",
    cursor: "pointer", textAlign: "left", font: "inherit",
  },
  mdPopoverRowIconTile: {
    width: 33, height: 33, borderRadius: tokens.radius.iconTile, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17,
  },
  mdPopoverRowLabel: { flex: 1, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, color: tokens.color.deepGreen },
  mdPopoverRowValue: {
    background: tokens.color.creamDeep, color: tokens.color.mutedText, fontFamily: tokens.font.body, fontWeight: 800,
    fontSize: 13, borderRadius: tokens.radius.chip, padding: "4px 10px", whiteSpace: "nowrap",
  },
  mdPopoverRowChevron: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 22, color: tokens.color.chevron, paddingLeft: 2 },
  // The four icon-tile tints reused across both popovers (README: "yellow
  // #FBE3A6, green #CBE8D6, neutral #F1E9D2, red #FAD3C8") — background
  // only, text/icon color is set per row alongside whichever of these is used.
  mdTintYellow: { background: tokens.color.headerYellow },
  mdTintGreen: { background: tokens.color.mint },
  mdTintNeutral: { background: tokens.color.creamDeep },
  mdTintRed: { background: tokens.color.injuryTint2 },
  mdPopoverFooter: {
    textAlign: "center", marginTop: 4, paddingTop: 10, borderTop: `1px solid ${tokens.color.rule}`,
    fontFamily: tokens.font.body, fontWeight: 800, color: tokens.color.mutedText, fontSize: 14,
  },
  mdPopoverFooterVersion: { fontSize: 12 },

  // Player-tap popover (A2g-Player-tap) — same mdPopover shell, different
  // interior: a name/meta header instead of grouped rows, and three (or
  // one, for an injured player) bigger action rows with a consequence
  // line under each label rather than a value chip.
  mdPlayerPopoverHeader: { padding: "0 4px 8px" },
  mdPlayerPopoverName: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 22, color: tokens.color.deepGreen },
  mdPlayerPopoverMeta: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: tokens.color.mutedText },
  mdPlayerPopoverRow: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#fff", borderRadius: tokens.radius.rowLg,
    border: "none", padding: "9px 12px 9px 9px", marginBottom: 8, cursor: "pointer", textAlign: "left", font: "inherit",
  },
  mdPlayerPopoverIconTile: {
    width: 36, height: 36, borderRadius: 14, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18,
  },
  mdPlayerPopoverRowLabel: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, color: tokens.color.deepGreen },
  mdPlayerPopoverRowConsequence: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.mutedText },

  // "Lit above the scrim" treatment for whichever control opened the
  // popover it's paired with — position:relative lets zIndex actually
  // apply (a static-position element ignores it), and the zIndex itself
  // just needs to clear mdScrim's 45.
  mdOriginLit: { position: "relative", zIndex: 47 },
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

  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(15,36,26,0.55)", display: "flex", alignItems: "center",
    justifyContent: "center", padding: 20, zIndex: 50,
  },
  modalCard: {
    background: colors.cardBg, borderRadius: 16, padding: 20, maxWidth: 480, width: "100%",
    maxHeight: "85vh", overflowY: "auto", boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
  },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: 900, color: colors.grass, textTransform: "uppercase", letterSpacing: 0.4 },
  modalCloseBtn: { background: colors.border, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", color: colors.ink },
  backupToggle: {
    display: "block", marginTop: 20, background: "transparent", border: "none", color: colors.field,
    fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline",
  },
  backupHint: { fontSize: 11, color: "#5B6B64", lineHeight: 1.4, margin: "0 0 6px 0" },
  backupBtn: {
    background: colors.grass, color: colors.chalk, border: "none", borderRadius: 8, padding: "7px 12px",
    fontWeight: 700, fontSize: 12, cursor: "pointer",
  },
  backupConfirmRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 },
  backupConfirmBtn: {
    background: colors.danger, color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px",
    fontWeight: 700, fontSize: 12, cursor: "pointer",
  },
  backupCancelBtn: {
    background: "transparent", color: colors.ink, border: "1px solid " + colors.border, borderRadius: 8,
    padding: "7px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer",
  },
  summaryTable: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 },
  summaryRow: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "9px 10px", background: colors.cardBg,
    border: "1px solid " + colors.border, borderRadius: 8, fontSize: 13,
  },
  summaryRow5: { gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" },
  summaryHeadRow: { background: "transparent", border: "none", fontWeight: 800, color: "#5B6B64", fontSize: 10, textTransform: "uppercase" },
  summaryName: { fontWeight: 700 },
  modalWarning: {
    marginTop: 14, fontSize: 12, color: colors.danger, background: "#FBEAE4", padding: "8px 12px", borderRadius: 8, fontWeight: 600,
  },
  saveErrorBanner: {
    background: colors.danger, color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "center",
    padding: "8px 16px", lineHeight: 1.4,
  },
};

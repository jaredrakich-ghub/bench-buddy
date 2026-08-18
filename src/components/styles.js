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
  app: { fontFamily: "system-ui, -apple-system, sans-serif", background: colors.chalk, minHeight: 500, color: colors.ink },
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
  numInput: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + colors.border, fontSize: 14 },
  primaryBtn: {
    display: "flex", alignItems: "center", gap: 6, justifyContent: "center", padding: "10px 16px", borderRadius: 10,
    border: "none", background: colors.grass, color: colors.chalk, fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  iconBtn: {
    border: "none", background: colors.border, borderRadius: 8, padding: 8, cursor: "pointer", color: colors.ink,
    display: "flex", alignItems: "center", justifyContent: "center", minWidth: 40, minHeight: 40,
  },
  emptyState: { color: "#7C8983", fontSize: 14, padding: "16px 0" },

  settingsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignItems: "start" },
  settingLabel: { display: "flex", flexDirection: "column", fontSize: 12, fontWeight: 700, color: "#5B6B64", textTransform: "uppercase", letterSpacing: 0.3 },
  settingLabelText: { minHeight: 28, display: "flex", alignItems: "flex-end", marginBottom: 4, lineHeight: 1.2 },
  intervalPreview: { fontSize: 12, color: colors.field, fontWeight: 700, marginTop: 8 },

  // The sub-interval fairness chips (SquadSettingsForm) — live, recomputed
  // against whoever's currently ticked "available", same visual family as
  // intervalTab/intervalTabActive (MatchView's interval nav) but with an
  // extra fair/unfair distinction baked into the resting (non-selected)
  // state, since that's the whole point of showing them.
  subIntervalHint: { fontSize: 12, color: "#5B6B64", marginTop: 10, marginBottom: 6, lineHeight: 1.4 },
  subIntervalChipRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  // borderWidth/borderStyle/borderColor kept as separate longhand properties
  // (not the border shorthand) specifically so fair/unfair/selected below
  // can each override just borderColor — mixing a shorthand base with a
  // longhand override is what React's "removing a style property during
  // rerender" warning is about, and it's not just noise: it can leave a
  // stale border color behind when this chip flips from one state to
  // another on the same element (which it does live, as availability changes).
  subIntervalChip: {
    flex: "0 0 auto", display: "flex", alignItems: "center", gap: 4, padding: "6px 11px", borderRadius: 999,
    borderWidth: 1, borderStyle: "solid", borderColor: colors.border, background: colors.cardBg,
    fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  subIntervalChipFair: { borderColor: colors.field, color: colors.field },
  subIntervalChipUnfair: { color: "#9AA6A0" },
  subIntervalChipSelected: { background: colors.grass, borderColor: colors.grass, color: colors.chalk },

  modeHint: { fontSize: 11, color: "#7C8983", marginTop: 6, lineHeight: 1.4 },

  subTitle: { fontSize: 15, fontWeight: 700, color: colors.ink, margin: 0 },
  subTitleRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 10, flexWrap: "wrap" },
  countBadge: { fontSize: 11, fontWeight: 700, color: colors.field, background: "#E9F5EE", padding: "2px 8px", borderRadius: 999 },
  selectAllBtn: {
    background: "transparent", color: colors.field, border: "1px solid " + colors.field, borderRadius: 999,
    padding: "3px 9px", fontWeight: 700, fontSize: 11, cursor: "pointer", marginLeft: "auto",
  },

  squadList: { display: "flex", flexDirection: "column", gap: 6 },
  squadRow: {
    display: "flex", alignItems: "center", gap: 10, background: colors.cardBg,
    border: "1px solid " + colors.border, borderRadius: 10, padding: "8px 10px",
  },
  squadName: { flex: 1, fontWeight: 600, fontSize: 14 },
  // borderWidth/borderStyle/borderColor as separate longhand properties
  // (not the border shorthand) so numberBadgeActive's borderColor override
  // applies cleanly across re-renders — see the comment on subIntervalChip
  // above for why mixing shorthand + longhand here isn't just a lint nit.
  numberBadge: {
    width: 38, height: 38, borderRadius: "50%", borderWidth: 1.5, borderStyle: "solid", borderColor: colors.border,
    background: "transparent", color: "#9AA6A0", fontWeight: 800, fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  numberBadgeActive: { background: colors.field, borderColor: colors.field, color: "#fff" },
  gloveToggle: {
    width: 38, height: 38, borderRadius: 8, border: "1px solid " + colors.border, background: "transparent",
    fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.35, flexShrink: 0,
  },
  gloveToggleActive: { opacity: 1, background: "#FFF6E4", borderColor: colors.gk },
  // The "start this player in goal today" toggle — deliberately its own
  // color (field green, matching numberBadgeActive's "you're active today"
  // meaning) rather than reusing gloveToggleActive's gold. It sits directly
  // next to the glove toggle in the same row, and gold means something
  // different there (keeper-eligible in general, not "starting today") — two
  // gold buttons side by side read as duplicates of the same state.
  // borderWidth/borderStyle/borderColor as separate longhand properties for
  // the same reason as subIntervalChip/numberBadge above.
  startGkToggle: {
    borderWidth: 1, borderStyle: "solid", borderColor: colors.border, background: colors.cardBg, color: "#9AA6A0",
    borderRadius: 8, padding: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    minWidth: 40, minHeight: 40,
  },
  startGkToggleActive: { background: colors.field, borderColor: colors.field, color: "#fff" },

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
  // Border kept as separate longhand properties (not the border shorthand)
  // specifically so intervalTabBreakStart below can override just
  // borderLeftColor/borderLeftWidth — same reasoning as subIntervalChip
  // above: mixing a shorthand base with a longhand override on the same
  // element is what React's "removing a style property during rerender"
  // warning is about, and it's not just noise here — breakBoundaries can
  // toggle a given tab in or out of this style across renders (settings
  // change, browsing a different game), which is exactly the "flips
  // between states live" case that bites.
  // Sub-window chip row — match-day redesign styling (pill shape, no
  // border; see tokens above). Active/inactive read purely from fill color
  // now rather than border + fill, since flat pills with no border
  // anywhere else in this row is the design's whole visual language here.
  intervalTab: {
    flex: "0 0 auto", padding: "8px 14px", borderRadius: tokens.radius.chip, border: "none",
    background: tokens.color.creamDeep, color: tokens.color.mutedText,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, cursor: "pointer",
    scrollSnapAlign: "start",
  },
  intervalTabActive: { background: tokens.color.deepGreen, color: tokens.color.creamPaper },
  // Purely visual grouping for a half-time/third-time/quarter-time break
  // (see computeBreakBoundaries, rotation.js) — just extra gap now (no
  // accent border) since the redesign's pills don't use borders anywhere
  // else in this row; the gap alone still reads as "a new section starts
  // here".
  intervalTabBreakStart: { marginLeft: 12 },

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
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11, padding: "1px 6px", borderRadius: tokens.radius.chip,
    pointerEvents: "none",
  },
  mdShirtPlayerName: { color: "#fff", fontFamily: tokens.font.body, fontSize: 12, fontWeight: 800, textAlign: "center" },
  // The one badge shape the design spells out explicitly (a pill, not a
  // circle) — everyone leaving the pitch next interval, regardless of
  // whether it's a regular sub or a keeper stepping down.
  mdOutgoingBadge: {
    position: "absolute", top: 0, right: -2, width: 26, height: 22, borderRadius: tokens.radius.chip,
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
    width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13, flexShrink: 0,
    background: tokens.color.pitchGreen, color: "#fff",
  },
  // A keeper-eligible bench player's number disc flips to gold — matches
  // the on-pitch keeper's gold shirt, so "this player can go in goal"
  // reads the same color wherever they're shown.
  mdBenchChipNumberGk: { background: tokens.color.yellow, color: tokens.color.deepGreen },
  mdBenchChipName: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.deepGreen },
  mdBenchChipUpArrow: { color: tokens.color.pitchGreen, display: "flex", alignItems: "center" },
  mdBenchEmpty: { color: tokens.color.mutedText, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13 },
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
  // The tap-to-open action menu shared by every token (pitch, bench,
  // injured) — replaces the old always-visible per-token side buttons.
  // Lives inside actionSheet, which already supplies the card chrome.
  tokenActionMenuHeader: { fontSize: 11, fontWeight: 700, color: colors.bench, padding: "2px 4px 7px" },
  tokenActionMenuItem: {
    display: "flex", alignItems: "center", gap: 8, padding: "10px 4px", borderRadius: 8,
    border: "none", background: "none", width: "100%", textAlign: "left", cursor: "pointer",
    fontSize: 13, fontWeight: 700, color: colors.ink, font: "inherit",
  },
  tokenActionMenuItemDanger: { color: colors.danger },

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
  mdTimerRow: { display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 },
  mdTimerDisplay: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 66, lineHeight: 0.95, color: tokens.color.deepGreen,
    fontVariantNumeric: "tabular-nums",
  },
  mdTimerCaption: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.goldText },
  mdBlockBar: { display: "flex", gap: 5, marginTop: 10 },
  mdBlockSegment: { flex: 1, height: 9, borderRadius: tokens.radius.chip, background: "rgba(28,58,46,.15)" },
  mdBlockSegmentElapsed: { background: tokens.color.deepGreen },
  // Base ("running") state — see the comment in MatchView.jsx on why the
  // pre-kickoff/paused variants of this same bar aren't built yet.
  mdActionBar: { background: tokens.color.actionBar, borderRadius: tokens.radius.actionBarTop, padding: "14px 16px", marginTop: tokens.spacing.rhythm },
  mdActionBarStatusRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  mdActionBarCountdown: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 24, color: tokens.color.yellow },
  mdActionBarStatus: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.mutedOnDark },
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

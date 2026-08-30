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
    // Not in the README's own central "Design Tokens" list, but each
    // appears in more than one of the shared non-match screens (A7/A8,
    // A8/A9 respectively) — named here rather than left as scattered
    // literals, same as everything else in this object.
    disabledBorder: "#DCD3BB", // A7's "not here" disc/text base, A8's dashed "Add a team" border
    groupLabel: "#3E5148", // group-header label color on the shared sub-header screens (A8, and A6/A7/A5-Minutes when built)
    benchText: "#8C8677", // A5-Minutes' BENCH column, also A7's "not here" text
    unavailableText: "#A39C8A", // A7-Squad-change's "not here" status line
    placeholderText: "#A8B3AC", // block 16's email field placeholder, and block 6's before it
    // Block 11 (the two-sheet final-60 rebuild) — the only two genuinely
    // new colours it introduces; everything else it uses (creamPaper,
    // creamDeep, yellow/yellowShadow, pitchGreen, deepGreen, alertRed,
    // groupLabel, scrim) already existed and is reused as-is, per the
    // brief's own "do not re-point any shared hex."
    changing: "#2F6475", // the execute sheet's third disc colour — a player already on the pitch just changing position, staying on (never "leaving" red or "arriving" green)
    sheetLabel: "#5A6B61", // the small uppercase corner label on both sheets ("GET READY", "30 secs to go") — close to but distinct from mutedText
    // A5-Minutes' em-dash-for-zero is #C9C4B6 — same value as `chevron`
    // above, so reuse that token directly rather than duplicating it here.
    // Block 15 — cancelling a change (execute sheet). injuryTint/
    // injuryBorder (#FBEDE9/#E8A899) are reused as-is for the cancel
    // buttons' own tint — same caution set, no duplicate. #B4462E (the
    // cancel buttons' own text colour) is genuinely new to this app's own
    // token set despite the design calling it "already existing" — that's
    // true of the design's own broader system, not this file, so it's
    // added here rather than reusing the close-but-not-equal injuryRed/
    // injuryText.
    moreGlyph: "#8A9A90", // the resting "more" (⋯) control's glyph
    cancelledNumeral: "#B3BBB4", // a cancelled step's own numeral
    cancelledTitle: "#96A29A", // a cancelled step's struck-through title
    cancelledCaption: "#7E8C83", // a cancelled step's "Cancelled · ..." caption
    undoPillBg: "#E2EEE4", // the Undo pill's background
    cancelText: "#B4462E", // "Cancel this change"/"Cancel the sub" button text
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

// README > Design Tokens > Texture: "Cream surfaces carry a tiled football
// pattern: 170x170 tile, two balls (r 19 and r 12) drawn as a
// rgba(28,58,46,.06) disc with cream pentagon patches. Subtle — it must
// never compete with text." Never actually applied anywhere in this
// redesign until now — copied verbatim as a data-URI from the reference
// file's own `--paper` CSS custom property (Bench Buddy Direction A.dc.html)
// rather than re-encoded by hand, to guarantee pixel-identical output.
// Applied as backgroundImage alongside `background: tokens.color.creamPaper`
// on actual page/sheet surfaces (the app root, full-screen takeovers,
// sign-in, the final60 sheet, anchored popovers) — not on small elements
// that merely use creamPaper as an accent color (e.g. a stepper button),
// where a 170px tile would be meaningless.
export const paperTexture =
  "url(data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27170%27%20height%3D%27170%27%3E%3Ccircle%20cx%3D%2738%27%20cy%3D%2736%27%20r%3D%2719%27%20fill%3D%27%231C3A2E%27%20fill-opacity%3D%27.06%27%2F%3E%3Cpath%20d%3D%27M38.0%2029.2L44.5%2033.9L42.0%2041.5L34.0%2041.5L31.5%2033.9ZM42.0%2030.5L40.2%2024.9L44.9%2021.5L49.6%2024.9L47.8%2030.5ZM44.5%2038.1L49.2%2034.7L53.9%2038.1L52.1%2043.6L46.3%2043.6ZM38.0%2042.8L42.7%2046.3L40.9%2051.8L35.1%2051.8L33.3%2046.3ZM31.5%2038.1L29.7%2043.6L23.9%2043.6L22.1%2038.1L26.8%2034.7ZM34.0%2030.5L28.2%2030.5L26.4%2024.9L31.1%2021.5L35.8%2024.9Z%27%20fill%3D%27%23FFF6E5%27%2F%3E%3Ccircle%20cx%3D%27120%27%20cy%3D%27116%27%20r%3D%2712%27%20fill%3D%27%231C3A2E%27%20fill-opacity%3D%27.06%27%2F%3E%3Cpath%20d%3D%27M120.0%20111.7L124.1%20114.7L122.5%20119.5L117.5%20119.5L115.9%20114.7ZM122.5%20112.5L121.4%20109.0L124.4%20106.9L127.3%20109.0L126.2%20112.5ZM124.1%20117.3L127.1%20115.2L130.0%20117.3L128.9%20120.8L125.2%20120.8ZM120.0%20120.3L123.0%20122.5L121.8%20126.0L118.2%20126.0L117.0%20122.5ZM115.9%20117.3L114.8%20120.8L111.1%20120.8L110.0%20117.3L112.9%20115.2ZM117.5%20112.5L113.8%20112.5L112.7%20109.0L115.6%20106.9L118.6%20109.0Z%27%20fill%3D%27%23FFF6E5%27%2F%3E%3C%2Fsvg%3E)";

export const styles = {
  // background was the old pre-redesign colors.chalk (pale grey) — the
  // match-day redesign's cards (bench strip, action bar, popovers) are all
  // designed against the warm "cream paper" page background instead, so
  // that stale chalk was showing through the header's rounded corners and
  // the gaps between cards, reading as a missing/unstyled background.
  app: {
    fontFamily: "system-ui, -apple-system, sans-serif", background: tokens.color.creamPaper,
    backgroundImage: paperTexture, minHeight: 500, color: colors.ink,
  },
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
  // paddingBottom gives the last element on any screen using `main` some
  // clearance from a mobile browser's own docked toolbar (back/forward/
  // tabs), which isn't reserved space the page knows about on its own —
  // without this, whatever ends up last (MatchView's action bar, Setup's
  // submit button) would sit flush against that chrome. Used to carry a
  // much bigger 130px reservation specifically for MatchView's action bar,
  // back when that bar was position:fixed and needed real document space
  // saved for it in advance; now that the bar is a normal-flow element
  // (block 8, part B) that reserves its own space simply by existing, this
  // is back to a flat, generous-but-modest value, matching the same 24px
  // the non-match full-screen takeovers already use for their own bottom
  // clearance (mdFullScreenTakeoverInner) — plus whatever margin the
  // screen's own last element already carries below it (e.g. the action
  // bar's own 16px).
  main: { padding: "12px 16px", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))", maxWidth: 640, margin: "0 auto" },
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
  // Absolutely positioned over the shirt SVG (see matchDayIcons.jsx) — top
  // offset and font size are both computed inline from the shirt's actual
  // rendered size (24/58 and 24/62 of the design's own 62x58 reference
  // shirt), so the number stays correctly placed as the shirt scales down
  // for busier games (see computeTokenSize, formation.js).
  mdShirtNumber: {
    position: "absolute", left: "50%", transform: "translateX(-50%)",
    fontFamily: tokens.font.display, fontWeight: 800, color: tokens.color.deepGreen, pointerEvents: "none",
    // line-height:1 matters here — without it, the browser's default
    // line-height for Baloo 2 pads well below the glyph, and since `top`
    // (set inline, MatchView.jsx) positions this box not the glyph itself,
    // the number renders noticeably lower on the shirt than the reference
    // HTML's own "top:24px; ...; line-height:1" at the same 62x58 size.
    lineHeight: 1,
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

  // ---- The app's shared "caution" confirm sheet — a lighter-weight,
  // amber-bordered cousin of mdSheet (below) for "here's what's about to
  // happen, confirm or back out" moments, as opposed to mdSheet's own job
  // (a menu of actions to pick from). Originally built for the edit
  // layout's own "rebuild the rotation" confirm sheet — real-use feedback:
  // the old red "This will restart the rotation from 0:00 and clear this
  // game's progress so far" banner warned on *every* visit (even ones with
  // nothing to lose) and was actually wrong — minutes already played are
  // never cleared. Replaced with a check at submit time: no game in
  // progress builds immediately, a game in progress opens this sheet
  // instead. Reused as-is (different copy, same shell) by MatchView's own
  // hidden reset gesture — genuinely the same shape of moment, not a
  // coincidence worth two near-duplicate style blocks over.
  //
  // This originally shipped as position:absolute with a locally-scoped
  // low z-index (5/6), reasoning it only needed to cover this screen's own
  // content rather than the whole app. Real-device feedback: "completely
  // off screen". The reasoning was wrong the same way mdSheet's own
  // comment above already warns about — bottom:0 on an absolutely
  // positioned sheet anchors to the bottom of its nearest positioned
  // ancestor (the edit layout's own position:relative wrapper), and that
  // wrapper's real height on a full roster/settings page runs well past
  // one viewport, not the minHeight:100vh floor it was sized against here.
  // So "bottom" landed at the bottom of a long, scrolled-away page, not
  // the bottom of what was actually on screen. Switched to position:fixed
  // (viewport-anchored, exactly mdSheet's own pattern) so it always
  // appears at the bottom of the visible screen regardless of scroll
  // position or content length. Because fixed positioning escapes the
  // takeover screen's own stacking context, the z-index has to clear
  // mdFullScreenTakeoverOuter's own 50 (this sheet lives inside that
  // takeover) rather than the old locally-scoped 5/6.
  mdCautionSheetScrim: { position: "fixed", inset: 0, background: tokens.color.scrim, zIndex: 51 },
  mdCautionSheet: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 52,
    maxWidth: 640, margin: "0 auto",
    background: tokens.color.creamPaper, borderRadius: "32px 32px 0 0",
    boxShadow: "0 -16px 44px rgba(20,32,28,.42)", borderTop: `3px solid ${tokens.color.yellow}`,
    padding: "12px 16px 22px", display: "flex", flexDirection: "column", gap: 12,
    maxHeight: "calc(100vh - 24px)", overflowY: "auto",
  },
  // Amber, not red — this is caution ("here's what's about to happen"),
  // not the app's injury-red, which stays reserved for actual injuries.
  mdCautionSheetIconBadge: {
    width: 40, height: 40, borderRadius: "50%", background: tokens.color.yellow, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  mdCautionSheetHeaderRow: { display: "flex", alignItems: "center", gap: 11, padding: "0 4px" },
  mdCautionSheetTitle: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 23, color: tokens.color.deepGreen, lineHeight: 1.1 },
  mdCautionSheetBody: {
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14.5, color: tokens.color.groupLabel, lineHeight: 1.45, padding: "0 4px",
  },
  mdCautionSheetBtnRow: { display: "flex", gap: 10 },
  // display:flex/alignItems/justifyContent on both — without it, a
  // block-level button's own content can push its rendered height past
  // the explicit height:60 (real-device feedback: "Keep current" and
  // "Build Rotation" weren't the same height — this is what actually
  // enforces it as a strict, centered box regardless of label length,
  // rather than height:60 being more of a suggestion).
  mdCautionSheetBtnPrimary: {
    display: "flex", alignItems: "center", justifyContent: "center",
    flex: 1.3, height: 60, borderRadius: 22, border: "none", background: tokens.color.pitchGreen,
    boxShadow: `0 4px 0 ${tokens.color.greenShadow}`, color: tokens.color.creamPaper, fontFamily: tokens.font.display, fontWeight: 800,
    fontSize: 20, cursor: "pointer",
  },
  // flex 1.3/1.05, not 1.35/1 — real-device feedback asked for a few
  // pixels handed from the green button over to this one.
  mdCautionSheetBtnSecondary: {
    display: "flex", alignItems: "center", justifyContent: "center",
    flex: 1.05, height: 60, borderRadius: 22, border: "none", background: tokens.color.creamDeep,
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
  mdCrestOuter: {
    width: 62, height: 62, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    border: "4px solid " + tokens.color.pitchGreen, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  mdCrestImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)" },
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

  // ---- Block 11 — the final-60 takeover, replaced with two sheets that
  // appear at different times (PREPARE at -60s, EXECUTE at -30s) rather
  // than one. Real-device feedback, two rounds: a true in-document-flow
  // version (this style's own first draft) pushed the whole page taller
  // than one screen, landing the sheet below the fold. Switching to
  // `position:fixed; bottom:0` (mdSheet's own proven mechanism elsewhere
  // in this file) fixed that but *still* rendered partly behind Safari's
  // own collapsing toolbar on a real phone — a well-known class of iOS
  // bug where `bottom:0` on a fixed element is measured against the
  // larger "layout" viewport (ignoring the toolbar) rather than the
  // currently-visible "visual" one. mdFinal60Overlay (below, wraps the
  // scrim + whichever sheet is showing) sidesteps that ambiguity
  // entirely: `height:100dvh` is a direct, guaranteed-live reference to
  // the real visible viewport, and flexbox's own `justify-content:
  // flex-end` is what actually pins the sheet to its bottom — no
  // `bottom:0` anywhere in this mechanism at all. Same idea as the
  // earlier "Build new rotation button" fix (SquadSettingsForm.jsx),
  // just via a fixed overlay instead of an in-flow column.
  mdFinal60Overlay: {
    position: "fixed", inset: 0, height: "100dvh", zIndex: 46,
    display: "flex", flexDirection: "column", justifyContent: "flex-end",
  },
  mdFinal60Shell: {
    maxWidth: 640, margin: "0 auto", width: "100%",
    background: tokens.color.creamPaper, borderRadius: "32px 32px 0 0",
    // Real-use feedback ("feels cramped"): top padding 12->16 and the
    // column's own gap 10->12 — this sheet is a fixed full-viewport
    // overlay (see ExecuteSheet's own comment, MatchView.jsx), not
    // squeezed against anything else, so there's real headroom to spend
    // on this rather than matching the reference spec's own tighter
    // values exactly.
    padding: "16px 16px calc(14px + env(safe-area-inset-bottom, 0px)) 24px", // wider left padding, per spec
    display: "flex", flexDirection: "column", gap: 12,
    boxShadow: "0 -12px 40px rgba(20,32,28,.35)",
    maxHeight: "calc(100dvh - 24px)", overflowY: "auto",
  },
  mdFinal60Handle: { width: 44, height: 5, borderRadius: 3, background: "#DCD2B6", margin: "2px auto 4px", flexShrink: 0 },
  // Shared by both sheets' own title row (title baseline-aligned against
  // a small uppercase corner label) — only the title's own font-size
  // differs between the two (25px prepare / 24px execute), set per call
  // site rather than baked in here.
  mdFinal60TitleRow: { display: "flex", alignItems: "baseline", gap: 9 },
  // Real-use feedback: pinned to the row's far-right edge read as
  // strangely off-balance. mdFinal60LabelWrap takes up whatever's left
  // after the title's own natural width and centers the label *within
  // that* — not glued to the edge, but not centered against the whole
  // row either, which would risk it colliding with a longer title
  // ("Make the changes") on a narrow phone. minWidth:0 is what lets this
  // flex item actually shrink down to the space really available instead
  // of forcing the row wider than the sheet itself.
  mdFinal60LabelWrap: { flex: 1, minWidth: 0, display: "flex", justifyContent: "center" },
  mdFinal60Label: {
    fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: tokens.color.sheetLabel, letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
  // The GK pill both sheets use — the prepare sheet's emphasised keeper
  // card (inline after the name) and the execute sheet's arriving-keeper
  // chip (right-aligned inside it via marginLeft:auto at the call site).
  mdFinal60GkPill: {
    fontSize: 11, fontWeight: 800, color: tokens.color.deepGreen, background: tokens.color.yellow,
    borderRadius: 999, padding: "2px 7px", flexShrink: 0,
  },
  // Shared action row/buttons — Pause (secondary) and Ready/Sub done
  // (primary) are the same geometry on both sheets.
  mdFinal60ActionRow: { display: "flex", gap: 10 },
  mdFinal60ActionPause: {
    flex: 1, height: 54, borderRadius: 22, border: "none", background: tokens.color.rule,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
  },
  mdFinal60ActionPrimary: {
    flex: 1.25, height: 54, borderRadius: 22, border: "none", background: tokens.color.yellow,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20,
    boxShadow: tokens.shadow.solid(5, tokens.color.yellowShadow),
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
  },

  // ---- PREPARE sheet only (-60s to -30s) ----
  mdPrepareTitle: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 25, color: tokens.color.deepGreen, lineHeight: 1.05 },
  // The one emphasised card, always the incoming keeper.
  mdPrepareCardKeeper: {
    display: "flex", alignItems: "center", gap: 11,
    background: "#FFE9B8", border: `2.5px solid ${tokens.color.yellow}`, borderRadius: 22, padding: "13px 14px",
  },
  mdPrepareDiscKeeper: {
    width: 42, height: 42, borderRadius: "50%", flexShrink: 0, background: tokens.color.pitchGreen, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19,
  },
  mdPrepareCardKeeperBody: { display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 },
  mdPrepareCardKeeperNameRow: { display: "flex", alignItems: "center", gap: 6 },
  mdPrepareCardKeeperName: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 22, color: tokens.color.deepGreen },
  mdPrepareCardKeeperInstruction: { fontWeight: 800, fontSize: 17, color: tokens.color.deepGreen, lineHeight: 1.15 },
  // Every other card — quiet form, instruction inline after the name
  // rather than on its own line below.
  mdPrepareCardQuiet: {
    display: "flex", alignItems: "center", gap: 10, background: tokens.color.creamDeep, borderRadius: 20, padding: "11px 14px",
  },
  mdPrepareDiscQuiet: {
    width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: tokens.color.pitchGreen, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16,
  },
  mdPrepareCardQuietBody: { display: "flex", alignItems: "baseline", gap: 6, flex: 1, minWidth: 0 },
  mdPrepareCardQuietName: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, color: tokens.color.deepGreen },
  mdPrepareCardQuietInstruction: { fontWeight: 800, fontSize: 15, color: tokens.color.groupLabel },

  // ---- EXECUTE sheet only (-30s onward, stays up past the boundary) ----
  mdExecuteTitle: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 24, color: tokens.color.deepGreen },
  // Real-use feedback ("feels cramped"): gap 10->14 between steps, and
  // mdExecuteStepBody's own gap 6->8 below, give the list more breathing
  // room than the reference spec's own literal values. Deliberate, not a
  // fidelity slip — confirmed there's no actual space constraint forcing
  // the tighter numbers (this sheet is a fixed full-viewport overlay, see
  // ExecuteSheet's own comment in MatchView.jsx), so real feedback about
  // how it reads wins over matching the mockup's own density exactly.
  mdExecuteStepList: { display: "flex", flexDirection: "column", gap: 14 },
  mdExecuteStepRow: { display: "flex", gap: 10, alignItems: "flex-start" },
  // The -3.5px margin-top is deliberate, not a rounding fudge — see
  // MatchView.jsx's own comment at the call site for the exact cap-height
  // reasoning (26px numeral against a 16px instruction line). Only the
  // open/cancelled numeral needs it — the collapsed row centers its items
  // instead of top-aligning them (mdExecuteStepCollapsedNumeral, below).
  mdExecuteStepNumeral: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.groupLabel,
    lineHeight: 1, width: 26, textAlign: "left", marginTop: -3.5, flexShrink: 0,
  },
  mdExecuteStepBody: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 },
  mdExecuteStepInstruction: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.groupLabel, lineHeight: 1 },
  mdExecuteChipRow: { display: "flex", alignItems: "center", gap: 8 },
  mdExecuteChip: {
    flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8,
    background: tokens.color.creamDeep, borderRadius: 999, padding: "5px 12px 5px 4px",
  },
  // Disc background colour is set per instance (leaving/arriving/changing
  // — see FINAL60_DISC_COLOR, MatchView.jsx), never fixed here — that's
  // the whole "three colours, three meanings" point of this sheet.
  mdExecuteChipDisc: {
    width: 26, height: 26, borderRadius: "50%", flexShrink: 0, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13,
  },
  mdExecuteChipName: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.deepGreen,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
  },
  mdExecuteChipArrow: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 17, color: tokens.color.pitchGreen, flexShrink: 0 },
  // Real-use feedback: "what if a kid who's about to be subbed on doesn't
  // want to go back on?" — the incoming chip is a real button (same shape
  // as mdExecuteChip, plus the resets a bare <span> never needed) so
  // tapping the player themselves opens the same step panel the row's own
  // "⋯" does (mdExecuteStepMore) — one, unambiguous place for the one
  // thing that can happen to this sub: cancel it. An earlier round had
  // this chip open its own separate "redirect to a specific other bench
  // player" picker; further real-use feedback was that two different
  // sets of options behind one tap read as confusing, so that picker (and
  // its own swap-icon affordance on the chip) is gone — matches the
  // design spec's own chips too, which were never independently
  // interactive.
  mdExecuteChipOpenBtn: {
    flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8,
    background: tokens.color.creamDeep, borderRadius: 999, padding: "5px 12px 5px 4px",
    border: "none", cursor: "pointer", font: "inherit", textAlign: "left",
  },

  // ---- Block 15 — cancelling a change (execute sheet). A player can
  // refuse to come on; the coach calls off that one step without
  // touching the rest. Temporary only — taking someone out for the rest
  // of the game is the existing injured-player flow, not this one.
  // Scoped to the same steps mdExecuteChipOpenBtn already targets (a
  // genuine bench arrival, inColor "arriving") — a same-pitch position
  // change (the stepping-down keeper taking an outfield spot) has no
  // clean "swap back" undo the way an arrival does — their own role is
  // entangled with a *different* step (the keeper handover itself) — so
  // it keeps its plain, always-expanded, non-cancellable display. The
  // reference mockup's own geometry section shows a "⋯" on every step
  // including this one; deliberately narrower here since the worked
  // example never actually demonstrates cancelling a same-pitch change,
  // and the spec's own prose only ever talks about refusing to come *on*.
  mdExecuteStepMore: {
    width: 28, height: 24, borderRadius: 9, flexShrink: 0, border: "none", cursor: "pointer", font: "inherit",
    background: tokens.color.creamDeep, color: tokens.color.moreGlyph,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 15,
  },
  mdExecuteStepMoreActive: { background: tokens.color.deepGreen, color: tokens.color.creamPaper },
  // The tappable "open this step" target — title + the more control
  // together, a real button (not the whole row: the incoming chip below
  // is its own independent button that opens this same panel, and a
  // button can't nest inside another button).
  mdExecuteStepOpenBtn: {
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    border: "none", background: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left",
  },
  // A step collapses to this compact form while a *different* step is
  // open — opacity .72 (numeral included, matching the reference markup
  // exactly — it used to sit outside this wrapper and stay full-strength
  // while only the text faded), players folded into one truncating
  // plain-text line instead of full chips. Purely a focus/declutter
  // choice, the same one the reference mockup itself makes (screens
  // 21-23) — not a hard space constraint: this sheet is a fixed, full-
  // viewport overlay (see ExecuteSheet's own comment, MatchView.jsx), so
  // its height has nothing to do with the pitch's.
  mdExecuteStepCollapsedRow: { display: "flex", alignItems: "center", gap: 10, opacity: 0.72 },
  // No cap-height fudge (unlike mdExecuteStepNumeral) — this row centers
  // its items instead of top-aligning them, so it doesn't need one.
  mdExecuteStepCollapsedNumeral: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.groupLabel,
    lineHeight: 1, width: 26, textAlign: "left", flexShrink: 0,
  },
  mdExecuteStepCollapsedBody: { flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden" },
  mdExecuteStepCollapsedTitle: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.groupLabel, flexShrink: 0 },
  mdExecuteStepCollapsedPlayers: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.mutedText,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
  },
  // The open step's own action strip. No margin of its own — it's already
  // nested inside mdExecuteStepBody, the same flex column the title and
  // chip row sit in, so it lines up with them (and stretches to the same
  // left edge as the outgoing player's own chip) for free. An earlier
  // draft added a redundant marginLeft:36 here on top of that — left over
  // from when this row was a sibling of the numeral rather than nested
  // inside the body — which double-indented it past where the row above
  // it actually starts; real-use feedback caught it. Button height
  // 46->50 (real-use feedback, "feels cramped") — the reference spec's
  // own 46px is a bit tight for a two-line-tall thumb target.
  mdExecuteStepActionRow: { display: "flex", gap: 8 },
  mdExecuteCancelBtn: {
    flex: 1, height: 50, borderRadius: 18, background: tokens.color.injuryTint, border: `2px solid ${tokens.color.injuryBorder}`,
    color: tokens.color.cancelText, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
  },
  mdExecuteCloseBtn: {
    flexShrink: 0, padding: "0 18px", height: 50, borderRadius: 18, background: tokens.color.creamDeep, border: "none",
    color: tokens.color.groupLabel, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, cursor: "pointer",
  },
  // A cancelled step keeps its place and its number — never removed,
  // never renumbered, nothing may shift under the coach's thumb
  // mid-sequence. Same numeral/body layout as a live step, just its own
  // muted colours and no chips.
  mdExecuteStepCancelledNumeral: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.cancelledNumeral,
    lineHeight: 1, width: 26, textAlign: "left", marginTop: -3.5, flexShrink: 0,
  },
  mdExecuteCancelledTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  mdExecuteCancelledTitle: {
    flex: 1, minWidth: 0, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.cancelledTitle,
    textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  // font-family/weight/size matches mdExecuteCancelBtn exactly, per
  // real-use feedback that it read as not-bold — it was: the trailing
  // `font: "inherit"` shorthand (meant only as a button reset, dropped
  // here since every font property is already set explicitly) was
  // clobbering fontFamily/fontWeight/fontSize the moment React applied
  // it, since a `font` shorthand resets all of those at once and this
  // object set it *after* them.
  mdExecuteUndoPill: {
    flexShrink: 0, padding: "3px 13px", borderRadius: 999, background: tokens.color.undoPillBg,
    color: tokens.color.pitchGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16,
    border: "none", cursor: "pointer",
  },
  mdExecuteCancelledCaption: {
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13, color: tokens.color.cancelledCaption,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },

  // ---- The cancel confirmation dialog — centred over the whole screen,
  // above even the execute sheet itself (mdFinal60Overlay's own zIndex
  // 46) since it has to interrupt that sheet, not sit inside it. The one
  // centred-card dialog in this app; everything else here is a bottom
  // sheet or an anchored popover.
  mdCancelDialogScrim: { position: "fixed", inset: 0, background: tokens.color.scrim, zIndex: 48 },
  mdCancelDialogCard: {
    position: "fixed", left: 20, right: 20, top: "50%", transform: "translateY(-50%)", zIndex: 49,
    maxWidth: 640 - 40, margin: "0 auto",
    background: tokens.color.creamPaper, borderRadius: 30,
    // Real-use feedback ("feels cramped"): a bit more padding/gap than
    // the reference spec's own 20/18/16 + 14 — nothing here is fighting
    // for space either (a centered dialog over a dimmed screen), so the
    // extra room is free to give.
    padding: "24px 20px 20px",
    display: "flex", flexDirection: "column", gap: 16,
    boxShadow: "0 20px 50px rgba(20,32,28,.4)",
  },
  mdCancelDialogTitle: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.deepGreen, lineHeight: 1.05 },
  mdCancelDialogBody: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 15, color: tokens.color.groupLabel, lineHeight: 1.4 },
  mdCancelDialogCancelBtn: {
    height: 50, borderRadius: 20, background: tokens.color.injuryTint, border: `2px solid ${tokens.color.injuryBorder}`,
    color: tokens.color.cancelText, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, cursor: "pointer",
  },
  mdCancelDialogKeepBtn: {
    height: 52, borderRadius: 20, background: tokens.color.yellow, boxShadow: tokens.shadow.solid(5, tokens.color.yellowShadow),
    border: "none", color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 19, cursor: "pointer",
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
    position: "fixed", left: 14, right: 14, zIndex: 47,
    background: tokens.color.creamPaper, backgroundImage: paperTexture, borderRadius: "28px 10px 28px 28px",
    border: `3px solid ${tokens.color.yellow}`, boxShadow: tokens.shadow.overlay,
    padding: "10px 12px 12px", maxWidth: 640 - 28, margin: "0 auto",
    maxHeight: "calc(100vh - 24px)", overflowY: "auto",
  },
  mdPopoverGroup: { marginBottom: 6 },
  mdPopoverGroupHeader: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0 6px 6px" },
  mdPopoverGroupDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  mdPopoverGroupLabel: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.mutedText },
  mdPopoverGroupRule: { flex: 1, height: 1, background: tokens.color.rule },
  // Real-use feedback: these rows read as "too thin" next to Game
  // settings' own accordion rows — padding and icon tile size now match
  // mdSetupAccordionRow/mdSetupRowIconTile exactly, so the two screens'
  // rows land the same height.
  mdPopoverRow: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#fff", borderRadius: tokens.radius.rowSm,
    border: "none", padding: "13px 15px", marginBottom: 6, boxShadow: "0 3px 0 rgba(28,58,46,.10)",
    cursor: "pointer", textAlign: "left", font: "inherit",
  },
  // Real-use feedback (TeamAccountScreen.jsx's "Signed in"/"Playing as a
  // guest" rows): tapping one of these did nothing, since they're purely
  // informational — but they shared mdPopoverRow's own raised-card
  // shadow and pointer cursor, the exact same look every genuinely
  // tappable row on this screen uses, so tapping one felt like a broken
  // button rather than "there's nothing to tap here." Same shape/padding,
  // no shadow, no pointer cursor — reads as a plain info card instead.
  mdPopoverRowStatic: {
    display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#fff", borderRadius: tokens.radius.rowSm,
    padding: "13px 15px", marginBottom: 6, cursor: "default",
  },
  mdPopoverRowIconTile: {
    width: 44, height: 44, borderRadius: 16, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17,
  },
  // Conversion nudge, moved here from two ambient badges (the cog button
  // itself, and the Team & account cog-menu row — both MatchView.jsx) that
  // real-use feedback found read as "too much before we've shown value."
  // This is now the only place any dot shows — TeamAccountScreen.jsx's own
  // Save Season Data row, on its icon tile, only ever seen once a coach
  // has already chosen to navigate in here. Yellow, not literally red —
  // red is reserved for injury everywhere else in this app
  // (SquadSettingsForm.jsx has the same rule stated explicitly).
  mdTeamAcctActionDot: {
    position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: "50%",
    background: tokens.color.yellow, border: `2px solid ${tokens.color.creamPaper}`,
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
  mdSheetGrabHandle: {
    width: 44, height: 5, borderRadius: tokens.radius.chip, background: "#DCD2B6", margin: "0 auto 2px", flexShrink: 0,
  },
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
  // position:fixed + zIndex:53 (not the naive "just render it up top") --
  // same reasoning as mdCautionSheet's own 51/52 (see that comment): this
  // banner sits in normal flow as the first child of styles.app, above
  // every full-screen takeover (zIndex:50) in DOM order, but those
  // takeovers are position:fixed/inset:0 with their own stacking context,
  // so with no zIndex of its own this banner was painted OVER regardless
  // of source order -- a save error firing while any takeover (Team &
  // account, Game settings, etc.) is open was invisible until the coach
  // happened to close back out to the plain match/setup screen. Needed now
  // more than before: addNewTeam only closes Team & account on success,
  // so a failed team creation surfaces its error here, banner still open,
  // not after the screen's already gone.
  saveErrorBanner: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 53,
    background: colors.danger, color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "center",
    padding: "8px 16px", lineHeight: 1.4,
  },

  // ---- Non-match screens (Direction A round 2) — see
  // design_handoff_bench_buddy_match_day/README.md. mdSubHeader* is the
  // shared header used by every screen reached off the cog menu that isn't
  // the match itself (A8-Team-account now; A5-Minutes/A6-Season/
  // A7-Squad-change when those get built) — same shape everywhere per the
  // README, so built once here rather than per screen.
  // Full-screen takeover, not a floating dialog — the README's non-match
  // screens replace the whole page (with their own back arrow) rather
  // than sitting as a centered card over a dimmed backdrop the way the
  // old TeamSwitcher modal did. `inset:0` pins left/right explicitly,
  // which defeats `margin:auto` centering on the content — same overflow
  // bug class already hit (and fixed) for the match screen's action bar —
  // so the maxWidth/centering lives on an inner wrapper instead, mirroring
  // `main`'s own box model exactly.
  mdFullScreenTakeoverOuter: {
    position: "fixed", inset: 0, zIndex: 50, overflowY: "auto",
    background: tokens.color.creamPaper, backgroundImage: paperTexture,
  },
  mdFullScreenTakeoverInner: { maxWidth: 640, margin: "0 auto", padding: "0 16px 24px" },
  // Block 8, part A — same inset-card treatment as mdHeader. This one
  // needs its own marginTop (mdFullScreenTakeoverInner has no top padding
  // of its own, unlike `main`, which already gives mdHeader its top gap).
  // marginTop:12 matches `main`'s own padding-top exactly (styles.main)
  // — real-use feedback: this family of screens (Today's Minutes, Set up
  // next game/Game settings, Who's here, Team & account, ...) sat a
  // couple pixels lower than the crest-header screens (mdHeader); this is
  // the whole family moving up to match, not one screen singled out —
  // every screen sharing this style shifts together.
  // marginBottom 12->8: real-use feedback on Set up new team ("reduce the
  // padding below the header") — measured directly (not just the source
  // numbers): the visible gap between this card's own bottom edge and the
  // "Who's here" title below it was ~36px, most of it from this margin
  // stacking with the Who's-here wrapper's own marginTop (below) — not a
  // difference between "Set up new team" and "Set up next game" (both
  // already matched exactly, gap for gap, once measured), so this tightens
  // the one shared value both draw from rather than chasing a mismatch
  // that wasn't actually there. 8 also matches mdHeader's own
  // marginBottom, the equivalent gap on the very-first-team header.
  mdSubHeader: {
    background: tokens.color.headerYellow, padding: "16px 18px 18px", borderRadius: 28, marginTop: 12,
    display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
  },
  mdSubHeaderBack: {
    width: 44, height: 44, borderRadius: tokens.radius.rowSm, border: "none", background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.deepGreen,
  },
  mdSubHeaderTitle: { flex: 1, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 27, color: tokens.color.deepGreen },
  // Backlog #1 — "Set up next game" showing which team, implicitly, by
  // actually naming it (SquadSettingsForm's teamName prop). Small and
  // above the title, not a redesign of the sub-header shape itself —
  // every other screen sharing mdSubHeader is untouched by this.
  mdSubHeaderTeamRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 },
  mdSubHeaderTeamCrest: {
    width: 22, height: 22, borderRadius: "50%", flexShrink: 0, objectFit: "cover", objectPosition: "50% 46%",
    border: `2px solid ${tokens.color.pitchGreen}`, background: "#fff",
  },
  mdSubHeaderTeamName: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: tokens.color.groupLabel,
    textTransform: "uppercase", letterSpacing: "0.04em",
  },
  // Same dot+rule shape as mdPopoverGroupHeader (cog menu), but this
  // screen's own label color per the README (#3E5148, named `groupLabel`
  // above) rather than mdPopoverGroupLabel's #6B7C72 — kept as its own
  // style rather than editing the cog menu's, which stays exactly as it
  // already is (out of scope here).
  mdTeamAcctGroupLabel: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.groupLabel },
  // marginBottom real-use feedback: "add some more padding between the
  // field where you enter a new team name and the fields above it" — 4px
  // read as barely any gap at all next to the team cards above it.
  mdTeamAcctList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  mdTeamAcctCard: {
    display: "flex", alignItems: "center", gap: 12, width: "100%", background: "#fff",
    borderRadius: tokens.radius.rowLg, border: "none", padding: "11px 14px 11px 11px",
    boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)"), cursor: "pointer", textAlign: "left", font: "inherit",
  },
  mdTeamAcctCardActive: { border: `3px solid ${tokens.color.pitchGreen}`, padding: "9px 12px 9px 9px" },
  mdTeamAcctCrest: {
    width: 46, height: 46, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center", background: tokens.color.creamDeep,
  },
  mdTeamAcctCrestImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)" },
  // A non-current team has no real crest to show (the app only has the
  // one shared crest asset, used for whichever team is active) — an
  // initial disc reads fine here and matches the README's own fallback
  // ("Other teams show a #F1E9D2 initial disc").
  mdTeamAcctInitialDisc: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, color: tokens.color.mutedText,
  },
  mdTeamAcctInfo: { flex: 1, minWidth: 0 },
  mdTeamAcctName: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, color: tokens.color.deepGreen,
    display: "flex", alignItems: "center", gap: 6,
  },
  mdTeamAcctSubline: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12.5, color: tokens.color.mutedText, marginTop: 2 },
  mdTeamAcctTickDisc: {
    width: 20, height: 20, borderRadius: "50%", background: tokens.color.pitchGreen, color: tokens.color.creamPaper,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
  },
  mdTeamAcctAddCard: {
    width: "100%", borderRadius: tokens.radius.rowLg, padding: 13, border: `3px dashed ${tokens.color.disabledBorder}`,
    background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, color: tokens.color.mutedText,
  },
  // Interaction affordances (rename/delete/add-team text entry, delete
  // confirmation) aren't covered by the README's A8 section — it's a
  // read-mostly screen in the design file — so these keep the existing
  // TeamSwitcher interaction shape (inline input, inline confirm row)
  // just restyled to sit inside a card instead of a plain modal row.
  mdTeamAcctInlineRow: { display: "flex", alignItems: "center", gap: 8, width: "100%" },
  // fontSize 16, same reason as mdSetupInput above — stays clear of
  // iOS Safari's auto-zoom-on-focus threshold.
  mdTeamAcctInput: {
    flex: 1, height: 40, borderRadius: tokens.radius.rowSm, border: `2px solid ${tokens.color.rule}`,
    padding: "0 12px", fontFamily: tokens.font.body, fontWeight: 700, fontSize: 16, color: tokens.color.deepGreen,
  },
  mdTeamAcctIconBtn: {
    width: 34, height: 34, borderRadius: tokens.radius.iconTile, border: "none", background: tokens.color.creamDeep,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: tokens.color.mutedText,
  },
  mdTeamAcctConfirmCard: {
    background: tokens.color.injuryTint, border: `2px solid ${tokens.color.injuryBorder}`, borderRadius: tokens.radius.rowLg,
    padding: "11px 14px", display: "flex", flexDirection: "column", gap: 8,
  },
  mdTeamAcctConfirmText: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13, color: tokens.color.injuryText },
  mdTeamAcctConfirmBtnRow: { display: "flex", gap: 8 },
  mdTeamAcctBtnDanger: {
    flex: 1, height: 40, borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.injuryRed,
    color: "#fff", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 14, cursor: "pointer",
  },
  mdTeamAcctBtnCancel: {
    flex: 1, height: 40, borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.creamDeep,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 14, cursor: "pointer",
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
  mdMinutesNote: {
    background: tokens.color.creamDeep, borderRadius: tokens.radius.rowLg, padding: "11px 14px",
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13.5, color: tokens.color.groupLabel,
    lineHeight: 1.4, marginBottom: 12,
  },
  // padding-left 51px aligns past the 32px disc + gap in the rows below.
  mdMinutesColHeads: { display: "flex", padding: "0 12px 2px 51px", gap: 9, marginBottom: 4 },
  mdMinutesColHeadPitch: {
    flex: 1, textAlign: "right", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11.5,
    letterSpacing: "0.03em", color: tokens.color.pitchGreen,
  },
  mdMinutesColHeadGoal: {
    width: 52, flexShrink: 0, textAlign: "right", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11.5,
    letterSpacing: "0.03em", color: tokens.color.goldText,
  },
  mdMinutesColHeadBench: {
    width: 52, flexShrink: 0, textAlign: "right", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11.5,
    letterSpacing: "0.03em", color: tokens.color.benchText,
  },
  mdMinutesList: { display: "flex", flexDirection: "column", gap: 6 },
  mdMinutesRow: {
    display: "flex", alignItems: "center", gap: 9, background: "#fff", borderRadius: tokens.radius.rowLg,
    padding: "10px 12px 10px 9px", boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)"),
  },
  mdMinutesDisc: {
    width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 13,
    background: tokens.color.pitchGreen, color: tokens.color.creamPaper,
  },
  mdMinutesName: { flex: 1, minWidth: 0, fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.deepGreen },
  mdMinutesValuePitch: {
    flex: 1, textAlign: "right", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17, color: tokens.color.pitchGreen,
  },
  mdMinutesValueGoal: {
    width: 52, flexShrink: 0, textAlign: "right", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17,
    color: tokens.color.goldText,
  },
  mdMinutesValueBench: {
    width: 52, flexShrink: 0, textAlign: "right", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17,
    color: tokens.color.benchText,
  },
  // Zero reads as this em dash instead of "0" — keeps the columns quiet
  // so the numbers that exist carry the meaning (README's own words).
  mdMinutesZero: { color: tokens.color.chevron },
  mdMinutesTotalsRow: {
    display: "flex", alignItems: "center", gap: 9, padding: "6px 12px 0 51px", marginTop: 4,
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 15,
  },
  mdMinutesTotalsName: { flex: 1, color: tokens.color.mutedText, fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13 },

  // ---- A6-Season (#10c) — README: "has the season been fair"; headline
  // is the average per game, not the total (a total penalises a child who
  // missed weekends). Row shell is "as A5-Minutes" per the README, just
  // different padding and a two-line name cell instead of three number
  // columns — mdMinutesNote/mdMinutesDisc are reused directly rather than
  // duplicated (identical shape/colour, no reason to fork them for this
  // screen). Same green/white disc for every player, no gold keeper
  // variant — matches A5-Minutes (real-use feedback: "too much yellow"),
  // which dropped it first.
  mdSeasonRow: {
    display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: tokens.radius.rowLg,
    padding: "10px 13px 10px 9px", boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)"),
  },
  mdSeasonNameStack: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 },
  mdSeasonName: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15.5, color: tokens.color.deepGreen },
  mdSeasonSubline: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.mutedText },
  // "Bars are scaled from the squad's lowest average, not from zero, so a
  // small spread stays visible" — the component computes the fill
  // percentage; this is just the track/fill shapes.
  mdSeasonBarTrack: {
    width: 96, flexShrink: 0, height: 11, borderRadius: tokens.radius.chip, background: tokens.color.creamDeep,
    overflow: "hidden",
  },
  mdSeasonBarFill: { height: "100%", borderRadius: tokens.radius.chip, background: tokens.color.pitchGreen },
  mdSeasonAvg: {
    width: 48, flexShrink: 0, textAlign: "right", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18,
    color: tokens.color.deepGreen,
  },
  mdSeasonFooter: {
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12.5, color: tokens.color.mutedText,
    textAlign: "center", marginTop: "auto", paddingTop: 16,
  },
  // The per-game delete list isn't covered by the README's A6 section at
  // all (it's existing functionality, not a designed screen) — light
  // restyle to sit consistently under the newly-styled averages above,
  // reusing mdTeamAcct*'s confirm-card/danger-button pattern rather than
  // inventing a second one.
  mdSeasonGameRow: {
    display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: tokens.radius.rowMd,
    padding: "9px 12px", boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)"), marginBottom: 6,
  },
  mdSeasonGameLabel: { flex: 1, fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.deepGreen },
  mdSeasonGameMeta: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.mutedText },

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

  // ---- A9-Signin (#10f) — README: "first run only. Magic-link, no
  // password." The real app authenticates via a Google OAuth popup
  // (signInWithGoogle, src/lib/auth.js), not email + a mailed link — that
  // mismatch is between the design file and this codebase, not something
  // to paper over with a non-functional email field. Restyled around the
  // real flow instead: same lockup/button/footer shapes the README
  // specifies, "Sign in with Google" where it says "Send me a link", and a
  // reassurance line that's actually true of what happens.
  // position:fixed/inset:0/zIndex:50/overflowY:auto — same shape
  // mdFullScreenTakeoverOuter already uses for every other full-screen
  // overlay in this app. Real-use feedback: SquadSettingsForm's own
  // "Already have a team?" link opens this deep inside a scrolled page
  // (right after the submit button, near the bottom) — with the old
  // minHeight:100vh (a normal block-flow element), it rendered wherever
  // that DOM position happened to fall, which on a scrolled page could be
  // entirely below the visible viewport. Baked the fix in here rather
  // than requiring every caller to wrap it — AuthGate's own root-level
  // usage (the whole app, nothing else in the DOM to stack against) is
  // unaffected either way.
  mdSignInWrap: {
    position: "fixed", inset: 0, zIndex: 50, overflowY: "auto",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: tokens.color.creamPaper, backgroundImage: paperTexture, padding: "40px 28px",
  },
  // Only rendered when SignIn.jsx's own onClose is set (SquadSettingsForm's
  // "Already have a team? Sign in" link) — plain white on this screen's own
  // light cream background, not mdSaveTeamClose's translucent-on-dark-green
  // treatment (wrong contrast here; that one's built for its own pitch band).
  mdSignInCloseBtn: {
    position: "absolute", top: 20, right: 20, width: 36, height: 36, borderRadius: 12,
    background: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, color: tokens.color.mutedText,
    cursor: "pointer", boxShadow: "0 2px 0 rgba(28,58,46,.08)",
  },
  mdSignInLockup: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 },
  // 132px, "one step down" from A0-Launch's own 168px crest — same
  // border/fill/crop treatment as every other crest in the app, just sized
  // per this screen's own spec.
  mdSignInCrest: {
    width: 132, height: 132, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    border: `6px solid ${tokens.color.pitchGreen}`, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: tokens.shadow.solid(6, "rgba(28,58,46,.14)"),
  },
  mdSignInCrestImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)" },
  mdSignInWordmark: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 42, color: tokens.color.deepGreen,
    lineHeight: 1, marginTop: 16, textAlign: "center",
  },
  // Real-use feedback: "I really like that slogan" — was plain body-copy
  // gray, reading as a throwaway caption under the wordmark rather than
  // something worth noticing. Baloo 2 (the same display font the wordmark
  // itself uses, not body copy) and pitchGreen (not mutedText) instead, so
  // the two read as one cohesive two-tone lockup — dark wordmark, bright
  // green tagline — rather than a headline with a caption underneath.
  mdSignInTagline: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, color: tokens.color.pitchGreen,
    marginTop: 6, textAlign: "center", letterSpacing: 0.2,
  },
  mdSignInForm: { width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14, alignItems: "stretch" },
  // mdSignInBtn (the old single big green Google button) removed — real-
  // use feedback: once Sign out routed here directly instead of this only
  // being a rare fallback, the screen needed a real Email option too, so
  // it switched to the same two-provider-button layout (mdSaveTeamProvider
  // Btn/GoogleBtn/EmailBtn, block 16) SaveTeamSheet.jsx already uses,
  // reused directly rather than duplicated.
  mdSignInError: {
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13, color: tokens.color.injuryText,
    background: tokens.color.injuryTint, border: `1px solid ${tokens.color.injuryBorder}`,
    borderRadius: 14, padding: "10px 14px", textAlign: "center",
  },
  mdSignInVersion: {
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12, color: tokens.color.unavailableText, marginTop: 28,
  },

  // ---- Block 16 — Save your team (SaveTeamSheet.jsx, full-screen). Not
  // the first-run gate (that's progressive auth's own anonymous bootstrap,
  // AuthGate.jsx) — reached only from Team & account's "Save your team"
  // row, so it has to sit above that screen's own mdFullScreenTakeoverOuter
  // (zIndex 50), hence 60 here rather than reusing that value. No new
  // colours anywhere in this block — every value below is an existing
  // token, per the brief.
  mdSaveTeamScreen: {
    position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", overflowY: "auto",
  },
  // Square corners, runs to the frame edges — deliberately NOT rounded at
  // the bottom (the sheet below rounds up and over it instead). flexShrink
  // 0 so the band never gets squeezed by the sheet's own flex:1 below it.
  mdSaveTeamBand: {
    position: "relative", flexShrink: 0, background: tokens.color.pitchGreen, overflow: "hidden",
  },
  mdSaveTeamStripes: {
    position: "absolute", inset: 0,
    backgroundImage: "repeating-linear-gradient(180deg, rgba(255,246,229,.055) 0 34px, transparent 34px 68px)",
  },
  mdSaveTeamCircle: {
    position: "absolute", left: "50%", bottom: -176, transform: "translateX(-50%)",
    width: 300, height: 300, borderRadius: "50%", border: "3px solid rgba(255,246,229,.4)",
  },
  // Deliberately not a cream disc — on a band of cream shirts, a cream
  // circle reads as another player rather than a way out.
  // top:20, not the spec's own 44 — real-device feedback: 44 (presumably
  // measured to clear a mocked-up status bar baked into the reference
  // frame's own 844px canvas) sat noticeably low against this app's real
  // header, which has no such reserved space above it.
  mdSaveTeamClose: {
    position: "absolute", top: 20, right: 24, width: 40, height: 40, borderRadius: 14,
    background: "rgba(20,44,32,.34)", border: "2px solid rgba(255,246,229,.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 21, color: tokens.color.creamPaper,
    cursor: "pointer",
  },
  mdSaveTeamMark: { position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" },
  mdSaveTeamMarkName: {
    marginTop: 5, fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: "#fff", whiteSpace: "nowrap",
  },
  mdSaveTeamBenchPill: {
    position: "absolute", left: "50%", transform: "translateX(-50%)",
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(255,246,229,.18)", borderRadius: 999, padding: "5px 14px",
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13, color: tokens.color.creamPaper, whiteSpace: "nowrap",
  },
  mdSaveTeamBenchDisc: {
    width: 17, height: 17, borderRadius: "50%", flexShrink: 0, background: tokens.color.creamPaper,
    color: tokens.color.pitchGreen, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 800, lineHeight: 1,
  },
  // marginTop -30 is what makes the sheet curve up and over the band's own
  // square bottom edge, per the spec's own "two parts" framing above.
  mdSaveTeamSheet: {
    position: "relative", zIndex: 4, flex: 1, marginTop: -30,
    background: tokens.color.creamPaper, backgroundImage: paperTexture, borderRadius: "30px 30px 0 0",
    padding: "34px 26px 0", display: "flex", flexDirection: "column",
  },
  mdSaveTeamHeading: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 38, color: tokens.color.deepGreen,
    lineHeight: 1.02, letterSpacing: "-0.4px",
  },
  mdSaveTeamBody: {
    marginTop: 12, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 16.5, color: tokens.color.groupLabel,
    lineHeight: 1.45, textWrap: "pretty",
  },
  mdSaveTeamButtonList: { marginTop: 14, display: "flex", flexDirection: "column", gap: 12 },
  // Shared shape for all three provider buttons — padding/gap/chip size are
  // shared on purpose (per the brief: "all three marks start on the same
  // vertical line") — colour/height/shadow are the only things that vary
  // per provider, applied at the call site.
  mdSaveTeamProviderBtn: {
    display: "flex", alignItems: "center", width: "100%", boxSizing: "border-box", padding: "0 22px", gap: 15,
    border: "none", cursor: "pointer", font: "inherit", textAlign: "left",
  },
  mdSaveTeamGoogleBtn: {
    height: 62, borderRadius: 22, background: tokens.color.yellow, boxShadow: tokens.shadow.solid(5, tokens.color.yellowShadow),
  },
  mdSaveTeamEmailBtn: { height: 60, borderRadius: 22, background: tokens.color.creamDeep },
  // SignIn.jsx only — "Continue as Guest" on the sign-out-recovery screen,
  // never SaveTeamSheet. Plain bordered white, deliberately the lightest-
  // weight of the three: this is the backup option, not a first choice.
  mdSaveTeamGuestBtn: { height: 58, borderRadius: 22, background: "#fff", border: `1px solid ${tokens.color.rule}` },
  mdSaveTeamProviderChip: {
    width: 34, height: 34, borderRadius: 12, flexShrink: 0, background: tokens.color.creamPaper,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  mdSaveTeamProviderLabel: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20, color: tokens.color.deepGreen },
  // Real-use feedback: tried without the card background (this screen is
  // tight on room — band + shirts + heading + body + two buttons all
  // above it) — a filled panel read as one more compressed block rather
  // than a reassurance line, so it stays a plain row instead. padding
  // "0 2px" only, not a filled panel's 14/16 — just enough to keep the
  // tick disc/text off the sheet's own edge.
  mdSaveTeamTickRow: {
    marginTop: 16, display: "flex", alignItems: "center", gap: 10, padding: "0 2px",
  },
  mdSaveTeamTickDisc: {
    width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: tokens.color.pitchGreen,
    color: tokens.color.creamPaper, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
  },
  mdSaveTeamTickText: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14.5, color: tokens.color.groupLabel },
  // "Bench Buddy Sports" wordmark dropped from here (real-use feedback:
  // this screen doesn't have the room a taller reference frame did) — no
  // gap needed any more with only the one child left.
  mdSaveTeamFooter: {
    marginTop: "auto", paddingBottom: 14, display: "flex", flexDirection: "column", alignItems: "center",
  },
  mdSaveTeamHomeIndicator: { width: 134, height: 5, borderRadius: 3, background: tokens.color.rule },

  // The email sub-state (block 6/A9-Signin's own field+button, reused
  // verbatim, dropped into this shell rather than a separate gate screen —
  // see SaveTeamSheet.jsx's own comment on why).
  mdSaveTeamEmailField: {
    width: "100%", height: 64, borderRadius: 22, background: "#fff", boxShadow: "0 3px 0 rgba(28,58,46,.10)",
    border: "none", padding: "0 18px", fontFamily: tokens.font.body, fontWeight: 700, fontSize: 17,
    color: tokens.color.deepGreen, boxSizing: "border-box",
  },
  mdSaveTeamSendLinkBtn: {
    width: "100%", height: 70, borderRadius: 26, border: "none", background: tokens.color.yellow,
    boxShadow: tokens.shadow.solid(5, tokens.color.yellowShadow), fontFamily: tokens.font.display, fontWeight: 800,
    fontSize: 25, color: tokens.color.deepGreen, cursor: "pointer",
  },
  mdSaveTeamReassurance: {
    marginTop: 13, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13.5, color: tokens.color.mutedText, textAlign: "center",
  },
};

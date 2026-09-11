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
    // Match Link 2b (MatchClaimPage) — the "Check your email" sheet's own
    // grabber pill. Close to disabledBorder (#DCD3BB) but not the same
    // value, and used for a genuinely different purpose (a drag handle, not
    // a border), so kept as its own token rather than reusing that one.
    grabber: "#DCD4C0",
    // Availability link — the four colors its own design table names that
    // don't already exist under a different name. availOut (#B4462F) is a
    // hair off cancelText (#B4462E) — a different design file's own
    // near-identical pick for a different concept (an "out" answer, not a
    // cancel action), not the same token wearing two names.
    availGreenTint: "#E3F0E5",
    availGreenChip: "#C9E4CE",
    availSand: "#EDE7D3",
    availWell: "#F8F3E3",
    availDisabledDisc: "#BFC7BE",
    availOut: "#B4462F",
  },
  // Baloo 2 800 for display type (timer, wordmark, buttons, popover
  // titles); Nunito for body copy (700 captions, 800 labels/chips/names)
  // — weight is picked per use, not baked in here, since the same family
  // is used at both weights depending on the element.
  font: {
    display: "'Baloo 2', system-ui, sans-serif",
    body: "'Nunito', system-ui, sans-serif",
    // Real-use feedback: the raw claim URL in the "WHAT THE GROUP SEES"
    // preview read as an unreadable jumble of random characters set in
    // the body font. Monospace is the standard convention for a URL/code
    // string — it reads as "this is deliberately technical", not noise —
    // system stack only, no webfont needed for a handful of characters.
    mono: "ui-monospace, 'SF Mono', 'Menlo', 'Consolas', monospace",
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


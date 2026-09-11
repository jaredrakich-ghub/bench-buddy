// The "share a link, parent claims" screens — Availability Link
// (AvailabilityScreen.jsx/AvailabilityClaimPage.jsx) and Match Link
// (MatchLinkScreen.jsx/MatchClaimPage.jsx/ParentMatchSession.jsx).
// Moved out of the old monolithic styles.js as-is.
import { tokens, colors, paperTexture } from "./tokens.js";

export const linksStyles = {

  // ---- Match Link (2a coach screen) — see docs/design_handoff_bench_
  // buddy_match_link/README.md and src/components/MatchLinkScreen.jsx.
  // Rule 5: every color below is an existing token (headerYellow,
  // pitchGreen, deepGreen, mutedText, groupLabel, yellow, yellowShadow,
  // goldText, alertRed, creamPaper, creamDeep) already confirmed to match
  // the design's own spec table exactly — nothing here re-points a shared
  // hex, and the two genuinely new pieces (the toggle switch, the level
  // segmented row) are built from existing card/tab styles, not new colors.
  mdMatchLinkExplainerCard: {
    background: "#fff", borderRadius: tokens.radius.rowLg, padding: "14px 16px",
    boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)"), marginBottom: 14,
  },
  mdMatchLinkExplainerTitle: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, color: tokens.color.deepGreen, marginBottom: 4,
  },
  mdMatchLinkExplainerBody: {
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13.5, color: tokens.color.mutedText, lineHeight: 1.4,
  },

  // Subs / Full game — a two-option segmented row, same visual language as
  // the interval-tabs strip (colors.grass/colors.chalk on the active tab)
  // rather than the design handoff's own stale interval-chip colors, per
  // the real-device revert already governing intervalTab/intervalTabActive
  // above. Genuinely new shape (equal-width segments, not a scrolling
  // strip), so its own styles rather than reusing intervalTab directly.
  mdMatchLinkLevelRow: {
    display: "flex", gap: 6, marginBottom: 14, background: colors.cardBg, borderRadius: tokens.radius.rowMd,
    border: `1px solid ${colors.border}`, padding: 4,
  },
  mdMatchLinkLevelBtn: {
    flex: 1, padding: "10px 8px", borderRadius: tokens.radius.rowSm, border: "none", background: "transparent",
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13.5, color: colors.ink, cursor: "pointer", textAlign: "center",
  },
  mdMatchLinkLevelBtnActive: { background: colors.grass, color: colors.chalk },

  mdMatchLinkCard: {
    background: "#fff", borderRadius: tokens.radius.rowLg, padding: "14px 16px",
    boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)"), marginBottom: 14,
    display: "flex", flexDirection: "column", gap: 12,
  },
  mdMatchLinkCardLabel: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 12, color: tokens.color.groupLabel,
    textTransform: "uppercase", letterSpacing: "0.04em",
  },
  mdMatchLinkUrlWell: {
    background: tokens.color.creamDeep, borderRadius: tokens.radius.rowSm, padding: "12px 14px",
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.pitchGreen,
    wordBreak: "break-all",
  },
  mdMatchLinkToggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  mdMatchLinkToggleLabel: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14, color: tokens.color.deepGreen },
  // 58x34 track+knob switch — no existing toggle in the app is this shape
  // (mdSetupToggle is a different, smaller control), so this is genuinely
  // new UI. Built from existing tokens only: pitchGreen for the on-state
  // track, creamDeep for off, white knob — same solid-sticker shadow
  // language as everything else rather than a soft CSS-transition glow.
  mdMatchLinkToggleTrack: {
    width: 58, height: 34, borderRadius: 17, border: "none", padding: 3, flexShrink: 0, cursor: "pointer",
    background: tokens.color.creamDeep, display: "flex", alignItems: "center", justifyContent: "flex-start",
    transition: "background 0.15s ease",
  },
  mdMatchLinkToggleTrackOn: { background: tokens.color.pitchGreen, justifyContent: "flex-end" },
  mdMatchLinkToggleKnob: {
    width: 28, height: 28, borderRadius: "50%", background: "#fff", boxShadow: tokens.shadow.solid(2, "rgba(28,58,46,.20)"),
  },
  mdMatchLinkFootnote: {
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12.5, color: tokens.color.mutedText, lineHeight: 1.4,
  },

  mdMatchLinkHolderRow: {
    display: "flex", alignItems: "center", gap: 10,
  },
  mdMatchLinkHolderInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 },
  mdMatchLinkHolderEmail: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.deepGreen,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  mdMatchLinkHolderStatus: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 12.5, color: tokens.color.goldText },
  mdMatchLinkEmptyHolder: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13.5, color: tokens.color.mutedText },

  mdMatchLinkShareBtn: {
    width: "100%", height: 56, borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.pitchGreen,
    color: tokens.color.creamPaper, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, cursor: "pointer",
    boxShadow: tokens.shadow.solid(4, tokens.color.greenShadow), display: "flex", alignItems: "center",
    justifyContent: "center", gap: 8,
  },
  mdMatchLinkCopyBtn: {
    width: "100%", height: 52, borderRadius: tokens.radius.buttonMd, border: "none", background: tokens.color.creamDeep,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 16, cursor: "pointer",
    marginTop: 8,
  },
  mdMatchLinkOffBtn: {
    width: "100%", background: "transparent", border: "none", padding: "10px 0", marginTop: 4,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13.5, color: tokens.color.alertRed, cursor: "pointer",
  },

  // ---- Match Link (2b claim page, MatchClaimPage.jsx) — README's own
  // "browser, not app chrome" note means no header/cog here at all, just
  // this page's own content on the paper-texture ground every other
  // full-screen surface already uses. Rule 5: every color is an existing
  // token (pitchGreen/greenShadow, deepGreen, groupLabel, mutedText, yellow,
  // creamPaper/creamDeep, scrim) except `grabber`, added alongside the rest
  // above for a value the spec calls out that nothing existing matches.
  mdClaimPage: {
    // height + overflowY (not minHeight relying on the document/body to
    // scroll) — real-use feedback: opened from a WhatsApp-shared link, this
    // renders inside WhatsApp's own in-app browser (a WKWebView with its
    // own chrome, confirmed from the screenshot: "◄ WhatsApp" + its own
    // address bar), and in-app browsers like it are notorious for not
    // reliably scrolling a page that only overflows the document/body —
    // WebKitOverflowScrolling:"touch" plus making this div its own scroll
    // container is the standard, reliable fix. Content taller than one
    // screen now scrolls inside mdClaimPage itself instead of growing the
    // whole page past 100dvh and hoping the host browser scrolls it.
    height: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch",
    background: tokens.color.creamPaper, backgroundImage: paperTexture,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "32px 24px", boxSizing: "border-box", gap: 18,
  },
  mdClaimInner: { width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 },
  mdClaimCrest: {
    width: 96, height: 96, borderRadius: "50%", border: `6px solid ${tokens.color.pitchGreen}`,
    overflow: "hidden", flexShrink: 0, background: "#fff",
  },
  mdClaimCrestImg: { width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.5)" },
  mdClaimTitle: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 32, lineHeight: 1.1, color: tokens.color.deepGreen,
    textAlign: "center", textWrap: "balance",
  },
  mdClaimBody: {
    fontFamily: tokens.font.body, fontWeight: 600, fontSize: 16, lineHeight: 1.5, color: tokens.color.groupLabel, textAlign: "center",
  },
  mdClaimForm: { width: "100%", display: "flex", flexDirection: "column", gap: 12 },
  mdClaimSubmitBtn: {
    width: "100%", height: 64, borderRadius: 26, border: "none", background: tokens.color.pitchGreen,
    boxShadow: tokens.shadow.solid(6, tokens.color.greenShadow), color: tokens.color.creamPaper,
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 23, cursor: "pointer",
  },
  mdClaimFootnote: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14, color: tokens.color.mutedText, textAlign: "center" },

  // The "Check your email" sheet — a bottom sheet covering the form, same
  // scrim as mdCautionSheet (reused directly) but its own shape: the spec's
  // radius/padding/shadow don't match mdCautionSheet's (that one has a
  // yellow top border and a squarer top radius, built for a different kind
  // of confirmation), so this is a dedicated style rather than a forced fit.
  mdClaimSentSheet: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 52, maxWidth: 640, margin: "0 auto",
    background: tokens.color.creamPaper, borderRadius: "34px 34px 38px 38px",
    boxShadow: "0 -18px 44px rgba(20,32,28,.28)", padding: "24px 22px 30px",
    display: "flex", flexDirection: "column", gap: 14, maxHeight: "calc(100vh - 24px)", overflowY: "auto",
  },
  mdClaimSentGrabber: { width: 56, height: 6, borderRadius: 3, background: tokens.color.grabber, alignSelf: "center", marginBottom: 4 },
  mdClaimSentIconDisc: {
    width: 52, height: 52, borderRadius: "50%", background: tokens.color.yellow, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  mdClaimSentHeaderRow: { display: "flex", alignItems: "center", gap: 12 },
  mdClaimSentTitle: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.deepGreen },
  mdClaimSentBody: { fontFamily: tokens.font.body, fontWeight: 600, fontSize: 15, lineHeight: 1.4, color: tokens.color.groupLabel },
  mdClaimSentSecondaryBtn: {
    width: "100%", height: 60, borderRadius: 24, border: "none", background: tokens.color.creamDeep,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18, cursor: "pointer",
  },
  mdClaimSentTertiary: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14, color: tokens.color.mutedText, textAlign: "center" },
  mdClaimSentTertiaryLink: {
    background: "transparent", border: "none", padding: 0, font: "inherit", fontWeight: 800, color: tokens.color.pitchGreen, cursor: "pointer",
  },

  // ---- Availability link (1a compose screen, AvailabilityScreen.jsx) —
  // same mdSubHeader/mdFullScreenTakeover shell every other cog-menu screen
  // uses. Every color here is a token (either already existing, reused
  // directly, or one of the availability-specific ones added alongside the
  // rest above) — nothing new-and-unnamed.
  mdAvailCard: {
    background: "#fff", borderRadius: tokens.radius.rowLg, padding: "14px 16px",
    boxShadow: tokens.shadow.solid(3, "rgba(28,58,46,.10)"), marginBottom: 14,
  },
  mdAvailFixture: { fontFamily: tokens.font.display, fontWeight: 800, fontSize: 21, color: tokens.color.deepGreen, marginBottom: 4 },
  mdAvailFixtureDetail: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 15, color: tokens.color.mutedText },
  // Real-use feedback: the whole fixture card is now tappable to edit
  // opponent/match time/location — button-reset, full width, so the
  // mdAvailFixture/mdAvailFixtureDetail children inside keep their exact
  // existing look while the whole card area (not just the text) responds.
  mdAvailFixtureEditBtn: {
    background: "transparent", border: "none", padding: 0, margin: 0, width: "100%", textAlign: "left", cursor: "pointer", font: "inherit",
  },
  // Real-use feedback: "Not the right player? Select again" (screen 6)
  // rendered as plain text directly inside this button, with no child span
  // of its own to carry a font — font: "inherit" pulled whatever the
  // browser's own default typeface is (this app sets font-family inline on
  // every piece of text itself; nothing at the page root does), which read
  // as visibly off from the rest of the app. AvailabilityScreen.jsx's own
  // use of this style always wraps its text in a span with an explicit
  // font (mdAvailClosesLine) that overrode the inherited value anyway, so
  // this was invisible there — explicit fontFamily here now covers both.
  mdAvailFixtureDetailBtn: {
    background: "transparent", border: "none", padding: 0, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 15,
    color: tokens.color.mutedText, textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer", textAlign: "left",
  },

  mdAvailCardLabel: {
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: tokens.color.mutedText,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
  },
  // The SQUAD label doubles as its own expand/collapse control — real-use
  // feedback: a fresh link's chip list is nothing but "· waiting" the
  // instant it's created, no point showing that by default. Same "›
  // rotates open" chevron language as the Game Settings accordion rows
  // (mdSetupAccordionChevron), just light enough to live inside an
  // existing card rather than being one itself.
  mdAvailSquadToggle: {
    display: "flex", alignItems: "center", gap: 6, width: "100%", background: "transparent",
    border: "none", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit",
  },
  mdAvailSquadToggleChevron: {
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 14, color: tokens.color.chevron,
    display: "inline-block", transition: "transform .2s ease",
  },
  mdAvailPreviewWell: {
    background: tokens.color.availSand, borderRadius: tokens.radius.rowMd, padding: "14px 16px",
    fontFamily: tokens.font.body, fontWeight: 600, fontSize: 15, color: tokens.color.groupLabel, lineHeight: 1.4,
    // buildShareMessage's own \n\n between the fixture line and the
    // instruction (real-use feedback: they used to run together as one
    // sentence) needs this to actually render as a visible blank line
    // here — plain block text collapses newlines by default. The literal
    // WhatsApp message this mirrors renders the same \n\n natively either
    // way, so this is display-only, not a copy change.
    whiteSpace: "pre-line",
  },
  // Real-use feedback: the raw claim URL used to sit as plain bold text
  // directly in the sand-coloured preview well, breaking mid-character
  // wherever it happened to wrap — read as noise, not a link. Framed as
  // its own light "chip" now (own background, radius, padding) so it
  // visually reads as a distinct, deliberate element rather than part of
  // the sentence above it; monospace (tokens.font.mono) is the standard
  // convention for a URL/code string. The text itself is untouched — full,
  // real, un-truncated — this label is titled "WHAT THE GROUP SEES" and
  // still needs to show byte-identically what actually ships.
  mdAvailPreviewUrl: {
    display: "block", marginTop: 10, background: "#fff", borderRadius: 10, padding: "8px 10px",
    fontFamily: tokens.font.mono, fontWeight: 600, fontSize: 13, color: tokens.color.pitchGreen,
    wordBreak: "break-word", overflowWrap: "anywhere",
  },
  // Real-use feedback: "feels a little cramped" — nudged right and given
  // a touch more breathing room from the preview well above it (both
  // small, deliberate adjustments, not a restyle).
  mdAvailClosesLine: {
    marginTop: 13, marginLeft: 3, display: "inline-block",
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14, color: tokens.color.mutedText,
  },

  mdAvailSquadChipRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  mdAvailSquadChip: {
    display: "flex", alignItems: "center", gap: 6, background: tokens.color.availSand, borderRadius: 999,
    padding: "6px 14px 6px 6px",
  },
  mdAvailSquadChipInFocus: { background: tokens.color.availGreenTint },
  mdAvailSquadChipDisc: {
    width: 28, height: 28, borderRadius: "50%", background: tokens.color.pitchGreen, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, flexShrink: 0,
  },
  mdAvailSquadChipName: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.deepGreen },
  mdAvailReplyState: { fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14, color: tokens.color.mutedText },

  mdAvailForm: { display: "flex", flexDirection: "column", gap: 10 },
  mdAvailLabel: { fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: tokens.color.groupLabel, marginBottom: -2 },
  mdAvailInput: {
    width: "100%", height: 56, borderRadius: 18, background: "#fff", boxShadow: "0 3px 0 rgba(28,58,46,.10)",
    border: "none", padding: "0 16px", fontFamily: tokens.font.body, fontWeight: 700, fontSize: 16,
    color: tokens.color.deepGreen, boxSizing: "border-box", textAlign: "left",
    // Real-use feedback, live on a real phone: <input type="date">/
    // type="time"> were barely visible next to the plain-text fields — iOS
    // Safari (and to a lesser extent other WebKit/Blink browsers) ignores
    // custom background/border/shadow/padding on these types and draws its
    // own native control chrome instead, unless told explicitly to stop.
    // `appearance: none` is that instruction, and fixes the box styling —
    // still worth keeping on this shared style for the plain text inputs
    // (Opponent/Location) it's also used for, though they never had the
    // problem. It does NOT fix text-align on a date/time picker's own
    // displayed value, though (confirmed live in both Safari and Chrome) —
    // see mdAvailDateFieldWrap/Display/Native below for the real fix used
    // on every date/time field in this file now (1a's own create form AND
    // the "Closes… Tap to change" edit, both migrated off this bare input).
    WebkitAppearance: "none",
    MozAppearance: "textfield",
    appearance: "none",
  },
  // Every date/time field in this file (1a's create form's MATCH DATE/
  // KICK OFF TIME, and the "Closes… Tap to change" edit) — the fix for
  // text-align not reaching a native picker's displayed value. The real
  // <input type="date">/type="time"> stays fully present and functional
  // (tapping anywhere in the wrap still opens the actual OS picker), just
  // invisible; mdAvailDateFieldDisplay is what's actually seen, fully our
  // own markup so left-align (and the "Saturday, 12 Sep 2026"/"9:30 am"
  // formatting real-use feedback originally asked for) are both trivially
  // just correct, no fighting the browser required.
  mdAvailDateFieldWrap: { position: "relative", width: "100%" },
  mdAvailDateFieldDisplay: {
    width: "100%", height: 56, borderRadius: 18, background: "#fff", boxShadow: "0 3px 0 rgba(28,58,46,.10)",
    padding: "0 16px", fontFamily: tokens.font.body, fontWeight: 700, fontSize: 16, boxSizing: "border-box",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    pointerEvents: "none", // the invisible native input on top handles every tap
  },
  mdAvailDateFieldNative: {
    position: "absolute", inset: 0, width: "100%", height: "100%",
    opacity: 0, border: "none", padding: 0, margin: 0, cursor: "pointer",
    // opacity (not display:none/visibility:hidden) — stays in the
    // accessibility tree and keyboard-focusable, same as any other real
    // input; it just isn't painted, since mdAvailDateFieldDisplay sits
    // visually in its place.
  },

  mdAvailPrimaryBtn: {
    width: "100%", height: 64, borderRadius: 26, border: "none", background: tokens.color.pitchGreen,
    boxShadow: tokens.shadow.solid(6, tokens.color.greenShadow), color: "#fff",
    fontFamily: tokens.font.display, fontWeight: 800, fontSize: 23, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  mdAvailSecondaryBtn: {
    width: "100%", height: 56, borderRadius: 22, border: "none", background: tokens.color.availSand,
    color: tokens.color.deepGreen, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20, cursor: "pointer", marginTop: 8,
  },
  mdAvailGhostBtn: {
    width: "100%", background: "transparent", border: "none", padding: "10px 0", marginTop: 4,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13.5, color: tokens.color.mutedText, cursor: "pointer",
  },

  // The setup screen's own (1d) entry point / summary line — one shared
  // pill for both states (no link sent yet / a link's already out), sitting
  // after the "Who's here" chip grid — the manual roster edit is the
  // primary, step-one action; this is a secondary tool for doing the same
  // thing via link, so it reads better following the primary action than
  // leading it. Used to be its own icon+title card above "Who's here"
  // entirely (mdAvailPrompt, retired), then a line directly under the
  // heading before the chips — real-use feedback moved it twice. The
  // pill's own background is what signals "tap me"; no icon, no chevron.
  mdAvailSummaryLine: {
    // No trailing `font: "inherit"` button-reset here — every font property
    // is already set explicitly, and (per mdExecuteUndoPill's own comment
    // above) a shorthand applied after longhand values clobbers them the
    // moment React sets it.
    //
    // marginTop matches marginBottom deliberately — real-use feedback: the
    // chip grid above (mdSquadChipWrapRow) carries no bottom margin of its
    // own, so without this the pill sat flush against the chip row (0px
    // above) while still keeping its own 14px below, hugging the names
    // instead of reading as evenly spaced from what's on both sides of it.
    background: tokens.color.availGreenTint, borderRadius: tokens.radius.rowMd, padding: "13px 15px",
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14.5, lineHeight: 1.4, color: tokens.color.deepGreen,
    marginTop: 14, marginBottom: 14, border: "none", width: "100%", textAlign: "left", cursor: "pointer",
  },
  mdAvailSummaryLineMuted: { color: tokens.color.mutedText },
  // Step 6's own "Nudge the two waiting" row — deliberately small/quiet
  // (a ghost button, not a card) since it's a secondary action sitting
  // right under the summary line, not a new competing focal point.
  mdAvailNudgeBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
    background: "transparent", border: "none", padding: "2px 0 12px", marginTop: -8,
    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: tokens.color.goldText, cursor: "pointer",
  },

  mdAvailStatusSuffix: { fontWeight: 700, opacity: 0.85 },
};

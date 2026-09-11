// Style/token groups genuinely shared across several unrelated screens
// (mdSubHeader*, mdCautionSheet*, mdCancelDialog*, mdFullScreenTakeover*,
// modalWarning, the crest, a few odd single keys a sibling screen also
// reaches into) — moved out of the old monolithic styles.js as-is, see
// styles.js's own top comment for the split's full reasoning.
import { tokens, colors, paperTexture } from "./tokens.js";

export const sharedStyles = {
  // background was the old pre-redesign colors.chalk (pale grey) — the
  // match-day redesign's cards (bench strip, action bar, popovers) are all
  // designed against the warm "cream paper" page background instead, so
  // that stale chalk was showing through the header's rounded corners and
  // the gaps between cards, reading as a missing/unstyled background.
  app: {
    fontFamily: "system-ui, -apple-system, sans-serif", background: tokens.color.creamPaper,
    backgroundImage: paperTexture, minHeight: 500, color: colors.ink,
  },
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
  mdCrestOuter: {
    width: 62, height: 62, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
    border: "4px solid " + tokens.color.pitchGreen, background: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  mdCrestImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)" },

  // ---- The cancel confirmation dialog — centred over the whole screen,
  // above even the execute sheet itself (mdFinal60Overlay's own zIndex
  // 46) since it has to interrupt that sheet, not sit inside it. The one
  // centred-card dialog style in this app; everything else here is a
  // bottom sheet or an anchored popover. Originally MatchView-only (a
  // scheduled sub not coming on); reused as-is for AvailabilityScreen's
  // own "cancel this link" confirm — the shape (title/body/two buttons,
  // one destructive one safe) fits both, no new style needed.
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
  mdSheetGrabHandle: {
    width: 44, height: 5, borderRadius: tokens.radius.chip, background: "#DCD2B6", margin: "0 auto 2px", flexShrink: 0,
  },
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
};

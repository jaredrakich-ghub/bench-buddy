// The final-60 two-sheet flow (Final60Sheets.jsx) — Prepare + Execute.
// Moved out of the old monolithic styles.js as-is.
import { tokens } from "./tokens.js";

export const final60Styles = {

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
};

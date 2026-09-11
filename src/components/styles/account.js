// Sign-in/save-team/team-account screens (SignIn.jsx, SaveTeamSheet.jsx,
// AuthGate.jsx, TeamAccountScreen.jsx).
// Moved out of the old monolithic styles.js as-is.
import { tokens, paperTexture } from "./tokens.js";

export const accountStyles = {

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
  mdPopoverFooter: {
    textAlign: "center", marginTop: 4, paddingTop: 10, borderTop: `1px solid ${tokens.color.rule}`,
    fontFamily: tokens.font.body, fontWeight: 800, color: tokens.color.mutedText, fontSize: 14,
  },
  mdPopoverFooterVersion: { fontSize: 12 },
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

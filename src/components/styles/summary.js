// Minutes/season-summary screens (SummaryModal.jsx, SeasonSummaryModal.jsx,
// RotationProgressOverlay.jsx's own current-minutes table).
// Moved out of the old monolithic styles.js as-is.
import { tokens, colors } from "./tokens.js";

export const summaryStyles = {

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
  mdMinutesNote: {
    background: tokens.color.creamDeep, borderRadius: tokens.radius.rowLg, padding: "11px 14px",
    fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13.5, color: tokens.color.groupLabel,
    lineHeight: 1.4, marginBottom: 12,
  },
  // padding-left 51px aligns past the 32px disc + gap in the rows below.
  // Real bug (real-use feedback): this used to fake the "disc + name"
  // space below with a flat padding-left:51px guess — close for the
  // fixed-width disc (32px) + its gap, but NAME itself (mdMinutesName) is
  // flex:1, a PROPORTIONAL share of the row's width, not a fixed one, so
  // a flat padding could never actually match it. That left the PITCH
  // header centred inside a box that started too far left and was too
  // wide (it silently included NAME's own real estate, which has no
  // header counterpart), pulling the centred text left of where the
  // PITCH values actually sit. Fixed properly: padding-left now matches
  // the row's own left inset (9px, mdMinutesRow's own padding) and two
  // invisible spacers (mdMinutesColHeadSpacerDisc/Name below) mirror the
  // row's real disc+name layout piece for piece, so PITCH's own flex:1
  // box starts and ends exactly where mdMinutesValuePitch's does.
  mdMinutesColHeads: { display: "flex", padding: "0 12px 2px 9px", gap: 9, marginBottom: 4 },
  mdMinutesColHeadSpacerDisc: { width: 32, flexShrink: 0 },
  mdMinutesColHeadSpacerName: { flex: 1, minWidth: 0 },
  // Centre-aligned (real-use feedback) — the headers sit directly above
  // mdMinutesValuePitch/Goal/Bench below, which match.
  mdMinutesColHeadPitch: {
    flex: 1, textAlign: "center", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11.5,
    letterSpacing: "0.03em", color: tokens.color.pitchGreen,
  },
  mdMinutesColHeadGoal: {
    width: 52, flexShrink: 0, textAlign: "center", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11.5,
    letterSpacing: "0.03em", color: tokens.color.goldText,
  },
  mdMinutesColHeadBench: {
    width: 52, flexShrink: 0, textAlign: "center", fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11.5,
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
  // Centre-aligned (real-use feedback) — matches mdMinutesColHeadPitch/
  // Goal/Bench above. Shared by SummaryModal's per-row/totals values and
  // RotationProgressOverlay's own current/candidate minutes tables (same
  // row shape, deliberately reused rather than restyled separately).
  mdMinutesValuePitch: {
    flex: 1, textAlign: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17, color: tokens.color.pitchGreen,
  },
  mdMinutesValueGoal: {
    width: 52, flexShrink: 0, textAlign: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17,
    color: tokens.color.goldText,
  },
  mdMinutesValueBench: {
    width: 52, flexShrink: 0, textAlign: "center", fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17,
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
};

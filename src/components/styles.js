// All visual styling for Bench Buddy, kept as inline-style objects rather
// than CSS (this matches how the component was originally built as a
// self-contained Claude.ai artifact). Pulled into its own file so the
// component files can focus on structure/behavior — see the architecture
// notes for the trade-offs of this approach vs. a CSS framework.

export const fontStyle = `
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

export const styles = {
  app: { fontFamily: "system-ui, -apple-system, sans-serif", background: colors.chalk, minHeight: 500, color: colors.ink },
  loadingWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: 300, background: colors.chalk },
  loadingText: { color: colors.grass, fontWeight: 700 },
  header: { background: colors.grass, padding: "10px 16px" },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerLogoGroup: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  logoMark: { fontSize: 20 },
  headerTitle: { color: colors.chalk, fontWeight: 900, letterSpacing: 2, fontSize: 16, textTransform: "uppercase" },
  teamSwitcherTrigger: {
    display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.12)", color: colors.chalk,
    border: "none", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer",
    maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0,
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
  main: { padding: "12px 16px", maxWidth: 640, margin: "0 auto" },
  sectionTitle: { fontSize: 17, fontWeight: 900, marginBottom: 8, color: colors.grass, textTransform: "uppercase", letterSpacing: 0.5 },
  subTrackerHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  headerBtnGroup: { display: "flex", gap: 6 },
  editSettingsBtn: {
    display: "flex", alignItems: "center", gap: 5, background: "transparent", color: colors.grass,
    border: "1px solid " + colors.border, borderRadius: 8, padding: "5px 10px", fontWeight: 700, fontSize: 12,
    cursor: "pointer", marginBottom: 8,
  },
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
  numberBadge: {
    width: 38, height: 38, borderRadius: "50%", border: "1.5px solid " + colors.border, background: "transparent",
    color: "#9AA6A0", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  numberBadgeActive: { background: colors.field, borderColor: colors.field, color: "#fff" },
  gloveToggle: {
    width: 38, height: 38, borderRadius: 8, border: "1px solid " + colors.border, background: "transparent",
    fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.35, flexShrink: 0,
  },
  gloveToggleActive: { opacity: 1, background: "#FFF6E4", borderColor: colors.gk },

  timerBar: {
    display: "flex", alignItems: "center", gap: 10, background: colors.ink, borderRadius: 12, padding: "10px 14px", marginBottom: 2,
  },
  clockBlock: { display: "flex", flexDirection: "column", flex: 1 },
  clockDisplay: { fontSize: 28, fontWeight: 900, color: colors.chalk, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  clockSub: { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginTop: 2 },
  timerBtn: {
    display: "flex", alignItems: "center", gap: 6, padding: "13px 18px", borderRadius: 10, border: "none",
    fontWeight: 700, fontSize: 14, cursor: "pointer", minHeight: 44,
  },
  timerBtnPlay: { background: colors.field, color: "#fff" },
  timerBtnPause: { background: colors.gk, color: "#fff" },
  timerBtnDone: { background: colors.border, color: colors.bench, cursor: "default" },
  intervalCountdown: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    textAlign: "center", fontSize: 12, color: "#5B6B64", fontWeight: 600, margin: "6px 0",
  },
  confirmBtnInline: {
    background: colors.field, color: "#fff", border: "none", borderRadius: 8,
    padding: "5px 10px", fontWeight: 800, fontSize: 11, cursor: "pointer",
  },
  gkWarmup: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: colors.gk, color: "#fff",
    fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, marginBottom: 8,
  },
  warmupText: { display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.3 },
  confirmBtn: {
    flex: "0 0 auto", background: "rgba(255,255,255,0.9)", color: colors.ink, border: "none", borderRadius: 8,
    padding: "7px 11px", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  },
  confirmedNote: {
    textAlign: "center", fontSize: 11, fontWeight: 700, color: colors.field, background: "#E9F5EE",
    padding: "6px 10px", borderRadius: 8, marginBottom: 8,
  },
  // Wraps intervalTabs so the fade-out hint below can be positioned over its
  // trailing edge — a plain overflow-x:auto row otherwise gives no visual
  // sign there's more to scroll to once the game has enough intervals to
  // overflow a phone-width screen.
  intervalTabsWrap: { position: "relative", marginBottom: 8 },
  intervalTabs: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 },
  intervalTabsFade: {
    position: "absolute", top: 0, right: 0, bottom: 2, width: 28,
    background: `linear-gradient(to right, rgba(244,247,242,0), ${colors.chalk})`,
    pointerEvents: "none",
  },
  intervalTab: {
    flex: "0 0 auto", padding: "9px 12px", borderRadius: 8, border: "1px solid " + colors.border,
    background: colors.cardBg, fontSize: 12, fontWeight: 700, cursor: "pointer", color: colors.ink,
  },
  intervalTabActive: { background: colors.grass, color: colors.chalk, border: "1px solid " + colors.grass },

  pitchBoard: { background: colors.pitchDark, borderRadius: 14, padding: 12 },
  pitchInner: { position: "relative", width: "100%", height: 220, marginBottom: 4 },
  pitchCenterCircle: {
    position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)",
    width: 80, height: 80, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)",
  },
  pitchHalfwayLine: { position: "absolute", top: "40%", left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.2)" },
  pitchGoalBox: {
    position: "absolute", bottom: 0, left: "30%", right: "30%", height: 40,
    border: "2px solid rgba(255,255,255,0.25)", borderBottom: "none", borderRadius: "4px 4px 0 0",
  },
  formationToken: {
    position: "absolute", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 3, width: 76,
  },
  tokenWithAction: { display: "flex", alignItems: "center", gap: 4 },
  // Kept smaller than the 44px ideal on purpose: it sits directly beside the
  // 40px pitch token within a 76px-wide formation slot, and up to 5 of these
  // pairs share the pitch width — growing it further would start crowding
  // neighboring players. Still a meaningful bump from the original 22px.
  injuryBtnSide: {
    width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(193,80,46,0.9)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, cursor: "pointer", padding: 0,
  },
  gloveIcon: { fontSize: 16, lineHeight: 1 },
  pitchLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 800, letterSpacing: 1.2, marginBottom: 6, marginTop: 8 },
  tokenRow: { display: "flex", flexWrap: "wrap", gap: 10 },
  tokenCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 62 },
  token: {
    width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.25)", border: "none", padding: 0, font: "inherit",
  },
  tokenSwapTarget: { cursor: "pointer", boxShadow: "0 0 0 3px rgba(255,255,255,0.85), 0 2px 6px rgba(0,0,0,0.25)" },
  tokenField: { background: colors.field },
  tokenGk: { background: colors.gk },
  tokenBench: { background: "transparent", border: "2px dashed rgba(255,255,255,0.5)", color: "rgba(255,255,255,0.8)" },
  tokenInjured: { background: "transparent", border: "2px dashed " + colors.danger, fontSize: 16 },
  tokenName: { color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center" },
  noneText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },

  benchInjuredRow: { display: "flex", gap: 14 },
  benchCol: { flex: 1, minWidth: 0 },
  injuredCol: { flex: 1, minWidth: 0, borderLeft: "1px dashed rgba(255,255,255,0.25)", paddingLeft: 12 },
  backInBtn: {
    marginTop: 2, background: colors.field, color: "#fff", border: "none", borderRadius: 999,
    padding: "3px 9px", fontWeight: 700, fontSize: 10, cursor: "pointer",
  },
  swapBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: colors.field,
    color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, marginBottom: 10,
  },
  swapCancelBtn: {
    background: "rgba(255,255,255,0.9)", color: colors.ink, border: "none", borderRadius: 8,
    padding: "5px 10px", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  },
  // width:100% (of the 62px tokenCol) rather than content-driven horizontal
  // padding — the original fix (bumping padding) risked the button growing
  // wider than its column, since text width varies by font rendering. This
  // way it's always exactly as wide as the column, however tall we make it.
  swapBtn: {
    marginTop: 4, background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 999,
    padding: "9px 4px", fontWeight: 700, fontSize: 12, cursor: "pointer", minHeight: 36, width: "100%",
  },
  swapBtnActive: { background: colors.danger, borderColor: colors.danger },

  planNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 16 },
  planNavLabel: { fontSize: 13, fontWeight: 700, color: "#5B6B64" },

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
  backupPanel: { marginTop: 10, background: "#F4F7F2", border: "1px solid " + colors.border, borderRadius: 10, padding: 12 },
  backupSubTitle: { fontSize: 12, fontWeight: 800, color: colors.grass, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  backupHint: { fontSize: 11, color: "#5B6B64", lineHeight: 1.4, margin: "0 0 6px 0" },
  backupTextarea: {
    width: "100%", minHeight: 70, fontSize: 11, fontFamily: "monospace", padding: 8, borderRadius: 8,
    border: "1px solid " + colors.border, resize: "vertical", marginBottom: 6, color: colors.ink, background: "#fff",
  },
  backupBtn: {
    background: colors.grass, color: colors.chalk, border: "none", borderRadius: 8, padding: "7px 12px",
    fontWeight: 700, fontSize: 12, cursor: "pointer",
  },
  backupStatus: { marginTop: 6, fontSize: 11, fontWeight: 700, color: colors.field },
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

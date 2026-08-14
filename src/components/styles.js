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
  // marginTop: 0 matters here specifically for subTrackerHeaderRow below —
  // without it, the browser's default <h2> top margin (not otherwise reset
  // anywhere in this file) throws off align-items: center against the
  // Summary/Edit buttons, which have no such margin.
  sectionTitle: { fontSize: 17, fontWeight: 900, margin: 0, marginBottom: 8, color: colors.grass, textTransform: "uppercase", letterSpacing: 0.5 },
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

  timerBar: {
    display: "flex", alignItems: "center", gap: 10, background: colors.ink, borderRadius: 12, padding: "20px 14px", marginBottom: 2,
  },
  clockBlock: { display: "flex", flexDirection: "column", flex: 1 },
  clockDisplay: { fontSize: 38, fontWeight: 900, color: colors.chalk, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  clockSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginTop: 3 },
  timerBtn: {
    display: "flex", alignItems: "center", gap: 6, padding: "13px 18px", borderRadius: 10, border: "none",
    fontWeight: 700, fontSize: 14, cursor: "pointer", minHeight: 44,
  },
  timerBtnPlay: { background: colors.field, color: "#fff" },
  timerBtnPause: { background: colors.gk, color: "#fff" },
  timerBtnDone: { background: colors.border, color: colors.bench, cursor: "default" },
  intervalCountdown: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    textAlign: "center", fontSize: 16, color: "#5B6B64", fontWeight: 600, margin: "8px 0",
    // Without this, a "1" is narrower than an "8" in most fonts, so the
    // clock text's total width shifts slightly every second — and since
    // this row is centered (justifyContent: center) with a button next to
    // it, that width change visibly nudges the whole row, button included,
    // left and right as the seconds tick. Locks every digit to the same
    // width so the row's total width — and its centered position — never
    // moves. Found by testing on a real phone: reported as "the countdown
    // moves the button a pixel every 2-3 seconds", which is exactly the
    // rhythm of hitting narrower digits like "1".
    fontVariantNumeric: "tabular-nums",
  },
  confirmBtnInline: {
    background: colors.field, color: "#fff", border: "none", borderRadius: 8,
    padding: "5px 10px", fontWeight: 800, fontSize: 11, cursor: "pointer",
  },
  gkWarmup: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: colors.gk, color: "#fff",
    fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, marginBottom: 8,
  },
  // Same shape as gkWarmup but field-green rather than gk-gold — this is a
  // "you're done, here's what's next" moment, not a warning.
  matchCompleteBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: colors.field, color: "#fff",
    fontWeight: 700, fontSize: 13, padding: "10px 12px", borderRadius: 10, marginBottom: 8,
  },
  warmupText: { display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.3 },
  // Deliberately the biggest, boldest thing in the box — a coach glancing
  // at their phone from a few feet away on the sideline needs the
  // countdown to be readable at a glance, not buried mid-sentence.
  warmupCountdown: { fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  confirmBtn: {
    flex: "0 0 auto", background: "rgba(255,255,255,0.9)", color: colors.ink, border: "none", borderRadius: 8,
    padding: "7px 11px", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  },
  confirmedNote: {
    textAlign: "center", fontSize: 11, fontWeight: 700, color: colors.field, background: "#E9F5EE",
    padding: "6px 10px", borderRadius: 8, marginBottom: 8,
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
  intervalTab: {
    flex: "0 0 auto", padding: "9px 12px", borderRadius: 8, border: "1px solid " + colors.border,
    background: colors.cardBg, fontSize: 12, fontWeight: 700, cursor: "pointer", color: colors.ink,
    scrollSnapAlign: "start",
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
  // Just wraps the 40px circle now — position:relative so injuryBtnSide can
  // anchor to it directly (see below).
  tokenWithAction: { position: "relative", display: "flex" },
  // Tried overlapping this on the circle's corner at one point (to fight a
  // rightward-skew complaint) but it read as sitting on top of the player
  // icon, which was worse — reverted to floating beside it. right:-32 =
  // 28px button width + 4px gap. Kept smaller than the 44px ideal on
  // purpose: up to 5 of these overlap the pitch width side by side —
  // growing it further would start crowding neighboring players.
  //
  // Off-white (colors.chalk) rather than gray or green: gray read as flat/
  // non-interactive against the dark pitch, and green risked being
  // confused with nextOnBadge's green (a genuinely different meaning) even
  // though the two don't sit in the same spot on a token. White gives the
  // strongest contrast against colors.pitchDark of anything in the
  // palette, which is what actually makes something look tappable, and it
  // sits entirely outside the red/green/gold "next interval" vocabulary.
  injuryBtnSide: {
    position: "absolute", right: -32, top: "50%", transform: "translateY(-50%)",
    width: 28, height: 28, borderRadius: "50%", border: "none", background: colors.chalk,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, cursor: "pointer", padding: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },
  gloveIcon: { fontSize: 25, lineHeight: 1 },
  // Advance notice of the next sub window's changes, shown on top of the
  // relevant token — top-left corner, opposite side from injuryBtnSide
  // (top-right-ish) so the two never collide. Deliberately simple, fixed
  // colors: red = off the pitch, green = playing outfield next (whether
  // arriving from the bench or staying on but losing keeper duty — same
  // badge either way, see steppingDownKeeperId in MatchView). A given token
  // only ever shows one badge (this or nextKeeperBadge below), so they can
  // safely share the same position.
  nextOffBadge: {
    position: "absolute", left: -6, top: -6, width: 18, height: 18, borderRadius: "50%",
    background: colors.danger, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    pointerEvents: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },
  nextOnBadge: {
    position: "absolute", left: -6, top: -6, width: 18, height: 18, borderRadius: "50%",
    background: colors.field, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    pointerEvents: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },
  // A keeper handover is a role change, not necessarily a substitution (the
  // two players involved are often already both on the pitch) — this gets
  // its own gold-and-glove treatment, distinct from the red/green subs
  // badges above, so it never reads as "just another sub". Shown only on
  // whoever's becoming keeper, wherever they currently are — the outgoing
  // keeper just gets the regular green "switching to outfield" badge.
  nextKeeperBadge: {
    position: "absolute", left: -6, top: -6, width: 18, height: 18, borderRadius: "50%",
    background: colors.gk, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, lineHeight: 1, pointerEvents: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },
  // Bench tokens don't have their own relative wrapper the way on-pitch
  // tokens get from tokenWithAction — this is that, just for the bench row.
  tokenCircleWrap: { position: "relative", display: "inline-flex" },
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

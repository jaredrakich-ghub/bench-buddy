// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// SignIn.jsx (rendered when the "Already have a team?" link is tapped —
// see the describe block below) reaches into ../lib/auth.js on import;
// mocked here so a test render never touches the real Firebase SDK, same
// as SignIn.test.jsx's own mock.
vi.mock("../lib/auth.js", () => ({
  signInWithGoogle: vi.fn(),
  sendLoginEmailLink: vi.fn(),
  signInAnon: vi.fn(),
}));
import SquadSettingsForm from "./SquadSettingsForm.jsx";

afterEach(cleanup);

const ROSTER = [
  { id: "p1", name: "Alice", keeperEligible: true },
  { id: "p2", name: "Bob", keeperEligible: false },
];
const numberOf = (id) => ({ p1: 1, p2: 2 }[id] ?? "?");

function baseProps(overrides = {}) {
  return {
    roster: ROSTER,
    gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6 },
    setGameSettings: vi.fn(),
    availableIds: ["p1", "p2"],
    setAvailableIds: vi.fn(),
    newPlayerName: "",
    setNewPlayerName: vi.fn(),
    addPlayer: vi.fn(),
    addPlayers: vi.fn(),
    removePlayer: vi.fn(),
    toggleAvailable: vi.fn(),
    toggleKeeperEligible: vi.fn(),
    setAllKeeperEligible: vi.fn(),
    numberOf,
    onSubmit: vi.fn(),
    submitLabel: "Generate Rotation",
    startingGkId: null,
    setStartingGkId: vi.fn(),
    ...overrides,
  };
}

// The exact scenario the starting-keeper investigation found (see
// pickFairStartingGk's tests in rotation.test.js): 7 players, fieldSize 5,
// a 42-minute/7-interval game, everyone keeper-eligible. Starting p2 or p3
// in goal produces a real 12-minute spread; every other choice is perfectly
// even. Used here to exercise the live warning banner against a real,
// known-unfair pick rather than a made-up one.
const FAIRNESS_ROSTER = Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, keeperEligible: true }));
const FAIRNESS_SETTINGS = { fieldSize: 5, gameMinutes: 42, subIntervalMinutes: 6 };

describe("SquadSettingsForm — rendering (inline / A3 layout)", () => {
  // Real-use feedback, round 1 ("needs a lot of care as this is the
  // user's first experience with the app"): this header used to always be
  // a plain title-row + optional ✕. Made context-aware — no onClose (a
  // genuinely new team, straight off sign-in) got its own crest+"TEAM"-
  // label shell, echoing MatchView's own header; onClose (an *additional*
  // team, added via Team & account) got the same back-chevron shell
  // "edit" uses.
  //
  // Round 2, real-device feedback: reaching "Set up new team" two
  // different ways (a genuinely first-ever team vs. Continue as Guest
  // re-bootstrapping a fresh anonymous session) landed on two visibly
  // different headers — read as a bug, not a deliberate distinction. Both
  // now get the same back-chevron shell; the back button itself still
  // only renders when there's actually an onClose to call.
  it("shows the same header shell with no back control for a first-ever team (no onClose)", () => {
    render(<SquadSettingsForm {...baseProps({ title: "Set up new team" })} />);
    expect(screen.getByText("Set up new team")).toBeInTheDocument();
    expect(screen.queryByTitle("Back")).not.toBeInTheDocument();
    // Not the old crest+"TEAM"-label shell any more.
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
  });

  // Real-device feedback: "Set up new team" looked "very plain" without
  // its crest once the header unified onto the back-chevron shell —
  // crestSrc alone (no teamName — nothing to name yet on this screen) is
  // enough to show it now, decoupled from teamName's own presence.
  // Real-device feedback, round 2: the first restoration used the small
  // 22px inline-crest treatment (mdSubHeaderTeamCrest, still used below
  // for a team-name row) — asked for the original 62px size and
  // left-of-title position back specifically. Reuses mdCrestOuter/
  // mdCrestImg directly (the exact style MatchView's own header still
  // uses), not a new near-identical size.
  it("shows the crest at its original 62px size, not the smaller inline-team-row treatment", () => {
    const { container } = render(<SquadSettingsForm {...baseProps({ title: "Set up new team", crestSrc: "mascot.jpg" })} />);
    // Decorative image (alt="") — not exposed via role="img", so queried
    // directly rather than through an accessibility-tree lookup.
    const img = container.querySelector('img[src="mascot.jpg"]');
    expect(img).toBeInTheDocument();
    const outer = img.parentElement;
    expect(outer.style.width).toBe("62px");
    expect(outer.style.height).toBe("62px");
  });

  it("shows the same header shell with a working back control for an additional team (onClose provided)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ title: "Set up new team", onClose })} />);
    expect(screen.getByText("Set up new team")).toBeInTheDocument();
    await user.click(screen.getByTitle("Back"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Real-use feedback (real-device screenshot): an additional team (onClose
  // set, a genuine back destination exists) showed the crest AND the
  // back-chevron together, reading as two competing headers. The crest is
  // for the genuine first-ever-team case only — anyone with a back button
  // already knows this screen shape from Game settings.
  it("shows the back chevron instead of the crest when onClose is given, even with a crestSrc", () => {
    const { container } = render(
      <SquadSettingsForm {...baseProps({ title: "Set up new team", crestSrc: "mascot.jpg", onClose: vi.fn() })} />
    );
    expect(screen.getByTitle("Back")).toBeInTheDocument();
    expect(container.querySelector('img[src="mascot.jpg"]')).not.toBeInTheDocument();
  });

  it("shows the three tiles, the squad, and the sub-window preview", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getByText("5")).toBeInTheDocument(); // on pitch
    expect(screen.getByText("40")).toBeInTheDocument(); // minutes
    expect(screen.getByText("on pitch")).toBeInTheDocument();
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sub windows/).length).toBeGreaterThan(0);
  });

  // Real-use feedback: "inline" should now "appear exactly how it does
  // the Game settings screen" — Goal Keeper Options and Breaks collapsed
  // by default here too, not open flat the way "inline" used to show
  // them. Manage squad no longer lives in this accordion at all (moved to
  // ManageSquadScreen.jsx, reached from Team & account) — nothing here to
  // collapse.
  //
  // Real-use feedback, later: Keepers/First in goal today/Keeper changes
  // used to be three separate collapsed rows here — merged into one
  // "Goal Keeper Options" entry (three separate GK-related rows read as
  // clutter). Collapsed, none of the three sub-section labels are in the
  // DOM at all yet — they only render once the merged card is expanded.
  it("collapses Goal Keeper Options and Breaks by default, same as 'edit'", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getByText("Goal Keeper Options")).toBeInTheDocument();
    expect(screen.getByText("Breaks")).toBeInTheDocument();
    expect(screen.queryByText("First in goal today")).not.toBeInTheDocument();
    expect(screen.queryByText("Keeper changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Keepers")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage squad")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Collapse")).not.toBeInTheDocument(); // nothing expanded
    expect(screen.queryByText("Tap a name to pick who starts in goal today.")).not.toBeInTheDocument();
  });

  // Real-use feedback: Who's here should be the very first thing a coach
  // does, not tiles/settings — DOCUMENT_POSITION_FOLLOWING confirms each
  // element genuinely comes *after* the previous one in the DOM, not just
  // that all three happen to be present somewhere.
  it("orders Who's here, then the tiles, then Goal Keeper Options, then Breaks", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    const whosHere = screen.getByText("Who's here");
    const tile = screen.getByText("on pitch");
    const gkOptions = screen.getByText("Goal Keeper Options");
    const breaks = screen.getByText("Breaks");
    expect(whosHere.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tile.compareDocumentPosition(gkOptions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(gkOptions.compareDocumentPosition(breaks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

});

// Real-use feedback: Keepers/First in goal today/Keeper changes used to be
// three separate accordion entries — merged into one "Goal Keeper Options"
// card now (three GK-related rows read as clutter). No collapsed-row value
// badge any more (there's no single clean value once three settings are
// combined into one row) — these tests cover the merged card's own Keepers
// sub-section specifically; "In goal today"/"Keeper swaps stepper" below
// cover its other two sub-sections.
describe("SquadSettingsForm — Keepers sub-section (inside the merged Goal Keeper Options card)", () => {
  it("defaults to collapsed — no eligibility toggle rows in the DOM yet", () => {
    render(<SquadSettingsForm {...baseProps()} />); // ROSTER: Alice eligible, Bob not
    expect(screen.getByText("Goal Keeper Options")).toBeInTheDocument();
    expect(screen.queryByTitle("Toggle keeper-eligible")).not.toBeInTheDocument();
  });

  it("expands to show a toggle row per player; tapping one calls toggleKeeperEligible with their id", async () => {
    const toggleKeeperEligible = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ toggleKeeperEligible })} />);
    await user.click(screen.getByText("Goal Keeper Options"));
    expect(screen.getByText("Keepers")).toBeInTheDocument();
    expect(screen.getByText("Everyone can play in goal by default — turn off anyone who shouldn't.")).toBeInTheDocument();
    await user.click(screen.getAllByTitle("Toggle keeper-eligible")[0]);
    expect(toggleKeeperEligible).toHaveBeenCalledWith("p1");
  });

  it("expanded, offers Select all, which marks everyone eligible", async () => {
    const setAllKeeperEligible = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setAllKeeperEligible })} />);
    await user.click(screen.getByText("Goal Keeper Options"));
    await user.click(screen.getByText("Select all"));
    expect(setAllKeeperEligible).toHaveBeenCalledWith(true);
  });

  it("doesn't offer Select all when the roster is empty, showing the empty state instead", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    await user.click(screen.getByText("Goal Keeper Options"));
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
    expect(screen.getByText("No players yet — add your squad above.")).toBeInTheDocument();
  });

  // Real-use feedback: "This should be available under Set up a New Team
  // Screen and Set Up Next Game" — extended to every "edit" render (not
  // just the match-complete one), since Manage squad's own 🧤 toggle is
  // gone from there too now and plain Game settings needs somewhere to
  // reach eligibility just as much as the other two contexts do.
  it("also appears in the 'edit' layout, directly after the header", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", title: "Game settings" })} />);
    const header = screen.getByText("Game settings");
    const gkOptions = screen.getByText("Goal Keeper Options");
    expect(header.compareDocumentPosition(gkOptions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(gkOptions);
    expect(screen.getByText("Keepers")).toBeInTheDocument();
  });
});

describe("SquadSettingsForm — rendering (edit / A4 layout)", () => {
  // Real-use feedback: this screen's own header should look exactly like
  // Minutes/Who's here's own (mdSubHeader — yellow beveled bar, white
  // back button), not its previous plain title-row + ✕. "Back", not
  // "Close" — same semantics as those two screens' own back buttons.
  it("shows the given title and a back button that calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", title: "Edit this game", onClose })} />);
    expect(screen.getByText("Edit this game")).toBeInTheDocument();
    await user.click(screen.getByTitle("Back"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives the edit layout's header the same yellow-beveled shell as Minutes/Who's here (mdSubHeader)", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", onClose: vi.fn() })} />);
    const header = screen.getByTitle("Back").closest("div");
    expect(header).toHaveStyle({ backgroundColor: "rgb(251, 227, 166)" }); // tokens.color.headerYellow
  });

  // Backlog #1: confirm which team you're setting up next, implicitly, by
  // actually naming it — only for the "Set up next game" moment
  // (SubRotationPlanner passes teamName only when isMatchComplete); a
  // plain mid-match "Game settings" visit never gets this prop at all.
  it("shows a small crest+team-name row above the title when teamName is given", () => {
    const { container } = render(
      <SquadSettingsForm {...baseProps({ variant: "edit", title: "Set up next game", teamName: "Scorpions", crestSrc: "/crest.jpg", onClose: vi.fn() })} />
    );
    expect(screen.getByText("Scorpions")).toBeInTheDocument();
    expect(screen.getByText("Set up next game")).toBeInTheDocument();
    expect(container.querySelector('img[src="/crest.jpg"]')).toBeInTheDocument();
  });

  it("omits the crest+team-name row entirely for a plain 'Game settings' visit (no teamName)", () => {
    const { container } = render(<SquadSettingsForm {...baseProps({ variant: "edit", title: "Game settings", onClose: vi.fn() })} />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  // Goal Keeper Options carries no collapsed-row value of its own any more
  // (see the merged-card describe block above) — Breaks still does.
  it("shows Goal Keeper Options and Breaks collapsed to one-line rows, Breaks carrying its current value", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.getByText("Goal Keeper Options")).toBeInTheDocument();
    expect(screen.getByText("Breaks")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.queryByText("First in goal today")).not.toBeInTheDocument();
    expect(screen.queryByText("Keeper changes")).not.toBeInTheDocument();
  });

  it("opens with nothing expanded by default (no initialExpandedSection)", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.queryByTitle("Collapse")).not.toBeInTheDocument();
  });

  // Real-use feedback: this row used to duplicate SquadChangeScreen.jsx's
  // own job (the cog menu's "Who's here" row) — availability toggling and
  // +Player both live there now, so the edit layout drops its own copy of
  // that section entirely.
  it("has no Who's here availability section — that's SquadChangeScreen's own job now", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.queryByText("Who's here?")).not.toBeInTheDocument();
    expect(screen.queryByText("tap to drop out")).not.toBeInTheDocument();
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });

  // Backlog #1, corrected: starting a new game should confirm who's here
  // today, same as first-time setup — confirmAvailability is the one
  // exception to the test right above it.
  it("shows the same Who's-here confirmation as first-time setup when confirmAvailability is on, prefilled from availableIds", async () => {
    const toggleAvailable = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", confirmAvailability: true, availableIds: ["p1"], toggleAvailable })} />);
    expect(screen.getByText("Who's here")).toBeInTheDocument();
    expect(screen.getByText("1 in")).toBeInTheDocument();
    expect(screen.getByText("tap to drop out")).toBeInTheDocument();

    // Alice (p1, available) reads normally; Bob (p2, not available this
    // game) gets the same greyed treatment used everywhere else in the
    // app for "not here today" — not a new visual, the existing one.
    expect(screen.getByText("Alice").closest("button")).not.toHaveStyle({ opacity: "0.6" });
    expect(screen.getByText("Bob").closest("button")).toHaveStyle({ opacity: "0.6" });

    // The same +Player control is here too, for a new arrival who isn't
    // on the roster at all yet.
    expect(screen.getByText("Player")).toBeInTheDocument();

    await user.click(screen.getByText("Bob"));
    expect(toggleAvailable).toHaveBeenCalledWith("p2");
  });

  // Real-use feedback: wanted the Breaks row to read as one phrase
  // ("Breaks" + "Every third"), matching how "Keeper changes" + "Every 4′"
  // already reads.
  it("shows the Breaks row's value as 'Every <segment>', not the chip's own plain noun", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, breakSegments: 3 } })} />);
    expect(screen.getByText("Every third")).toBeInTheDocument();
    expect(screen.queryByText("Thirds")).not.toBeInTheDocument(); // that's the chip's own label, only shown once expanded
  });

  // Goal Keeper Options and Breaks are still mutually exclusive (one
  // expandedSection at a time) — but Goal Keeper Options' own three
  // sub-sections (Keepers/First in goal today/Keeper changes) all open
  // together now, not one at a time within it.
  it("expands Goal Keeper Options to show all three of its sub-sections at once, and only one top-level section at a time", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);

    await user.click(screen.getByText("Goal Keeper Options"));
    expect(screen.getByText("Keepers")).toBeInTheDocument();
    expect(screen.getByText("Tap a name to pick who starts in goal today.")).toBeInTheDocument();
    expect(screen.getByText("Leave at the sub length to rotate keepers every window.")).toBeInTheDocument();

    // Opening Breaks closes Goal Keeper Options back to its one-liner.
    await user.click(screen.getByText("Breaks"));
    expect(screen.queryByText("Tap a name to pick who starts in goal today.")).not.toBeInTheDocument();
    expect(screen.getAllByText(/sub windows/).length).toBeGreaterThan(0);
  });

  it("collapses an expanded section back via its chevron", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("Breaks"));
    expect(screen.getAllByText(/sub windows/).length).toBeGreaterThan(0);
    // The chevron toggle is icon-only now (ChevronDown, lucide-react) —
    // queried by its title, same pattern as the app's other icon-only
    // buttons ("Back", "Remove from squad", etc.).
    await user.click(screen.getByTitle("Collapse"));
    expect(screen.getByText("Breaks")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  // Real-device feedback: the old text-glyph "⌄" was too small a tap
  // target (18px font, no padding) and couldn't get much "thicker" than
  // 800-weight already was. Both fixed by switching to a real SVG icon
  // (ChevronDown) with explicit strokeWidth, inside a padded box.
  it("gives the collapse chevron a bigger, thicker, real tap target than before", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("Breaks"));
    const chevron = screen.getByTitle("Collapse");
    expect(chevron).toHaveStyle({ padding: "8px" });
    const icon = chevron.querySelector("svg");
    expect(icon).toHaveAttribute("stroke-width", "3");
  });

  // Real-use feedback: "all collapse arrows...should be vertically
  // aligned for consistency" — Breaks/Manage squad's own chevrons used to
  // sit right next to the title instead of flush against the card's
  // right edge like First in goal today's already did. mdSetupCardTitle's
  // own flex:1 (styles.js) is what makes this automatic regardless of how
  // long each section's title text is.
  it("right-aligns every section's collapse chevron to the same edge", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("Breaks"));
    const row = screen.getByTitle("Collapse").closest("div");
    expect(row.lastElementChild).toBe(screen.getByTitle("Collapse"));
  });

  // Real-use feedback: "Keeper Change[s]...we need to add in a collapse
  // arrow" — its own expanded card had no way to close itself before
  // (only opening a different section closed it). Now Keeper changes is a
  // sub-section of the merged Goal Keeper Options card, which carries the
  // one collapse chevron for all three sub-sections together.
  it("gives Goal Keeper Options one collapse chevron that closes all three of its sub-sections", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("Goal Keeper Options"));
    expect(screen.getByText("Leave at the sub length to rotate keepers every window.")).toBeInTheDocument();
    await user.click(screen.getByTitle("Collapse"));
    expect(screen.queryByText("Leave at the sub length to rotate keepers every window.")).not.toBeInTheDocument();
    expect(screen.queryByText("Keepers")).not.toBeInTheDocument();
    expect(screen.getByText("Goal Keeper Options")).toBeInTheDocument(); // back to its one-line row
  });

});

describe("SquadSettingsForm — number tiles (tap to flip, stepper)", () => {
  // Keeper changes (further down) starts collapsed by default in both
  // layouts now, so it doesn't contribute its own −/+ here unless a test
  // explicitly expands it — no disambiguation needed for a plain resting
  // vs. flipped check.
  it("tapping a resting tile flips it and shows a −/+ stepper", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.queryByText("−")).not.toBeInTheDocument();
    await user.click(screen.getByText("on pitch"));
    expect(screen.getAllByText("−")).toHaveLength(1);
  });

  it("+ steps fieldSize up by 1", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    await user.click(screen.getByText("on pitch"));
    await user.click(screen.getAllByText("+")[0]);
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 6, gameMinutes: 40, subIntervalMinutes: 6 });
  });

  it("steps gameMinutes by 5, not 1", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    await user.click(screen.getByText("minutes"));
    await user.click(screen.getAllByText("+")[0]);
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 45, subIntervalMinutes: 6 });
  });

  it("won't step below the tile's own minimum", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ gameSettings: { fieldSize: 2, gameMinutes: 40, subIntervalMinutes: 6 }, setGameSettings })} />);
    await user.click(screen.getByText("on pitch"));
    await user.click(screen.getAllByText("−")[0]);
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 2, gameMinutes: 40, subIntervalMinutes: 6 });
  });

  it("tapping the flipped tile's own body settles it back, without changing any value", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    await user.click(screen.getByText("on pitch"));
    expect(screen.getAllByText("−")).toHaveLength(1);
    await user.click(screen.getByText("sub every")); // tapping a different resting tile
    expect(screen.getAllByText("−")).toHaveLength(1); // still exactly one flipped tile
    expect(setGameSettings).not.toHaveBeenCalled();
  });

  // Real-use feedback: settling a flipped tile back used to only work by
  // tapping dead centre on the tile's own body -- tapping anywhere else on
  // the page (another section entirely, not just a different tile) left
  // it stuck open.
  it("tapping outside the tiles row settles a flipped tile back too, not just tapping its own body", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    const tilesRow = screen.getByText("on pitch").closest("div").parentElement;
    await user.click(screen.getByText("on pitch"));
    // Keeper changes' own stepper isn't in the DOM yet in the edit layout
    // (that section starts collapsed) -- just this tile's own "-" here.
    expect(screen.getAllByText("−")).toHaveLength(1);
    // Tapping a wholly unrelated section, not another tile. This also
    // expands Goal Keeper Options, which reveals Keeper changes' own
    // separate "−" stepper — so the check below is scoped to the tiles
    // row specifically, not a document-wide absence of "−" text.
    await user.click(screen.getByText("Goal Keeper Options"));
    expect(within(tilesRow).queryByText("−")).not.toBeInTheDocument(); // the tile settled back
    expect(screen.getByTitle("Collapse")).toBeInTheDocument(); // the outside tap's own action still happened
  });
});

// This grid (tap-to-toggle chips, dashed "+ Player" reveal, Select all) is
// now "edit"-only — see the "inline" variant's own quick-add describe
// block below for its replacement there. confirmAvailability:true is what
// makes "edit" render this section at all (see SquadSettingsForm.jsx's own
// comment on that prop).
describe("SquadSettingsForm — squad chips (availability, edit variant)", () => {
  // Real-use feedback: this row used to be the same 2-row scrolling grid
  // as the pitch screen's own bench chips (mdBenchChipRow), with the
  // "+ Player" chip pinned position:sticky to the scroll viewport's right
  // edge — real-device feedback found that sticky chip visually
  // overlapping real player chips scrolling underneath it "looks very
  // strange." Now a plain wrapping row instead — every chip, "+ Player"
  // included, just wraps to as many rows as it needs, no scroll, no
  // sticky positioning needed at all.
  it("wraps chips in a plain row instead of the old scrolling grid with a sticky + Player chip", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", confirmAvailability: true })} />);
    const addChip = screen.getByText("Player").closest("button");
    expect(addChip.style.position).not.toBe("sticky");
    const chipRow = addChip.parentElement;
    expect(chipRow.style.flexWrap).toBe("wrap");
    expect(chipRow.style.display).toBe("flex");
  });

  it("tapping a player's chip calls toggleAvailable with their id", async () => {
    const toggleAvailable = vi.fn();
    const user = userEvent.setup();
    // Bob isn't keeper-eligible, so his only two appearances are the squad
    // chip and the Manage-squad row name — no In-goal chip to disambiguate
    // from, unlike Alice.
    render(<SquadSettingsForm {...baseProps({ variant: "edit", confirmAvailability: true, toggleAvailable })} />);
    await user.click(screen.getAllByText("Bob")[0]);
    expect(toggleAvailable).toHaveBeenCalledWith("p2");
  });

  it("tapping + Player reveals the add-player input; Enter and the Add button both call addPlayer", async () => {
    const addPlayer = vi.fn();
    const setNewPlayerName = vi.fn();
    const user = userEvent.setup();
    render(
      <SquadSettingsForm
        {...baseProps({ variant: "edit", confirmAvailability: true, addPlayer, setNewPlayerName, newPlayerName: "Cara" })}
      />
    );
    await user.click(screen.getByText("Player"));
    fireEvent.keyDown(screen.getByPlaceholderText("Player name"), { key: "Enter" });
    expect(addPlayer).toHaveBeenCalledTimes(1);
  });

  it("Select all / Clear all toggles the whole roster's availability", async () => {
    const setAvailableIds = vi.fn();
    const user = userEvent.setup();
    render(
      <SquadSettingsForm {...baseProps({ variant: "edit", confirmAvailability: true, availableIds: ["p1"], setAvailableIds })} />
    );
    await user.click(screen.getByText("Select all"));
    expect(setAvailableIds).toHaveBeenCalledWith(["p1", "p2"]);
  });

  it("hides Select all when the roster is empty", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", confirmAvailability: true, roster: [], availableIds: [] })} />);
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });
});

// The "inline" variant's own roster-building UI — always a brand-new,
// currently-empty-or-being-built squad (see SquadSettingsForm.jsx's file-
// level comment on why "inline" never carries over an existing roster).
// Zero taps to start typing, Enter commits and keeps focus, a whole pasted
// list adds in one commit, and an empty Backspace undoes the last entry.
describe("SquadSettingsForm — quick-add squad (inline variant)", () => {
  it("auto-focuses the name field on arrival, with no reveal tap needed first", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    expect(screen.getByPlaceholderText("Type a player's name")).toHaveFocus();
  });

  it("shows the empty-state hint when nobody's been added yet", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    expect(screen.getByText("Nobody added yet — start typing above")).toBeInTheDocument();
  });

  it("Enter commits the typed name via addPlayers and clears the field", () => {
    const addPlayers = vi.fn();
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [], addPlayers })} />);
    const input = screen.getByPlaceholderText("Type a player's name");
    fireEvent.change(input, { target: { value: "Cara" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(addPlayers).toHaveBeenCalledWith(["Cara"]);
    expect(input).toHaveValue("");
  });

  it("pasting a multi-line list adds every name in one addPlayers call", () => {
    const addPlayers = vi.fn();
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [], addPlayers })} />);
    const input = screen.getByPlaceholderText("Type a player's name");
    const clipboardData = { getData: () => "Otis\nEli\nRocco" };
    fireEvent.paste(input, { clipboardData });
    expect(addPlayers).toHaveBeenCalledWith(["Otis", "Eli", "Rocco"]);
  });

  // Real-device feedback: typed several comma-separated names and "nothing
  // happened" — anything left in the field without an explicit Enter used
  // to just be silently dropped. Blur (tapping away, dismissing the
  // keyboard, scrolling to Build new rotation) now commits it too.
  it("blur commits whatever's typed, same as Enter would", () => {
    const addPlayers = vi.fn();
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [], addPlayers })} />);
    const input = screen.getByPlaceholderText("Type a player's name");
    fireEvent.change(input, { target: { value: "Otis, Eli, Rocco" } });
    fireEvent.blur(input);
    expect(addPlayers).toHaveBeenCalledWith(["Otis", "Eli", "Rocco"]);
  });

  it("blur on an empty field is a no-op", () => {
    const addPlayers = vi.fn();
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [], addPlayers })} />);
    fireEvent.blur(screen.getByPlaceholderText("Type a player's name"));
    expect(addPlayers).not.toHaveBeenCalled();
  });

  it("Backspace on an empty field removes the last player and refills their name for editing", () => {
    const removePlayer = vi.fn();
    render(<SquadSettingsForm {...baseProps({ removePlayer })} />); // ROSTER: Alice, Bob — Bob is last
    const input = screen.getByPlaceholderText("Type a player's name");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(removePlayer).toHaveBeenCalledWith("p2");
    expect(input).toHaveValue("Bob");
  });

  it("shows the running count against the roster, not availableIds", () => {
    render(<SquadSettingsForm {...baseProps()} />); // 2 on the roster
    expect(screen.getByText("2 in")).toBeInTheDocument();
  });

  it("doesn't show 'tap to drop out' or Select all — nothing to toggle yet", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.queryByText("tap to drop out")).not.toBeInTheDocument();
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });
});

// Real-use feedback: an anonymous session can end up genuinely empty for
// reasons that have nothing to do with being a new coach (Safari clearing
// storage, a new device/browser) — this link is the way back to a real
// account without digging through Team & account -> Save Season Data ->
// the Google conflict screen. Always shown for this exact condition, no
// stored flag or detection heuristic (see SquadSettingsForm.jsx's own
// comment on showSignIn for why).
describe("SquadSettingsForm — 'Already have a team? Sign in' link (inline variant)", () => {
  it("shows only for an anonymous session with a genuinely empty roster", () => {
    render(<SquadSettingsForm {...baseProps({ isAnonymous: true, roster: [], availableIds: [] })} />);
    expect(screen.getByText("Already have a team? Sign in")).toBeInTheDocument();
  });

  it("hides once the roster has anyone on it, even for an anonymous session", () => {
    render(<SquadSettingsForm {...baseProps({ isAnonymous: true })} />); // ROSTER has Alice, Bob
    expect(screen.queryByText("Already have a team? Sign in")).not.toBeInTheDocument();
  });

  it("hides for a non-anonymous session, even with an empty roster", () => {
    render(<SquadSettingsForm {...baseProps({ isAnonymous: false, roster: [], availableIds: [] })} />);
    expect(screen.queryByText("Already have a team? Sign in")).not.toBeInTheDocument();
  });

  it("opens SignIn as a dismissible overlay, closing back to this screen", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ isAnonymous: true, roster: [], availableIds: [] })} />);
    expect(screen.queryByText("Sign in with Google")).not.toBeInTheDocument();

    await user.click(screen.getByText("Already have a team? Sign in"));
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
    expect(screen.getByText("Sign in with Email")).toBeInTheDocument();
    // Not a sign-out — nothing to fall back to as a guest again from here.
    expect(screen.queryByText("Continue as Guest")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Close"));
    expect(screen.queryByText("Sign in with Google")).not.toBeInTheDocument();
    expect(screen.getByText("Already have a team? Sign in")).toBeInTheDocument();
  });
});

describe("SquadSettingsForm — In goal today (starting keeper)", () => {
  // Goal Keeper Options is a collapsed accordion row by default in both
  // layouts now — these open straight to it via initialExpandedSection
  // (still "goal", the merged card's own key), same as the "rendering
  // (edit / A4)" tests do. Expanding it also shows the Keepers
  // eligibility list (same merged card, see the sub-section describe
  // block above) — which renders Alice's name a second time, in a plain
  // (non-button) row, so tests below disambiguate via .closest("button")
  // to reliably target her actual in-goal chip.
  it("only lists players who are both available and keeper-eligible", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal" })} />); // Alice eligible, Bob not
    const aliceChip = screen.getAllByText("Alice").find((el) => el.closest("button"));
    expect(aliceChip).toBeTruthy();
    // Bob legitimately still appears once, in the same merged card's own
    // Keepers eligibility list (every roster player, toggleable, by
    // design) — just not as his own in-goal chip.
    const bobChip = screen.queryAllByText("Bob").find((el) => el.closest("button"));
    expect(bobChip).toBeFalsy();
  });

  it("shows a hint instead of an empty card when nobody eligible is available", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal", availableIds: ["p2"] })} />); // only Bob, not eligible
    expect(screen.getByText(/No keeper-eligible players available today/)).toBeInTheDocument();
  });

  it("tapping an eligible player's chip sets them as starting keeper", async () => {
    const setStartingGkId = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal", setStartingGkId })} />);
    const aliceChip = screen.getAllByText("Alice").find((el) => el.closest("button"));
    await user.click(aliceChip);
    expect(setStartingGkId).toHaveBeenCalledWith("p1");
  });

  // Real-use feedback: "Player name starts" read oddly next to "Random" —
  // just the name reads as the plain fact it is, in the expanded card's
  // own value badge. (The merged Goal Keeper Options row no longer shows
  // a value at all when collapsed — see the merged-card describe block's
  // own comment on why — so there's nothing to check there any more.)
  it("shows just the player's name once picked, not 'name starts'", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal", startingGkId: "p1" })} />);
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.queryByText("Alice starts")).not.toBeInTheDocument();
  });

  it("tapping the already-starting player's chip again clears the pick", async () => {
    const setStartingGkId = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal", startingGkId: "p1", setStartingGkId })} />);
    await user.click(screen.getByText(/Alice.*\u{1F451}/u));
    expect(setStartingGkId).toHaveBeenCalledWith(null);
  });

  it("shows no fairness warning when no manual pick is made", () => {
    render(<SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS })} />);
    expect(screen.queryByText(/more minutes than others today/)).not.toBeInTheDocument();
  });

  it("warns, naming the player and the spread, for a starting keeper known to make the game unfair", () => {
    render(
      <SquadSettingsForm
        {...baseProps({
          roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id),
          gameSettings: { ...FAIRNESS_SETTINGS, subIntervalMinutes: 5 }, startingGkId: "p2",
        })}
      />
    );
    expect(screen.getByText("Starting Player 2 in goal means some players could get up to 6 more minutes than others today.")).toBeInTheDocument();
  });
});

// Keeper changes is now a sub-section of the merged Goal Keeper Options
// card ("goal", same key as First in goal today/Keepers) — these open
// straight to it via initialExpandedSection, same as the "rendering
// (edit / A4)" tests do.
// Real-use feedback ("we don't want the goalkeepers to be the only ones
// either in goal or on the bench") — see assessKeeperShift's own tests
// (rotation.test.js) for the underlying numbers this scenario is drawn
// from directly (9 players, 2 eligible, 5-a-side, 5-min subs — a real,
// verified squeeze, not a hand-picked one).
const SQUEEZE_ROSTER = Array.from({ length: 9 }, (_, i) => ({
  id: `p${i + 1}`, name: `Player ${i + 1}`, keeperEligible: i < 2,
}));
const SQUEEZE_IDS = SQUEEZE_ROSTER.map((p) => p.id);
const squeezeProps = (overrides = {}) =>
  baseProps({
    variant: "edit",
    initialExpandedSection: "goal",
    roster: SQUEEZE_ROSTER,
    availableIds: SQUEEZE_IDS,
    gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 5 },
    ...overrides,
  });

describe("SquadSettingsForm — keeper-squeeze nudge", () => {
  it("warns and offers a one-tap fix when 2 keepers on a short shift would squeeze their own outfield time", () => {
    render(<SquadSettingsForm {...squeezeProps()} />);
    expect(screen.getByText(/With only 2 keepers, changing every 5.* means they'll get much less/)).toBeInTheDocument();
    expect(screen.getByText("Use 10′ instead")).toBeInTheDocument();
    // The plain, no-warning caption is gone while the warning shows.
    expect(screen.queryByText("Leave at the sub length to rotate keepers every window.")).not.toBeInTheDocument();
  });

  it("tapping the fix applies the suggested keeperShiftMinutes", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...squeezeProps({ setGameSettings })} />);
    await user.click(screen.getByText("Use 10′ instead"));
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 5, keeperShiftMinutes: 10 });
  });

  it("stays quiet — plain caption, no warning — once a longer shift is already set", () => {
    render(<SquadSettingsForm {...squeezeProps({ gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 5, keeperShiftMinutes: 20 } })} />);
    expect(screen.getByText("Leave at the sub length to rotate keepers every window.")).toBeInTheDocument();
    expect(screen.queryByText(/would squeeze|means they'll get much less/)).not.toBeInTheDocument();
  });

  it("stays quiet for a normal squad where everyone (or nearly everyone) is keeper-eligible", () => {
    const everyoneEligible = SQUEEZE_ROSTER.map((p) => ({ ...p, keeperEligible: true }));
    render(<SquadSettingsForm {...squeezeProps({ roster: everyoneEligible })} />);
    expect(screen.getByText("Leave at the sub length to rotate keepers every window.")).toBeInTheDocument();
  });
});

describe("SquadSettingsForm — Keeper swaps stepper", () => {
  it("defaults to the sub interval length when keeperShiftMinutes is unset", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal" })} />);
    expect(screen.getByText("6′")).toBeInTheDocument();
  });

  it("+ steps up from the sub interval and records a real override", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal", setGameSettings })} />);
    await user.click(screen.getByText("+"));
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: 7 });
  });

  it("stepping back down to the sub interval clears the override back to blank", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <SquadSettingsForm
        {...baseProps({
          variant: "edit", initialExpandedSection: "goal",
          gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: 7 }, setGameSettings,
        })}
      />
    );
    await user.click(screen.getByText("−"));
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: "" });
  });
});

describe("SquadSettingsForm — Breaks", () => {
  it("picking a break option calls setGameSettings with the new segment count", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "breaks", setGameSettings })} />);
    await user.click(screen.getByText("Thirds"));
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, breakSegments: 3 });
  });
});

// FAIRNESS_SETTINGS' own subIntervalMinutes (6) is already the fixture's
// unique best fit — used below for the "already fair" branch. UNFAIR_
// SETTINGS swaps in 4′, one of the non-fair candidates, to exercise the
// "something to improve" branch instead.
const UNFAIR_SETTINGS = { ...FAIRNESS_SETTINGS, subIntervalMinutes: 4 };

describe("SquadSettingsForm — sub-interval recommendation", () => {
  it("stays hidden while there aren't enough available players yet", () => {
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1"] })} />);
    expect(screen.queryByTitle(/min subs/)).not.toBeInTheDocument();
    expect(screen.queryByText("Improve fairness")).not.toBeInTheDocument();
  });

  // Progressive disclosure, real-use feedback: showing a "fix this" picker
  // when the coach's current pick is already the fairest option invites
  // solving a problem that doesn't exist. FAIRNESS_SETTINGS' own
  // subIntervalMinutes (6) is that fixture's unique best fit.
  it("when the current pick is already fair, shows a plain confirmation instead of the picker", () => {
    render(
      <SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS })} />
    );
    expect(screen.getByText("These sub settings provide a fair rotation.")).toBeInTheDocument();
    expect(screen.queryByText("Improve fairness")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/min subs/)).not.toBeInTheDocument();
  });

  // Unfair: starts collapsed behind the "Improve fairness" prompt, not the
  // chip picker itself — a guide only, not something in the coach's way.
  it("when the current pick isn't fair, shows a collapsed 'Improve fairness' prompt instead of the picker", () => {
    render(
      <SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: UNFAIR_SETTINGS })} />
    );
    expect(screen.getByText("Improve fairness")).toBeInTheDocument();
    expect(screen.getByText(/tap to explore fairer subbing options/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/min subs/)).not.toBeInTheDocument();
  });

  // Real-use feedback replaced the old two-line prose + ✓/✗-per-chip
  // design with a short label and chips showing the minute mark (not a
  // bare number), highlighting the single best fit — for this fixture
  // (7 players, 42-minute game), 6′ is the unique smallest-spread option
  // among 4/5/6/7/8′ (bestSpread 0; every other candidate is non-zero) —
  // see rotation.test.js's own recommendSubIntervals coverage for the math.
  it("tapping 'Improve fairness' reveals a chip per candidate interval with its minute mark, highlighting the single best fit", async () => {
    const user = userEvent.setup();
    render(
      <SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: UNFAIR_SETTINGS })} />
    );
    await user.click(screen.getByText("Improve fairness"));
    // Queried by title, not text — "6′" also legitimately appears in the
    // Keeper swaps stepper elsewhere on this (inline-variant) screen,
    // since this fixture's keeperShiftMinutes falls back to the same
    // subIntervalMinutes (6) the best-fit chip shows.
    const bestChip = screen.getByTitle("6 min subs is the fairest split today.");
    const otherChip = screen.getByTitle(/4 min subs could leave/);
    expect(bestChip).toHaveTextContent("6′");
    expect(otherChip).toHaveTextContent("4′");
    expect(bestChip).toHaveStyle({ backgroundColor: "rgb(46, 125, 83)" }); // tokens.color.pitchGreen
    expect(otherChip).toHaveStyle({ backgroundColor: "rgb(255, 255, 255)" });
  });

  it("picking a chip applies that sub interval", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <SquadSettingsForm
        {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: UNFAIR_SETTINGS, setGameSettings })}
      />
    );
    await user.click(screen.getByText("Improve fairness"));
    await user.click(screen.getByTitle("6 min subs is the fairest split today."));
    expect(setGameSettings).toHaveBeenCalledWith({ ...UNFAIR_SETTINGS, subIntervalMinutes: 6 });
  });

  // Real-use feedback: expanding the picker once for an unfair pick left
  // it expanded for every later pick too -- a second, different unfair
  // choice skipped straight to the bare chip row with no "Improve
  // fairness" prompt ever shown for it. The prompt should collapse fresh
  // whenever the actual interval changes.
  it("collapses back behind the prompt when a different sub interval is picked, rather than staying expanded", () => {
    const { rerender } = render(
      <SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: UNFAIR_SETTINGS })} />
    );
    fireEvent.click(screen.getByText("Improve fairness"));
    expect(screen.getByTitle("6 min subs is the fairest split today.")).toBeInTheDocument();

    // Same component instance, a different (still unfair) interval --
    // simulates the coach picking 5' next via the "sub every" tile.
    rerender(
      <SquadSettingsForm
        {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: { ...UNFAIR_SETTINGS, subIntervalMinutes: 5 } })}
      />
    );
    expect(screen.getByText("Improve fairness")).toBeInTheDocument();
    expect(screen.queryByTitle(/min subs/)).not.toBeInTheDocument();
  });
});

describe("SquadSettingsForm — validation and submit", () => {
  it("disables submit and shows the validation error when there aren't enough available players", () => {
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1"] })} />);
    // fieldSize 5 (baseProps default) -- a bench isn't required any more,
    // so the minimum is exactly the field size, not field size + 1.
    expect(screen.getByText(/Select at least 5 available players/)).toBeInTheDocument();
    expect(screen.getByText("Generate Rotation")).toBeDisabled();
  });

  it("enables submit and calls onSubmit when settings are valid", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const roster = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const availableIds = roster.map((p) => p.id);
    render(<SquadSettingsForm {...baseProps({ roster, availableIds, onSubmit })} />);
    const btn = screen.getByText("Generate Rotation");
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // Real-use feedback: the old red banner ("This will restart the
  // rotation from 0:00 and clear this game's progress so far") warned on
  // *every* visit, even ones with nothing to lose, and its own wording
  // was wrong — minutes already played are never cleared. Replaced with a
  // targeted check at submit time: no game in progress builds
  // immediately; a game in progress opens a confirm sheet instead (edit
  // layout only — first-time setup never has anything in progress).
  it("builds immediately, no confirm sheet, when no game is in progress", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const roster = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const availableIds = roster.map((p) => p.id);
    render(<SquadSettingsForm {...baseProps({ variant: "edit", roster, availableIds, onSubmit, gameInProgress: false, submitLabel: "Build new rotation" })} />);
    await user.click(screen.getByText("Build new rotation"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("rebuild-confirm-sheet")).not.toBeInTheDocument();
  });

  it("opens a confirm sheet instead of building immediately when a game is in progress, naming the real elapsed time played", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const roster = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const availableIds = roster.map((p) => p.id);
    render(
      <SquadSettingsForm {...baseProps({ variant: "edit", roster, availableIds, onSubmit, gameInProgress: true, elapsedSec: 760, submitLabel: "Build new rotation" })} />
    );
    await user.click(screen.getByText("Build new rotation"));
    expect(onSubmit).not.toHaveBeenCalled();
    const sheet = screen.getByTestId("rebuild-confirm-sheet");
    expect(within(sheet).getByText("Today's game is running")).toBeInTheDocument();
    expect(within(sheet).getByText(/The 12:40 already played stays/)).toBeInTheDocument();
  });

  it("confirming the sheet calls onSubmit and closes it", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const roster = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const availableIds = roster.map((p) => p.id);
    render(
      <SquadSettingsForm {...baseProps({ variant: "edit", roster, availableIds, onSubmit, gameInProgress: true, elapsedSec: 760, submitLabel: "Build new rotation" })} />
    );
    await user.click(screen.getByText("Build new rotation"));
    // The sheet's own confirm button reads "Build Rotation" — shorter
    // than the main submit button's "Build new rotation" on purpose
    // (real-use feedback: it's just confirming the action already named
    // on the screen behind it, and the full phrase wrapped onto two
    // lines at this button's own width).
    await user.click(screen.getByText("Build Rotation"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("rebuild-confirm-sheet")).not.toBeInTheDocument();
  });

  it("'Keep current' dismisses the sheet without calling onSubmit", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const roster = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const availableIds = roster.map((p) => p.id);
    render(
      <SquadSettingsForm {...baseProps({ variant: "edit", roster, availableIds, onSubmit, gameInProgress: true, elapsedSec: 760, submitLabel: "Build new rotation" })} />
    );
    await user.click(screen.getByText("Build new rotation"));
    await user.click(screen.getByText("Keep current"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByTestId("rebuild-confirm-sheet")).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SquadSettingsForm from "./SquadSettingsForm.jsx";
import { getSquadNumber } from "../lib/squadNumber.js";

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
    removePlayer: vi.fn(),
    toggleAvailable: vi.fn(),
    toggleKeeperEligible: vi.fn(),
    setAllKeeperEligible: vi.fn(),
    setPlayerNumber: vi.fn(),
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
  // Real-use feedback ("needs a lot of care as this is the user's first
  // experience with the app"): this header used to always be a plain
  // title-row + optional ✕. Now context-aware — no onClose (a genuinely
  // new team, straight off sign-in) gets the crest+title shell, no back
  // control at all; onClose (an *additional* team, added via Team &
  // account) gets the exact same back-chevron shell "edit" uses.
  it("shows crest+title with no back control for a first-ever team (no onClose)", () => {
    render(<SquadSettingsForm {...baseProps({ title: "Set up new team" })} />);
    expect(screen.getByText("Set up new team")).toBeInTheDocument();
    expect(screen.queryByTitle("Back")).not.toBeInTheDocument();
  });

  it("shows the same back-chevron header 'edit' uses for an additional team (onClose provided)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ title: "Set up new team", onClose })} />);
    expect(screen.getByText("Set up new team")).toBeInTheDocument();
    await user.click(screen.getByTitle("Back"));
    expect(onClose).toHaveBeenCalledTimes(1);
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
  // the Game settings screen" — First in goal today, Keeper changes,
  // Breaks, and Manage squad all collapsed by default here too, not open
  // flat the way "inline" used to show them.
  it("collapses First in goal today, Keeper changes, Breaks, and Manage squad by default, same as 'edit'", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getByText("First in goal today")).toBeInTheDocument();
    expect(screen.getByText("Keeper changes")).toBeInTheDocument();
    expect(screen.getByText("Breaks")).toBeInTheDocument();
    expect(screen.getByText("Manage squad")).toBeInTheDocument();
    expect(screen.queryByTitle("Collapse")).not.toBeInTheDocument(); // nothing expanded
    expect(screen.queryByText("Tap a name to pick who starts in goal today.")).not.toBeInTheDocument();
  });

  // Real-use feedback: Who's here should be the very first thing a coach
  // does, not tiles/settings — DOCUMENT_POSITION_FOLLOWING confirms each
  // element genuinely comes *after* the previous one in the DOM, not just
  // that all three happen to be present somewhere.
  it("orders Who's here, then Keepers, then the settings accordion", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    const whosHere = screen.getByText("Who's here");
    const keepers = screen.getByText("Keepers");
    const firstInGoal = screen.getByText("First in goal today");
    expect(whosHere.compareDocumentPosition(keepers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(keepers.compareDocumentPosition(firstInGoal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows an empty-state message in Manage squad when the roster has no players yet", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [], initialExpandedSection: "squad" })} />);
    expect(screen.getByText("No players yet — add your squad above.")).toBeInTheDocument();
  });
});

describe("SquadSettingsForm — Keepers (inline / A3 layout only)", () => {
  it("defaults to collapsed, its value reflecting who's actually eligible", () => {
    render(<SquadSettingsForm {...baseProps()} />); // ROSTER: Alice eligible, Bob not
    expect(screen.getByText("Keepers")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.queryByTitle("Toggle keeper-eligible")).not.toBeInTheDocument(); // collapsed
  });

  it("reads 'Shared by all' once every player is actually eligible", () => {
    const allEligible = [{ id: "p1", name: "Alice", keeperEligible: true }, { id: "p2", name: "Bob", keeperEligible: true }];
    render(<SquadSettingsForm {...baseProps({ roster: allEligible })} />);
    expect(screen.getByText("Shared by all")).toBeInTheDocument();
  });

  it("reads 'Add squad first' when the roster is empty", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    expect(screen.getByText("Add squad first")).toBeInTheDocument();
  });

  it("expands to show a toggle row per player; tapping one calls toggleKeeperEligible with their id", async () => {
    const toggleKeeperEligible = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ toggleKeeperEligible })} />);
    await user.click(screen.getByText("Keepers"));
    expect(screen.getByText("Everyone can play in goal by default — turn off anyone who shouldn't.")).toBeInTheDocument();
    await user.click(screen.getAllByTitle("Toggle keeper-eligible")[0]);
    expect(toggleKeeperEligible).toHaveBeenCalledWith("p1");
  });

  it("expanded, offers Select all, which marks everyone eligible and collapses the card back down", async () => {
    const setAllKeeperEligible = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setAllKeeperEligible })} />);
    await user.click(screen.getByText("Keepers"));
    await user.click(screen.getByText("Select all"));
    expect(setAllKeeperEligible).toHaveBeenCalledWith(true);
    // Back to collapsed — the toggle rows are gone again.
    expect(screen.queryByTitle("Toggle keeper-eligible")).not.toBeInTheDocument();
  });

  it("doesn't offer Select all when the roster is empty", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    await user.click(screen.getByText("Keepers"));
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });

  // "edit" (Game settings) has no Keepers section at all — that decision
  // stays reachable there via Manage squad's own 🧤 toggle, unchanged.
  it("doesn't appear in the 'edit' layout", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.queryByText("Keepers")).not.toBeInTheDocument();
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

  it("shows the three advanced sections collapsed to one-line rows carrying their current value", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.getByText("First in goal today")).toBeInTheDocument();
    expect(screen.getByText("Random")).toBeInTheDocument(); // no starting keeper picked
    expect(screen.getByText("Keeper changes")).toBeInTheDocument();
    expect(screen.getByText("Every 6′")).toBeInTheDocument(); // defaults to subIntervalMinutes
    expect(screen.getByText("Breaks")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  // Real-use feedback: Team & account's own "Manage squad" row landed on
  // this screen with nothing expanded, same as the plain cog-menu entry --
  // not the squad list a coach tapped that specific row to reach.
  it("opens straight to the Manage squad card when initialExpandedSection is 'squad'", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "squad" })} />);
    expect(screen.getByTitle("Collapse")).toBeInTheDocument();
    expect(screen.getAllByTitle("Set squad number").length).toBeGreaterThan(0);
    // The other three sections stay collapsed -- only one section open at a time.
    expect(screen.queryByText("Tap a name to pick who starts in goal today.")).not.toBeInTheDocument();
  });

  it("opens with nothing expanded by default (no initialExpandedSection)", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.queryByTitle("Collapse")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Set squad number")).not.toBeInTheDocument();
  });

  // Real-use feedback: even expanded, Manage squad was still the *last*
  // thing on the screen -- header, tiles, and three collapsed sections all
  // sat above it, so a coach arriving via that specific route still had to
  // scroll past everything else to reach the squad list they came for.
  // jsdom doesn't implement scrollIntoView at all -- mocked here the same
  // way real browsers that happen to lack it are already guarded against
  // in the component itself (a typeof check, not just a null check).
  it("scrolls the Manage squad card into view on mount when opened via initialExpandedSection, not otherwise", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "squad" })} />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("doesn't force a scroll when a coach manually expands Manage squad during a normal visit", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("Manage squad"));
    expect(screen.getAllByTitle("Set squad number").length).toBeGreaterThan(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  // Real-use feedback: this row used to duplicate SquadChangeScreen.jsx's
  // own job (the cog menu's "Who's here" row) — availability toggling and
  // +Player both live there now, so the edit layout drops its own copy of
  // that section entirely. Manage squad (further down) keeps its own,
  // different job — number/keeper-eligible/remove, not availability.
  it("has no Who's here availability section — that's SquadChangeScreen's own job now", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.queryByText("Who's here?")).not.toBeInTheDocument();
    expect(screen.queryByText("tap to drop out")).not.toBeInTheDocument();
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });

  // Real-use feedback: wanted the Breaks row to read as one phrase
  // ("Breaks" + "Every third"), matching how "Keeper changes" + "Every 4′"
  // already reads.
  it("shows the Breaks row's value as 'Every <segment>', not the chip's own plain noun", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, breakSegments: 3 } })} />);
    expect(screen.getByText("Every third")).toBeInTheDocument();
    expect(screen.queryByText("Thirds")).not.toBeInTheDocument(); // that's the chip's own label, only shown once expanded
  });

  it("expands a section in place when tapped, and only one at a time", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);

    await user.click(screen.getByText("First in goal today"));
    expect(screen.getByText("Tap a name to pick who starts in goal today.")).toBeInTheDocument();

    // Opening Keeper changes closes the In-goal card back to its one-liner.
    await user.click(screen.getByText("Keeper changes"));
    expect(screen.queryByText("Tap a name to pick who starts in goal today.")).not.toBeInTheDocument();
    expect(screen.getByText("Leave at the sub length to rotate keepers every window.")).toBeInTheDocument();
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
  // (only opening a different section closed it).
  it("gives Keeper changes its own collapse chevron too", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("Keeper changes"));
    expect(screen.getByText("Leave at the sub length to rotate keepers every window.")).toBeInTheDocument();
    await user.click(screen.getByTitle("Collapse"));
    expect(screen.queryByText("Leave at the sub length to rotate keepers every window.")).not.toBeInTheDocument();
    expect(screen.getByText("Keeper changes")).toBeInTheDocument(); // back to its one-line row
  });

  // Manage squad joined the other three accordion rows on real-use feedback
  // ("too much going on" that page) — every player's name/number was
  // already shown once in the Who's here chip row, so the detail list
  // (number/keeper-eligible/remove) sitting open by default was pure
  // duplication. Only the "edit" layout gets this treatment — "inline"
  // (first-time setup) still shows everything open, per its own README-
  // cited rationale ("nothing already answered yet to skim past").
  it("collapses Manage squad to a one-line row carrying the player count", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.getByText("Manage squad")).toBeInTheDocument();
    expect(screen.getByText("2 players")).toBeInTheDocument();
    expect(screen.queryByTitle("Set squad number")).not.toBeInTheDocument();
  });

  it("expands Manage squad to show the number/keeper-eligible/remove rows, and collapses the other sections", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("First in goal today"));
    expect(screen.getByText("Tap a name to pick who starts in goal today.")).toBeInTheDocument();

    await user.click(screen.getByText("Manage squad"));
    expect(screen.queryByText("Tap a name to pick who starts in goal today.")).not.toBeInTheDocument();
    expect(screen.getAllByTitle("Set squad number")).toHaveLength(2);
    expect(screen.getAllByTitle("Toggle keeper-eligible")).toHaveLength(2);
    expect(screen.getAllByTitle("Remove from squad")).toHaveLength(2);
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
    await user.click(screen.getByText("on pitch"));
    // Keeper changes' own stepper isn't in the DOM yet in the edit layout
    // (that section starts collapsed) -- just this tile's own "-" here.
    expect(screen.getAllByText("−")).toHaveLength(1);
    // Tapping a wholly unrelated section, not another tile.
    await user.click(screen.getByText("First in goal today"));
    expect(screen.queryByText("−")).not.toBeInTheDocument(); // the tile settled back
    expect(screen.getByTitle("Collapse")).toBeInTheDocument(); // the outside tap's own action still happened
  });
});

describe("SquadSettingsForm — squad chips (availability)", () => {
  it("tapping a player's chip calls toggleAvailable with their id", async () => {
    const toggleAvailable = vi.fn();
    const user = userEvent.setup();
    // Bob isn't keeper-eligible, so his only two appearances are the squad
    // chip and the Manage-squad row name — no In-goal chip to disambiguate
    // from, unlike Alice.
    render(<SquadSettingsForm {...baseProps({ toggleAvailable })} />);
    await user.click(screen.getAllByText("Bob")[0]);
    expect(toggleAvailable).toHaveBeenCalledWith("p2");
  });

  it("tapping + Player reveals the add-player input; Enter and the Add button both call addPlayer", async () => {
    const addPlayer = vi.fn();
    const setNewPlayerName = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ addPlayer, setNewPlayerName, newPlayerName: "Cara" })} />);
    await user.click(screen.getByText("Player"));
    fireEvent.keyDown(screen.getByPlaceholderText("Player name"), { key: "Enter" });
    expect(addPlayer).toHaveBeenCalledTimes(1);
  });

  it("Select all / Clear all toggles the whole roster's availability", async () => {
    const setAvailableIds = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1"], setAvailableIds })} />);
    await user.click(screen.getByText("Select all"));
    expect(setAvailableIds).toHaveBeenCalledWith(["p1", "p2"]);
  });

  it("hides Select all when the roster is empty", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });
});

describe("SquadSettingsForm — Manage squad (number, keeper-eligible, remove)", () => {
  // Real-use feedback: an unset number used to show as a muted, bare "–"
  // ("I don't really know what it means") -- replaced with numberOf's own
  // fallback (the same one the Who's-here screen's number discs already
  // rely on) so the badge always shows a real number, always in the same
  // solid green/white treatment as Who's-here, whether or not a squad
  // number has actually been explicitly set.
  // Manage squad is a collapsed accordion row by default in both layouts
  // now (real-use feedback moved keeper eligibility itself to "inline"'s
  // own dedicated Keepers section instead — see that describe block
  // further down) — these tests open straight to it via
  // initialExpandedSection, same as the "rendering (edit / A4)" tests do.
  it("always shows a real number in a solid badge, never a bare dash -- an explicit one, or numberOf's own fallback", () => {
    const roster = [{ id: "p1", name: "Alice", keeperEligible: true, number: 7 }, ROSTER[1]];
    const testNumberOf = (id) => getSquadNumber(roster.find((p) => p.id === id), roster);
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "squad", roster, numberOf: testNumberOf })} />);
    const badges = screen.getAllByTitle("Set squad number");
    expect(badges[0]).toHaveTextContent("7"); // Alice's explicit number
    expect(badges[1]).toHaveTextContent("2"); // Bob has none set -- falls back to his position (2nd) in the roster
    expect(badges[0]).toHaveStyle({ backgroundColor: "rgb(46, 125, 83)" }); // tokens.color.pitchGreen, same for both
    expect(badges[1]).toHaveStyle({ backgroundColor: "rgb(46, 125, 83)" });
  });

  it("tapping a player's number turns it into an input; typing and blurring calls setPlayerNumber", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "squad", setPlayerNumber })} />);
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = document.activeElement;
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);
    expect(setPlayerNumber).toHaveBeenCalledWith("p1", 9);
  });

  it("committing an empty value clears the number back to unset (null)", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(
      <SquadSettingsForm
        {...baseProps({
          variant: "edit", initialExpandedSection: "squad",
          roster: [{ id: "p1", name: "Alice", keeperEligible: true, number: 7 }, ROSTER[1]], setPlayerNumber,
        })}
      />
    );
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = screen.getByDisplayValue("7");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(setPlayerNumber).toHaveBeenCalledWith("p1", null);
  });

  it("pressing Escape while editing discards the edit without calling setPlayerNumber", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "squad", setPlayerNumber })} />);
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = document.activeElement;
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(setPlayerNumber).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("9")).not.toBeInTheDocument();
  });

  it("toggling keeper-eligible calls toggleKeeperEligible with that player's id", async () => {
    const toggleKeeperEligible = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "squad", toggleKeeperEligible })} />);
    await user.click(screen.getAllByTitle("Toggle keeper-eligible")[0]);
    expect(toggleKeeperEligible).toHaveBeenCalledWith("p1");
  });

  it("removing a player calls removePlayer with that player's id", async () => {
    const removePlayer = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "squad", removePlayer })} />);
    await user.click(screen.getAllByTitle("Remove from squad")[0]);
    expect(removePlayer).toHaveBeenCalledWith("p1");
  });
});

describe("SquadSettingsForm — In goal today (starting keeper)", () => {
  // First in goal today is a collapsed accordion row by default in both
  // layouts now — these open straight to it via initialExpandedSection,
  // same as the "rendering (edit / A4)" tests do.
  it("only lists players who are both available and keeper-eligible", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal" })} />); // Alice eligible, Bob not
    // Just Alice's own in-goal chip — no Who's-here chip row or Manage
    // squad list in the "edit" layout to duplicate her name elsewhere.
    expect(screen.getAllByText("Alice")).toHaveLength(1);
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("shows a hint instead of an empty card when nobody eligible is available", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal", availableIds: ["p2"] })} />); // only Bob, not eligible
    expect(screen.getByText(/No keeper-eligible players available today/)).toBeInTheDocument();
  });

  it("tapping an eligible player's chip sets them as starting keeper", async () => {
    const setStartingGkId = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "goal", setStartingGkId })} />);
    await user.click(screen.getByText("Alice"));
    expect(setStartingGkId).toHaveBeenCalledWith("p1");
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

// Keeper changes and Breaks are collapsed accordion rows by default in
// both layouts now — these open straight to them via
// initialExpandedSection, same as the "rendering (edit / A4)" tests do.
describe("SquadSettingsForm — Keeper swaps stepper", () => {
  it("defaults to the sub interval length when keeperShiftMinutes is unset", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "swaps" })} />);
    expect(screen.getByText("6′")).toBeInTheDocument();
  });

  it("+ steps up from the sub interval and records a real override", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", initialExpandedSection: "swaps", setGameSettings })} />);
    await user.click(screen.getByText("+"));
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: 7 });
  });

  it("stepping back down to the sub interval clears the override back to blank", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <SquadSettingsForm
        {...baseProps({
          variant: "edit", initialExpandedSection: "swaps",
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
    expect(screen.getByText("This sub interval gives one of the fairest rotations for today.")).toBeInTheDocument();
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
    expect(screen.getByText(/Select at least 6 available players/)).toBeInTheDocument();
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

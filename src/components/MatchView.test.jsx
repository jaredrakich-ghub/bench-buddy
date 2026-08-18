// @vitest-environment jsdom
//
// Component-level tests for MatchView — the screen where the real bugs this
// session actually lived (badge wiring, the Reset-doesn't-reset-the-board
// gap, the match-complete call-to-action). The fiddly *decision* logic
// (computeNextChangeBadges, resolveAutoFollowInterval) already has its own
// thorough unit tests in rotation.test.js; these tests are about whether
// MatchView renders and wires that correctly — actual DOM, actual clicks.
//
// Rewritten for the match-day redesign (Direction A) — step 3 of
// design_handoff_bench_buddy_match_day/README.md's implementation plan.
// The swap/keeper/injury action-sheet mechanism and the last-60s warning
// concept are untouched *behaviorally* (still their own later steps to
// restyle), so those tests carry over close to unchanged. What's genuinely
// gone: the old intervalCountdown/gkWarmup boxes (replaced by the new
// action bar's always-visible countdown+status), the "Full Time" header
// button and the standalone Reset-clock button (moved into the cog's
// interim quick menu), and the separate "Interval X of Y ◀ ▶" nav (dropped
// — the sub-window chips are now the only interval navigation).
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MatchView from "./MatchView.jsx";

// RTL's automatic afterEach(cleanup) only registers itself when it detects
// globals (test.globals in the vitest config) — we deliberately don't turn
// that on project-wide (it'd apply to every test file, not just this one),
// so each component test file that renders needs this itself.
afterEach(cleanup);
// A safety net independent of any individual test's own cleanup line — if
// a fake-timers test fails before reaching its own vi.useRealTimers() call,
// real timers never come back and every subsequent test in this file hangs
// on its own real userEvent.click awaits. This runs regardless of whether
// the test passed or threw.
afterEach(() => vi.useRealTimers());

const NAMES = { p1: "Alice", p2: "Bob", p3: "Cara", p4: "Dan", p5: "Eve", p6: "Finn", p7: "Gus" };
const NUMBERS = { p1: 1, p2: 2, p3: 3, p4: 4, p5: 5, p6: 6, p7: 7 };
const nameOf = (id) => NAMES[id] || id;
const numberOf = (id) => NUMBERS[id] ?? "?";

function makeInterval(index, startMin, endMin, onFieldIds, gkId, bench) {
  return {
    index, startMin, endMin,
    onField: onFieldIds.map((id) => ({ id, isGk: id === gkId })),
    bench,
  };
}

// A 2-interval plan: interval 0 has p1(gk)/p2/p3/p4/p5 on field, p6/p7 on
// bench; interval 1 swaps p4->p6 (regular sub) and hands the gloves from
// p1 to p3 (p1 stays on the pitch as an outfielder, p3 comes from the bench
// as the new keeper) — exercises every badge state in one plan.
const defaultPlan = [
  makeInterval(0, 0, 6, ["p1", "p2", "p3", "p4", "p5"], "p1", ["p6", "p7"]),
  makeInterval(1, 6, 12, ["p1", "p2", "p3", "p5", "p6"], "p3", ["p4", "p7"]),
];

// A real rebuild after an injury removes that player from onField/bench
// entirely (see rebuildFromInterval, useMatchState.js) — defaultPlan is a
// static fixture that doesn't reflect that, so any test combining
// injuredThisGame with defaultPlan would show the same player twice (once
// still listed on the bench, once in the injured row). Tests that need an
// actually-injured player use this variant instead, with p7 removed from
// interval 0's bench to match what a real rebuild would produce.
const planWithP7Injured = [
  makeInterval(0, 0, 6, ["p1", "p2", "p3", "p4", "p5"], "p1", ["p6"]),
  makeInterval(1, 6, 12, ["p1", "p2", "p3", "p5", "p6"], "p3", ["p4"]),
];

function baseProps(overrides = {}) {
  return {
    plan: defaultPlan,
    activeInterval: 0,
    setActiveInterval: vi.fn(),
    elapsedSec: 0,
    setElapsedSec: vi.fn(),
    baseElapsedSec: 0,
    setBaseElapsedSec: vi.fn(),
    runStartedAt: null,
    setRunStartedAt: vi.fn(),
    timerRunning: false,
    setTimerRunning: vi.fn(),
    setSubLog: vi.fn(),
    swapPickId: null,
    setSwapPickId: vi.fn(),
    injuredThisGame: [],
    keeperEligibleIds: Object.keys(NAMES),
    nameOf,
    numberOf,
    teamName: "Scorpions",
    crestSrc: undefined,
    onInjury: vi.fn(),
    onBringBack: vi.fn(),
    onSwap: vi.fn(),
    onShowSummary: vi.fn(),
    onShowSettings: vi.fn(),
    onShowSeason: vi.fn(),
    onShowTeamSwitcher: vi.fn(),
    ...overrides,
  };
}

// Every token (pitch shirt, bench chip, injured chip) renders its name
// somewhere inside — a pitch shirt's name is a sibling <span> *after* its
// tap button (button+name share a wrapper div), while a bench/injured
// chip's name is a <span> *inside* the button itself (the whole chip is
// the button). closest("button") covers the chip case directly; the div
// fallback covers the pitch-shirt case where the name isn't inside a
// button at all. Uses getAllByText + a tag filter (not plain getByText)
// because a player's name can legitimately appear a second time elsewhere
// on screen at once — e.g. the swap-picking banner's own "swap with
// <strong>Name</strong>" text — and only the token's own name is a bare
// <span>, so filtering by tag disambiguates without depending on which one
// happens to render first in the DOM.
function tokenButtonFor(name) {
  const nameSpan = screen.getAllByText(name).find((el) => el.tagName === "SPAN");
  return nameSpan.closest("button") || nameSpan.closest("div").querySelector("button");
}

describe("MatchView — basic rendering", () => {
  it("shows the clock, total game time, team name, and on-field/bench player names", () => {
    render(<MatchView {...baseProps()} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
    // Deliberate copy change (design spec): "of 45 min" style caption,
    // not the old "of 12:00" mm:ss format.
    expect(screen.getByText("of 12 min")).toBeInTheDocument();
    expect(screen.getByText("Scorpions")).toBeInTheDocument();
    // on field
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Dan")).toBeInTheDocument();
    // bench
    expect(screen.getByText("Finn")).toBeInTheDocument();
    expect(screen.getByText("Gus")).toBeInTheDocument();
  });

  it("shows each player's squad number from numberOf", () => {
    render(<MatchView {...baseProps()} />);
    // p1/Alice on the pitch (number 1) and p6/Finn on the bench (number 6).
    const aliceNumber = screen.getAllByText("1").find((el) => el.tagName === "SPAN");
    expect(aliceNumber).toBeInTheDocument();
    const finnNumber = screen.getAllByText("6").find((el) => el.tagName === "SPAN");
    expect(finnNumber).toBeInTheDocument();
  });

  it("shows Start when paused and Pause when running", () => {
    const { rerender } = render(<MatchView {...baseProps({ timerRunning: false })} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
    rerender(<MatchView {...baseProps({ timerRunning: true })} />);
    expect(screen.getByText("Pause")).toBeInTheDocument();
  });
});

describe("MatchView — next-sub badges", () => {
  it("flags the regular sub (off/on) and the keeper handover distinctly", () => {
    // Viewing interval 0 live (activeInterval === cur.index), so badges for
    // the transition into interval 1 should be showing.
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    expect(screen.getByTitle("Coming off next interval")).toBeInTheDocument(); // p4 leaving
    expect(screen.getByTitle("Coming on next interval")).toBeInTheDocument(); // p6 arriving
    expect(screen.getByTitle("Becoming keeper next interval")).toBeInTheDocument(); // p3
    expect(screen.getByTitle("Staying on, switching to outfield next interval")).toBeInTheDocument(); // p1
  });

  it("still shows next-sub badges when browsing away from the live interval", () => {
    // elapsedSec still puts the live interval at 0, but the board is showing
    // interval 1 (activeInterval=1) — the coach browsed forward to check an
    // upcoming sub. Badges now follow whatever's being viewed, not just the
    // live interval, so they should reflect interval 1 -> 2's transition.
    const threeIntervalPlan = [...defaultPlan, makeInterval(2, 12, 18, ["p1", "p3", "p5", "p6", "p7"], "p3", ["p2", "p4"])];
    render(<MatchView {...baseProps({ plan: threeIntervalPlan, activeInterval: 1, elapsedSec: 0 })} />);
    expect(screen.getByTitle("Coming off next interval")).toBeInTheDocument(); // p2 leaving
    expect(screen.getByTitle("Coming on next interval")).toBeInTheDocument(); // p7 arriving
  });

  it("shows no next-sub badges on the last interval of the game (nothing to sub into)", () => {
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 6 * 60 })} />);
    expect(screen.queryByTitle("Coming off next interval")).not.toBeInTheDocument();
  });
});

describe("MatchView — cog quick menu", () => {
  // Interim scaffolding for this step (see the showQuickMenu comment in
  // MatchView.jsx) — a plain modal standing in for the real anchored cog
  // popover, which is its own later step. Reset clock moved in here (the
  // redesigned header has no room for a separate always-visible button);
  // Minutes/Settings/Season/Switch-team all still call the exact same
  // callbacks the old header's Summary/Edit buttons and the app-level
  // Season/team-switcher buttons did.
  it("opens on tapping the cog and closes on tapping the close button", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps()} />);
    expect(screen.queryByText("Reset clock")).not.toBeInTheDocument();
    await user.click(screen.getByTitle("Menu"));
    expect(screen.getByText("Reset clock")).toBeInTheDocument();
    await user.click(screen.getByTitle("Close menu"));
    expect(screen.queryByText("Reset clock")).not.toBeInTheDocument();
  });

  it("resets the board back to interval 0, not just the clock", async () => {
    // Regression test: Reset used to rewind the clock/sub-log but leave the
    // board showing whatever interval was last being viewed.
    const setActiveInterval = vi.fn();
    const setElapsedSec = vi.fn();
    const setTimerRunning = vi.fn();
    const user = userEvent.setup();
    render(
      <MatchView
        {...baseProps({ activeInterval: 1, elapsedSec: 400, setActiveInterval, setElapsedSec, setTimerRunning })}
      />
    );
    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Reset clock"));
    expect(setActiveInterval).toHaveBeenCalledWith(0);
    expect(setElapsedSec).toHaveBeenCalledWith(0);
    expect(setTimerRunning).toHaveBeenCalledWith(false);
  });

  it("Minutes so far, Squad & game settings, Season data and Switch team each call their own callback and close the menu", async () => {
    const onShowSummary = vi.fn();
    const onShowSettings = vi.fn();
    const onShowSeason = vi.fn();
    const onShowTeamSwitcher = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ onShowSummary, onShowSettings, onShowSeason, onShowTeamSwitcher })} />);

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Minutes so far"));
    expect(onShowSummary).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Reset clock")).not.toBeInTheDocument(); // menu closed itself

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText(/Squad & game settings/));
    expect(onShowSettings).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Season data"));
    expect(onShowSeason).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Switch team"));
    expect(onShowTeamSwitcher).toHaveBeenCalledTimes(1);
  });
});

describe("MatchView — interval navigation", () => {
  // The separate "Interval X of Y ◀ ▶" nav is gone — the sub-window chip
  // row (already there for browsing) is now the only way to change which
  // interval is being viewed.
  it("tapping a chip changes the viewed interval", async () => {
    const setActiveInterval = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, setActiveInterval })} />);
    await user.click(screen.getByText("6–12′"));
    expect(setActiveInterval).toHaveBeenCalledWith(1);
  });
});

describe("MatchView — action bar", () => {
  // Replaces the old intervalCountdown/gkWarmup boxes entirely — always
  // visible (not just in the last 60s), always the live interval's
  // countdown (never whatever's being browsed), single "Sub done" button
  // regardless of timing.
  it("shows the live countdown to the next sub, tied to the live interval even while browsing elsewhere", () => {
    // Live interval is 0 (elapsedSec=340, 20s left in a 0-6min interval);
    // board is showing interval 1 (browsed ahead).
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 340 })} />);
    expect(screen.getByText("Next sub 0:20")).toBeInTheDocument();
  });

  it("shows a swap-count status derived from who's coming off, and an out-count when someone's injured", () => {
    render(<MatchView {...baseProps({ plan: planWithP7Injured, injuredThisGame: ["p7"], activeInterval: 0, elapsedSec: 0 })} />);
    // interval 0 -> 1: p4 comes off (regular sub) — 1 to swap. p7 already injured — 1 out.
    expect(screen.getByText("1 to swap · 1 out")).toBeInTheDocument();
  });

  it("Sub done writes to subLog for the live interval regardless of how much time is left", () => {
    const setSubLog = vi.fn();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 100, setSubLog })} />);
    fireEvent.click(screen.getByText("Sub done ✓"));
    const updater = setSubLog.mock.calls[0][0];
    expect(updater({})).toEqual({ 0: 100 });
  });

  it("hides Sub done on the last interval of the game (nothing to sub into) but keeps the Start/Pause toggle", () => {
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 400 })} />);
    expect(screen.queryByText("Sub done ✓")).not.toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
  });
});

describe("MatchView — past-interval guard", () => {
  // Swap/injury/bring-back all act on plan[activeInterval] with no separate
  // "live interval" concept enforced in useMatchState — browsing ahead to
  // pre-correct an upcoming interval is the whole point. But editing an
  // interval *before* the live one would rebuild everything from there
  // forward, silently overwriting intervals that already actually happened.
  // Every token's tap button is disabled (not just hidden) once a coach
  // browses back to a past interval, so there's nothing to act on by mistake.
  it("shows a note and disables every token on a past interval", () => {
    // Live interval is 1 (elapsedSec=400s falls in interval 1's 360-720s
    // window); activeInterval=0 means the coach browsed back to the past.
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 400, plan: planWithP7Injured, injuredThisGame: ["p7"] })} />);
    expect(screen.getByText(/Interval Complete/)).toBeInTheDocument();
    expect(tokenButtonFor("Alice")).toBeDisabled(); // on-field
    expect(tokenButtonFor("Finn")).toBeDisabled(); // bench
    expect(tokenButtonFor("Gus")).toBeDisabled(); // injured
  });

  it("tapping a token on a past interval does not open its action menu", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 400 })} />);
    await user.click(tokenButtonFor("Alice"));
    expect(screen.queryByText("Swap")).not.toBeInTheDocument();
  });

  it("tapping a token on the live interval opens its action menu instead", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 400 })} />);
    expect(screen.queryByText(/Interval Complete/)).not.toBeInTheDocument();
    await user.click(tokenButtonFor("Bob"));
    expect(screen.getByText("Swap")).toBeInTheDocument();
  });
});

describe("MatchView — tap-to-act token menu", () => {
  // interval 0: onField = p1/Alice(gk), p2/Bob, p3/Cara, p4/Dan, p5/Eve; bench = p6/Finn, p7/Gus.
  it("tapping an on-field player offers Swap, Make keeper, and Mark injured", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    await user.click(tokenButtonFor("Bob")); // p2, outfield
    expect(screen.getByText("Swap")).toBeInTheDocument();
    expect(screen.getByText("Make keeper")).toBeInTheDocument();
    expect(screen.getByText(/Mark injured/)).toBeInTheDocument();
  });

  it("does not offer Make keeper on the current keeper themselves", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    await user.click(tokenButtonFor("Alice")); // p1, keeper
    expect(screen.getByText("Swap")).toBeInTheDocument();
    expect(screen.queryByText("Make keeper")).not.toBeInTheDocument();
  });

  it("does not offer Make keeper for a player who isn't keeper-eligible", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, keeperEligibleIds: ["p1", "p3", "p4", "p5"] })} />); // p2 not eligible
    await user.click(tokenButtonFor("Bob"));
    expect(screen.queryByText("Make keeper")).not.toBeInTheDocument();
  });

  it("offers only Back in for an injured player", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"] })} />);
    await user.click(tokenButtonFor("Gus")); // p7, injured
    expect(screen.getByText("Back in")).toBeInTheDocument();
    expect(screen.queryByText("Swap")).not.toBeInTheDocument();
    expect(screen.queryByText("Make keeper")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark injured/)).not.toBeInTheDocument();
  });

  it("choosing Swap enters swap-picking mode rather than immediately calling onSwap", async () => {
    const setSwapPickId = vi.fn();
    const onSwap = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, setSwapPickId, onSwap })} />);
    await user.click(tokenButtonFor("Bob"));
    await user.click(screen.getByText("Swap"));
    expect(setSwapPickId).toHaveBeenCalledWith("p2");
    expect(onSwap).not.toHaveBeenCalled();
  });

  it("choosing Make keeper calls onSwap with the target and the current keeper", async () => {
    const onSwap = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, onSwap })} />);
    await user.click(tokenButtonFor("Bob")); // p2
    await user.click(screen.getByText("Make keeper"));
    expect(onSwap).toHaveBeenCalledWith("p2", "p1"); // p1 is the current keeper
  });

  it("choosing Mark injured calls onInjury and closes the menu", async () => {
    const onInjury = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, onInjury })} />);
    await user.click(tokenButtonFor("Bob"));
    await user.click(screen.getByText(/Mark injured/));
    expect(onInjury).toHaveBeenCalledWith("p2");
    expect(screen.queryByText(/Mark injured/)).not.toBeInTheDocument();
  });

  it("choosing Back in calls onBringBack", async () => {
    const onBringBack = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"], onBringBack })} />);
    await user.click(tokenButtonFor("Gus"));
    await user.click(screen.getByText("Back in"));
    expect(onBringBack).toHaveBeenCalledWith("p7");
  });

  it("tapping a bench player while mid-swap completes the swap with the pending swap source — no separate 'Swap in' button needed", async () => {
    const onSwap = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, swapPickId: "p2", onSwap })} />);
    await user.click(tokenButtonFor("Finn")); // p6, bench
    expect(onSwap).toHaveBeenCalledWith("p2", "p6");
  });

  it("tapping the same player again toggles their menu closed", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    const bobToken = tokenButtonFor("Bob");
    await user.click(bobToken);
    expect(screen.getByText("Swap")).toBeInTheDocument();
    await user.click(bobToken);
    expect(screen.queryByText("Swap")).not.toBeInTheDocument();
  });

  it("tapping the pending swap source again cancels instead of swapping them with themselves", async () => {
    const onSwap = vi.fn();
    const setSwapPickId = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, swapPickId: "p2", onSwap, setSwapPickId })} />);
    await user.click(tokenButtonFor("Bob")); // p2, the swap source itself
    expect(onSwap).not.toHaveBeenCalled();
    expect(setSwapPickId).toHaveBeenCalledWith(null);
  });
});

describe("MatchView — post-action confirmation toast", () => {
  it("shows a confirmation after completing a swap, and it replaces the 'pick a target' hint", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, swapPickId: "p2" })} />);
    await user.click(tokenButtonFor("Finn")); // p6, bench
    expect(screen.getByText("✓ Bob swapped with Finn")).toBeInTheDocument();
    expect(screen.queryByText(/Tap another player/)).not.toBeInTheDocument();
  });

  it("shows a confirmation after choosing Make keeper", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    await user.click(tokenButtonFor("Bob")); // p2
    await user.click(screen.getByText("Make keeper"));
    expect(screen.getByText("✓ Bob is now keeper")).toBeInTheDocument();
  });

  it("auto-dismisses the confirmation after a short delay", () => {
    // fireEvent (synchronous) rather than userEvent here — userEvent's own
    // internal async waits don't coordinate cleanly with fake timers, and
    // this click needs no real user-interaction simulation (typing, focus
    // order) to matter for what's being tested.
    vi.useFakeTimers();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, swapPickId: "p2" })} />);
    fireEvent.click(tokenButtonFor("Finn"));
    expect(screen.getByText("✓ Bob swapped with Finn")).toBeInTheDocument();
    // act() so React flushes the setTimeout callback's state update
    // synchronously — outside a real user event, nothing else prompts it to.
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.queryByText("✓ Bob swapped with Finn")).not.toBeInTheDocument();
  });

  it("does not show a confirmation when viewing a past interval", () => {
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 400 })} />);
    expect(screen.queryByText(/^✓/)).not.toBeInTheDocument();
  });
});

describe("MatchView — break markers (purely visual, no effect on the plan itself)", () => {
  // 4 intervals, so computeBreakBoundaries gives clean, predictable results:
  // halves -> divider before index 2; quarters -> dividers before 1, 2, 3.
  const fourIntervalPlan = [
    makeInterval(0, 0, 6, ["p1", "p2", "p3", "p4", "p5"], "p1", ["p6", "p7"]),
    makeInterval(1, 6, 12, ["p1", "p2", "p3", "p5", "p6"], "p3", ["p4", "p7"]),
    makeInterval(2, 12, 18, ["p1", "p3", "p5", "p6", "p7"], "p3", ["p2", "p4"]),
    makeInterval(3, 18, 24, ["p1", "p3", "p5", "p6", "p7"], "p6", ["p2", "p4"]),
  ];

  it("shows no marker at all when breaks are off (the default)", () => {
    render(<MatchView {...baseProps({ plan: fourIntervalPlan })} />);
    expect(screen.queryByTitle("Break")).not.toBeInTheDocument();
  });

  it("shows exactly one marker at the halfway point for halves", () => {
    render(<MatchView {...baseProps({ plan: fourIntervalPlan, breakSegments: 2 })} />);
    const markers = screen.getAllByTitle("Break");
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveTextContent("12–18′"); // interval index 2 (the third tab)
  });

  it("shows more, closer-together markers for quarters than for halves", () => {
    render(<MatchView {...baseProps({ plan: fourIntervalPlan, breakSegments: 4 })} />);
    expect(screen.getAllByTitle("Break")).toHaveLength(3);
  });
});

describe("MatchView — match complete", () => {
  it("shows the match-complete banner with a working Start new game action, and hides the action bar", async () => {
    const onShowSettings = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 12 * 60, onShowSettings })} />);
    expect(screen.getByText(/Match complete/)).toBeInTheDocument();
    // The action bar (countdown + Pause/Sub done) shouldn't show once the match is over.
    expect(screen.queryByText(/Next sub/)).not.toBeInTheDocument();
    expect(screen.queryByText("Sub done ✓")).not.toBeInTheDocument();

    await user.click(screen.getByText("Start new game"));
    expect(onShowSettings).toHaveBeenCalledTimes(1);
  });

  it("shows the action bar's countdown instead, before the match ends", () => {
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    expect(screen.getByText(/Next sub/)).toBeInTheDocument();
    expect(screen.queryByText(/Match complete/)).not.toBeInTheDocument();
  });
});

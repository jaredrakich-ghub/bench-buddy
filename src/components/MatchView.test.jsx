// @vitest-environment jsdom
//
// Component-level tests for MatchView — the screen where the real bugs this
// session actually lived (badge wiring, the Reset-doesn't-reset-the-board
// gap, the match-complete call-to-action). The fiddly *decision* logic
// (computeNextChangeBadges, resolveAutoFollowInterval) already has its own
// thorough unit tests in rotation.test.js; these tests are about whether
// MatchView renders and wires that correctly — actual DOM, actual clicks.
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MatchView from "./MatchView.jsx";

// RTL's automatic afterEach(cleanup) only registers itself when it detects
// globals (test.globals in the vitest config) — we deliberately don't turn
// that on project-wide (it'd apply to every test file, not just this one),
// so each component test file that renders needs this itself.
afterEach(cleanup);

const NAMES = { p1: "Alice", p2: "Bob", p3: "Cara", p4: "Dan", p5: "Eve", p6: "Finn", p7: "Gus" };
const nameOf = (id) => NAMES[id] || id;

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
    subLog: {},
    setSubLog: vi.fn(),
    swapPickId: null,
    setSwapPickId: vi.fn(),
    injuredThisGame: [],
    keeperEligibleIds: Object.keys(NAMES),
    nameOf,
    onInjury: vi.fn(),
    onBringBack: vi.fn(),
    onSwap: vi.fn(),
    onSwapKeeper: vi.fn(),
    onShowSummary: vi.fn(),
    onShowSettings: vi.fn(),
    ...overrides,
  };
}

describe("MatchView — basic rendering", () => {
  it("shows the clock, total game time, and on-field/bench player names", () => {
    render(<MatchView {...baseProps()} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("of 12:00")).toBeInTheDocument();
    // on field
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Dan")).toBeInTheDocument();
    // bench
    expect(screen.getByText("Finn")).toBeInTheDocument();
    expect(screen.getByText("Gus")).toBeInTheDocument();
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

describe("MatchView — Reset", () => {
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
    await user.click(screen.getByTitle("Reset clock"));
    expect(setActiveInterval).toHaveBeenCalledWith(0);
    expect(setElapsedSec).toHaveBeenCalledWith(0);
    expect(setTimerRunning).toHaveBeenCalledWith(false);
  });
});

describe("MatchView — interval navigation", () => {
  it("disables the back button on the first interval and the forward button on the last", () => {
    const { rerender } = render(<MatchView {...baseProps({ activeInterval: 0 })} />);
    expect(screen.getByText("Interval 1 of 2")).toBeInTheDocument();
    // ‹ is the only disabled iconBtn at the first interval
    const backBtnFirst = screen.getAllByRole("button").find((b) => b.disabled);
    expect(backBtnFirst).toBeTruthy();

    rerender(<MatchView {...baseProps({ activeInterval: 1 })} />);
    expect(screen.getByText("Interval 2 of 2")).toBeInTheDocument();
  });
});

describe("MatchView — sub-window warning box", () => {
  // Regular subs used to only ever say "Start looking for the next sub" —
  // no names. This shows exactly who's coming off and on, plus a large
  // countdown, so a coach glancing at their phone can act without reading
  // closely. Tied to the live interval (elapsedSec), not whatever's being
  // browsed — see liveChanges in MatchView.
  it("names who's coming off and on, and shows the keeper handover, inside the last-minute warning window", () => {
    // interval 0 (0-6min) -> interval 1: p4 off, p6 on, keeper handover p1->p3.
    // 340s elapsed leaves 20s in interval 0 (6*60=360), inside the 60s window.
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 340 })} />);
    // "0:20" appears twice — the header row stays put the whole game (see
    // MatchView) and the warning box shows the same value again, larger.
    expect(screen.getAllByText("0:20").length).toBe(2);
    // Names appear elsewhere too (pitch/bench labels), so scope into the
    // OFF/ON line's own text rather than matching bare names page-wide.
    const offOnLine = screen.getByText(/OFF:/).closest("div");
    expect(offOnLine.textContent).toContain("Dan"); // p4, coming off
    expect(offOnLine.textContent).toContain("Finn"); // p6, coming on
    const keeperLine = screen.getByText(/to goal for the swap/).closest("div");
    expect(keeperLine.textContent).toContain("Cara"); // p3, becoming keeper
  });

  it("keeps showing the live upcoming change even while browsing a different interval", () => {
    const threeIntervalPlan = [...defaultPlan, makeInterval(2, 12, 18, ["p1", "p3", "p5", "p6", "p7"], "p3", ["p2", "p4"])];
    // Live is still interval 0 (elapsedSec=340), but the board is showing interval 2.
    render(<MatchView {...baseProps({ plan: threeIntervalPlan, activeInterval: 2, elapsedSec: 340 })} />);
    expect(screen.getAllByText("0:20").length).toBe(2);
    const offOnLine = screen.getByText(/OFF:/).closest("div");
    expect(offOnLine.textContent).toContain("Dan"); // still the live transition's names (p4), not interval 2's (p2/p4 bench)
  });

  it("disappears once the interval it warned about actually ends", () => {
    // elapsedSec now well into interval 1 - the interval-0 warning is gone.
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 400 })} />);
    expect(screen.queryByText(/OFF:/)).not.toBeInTheDocument();
  });

  it("keeps the header countdown row's own height stable when the warning box appears — only its button toggles", () => {
    // Regression test: an earlier version hid the whole header row once the
    // warning box appeared, which collapsed its height at the exact moment
    // the (taller) box appeared below it — looked like the "Sub made early"
    // button had jumped or the two were overlapping. The row itself must
    // never disappear; only the button inside it should.
    const { rerender } = render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 295 })} />); // 65s left - not yet in the window (window opens at <=60s)
    expect(screen.getByText(/Sub window ends in/)).toBeInTheDocument();
    expect(screen.getByText("✓ Sub made early")).toBeInTheDocument();
    expect(screen.queryByText(/OFF:/)).not.toBeInTheDocument();

    rerender(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 340 })} />); // 20s left - inside the window
    expect(screen.getByText(/Sub window ends in/)).toBeInTheDocument(); // row still there
    expect(screen.queryByText("✓ Sub made early")).not.toBeInTheDocument(); // only the button is gone
    expect(screen.getByText(/OFF:/)).toBeInTheDocument(); // warning box now also showing
  });
});

describe("MatchView — past-interval guard", () => {
  // Swap/injury/bring-back all act on plan[activeInterval] with no separate
  // "live interval" concept enforced in useMatchState — browsing ahead to
  // pre-correct an upcoming interval is the whole point. But editing an
  // interval *before* the live one would rebuild everything from there
  // forward, silently overwriting intervals that already actually happened.
  // These controls are hidden (not just disabled) once a coach browses back
  // to a past interval, so there's nothing to tap by mistake.
  it("hides Swap in, the injury button, and Back in when viewing a past interval, and shows a note instead", () => {
    // Live interval is 1 (elapsedSec=400s falls in interval 1's 360-720s
    // window); activeInterval=0 means the coach browsed back to the past.
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 400, injuredThisGame: ["p7"] })} />);
    expect(screen.getByText(/Interval Complete/)).toBeInTheDocument();
    expect(screen.queryByText("Swap in")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Mark injured / off")).not.toBeInTheDocument();
    expect(screen.queryByText("Back in")).not.toBeInTheDocument();
  });

  it("still shows Swap in and the injury button when viewing the live interval or a future one", () => {
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 400 })} />);
    expect(screen.queryByText(/Interval Complete/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Swap in").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Mark injured / off").length).toBeGreaterThan(0);
  });

  it("hides Make keeper now on a past interval too", () => {
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 400 })} />);
    expect(screen.queryByTitle("Make keeper now")).not.toBeInTheDocument();
  });
});

describe("MatchView — manual keeper swap (Make keeper now)", () => {
  // interval 0: onField = p1(gk), p2, p3, p4, p5; bench = p6, p7.
  it("shows the action on every keeper-eligible outfield player, but not on the current keeper", () => {
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    // p2,p3,p4,p5 are eligible outfield players -> 4 buttons. p1 (keeper) gets none.
    expect(screen.getAllByTitle("Make keeper now")).toHaveLength(4);
  });

  it("hides the action for a player who isn't keeper-eligible", () => {
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, keeperEligibleIds: ["p1", "p3", "p4", "p5"] })} />); // p2 not eligible
    expect(screen.getAllByTitle("Make keeper now")).toHaveLength(3);
  });

  it("hides the action while a bench swap is in progress, to avoid two conflicting actions at once", () => {
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, swapPickId: "p6" })} />);
    expect(screen.queryByTitle("Make keeper now")).not.toBeInTheDocument();
  });

  it("calls onSwapKeeper with the tapped player's id", async () => {
    const onSwapKeeper = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, onSwapKeeper })} />);
    await user.click(screen.getAllByTitle("Make keeper now")[0]);
    expect(onSwapKeeper).toHaveBeenCalledTimes(1);
    expect(onSwapKeeper).toHaveBeenCalledWith(expect.stringMatching(/^p[2-5]$/));
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
  it("shows the match-complete banner with a working Start new game action once the clock reaches the end", async () => {
    const onShowSettings = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 12 * 60, onShowSettings })} />);
    expect(screen.getByText("Full Time")).toBeInTheDocument();
    expect(screen.getByText(/Match complete/)).toBeInTheDocument();
    // The old "Sub window ends in" countdown shouldn't show once the match is over.
    expect(screen.queryByText(/Sub window ends in/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Start new game"));
    expect(onShowSettings).toHaveBeenCalledTimes(1);
  });

  it("shows the sub-window countdown instead, before the match ends", () => {
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    expect(screen.getByText(/Sub window ends in/)).toBeInTheDocument();
    expect(screen.queryByText(/Match complete/)).not.toBeInTheDocument();
  });
});

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
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { render, screen, cleanup, fireEvent, act, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MatchView from "./MatchView.jsx";
import { fmtClock } from "../lib/clock.js";

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
    // Defaults to a live, running match — the common case most tests in
    // this file care about (badges, tap-menu, browsing). Tests about the
    // pre-kickoff/paused/final60 states themselves override this and
    // elapsedSec explicitly, since those three are exactly what varying
    // timerRunning/elapsedSec together produces (see MatchView.jsx).
    timerRunning: true,
    setTimerRunning: vi.fn(),
    subLog: {},
    setSubLog: vi.fn(),
    swapPickId: null,
    setSwapPickId: vi.fn(),
    injuredThisGame: [],
    injuredAt: {},
    keeperEligibleIds: Object.keys(NAMES),
    availableIds: Object.keys(NAMES),
    nameOf,
    numberOf,
    teamName: "Scorpions",
    crestSrc: undefined,
    onInjury: vi.fn(),
    onBringBack: vi.fn(),
    onSwap: vi.fn(),
    onReset: vi.fn(),
    onShowSummary: vi.fn(),
    onShowSeason: vi.fn(),
    onShowSettings: vi.fn(),
    onShowSquadChange: vi.fn(),
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

  // Real-use feedback: "Full squad on field" read as misaligned against
  // "BENCH" — mdBenchStrip/mdBenchLabel's own alignItems/paddingTop are
  // tuned for the (taller) chip-row case, not a plain one-line message.
  it("centres the empty-bench message against its BENCH label, not the chip row's own top-alignment", () => {
    const zeroBenchPlan = [makeInterval(0, 0, 12, ["p1", "p2", "p3", "p4", "p5", "p6", "p7"], "p1", [])];
    render(<MatchView {...baseProps({ plan: zeroBenchPlan, availableIds: Object.keys(NAMES) })} />);
    const message = screen.getByText("Full squad on field");
    expect(message).toBeInTheDocument();
    const strip = message.closest("div");
    expect(strip).toHaveStyle({ alignItems: "center" });
    const label = screen.getByText("BENCH");
    expect(label).toHaveStyle({ paddingTop: "0px" });
  });

  // Real-device feedback: the timer became a <button> (the hidden reset
  // gesture) with a `font: "inherit"` meant only to reset button chrome,
  // but that CSS shorthand also wiped out the fontSize:66/Baloo 2/800
  // weight the mdTimerDisplay spread just before it had set, rendering as
  // tiny inherited body text instead. Locks in that it still renders at
  // its actual designed size.
  it("keeps the timer at its full 66px display size now that it's a button", () => {
    render(<MatchView {...baseProps()} />);
    const timer = screen.getByText("0:00");
    expect(timer.tagName).toBe("BUTTON");
    expect(timer).toHaveStyle({ fontSize: "66px", fontWeight: 800 });
  });

  it("shows each player's squad number from numberOf", () => {
    render(<MatchView {...baseProps()} />);
    // p1/Alice on the pitch (number 1) and p6/Finn on the bench (number 6).
    const aliceNumber = screen.getAllByText("1").find((el) => el.tagName === "SPAN");
    expect(aliceNumber).toBeInTheDocument();
    const finnNumber = screen.getAllByText("6").find((el) => el.tagName === "SPAN");
    expect(finnNumber).toBeInTheDocument();
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

  // Real-use bug report: two bench subs both showed gold discs — read by
  // the coach as "these two are both going in goal" — when neither was;
  // the actual next keeper (p3) is an on-pitch player switching role, not
  // a bench sub at all. baseProps defaults keeperEligibleIds to *every*
  // player (matching real teams, where eligibility is opt-out and most
  // squads never touch it) — the disc used to key off that blanket flag
  // instead of who's actually coming on as keeper.
  it("only golds a bench chip's disc for the specific player becoming keeper, not everyone keeper-eligible", () => {
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    // p6 (regular sub, arriving as an outfielder) and p7 (staying put) are
    // both keeper-eligible per baseProps, but neither is becomingKeeperId
    // (p3 is, and p3 is already on the pitch) — both should read plain
    // green, not gold.
    const finnDisc = tokenButtonFor("Finn").querySelector("span");
    const gusDisc = tokenButtonFor("Gus").querySelector("span");
    expect(finnDisc).toHaveStyle({ backgroundColor: "rgb(46, 125, 83)" }); // tokens.color.pitchGreen
    expect(gusDisc).toHaveStyle({ backgroundColor: "rgb(46, 125, 83)" });
  });
});

describe("MatchView — cog menu (anchored popover, trimmed / #10a)", () => {
  // A2d-Menu-trimmed (#10a): no group headers — Manage squad, Switch team,
  // Account, and Sign out all moved to Team & account (#10e); the reset
  // button came out of the app entirely rather than being relocated (no
  // standalone close button either, by design — dismissed by tapping the
  // cog again, the scrim, or any row). Season Minutes moved back out of
  // Team & account and in here instead, real-use feedback.
  it("opens on tapping the cog, closes on tapping the cog again or the scrim", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps()} />);
    expect(screen.queryByText("Game settings")).not.toBeInTheDocument();

    await user.click(screen.getByTitle("Menu"));
    expect(screen.getByText("Game settings")).toBeInTheDocument();
    await user.click(screen.getByTitle("Menu")); // toggle closed
    expect(screen.queryByText("Game settings")).not.toBeInTheDocument();

    await user.click(screen.getByTitle("Menu"));
    expect(screen.getByText("Game settings")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("scrim"));
    expect(screen.queryByText("Game settings")).not.toBeInTheDocument();
  });

  it("shows only the 5 rows this trim keeps — nothing that moved to Team & account", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps()} />);
    await user.click(screen.getByTitle("Menu"));
    const popover = within(screen.getByTestId("cog-popover"));
    expect(popover.getByText("Today's Minutes")).toBeInTheDocument();
    expect(popover.getByText("Season Minutes")).toBeInTheDocument();
    expect(popover.getByText("Who's here")).toBeInTheDocument();
    expect(popover.getByText("Game settings")).toBeInTheDocument();
    expect(popover.getByText("Team & account")).toBeInTheDocument();
    expect(popover.queryByText("Manage squad")).not.toBeInTheDocument();
    expect(popover.queryByText("Switch team")).not.toBeInTheDocument();
    expect(popover.queryByText("Account")).not.toBeInTheDocument();
    expect(popover.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("shows the live-computed value chips: squad in, game settings, team name (Minutes has none — full-game projection, not tied to elapsed time)", () => {
    render(
      <MatchView
        {...baseProps({ elapsedSec: 125, availableCount: 7, teamName: "Scorpions", gameSettingsSummary: "5 a side · sub 5′" })}
      />
    );
    fireEvent.click(screen.getByTitle("Menu"));
    // Scoped into the popover specifically — "Scorpions" also legitimately
    // appears in the (still-rendered, just dimmed) header behind it.
    const popover = within(screen.getByTestId("cog-popover"));
    expect(popover.queryByText("2:05")).not.toBeInTheDocument(); // no elapsed-time chip on Minutes
    expect(popover.getByText("7 in")).toBeInTheDocument(); // Who's here
    expect(popover.getByText("5 a side · sub 5′")).toBeInTheDocument(); // Game settings
    expect(popover.getByText("Scorpions")).toBeInTheDocument(); // Team & account value
  });

  it("every row calls its own callback and closes the menu", async () => {
    const onShowSummary = vi.fn();
    const onShowSeason = vi.fn();
    const onShowSettings = vi.fn();
    const onShowSquadChange = vi.fn();
    const onShowTeamSwitcher = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ onShowSummary, onShowSeason, onShowSettings, onShowSquadChange, onShowTeamSwitcher })} />);

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Today's Minutes"));
    expect(onShowSummary).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Game settings")).not.toBeInTheDocument(); // menu closed itself

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Season Minutes"));
    expect(onShowSeason).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Who's here"));
    expect(onShowSquadChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Game settings"));
    expect(onShowSettings).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle("Menu"));
    await user.click(screen.getByText("Team & account"));
    expect(onShowTeamSwitcher).toHaveBeenCalledTimes(1);
  });

  it("the cog stays lit (elevated above the scrim, but below the popover itself) while its menu is open", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps()} />);
    const cog = screen.getByTitle("Menu");
    expect(cog.style.zIndex).toBe("");
    await user.click(cog);
    expect(cog.style.zIndex).toBe("46");
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
    // Live interval is 0 (elapsedSec=200, 160s left in a 0-6min interval —
    // outside the final60 window, so this is genuinely the plain running
    // bar, not the final60 sheet); board is showing interval 1 (browsed ahead).
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 200 })} />);
    expect(screen.getByText("Next sub 2:40")).toBeInTheDocument();
  });

  // The swap-count/out-count status ("1 to swap · 1 out") used to also
  // show on the plain running bar; real-device feedback asked for that to
  // be dropped there ("the final 60 second window pop up will give us the
  // detail we need") since the final60 sheet already surfaces it — see
  // the "final60 sheet" describe block below for that coverage. The
  // running bar itself is now just the countdown + button, no status line.
  it("does not show a swap-count/out-count status on the plain running bar", () => {
    render(<MatchView {...baseProps({ plan: planWithP7Injured, injuredThisGame: ["p7"], activeInterval: 0, elapsedSec: 0 })} />);
    expect(screen.queryByText(/to swap/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d out/)).not.toBeInTheDocument();
  });

  // "Sub done" removed entirely from this bar (README > A2-Match-actionbar
  // > Action bar, confirmed explicitly) — the final-60 sheet is now the
  // only place a sub gets confirmed; this bar is just the countdown and
  // the clock button.
  it("has no Sub done early-confirm option — only the clock button, on the last interval too", () => {
    // subLog: {0: ...} — interval 0's own sub already confirmed, so
    // pendingIndex has advanced to 1 (the last interval, nothing after
    // it to sub into) rather than still sitting on interval 0's own
    // transition just because elapsedSec has moved past it.
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 400, subLog: { 0: 361 } })} />);
    expect(screen.queryByText("Sub done ✓")).not.toBeInTheDocument();
    expect(screen.getByText("Pause")).toBeInTheDocument();
  });

  it("the action bar's clock button pauses the running clock", () => {
    const setTimerRunning = vi.fn();
    const setBaseElapsedSec = vi.fn();
    render(
      <MatchView
        {...baseProps({ activeInterval: 0, elapsedSec: 100, baseElapsedSec: 100, setTimerRunning, setBaseElapsedSec })}
      />
    );
    fireEvent.click(screen.getByText("Pause"));
    expect(setTimerRunning).toHaveBeenCalledWith(false);
    expect(setBaseElapsedSec).toHaveBeenCalledWith(100);
  });
});

describe("MatchView — pre-kickoff", () => {
  // !timerRunning && elapsedSec === 0 — the clock has never run yet.
  it("shows Ready to go context and the action bar's Start match button, no running/paused bar text", () => {
    render(<MatchView {...baseProps({ timerRunning: false, elapsedSec: 0 })} />);
    expect(screen.getByText("Ready to go")).toBeInTheDocument();
    expect(screen.getByText("Start match")).toBeInTheDocument();
    expect(screen.queryByText(/Next sub/)).not.toBeInTheDocument();
    expect(screen.queryByText("Clock stopped")).not.toBeInTheDocument();
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  });

  // Real-device feedback: the pre-kickoff bar used to be its own bigger,
  // stacked shape (a status line, then a full-width button) — now the
  // same compact single-row shape (label + a content-width button) as the
  // running/paused bars, same mdActionBarClockBtn size/placement as
  // Resume/Pause use.
  it("sizes the Start match button the same as the running/paused bar's own clock button", () => {
    render(<MatchView {...baseProps({ timerRunning: false, elapsedSec: 0 })} />);
    const btn = screen.getByText("Start match").closest("button");
    expect(btn).toHaveStyle({ height: "66px" });
  });

  it("the action bar's Start match button starts the clock", () => {
    const setRunStartedAt = vi.fn();
    const setTimerRunning = vi.fn();
    render(<MatchView {...baseProps({ timerRunning: false, elapsedSec: 0, setRunStartedAt, setTimerRunning })} />);
    fireEvent.click(screen.getByText("Start match"));
    expect(setTimerRunning).toHaveBeenCalledWith(true);
    expect(setRunStartedAt).toHaveBeenCalled();
  });

  it("shows no next-sub preview badges — nothing's due yet with the clock not even started", () => {
    render(<MatchView {...baseProps({ timerRunning: false, elapsedSec: 0 })} />);
    expect(screen.queryByTitle("Coming off next interval")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Coming on next interval")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Becoming keeper next interval")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Staying on, switching to outfield next interval")).not.toBeInTheDocument();
  });
});

describe("MatchView — paused", () => {
  // !timerRunning && elapsedSec > 0 — was running, now stopped.
  it("shows the greyed timer, Clock stopped, and the action bar's Resume button — no redundant Paused text chip, no Sub now", () => {
    render(<MatchView {...baseProps({ timerRunning: false, elapsedSec: 100 })} />);
    // The Play/Pause icon button already communicates the state; a
    // separate "Paused" text chip was dropped (real-device feedback: it
    // forced the timer row to stack vertically and threw off alignment).
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    expect(screen.getByText("Clock stopped")).toBeInTheDocument();
    // "Sub now" removed entirely (README > A2-Match-actionbar > Action
    // bar, confirmed explicitly) — the final-60 sheet is the only place a
    // sub gets confirmed now.
    expect(screen.queryByText("Sub now")).not.toBeInTheDocument();
    expect(screen.getByText("Resume")).toBeInTheDocument();
    expect(screen.queryByText("Ready to go")).not.toBeInTheDocument();
    expect(screen.queryByText(/Next sub/)).not.toBeInTheDocument();
  });

  it("the action bar's Resume button restarts the clock", () => {
    const setRunStartedAt = vi.fn();
    const setTimerRunning = vi.fn();
    render(<MatchView {...baseProps({ timerRunning: false, elapsedSec: 100, setRunStartedAt, setTimerRunning })} />);
    fireEvent.click(screen.getByText("Resume"));
    expect(setTimerRunning).toHaveBeenCalledWith(true);
    expect(setRunStartedAt).toHaveBeenCalled();
  });
});

// Real-use feedback: a dedicated action-bar Reset button "looked
// terrible" -- replaced with a hidden gesture, tapping the timer display
// itself, no new visible UI at all. Underlying action (resetClock,
// useMatchState.js) is unchanged from when it briefly had a button.
describe("MatchView — hidden reset gesture (tap the timer)", () => {
  it("resets immediately, no confirm sheet, when there's nothing to lose", () => {
    const onReset = vi.fn();
    render(<MatchView {...baseProps({ timerRunning: true, elapsedSec: 0, subLog: {}, onReset })} />);
    fireEvent.click(screen.getByText(fmtClock(0)));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("reset-confirm-sheet")).not.toBeInTheDocument();
  });

  it("opens a confirm sheet instead of resetting immediately once there's real progress, naming the real elapsed time", () => {
    const onReset = vi.fn();
    render(<MatchView {...baseProps({ timerRunning: false, elapsedSec: 100, onReset })} />);
    fireEvent.click(screen.getByText(fmtClock(100)));
    expect(onReset).not.toHaveBeenCalled();
    const sheet = screen.getByTestId("reset-confirm-sheet");
    expect(within(sheet).getByText("Restart this game?")).toBeInTheDocument();
    expect(within(sheet).getByText(/the 1:40 played so far won't be kept/)).toBeInTheDocument();
  });

  it("confirming resets and closes the sheet; Cancel closes it without resetting", () => {
    const onReset = vi.fn();
    render(<MatchView {...baseProps({ timerRunning: false, elapsedSec: 100, onReset })} />);
    fireEvent.click(screen.getByText(fmtClock(100)));
    fireEvent.click(screen.getByText("Cancel"));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reset-confirm-sheet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(fmtClock(100)));
    // The sheet's own confirm button -- unambiguous from the timer, which
    // shows a clock reading, not the word "Reset".
    fireEvent.click(screen.getByText("Reset"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("reset-confirm-sheet")).not.toBeInTheDocument();
  });

  it("does nothing while a past interval is being browsed (interactionLocked)", () => {
    const onReset = vi.fn();
    // elapsedSec 400 puts the live interval at 1 (defaultPlan's interval 1
    // spans 360-720s); browsing activeInterval 0 makes it a past interval
    // -- same isPastInterval guard the tap-to-act menu already respects.
    render(<MatchView {...baseProps({ timerRunning: true, elapsedSec: 400, activeInterval: 0, onReset })} />);
    fireEvent.click(screen.getByText(fmtClock(400)));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reset-confirm-sheet")).not.toBeInTheDocument();
  });
});

describe("MatchView — final-60 sheets (block 11: prepare + execute)", () => {
  // Interval 0 -> 1: Alice (keeper) steps down to outfield, Finn comes on
  // as the new keeper from the bench, Gus comes on regular for Bob, and
  // Cara comes off with Alice taking her spot instead of a third bench
  // arrival — the exact shape of block 11's own worked example (George/
  // Eli/Jack/Hugo/Otis), just with this file's own p1..p7 roster. Interval
  // 0 is 0-6min (360s).
  const final60Plan = [
    makeInterval(0, 0, 6, ["p1", "p2", "p3", "p4", "p5"], "p1", ["p6", "p7"]),
    makeInterval(1, 6, 12, ["p6", "p1", "p7", "p4", "p5"], "p6", ["p2", "p3"]),
  ];

  describe("sheet 1 — prepare (-60s to -30s)", () => {
    it("shows the emphasised keeper card first, then a quiet card per other bench arrival — nobody leaving or just changing position gets one", () => {
      render(<MatchView {...baseProps({ plan: final60Plan, timerRunning: true, activeInterval: 0, elapsedSec: 310 })} />);
      const sheet = within(screen.getByTestId("prepare-sheet"));
      expect(sheet.getByText("Next sub 60 secs")).toBeInTheDocument();
      expect(sheet.getByText("GET READY")).toBeInTheDocument();
      expect(sheet.getByText("Finn")).toBeInTheDocument(); // incoming keeper, emphasised card
      expect(sheet.getByText("Go stand by the goal")).toBeInTheDocument();
      expect(sheet.getByText("GK")).toBeInTheDocument();
      expect(sheet.getByText("Gus")).toBeInTheDocument(); // regular bench arrival, quiet card
      expect(sheet.getByText("Ready at halfway")).toBeInTheDocument();
      // Nobody leaving (Bob, Cara) or just changing position (Alice) has
      // anything to walk to yet, so none of them get a card at all.
      expect(sheet.queryByText("Bob")).not.toBeInTheDocument();
      expect(sheet.queryByText("Cara")).not.toBeInTheDocument();
      expect(sheet.queryByText("Alice")).not.toBeInTheDocument();
    });

    it("Ready dismisses it without writing to subLog — it changes no state at all", () => {
      const setSubLog = vi.fn();
      render(
        <MatchView {...baseProps({ plan: final60Plan, timerRunning: true, activeInterval: 0, elapsedSec: 310, setSubLog })} />
      );
      fireEvent.click(within(screen.getByTestId("prepare-sheet")).getByText("Ready ✓"));
      expect(screen.queryByTestId("prepare-sheet")).not.toBeInTheDocument();
      expect(setSubLog).not.toHaveBeenCalled();
    });

    it("skips the emphasised keeper card for a keeper change that's really just an on-pitch role swap, with no genuine bench arrival", () => {
      // defaultPlan's own keeper handover (Alice -> Cara) is exactly this
      // shape — both already on the pitch, nobody walks on for it — but
      // its regular sub (Dan -> Finn) still needs a quiet card of its own,
      // so the sheet itself still shows, just without the keeper card.
      render(<MatchView {...baseProps({ timerRunning: true, activeInterval: 0, elapsedSec: 310 })} />);
      const sheet = within(screen.getByTestId("prepare-sheet"));
      expect(sheet.getByText("Finn")).toBeInTheDocument();
      expect(sheet.getByText("Ready at halfway")).toBeInTheDocument();
      expect(sheet.queryByText("Go stand by the goal")).not.toBeInTheDocument();
      expect(sheet.queryByText("GK")).not.toBeInTheDocument();
      expect(sheet.queryByText("Cara")).not.toBeInTheDocument();
    });
  });

  describe("sheet 2 — execute (-30s onward)", () => {
    it("lists the numbered steps in order: keeper swap, then the regular arrival, then the stepping-down keeper taking the last spot", () => {
      render(<MatchView {...baseProps({ plan: final60Plan, timerRunning: true, activeInterval: 0, elapsedSec: 340 })} />);
      const sheet = within(screen.getByTestId("execute-sheet"));
      expect(sheet.getByText("Make the changes")).toBeInTheDocument();
      expect(sheet.getByText("30 secs to go")).toBeInTheDocument();
      expect(sheet.getByText("Goalkeeper swap")).toBeInTheDocument();
      expect(sheet.getByText("Gus comes on")).toBeInTheDocument();
      expect(sheet.getByText("Alice takes the field")).toBeInTheDocument();
      ["Finn", "Bob", "Gus", "Cara"].forEach((name) => expect(sheet.getByText(name)).toBeInTheDocument());
      // Alice appears twice — once leaving the goal (step 1's OUT chip),
      // once taking Cara's spot (step 3's IN chip) — never as a single
      // straight swap with the incoming keeper.
      expect(sheet.getAllByText("Alice")).toHaveLength(2);
    });

    it("stays up once the clock runs past the planned sub time, not just up to it", () => {
      // secSincePendingEnd is well past 0 here — the interval's own
      // scheduled end has already come and gone, but nothing's been
      // confirmed yet, so the sheet must not have quietly gone away.
      render(<MatchView {...baseProps({ plan: final60Plan, timerRunning: true, activeInterval: 0, elapsedSec: 380 })} />);
      expect(screen.getByTestId("execute-sheet")).toBeInTheDocument();
    });

    it("does not show once this interval's sub is already confirmed, even inside the window", () => {
      render(
        <MatchView {...baseProps({ plan: final60Plan, timerRunning: true, activeInterval: 0, elapsedSec: 340, subLog: { 0: 300 } })} />
      );
      expect(screen.queryByTestId("execute-sheet")).not.toBeInTheDocument();
      expect(screen.getByText("Next sub 0:20")).toBeInTheDocument(); // plain bar back instead
    });

    it("does not show when there's nothing to confirm (empty bench, no keeper change)", () => {
      const noSubPlan = [
        makeInterval(0, 0, 6, ["p1", "p2", "p3", "p4", "p5"], "p1", []),
        makeInterval(1, 6, 12, ["p1", "p2", "p3", "p4", "p5"], "p1", []),
      ];
      render(<MatchView {...baseProps({ plan: noSubPlan, timerRunning: true, activeInterval: 0, elapsedSec: 340 })} />);
      expect(screen.queryByTestId("execute-sheet")).not.toBeInTheDocument();
      expect(screen.queryByTestId("prepare-sheet")).not.toBeInTheDocument();
    });

    it("disables every token on the board while it's showing", () => {
      render(<MatchView {...baseProps({ plan: final60Plan, timerRunning: true, activeInterval: 0, elapsedSec: 340 })} />);
      expect(tokenButtonFor("Alice")).toBeDisabled();
      expect(tokenButtonFor("Finn")).toBeDisabled();
    });

    it("Sub done writes to subLog for the pending interval, timestamped at the tap", async () => {
      const setSubLog = vi.fn();
      render(
        <MatchView {...baseProps({ plan: final60Plan, timerRunning: true, activeInterval: 0, elapsedSec: 340, setSubLog })} />
      );
      fireEvent.click(within(screen.getByTestId("execute-sheet")).getByText("Sub done ✓"));
      // Unlike trySwapComplete/Make-keeper, Sub done's own subLog write is
      // NOT deferred through the swap-animation trigger — it never called
      // onSwap in the first place, so there's no real data change to
      // synchronize an animation frame against yet (see pendingConfirm's
      // own comment, MatchView.jsx, for the bug that caused and the fix).
      await waitFor(() => expect(setSubLog).toHaveBeenCalled());
      const updater = setSubLog.mock.calls[0][0];
      expect(updater({})).toEqual({ 0: 340 });
    });
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
    expect(screen.queryByText("Swap player")).not.toBeInTheDocument();
  });

  it("tapping a token on the live interval opens its action menu instead", async () => {
    const user = userEvent.setup();
    // subLog: {0: ...} — same reasoning as the action-bar test above:
    // without it, pendingIndex would still be sitting on interval 0's own
    // (long-past) transition and lock the board via showSheet2.
    render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 400, subLog: { 0: 361 } })} />);
    expect(screen.queryByText(/Interval Complete/)).not.toBeInTheDocument();
    await user.click(tokenButtonFor("Bob"));
    expect(screen.getByText("Swap player")).toBeInTheDocument();
  });
});

describe("MatchView — tap-to-act token menu", () => {
  // interval 0: onField = p1/Alice(gk), p2/Bob, p3/Cara, p4/Dan, p5/Eve; bench = p6/Finn, p7/Gus.
  it("tapping an on-field player offers Swap, Make keeper, and Mark injured", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    await user.click(tokenButtonFor("Bob")); // p2, outfield
    expect(screen.getByText("Swap player")).toBeInTheDocument();
    expect(screen.getByText("Make keeper")).toBeInTheDocument();
    expect(screen.getByText(/Mark injured/)).toBeInTheDocument();
  });

  it("shows the player's name and time played so far in the sheet header (block 8, part C)", async () => {
    // 3:00 elapsed, inside interval 1 (0-6') — p2/Bob has been on the pitch
    // the whole time; p6/Finn has been on the bench the whole time.
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 180 })} />);
    await user.click(tokenButtonFor("Bob"));
    const popover = within(screen.getByTestId("player-popover"));
    expect(popover.getByText("Bob")).toBeInTheDocument();
    expect(popover.getByText("3:00 played")).toBeInTheDocument();

    await user.click(tokenButtonFor("Bob")); // close
    await user.click(tokenButtonFor("Finn"));
    expect(within(screen.getByTestId("player-popover")).getByText("0:00 played")).toBeInTheDocument();
  });

  it("previews who the schedule already has coming on when swapping a player who's due off this window", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    await user.click(tokenButtonFor("Dan")); // p4, scheduled to come off for p6/Finn next interval
    expect(screen.getByText("Finn comes on")).toBeInTheDocument();
  });

  it("falls back to generic copy when swapping a player who isn't part of a scheduled change", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    await user.click(tokenButtonFor("Eve")); // p5, not due off this window
    expect(screen.getByText("Tap another player to swap with them")).toBeInTheDocument();
  });

  it("Make keeper's consequence line names the current keeper", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    await user.click(tokenButtonFor("Bob")); // p2
    expect(screen.getByText("Alice moves out")).toBeInTheDocument(); // p1 is the current keeper
  });

  it("lights up the tapped token while its popover is open, staying below the sheet itself", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    const bobToken = tokenButtonFor("Bob");
    expect(bobToken.style.zIndex).toBe("");
    await user.click(bobToken);
    expect(bobToken.style.zIndex).toBe("46");
  });

  it("does not offer Make keeper on the current keeper themselves", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    await user.click(tokenButtonFor("Alice")); // p1, keeper
    expect(screen.getByText("Swap player")).toBeInTheDocument();
    expect(screen.queryByText("Make keeper")).not.toBeInTheDocument();
  });

  it("does not offer Make keeper for a player who isn't keeper-eligible", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, keeperEligibleIds: ["p1", "p3", "p4", "p5"] })} />); // p2 not eligible
    await user.click(tokenButtonFor("Bob"));
    expect(screen.queryByText("Make keeper")).not.toBeInTheDocument();
  });

  // Confirmed bug (real-use feedback: "only see 2 options available" for a
  // bench player): the menu used to require the tapped player to already
  // be on the field before it would even consider offering Make keeper,
  // silently excluding every keeper-eligible bench player from the option
  // regardless of eligibility.
  it("offers Make keeper for a keeper-eligible bench player too, not just on-field ones", async () => {
    const onSwap = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, onSwap })} />);
    await user.click(tokenButtonFor("Finn")); // p6, bench, keeper-eligible by default
    expect(screen.getByText("Swap player")).toBeInTheDocument();
    expect(screen.getByText("Make keeper")).toBeInTheDocument();
    expect(screen.getByText(/Mark injured/)).toBeInTheDocument();
    expect(screen.getByText("Alice moves out")).toBeInTheDocument(); // p1 is the current keeper

    await user.click(screen.getByText("Make keeper"));
    // Deferred one rAF past the tap by the swap-animation trigger — see
    // "Sub done in the sheet writes to subLog" above for why.
    await waitFor(() => expect(onSwap).toHaveBeenCalledWith("p6", "p1"));
  });

  it("still doesn't offer Make keeper for a bench player who isn't keeper-eligible", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, keeperEligibleIds: ["p1", "p2", "p3", "p4", "p5", "p7"] })} />); // p6/Finn not eligible
    await user.click(tokenButtonFor("Finn"));
    expect(screen.queryByText("Make keeper")).not.toBeInTheDocument();
  });

  it("choosing Swap enters swap-picking mode rather than immediately calling onSwap", async () => {
    const setSwapPickId = vi.fn();
    const onSwap = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, setSwapPickId, onSwap })} />);
    await user.click(tokenButtonFor("Bob"));
    await user.click(screen.getByText("Swap player"));
    expect(setSwapPickId).toHaveBeenCalledWith("p2");
    expect(onSwap).not.toHaveBeenCalled();
  });

  it("choosing Make keeper calls onSwap with the target and the current keeper", async () => {
    const onSwap = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, onSwap })} />);
    await user.click(tokenButtonFor("Bob")); // p2
    await user.click(screen.getByText("Make keeper"));
    // Deferred one rAF past the tap — see the earlier Make-keeper test's
    // own comment on why.
    await waitFor(() => expect(onSwap).toHaveBeenCalledWith("p2", "p1")); // p1 is the current keeper
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

  it("tapping a bench player while mid-swap completes the swap with the pending swap source — no separate 'Swap in' button needed", async () => {
    const onSwap = vi.fn();
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0, swapPickId: "p2", onSwap })} />);
    await user.click(tokenButtonFor("Finn")); // p6, bench
    // Deferred one rAF past the tap — see the Make-keeper tests' own
    // comment on why.
    await waitFor(() => expect(onSwap).toHaveBeenCalledWith("p2", "p6"));
  });

  it("tapping the same player again toggles their menu closed", async () => {
    const user = userEvent.setup();
    render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 0 })} />);
    const bobToken = tokenButtonFor("Bob");
    await user.click(bobToken);
    expect(screen.getByText("Swap player")).toBeInTheDocument();
    await user.click(bobToken);
    expect(screen.queryByText("Swap player")).not.toBeInTheDocument();
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

describe("MatchView — injured chip and the back-from-injury popover", () => {
  // A2h-Injured / A2i-Back-from-injury: an injured chip opens its own
  // dedicated two-button popover, not the general Swap/Make keeper/Mark
  // injured one — a separate mechanism from the tap-to-act menu above,
  // not a variant of it.
  it("tapping an injured chip opens Back to bench / Still out, not the general player-tap menu", async () => {
    const user = userEvent.setup();
    render(
      <MatchView
        {...baseProps({ activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"] })}
      />
    );
    await user.click(tokenButtonFor("Gus")); // p7, injured
    expect(screen.getByText("Gus is out")).toBeInTheDocument();
    expect(screen.getByText("Back to bench")).toBeInTheDocument();
    expect(screen.getByText("Still out")).toBeInTheDocument();
    expect(screen.queryByText("Swap player")).not.toBeInTheDocument();
    expect(screen.queryByText("Make keeper")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark injured/)).not.toBeInTheDocument();
  });

  // Real-device bug: the injured chip's own "lit above the scrim"
  // highlight was rendering *in front of* the back-from-injury sheet it
  // had just opened, instead of staying tucked behind it (mdOriginLit
  // used to outrank mdSheet's own z-index — see styles.js's comment).
  it("keeps the lit injured chip behind the back-from-injury sheet, not in front of it", async () => {
    const user = userEvent.setup();
    render(
      <MatchView
        {...baseProps({ activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"] })}
      />
    );
    const gusChip = tokenButtonFor("Gus");
    await user.click(gusChip);
    const sheet = screen.getByTestId("back-popover");
    expect(Number(gusChip.style.zIndex)).toBeLessThan(Number(sheet.style.zIndex));
  });

  it("shows when they went off when tracked, and a plain fallback when it isn't (an older saved game)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MatchView
        {...baseProps({
          activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"], injuredAt: { p7: 65 },
        })}
      />
    );
    await user.click(tokenButtonFor("Gus"));
    expect(screen.getByText("Off at 1:05 · not counting minutes")).toBeInTheDocument();

    // Same popover instance, re-rendered with no tracked timestamp this
    // time (an older saved game) — still open (state persists across a
    // rerender), so no second click here; clicking Gus again would toggle
    // it closed instead.
    rerender(
      <MatchView
        {...baseProps({
          activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"], injuredAt: {},
        })}
      />
    );
    expect(screen.getByText("Not counting minutes")).toBeInTheDocument();
  });

  it("Back to bench calls onBringBack and closes the popover", async () => {
    const onBringBack = vi.fn();
    const user = userEvent.setup();
    render(
      <MatchView
        {...baseProps({ activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"], onBringBack })}
      />
    );
    await user.click(tokenButtonFor("Gus"));
    await user.click(screen.getByText("Back to bench"));
    expect(onBringBack).toHaveBeenCalledWith("p7");
    expect(screen.queryByText("Back to bench")).not.toBeInTheDocument();
  });

  it("Still out just closes the popover without calling onBringBack", async () => {
    const onBringBack = vi.fn();
    const user = userEvent.setup();
    render(
      <MatchView
        {...baseProps({ activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"], onBringBack })}
      />
    );
    await user.click(tokenButtonFor("Gus"));
    await user.click(screen.getByText("Still out"));
    expect(onBringBack).not.toHaveBeenCalled();
    expect(screen.queryByText("Still out")).not.toBeInTheDocument();
  });

  it("tapping the same injured chip again toggles the popover closed", async () => {
    const user = userEvent.setup();
    render(
      <MatchView
        {...baseProps({ activeInterval: 0, elapsedSec: 0, plan: planWithP7Injured, injuredThisGame: ["p7"] })}
      />
    );
    const gusChip = tokenButtonFor("Gus");
    await user.click(gusChip);
    expect(screen.getByText("Back to bench")).toBeInTheDocument();
    await user.click(gusChip);
    expect(screen.queryByText("Back to bench")).not.toBeInTheDocument();
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

  // Backlog #4: a one-time confetti burst over the match-complete banner.
  it("bursts confetti over the match-complete banner", () => {
    const { container } = render(<MatchView {...baseProps({ activeInterval: 1, elapsedSec: 12 * 60 })} />);
    expect(screen.getByText(/Match complete/)).toBeInTheDocument();
    // 16 pieces, each carrying the animation this file's own keyframe drives.
    const pieces = [...container.querySelectorAll("div")].filter((d) => d.getAttribute("style")?.includes("mvConfettiFall"));
    expect(pieces).toHaveLength(16);
  });
});

// Whatever actually changes `plan` (a swap, a late arrival, an injury, a
// squad change) all funnel through this same prop, so these drive the
// toast the same way: a fresh plan reference landing after the initial
// mount, via rerender.
describe("MatchView — mid-match fairness toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows nothing on first mount — only an actual change triggers it", () => {
    render(<MatchView {...baseProps()} />);
    expect(screen.queryByText(/Subs still fair|Nearly even|Evening it up/)).not.toBeInTheDocument();
  });

  // defaultPlan/planWithP7Injured: p7 never appears on either interval's
  // onField list in either fixture, so their spread against all 7
  // available players is 12 (p1/p2/p3/p5 at 12 min each vs. p7 at 0),
  // against this fixture's own 6-min intervals — 2 intervals' worth
  // (12 min), over the 10-min ceiling for that band, so "nearly fair"
  // (getFairnessState, fairness.js) either way, same toast copy for
  // both plans.
  it("shows just the fairness mark on the trigger — no visible pill or on-screen words, real-use feedback retired that", () => {
    const { rerender } = render(<MatchView {...baseProps()} />);
    rerender(<MatchView {...baseProps({ plan: planWithP7Injured })} />);
    act(() => vi.advanceTimersByTime(16)); // flush the entrance rAF

    // The mark itself: drawn, 56px, correctly labelled by state.
    const mark = screen.getByRole("img", { name: "Nearly fair" });
    expect(mark).toHaveStyle({ width: "56px", height: "56px" });

    // The toast copy is still in the DOM (so aria-live still announces
    // it once) but visually hidden — not a drawn pill with visible text.
    const words = screen.getByText("Nearly even");
    expect(words).toHaveStyle({ position: "absolute", width: "1px", height: "1px", overflow: "hidden" });
    expect(words.closest('[aria-live="polite"]')).toBeInTheDocument();
  });

  it("fades out on its own after ~5s, without needing a tap to dismiss", () => {
    const { rerender } = render(<MatchView {...baseProps()} />);
    rerender(<MatchView {...baseProps({ plan: planWithP7Injured })} />);
    act(() => vi.advanceTimersByTime(16));
    const toast = screen.getByText("Nearly even").closest('[aria-live="polite"]');
    expect(toast).toHaveStyle({ opacity: "1" });

    act(() => vi.advanceTimersByTime(5000));
    expect(toast).toHaveStyle({ opacity: "0" });
  });

  it("never requires a dismiss tap — the holder itself ignores pointer events", () => {
    const { rerender } = render(<MatchView {...baseProps()} />);
    rerender(<MatchView {...baseProps({ plan: planWithP7Injured })} />);
    act(() => vi.advanceTimersByTime(16));
    const toast = screen.getByText("Nearly even").closest('[aria-live="polite"]');
    expect(toast).toHaveStyle({ pointerEvents: "none" });
  });
});

describe("MatchView — swap-animation dual-mount + gold hold marker (Backlog: motion for committed swaps)", () => {
  beforeEach(() => vi.useFakeTimers());

  // A minimal stand-in for useMatchState's real performSwap, scoped to
  // this test's own 2-interval fixture: takes whichever of the two ids
  // is on the bench and swaps them into interval 0's onField (the other
  // going the other way), or trades isGk in place if both are already on
  // the field. Just enough real data-flip behaviour for beginSwap's own
  // ghost-node logic (MatchView.jsx) to have something genuine to react
  // to — the actual swap *algorithm* is rotation.js's job and already has
  // its own thorough tests; this only exists to prove the animation layer
  // wired on top of it behaves once the data really does change under it.
  function Harness({ onSwapSpy }) {
    const [plan, setPlan] = useState(() => JSON.parse(JSON.stringify(defaultPlan)));
    const [swapPickId, setSwapPickId] = useState("p2");
    const onSwap = (aId, bId) => {
      onSwapSpy(aId, bId);
      setPlan((prev) => {
        const next = JSON.parse(JSON.stringify(prev));
        const iv = next[0];
        const aOnField = iv.onField.find((p) => p.id === aId);
        const bOnField = iv.onField.find((p) => p.id === bId);
        if (aOnField && !bOnField) {
          iv.onField = iv.onField.map((p) => (p.id === aId ? { ...p, id: bId } : p));
          iv.bench = iv.bench.map((id) => (id === bId ? aId : id));
        } else if (bOnField && !aOnField) {
          iv.onField = iv.onField.map((p) => (p.id === bId ? { ...p, id: aId } : p));
          iv.bench = iv.bench.map((id) => (id === aId ? bId : id));
        } else if (aOnField && bOnField) {
          const aIsGk = aOnField.isGk;
          aOnField.isGk = bOnField.isGk;
          bOnField.isGk = aIsGk;
        }
        return next;
      });
    };
    return <MatchView {...baseProps({ plan, activeInterval: 0, elapsedSec: 0, swapPickId, setSwapPickId, onSwap })} />;
  }

  it("keeps both players mounted through the travel, then clears everything once the gold hold is done", () => {
    const onSwapSpy = vi.fn();
    render(<Harness onSwapSpy={onSwapSpy} />);
    fireEvent.click(tokenButtonFor("Finn")); // p6, bench — completes the pending swapPickId=p2 (Bob) swap

    // Pending frame: data hasn't flipped yet, the real commit hasn't run.
    expect(onSwapSpy).not.toHaveBeenCalled();

    // One rAF later, beginSwap's own pending->active effect fires the
    // real commit and the data flips.
    act(() => vi.advanceTimersByTime(16));
    expect(onSwapSpy).toHaveBeenCalledWith("p2", "p6");

    // Mid-travel: Bob (left the pitch, arriving at the bench) and Finn
    // (left the bench, arriving on the pitch) both still have a token on
    // screen — the whole point of part A's dual-mount.
    const nameSpans = (text) => screen.getAllByText(text).filter((el) => el.tagName === "SPAN");
    expect(nameSpans("Bob").length).toBeGreaterThan(0);
    expect(nameSpans("Finn").length).toBeGreaterThan(0);

    // Real-use feedback: rendering Bob's arriving bench chip and Finn's
    // departing one as two ordinary flex siblings made the row visibly
    // reflow and the two names collide on screen — this pair shares one
    // slot instead (renderBenchSlotPair), so both bench-side chips sit
    // inside the SAME wrapper rather than as separate top-level items.
    const pairSlot = document.querySelector('span[style*="display: inline-block"]');
    expect(pairSlot).toBeTruthy();
    expect(pairSlot.textContent).toContain("Bob");
    expect(pairSlot.textContent).toContain("Finn");

    // Real-use feedback, real screenshot: the pitch name label used to
    // stay at opacity 1 for the *whole* hold regardless of which player
    // it belonged to — it's a sibling of the shirt button, not a
    // descendant, so the swap fade (applied only to the button) never
    // reached it, and two names sat fully visible on top of each other.
    // Once settled well past the travel, Bob's pitch-side name (he left
    // the pitch) must be faded to 0 — not just his shirt — while Finn's
    // (arriving) is fully opaque.
    act(() => vi.advanceTimersByTime(650 + 140 + 250));
    const pitchNameWrapper = (text) => {
      const span = screen.getAllByText(text).find(
        (el) => el.tagName === "SPAN" && el.parentElement.tagName !== "BUTTON" && el.closest('[style*="translate(-50%"]')
      );
      return span.parentElement; // the new swap-fade wrapper around shirt+name
    };
    expect(pitchNameWrapper("Bob").style.opacity).toBe("0");
    expect(pitchNameWrapper("Finn").style.opacity).toBe("1");

    // Past the full window (travel + 140ms delay + gold fade-in +
    // GOLD_HOLD_MS hold + gold fade-out + margin), activeSwap clears
    // itself — each name is back down to exactly the one real token it
    // actually has.
    act(() => vi.advanceTimersByTime(650 + 140 + 220 + 1000 + 520 + 200));
    expect(nameSpans("Bob").length).toBe(1);
    expect(nameSpans("Finn").length).toBe(1);
  });

  it("under prefers-reduced-motion, still shows both ends and still clears — just without the travel curves", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query, addEventListener: () => {}, removeEventListener: () => {},
    });
    const onSwapSpy = vi.fn();
    render(<Harness onSwapSpy={onSwapSpy} />);
    fireEvent.click(tokenButtonFor("Finn"));
    act(() => vi.advanceTimersByTime(16));
    expect(onSwapSpy).toHaveBeenCalledWith("p2", "p6");

    // Reduced-motion's own travel is only 160ms, but the gold hold itself
    // is never shortened (part E, explicit) — clearing still waits out
    // the full GOLD_HOLD_MS hold plus its fades. Checked partway through
    // the hold (half of it), comfortably clear of either edge.
    act(() => vi.advanceTimersByTime(160 + 140 + 220 + 500));
    const nameSpans = (text) => screen.getAllByText(text).filter((el) => el.tagName === "SPAN");
    // Still mid-hold — both real tokens present, nothing has cleared yet.
    expect(nameSpans("Bob").length).toBeGreaterThan(0);
    expect(nameSpans("Finn").length).toBeGreaterThan(0);

    act(() => vi.advanceTimersByTime(500 + 520 + 200));
    expect(nameSpans("Bob").length).toBe(1);
    expect(nameSpans("Finn").length).toBe(1);

    window.matchMedia = originalMatchMedia;
  });
});

describe("MatchView — Sub done's swap animation waits for the real clock advance", () => {
  beforeEach(() => vi.useFakeTimers());

  // Sub done never calls onSwap — the pitch/bench occupants for interval
  // 1 only ever come from the clock crossing into it (useMatchState's own
  // auto-follow effect, simulated here by literally advancing
  // activeInterval once the "clock" decides to, independently of the tap
  // below) — this harness's whole point is proving the animation waits
  // for that real advance instead of firing (and then reverting) right on
  // the tap.
  function Harness({ activeInterval, setActiveInterval }) {
    // Real subLog state, not a static prop — otherwise confirmedAt never
    // actually becomes defined and the final60 sheet (with its own
    // "Dan" text in the swap-rows list) never closes, muddying the
    // pitch/bench assertions below with a second, unrelated "Dan".
    const [subLog, setSubLog] = useState({});
    return (
      <MatchView
        {...baseProps({
          plan: defaultPlan, activeInterval, elapsedSec: 340, timerRunning: true, setActiveInterval, subLog, setSubLog,
        })}
      />
    );
  }

  it("does not animate on the tap itself, and does animate once activeInterval genuinely advances", () => {
    let activeInterval = 0;
    const setActiveInterval = vi.fn((next) => {
      activeInterval = next;
    });
    const { rerender } = render(<Harness activeInterval={activeInterval} setActiveInterval={setActiveInterval} />);

    fireEvent.click(within(screen.getByTestId("execute-sheet")).getByText("Sub done ✓"));
    act(() => vi.advanceTimersByTime(16)); // nothing pending to flip yet — no real advance happened

    const nameSpans = (text) => screen.getAllByText(text).filter((el) => el.tagName === "SPAN");
    // Interval 0 still showing, unchanged — Dan (p4, leaving) and Finn
    // (p6, arriving) each have exactly their one real token, no ghost of
    // either, because nothing has actually moved yet.
    expect(nameSpans("Dan").length).toBe(1);
    expect(nameSpans("Finn").length).toBe(1);

    // The clock (not this tap) is what really advances the board — same
    // as useMatchState's own auto-follow effect would, moments later.
    rerender(<Harness activeInterval={1} setActiveInterval={setActiveInterval} />);
    act(() => vi.advanceTimersByTime(16)); // flush the newly-queued "pending" -> "active" flip

    // NOW both Dan (fading out) and Finn (rising in) are on screen at
    // once — the dual-mount finally has real data to animate against.
    expect(nameSpans("Dan").length).toBeGreaterThan(0);
    expect(nameSpans("Finn").length).toBeGreaterThan(0);

    act(() => vi.advanceTimersByTime(650 + 140 + 220 + 2000 + 520 + 200));
    expect(nameSpans("Dan").length).toBe(1);
    expect(nameSpans("Finn").length).toBe(1);
  });
});

describe("MatchView — auto-apply toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows nothing until autoAppliedSub actually changes", () => {
    render(<MatchView {...baseProps()} />);
    expect(screen.queryByText(/Sub applied automatically/)).not.toBeInTheDocument();
  });

  it("shows a message naming who came on when autoAppliedSub fires, and actually unmounts afterward — not just fades, leaving no permanent gap", () => {
    const { rerender } = render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 390 })} />);
    rerender(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 390, autoAppliedSub: { index: 0, at: 390 } })} />);
    act(() => vi.advanceTimersByTime(16));

    // defaultPlan interval 0 -> 1: Finn (p6) is the one regular bench
    // arrival (the keeper handover, Alice -> Cara, is a pure on-pitch
    // role swap with nobody arriving from the bench — see the prepare-
    // sheet tests above for that same fixture's own shape).
    expect(screen.getByText(/Sub applied automatically:.*Finn/)).toBeInTheDocument();

    // Real-use feedback: this used to fade to opacity 0 but stay mounted
    // forever, permanently reserving its own height + margin in the flex
    // column above the action bar. Past the full hold+fade window, it
    // must be gone from the DOM entirely, not just invisible.
    act(() => vi.advanceTimersByTime(5400));
    expect(screen.queryByText(/Sub applied automatically/)).not.toBeInTheDocument();
  });

  it("a fresh auto-apply (a different key) re-triggers the toast even if a previous one already fired", () => {
    // Mounts with autoAppliedSub already null, same as the real app always
    // does (useMatchState's own initial state) — mounting with it already
    // set from the very first render would match the ref-diff trigger's
    // own initial value and never fire at all, same reasoning as the
    // fairness toast's "0 = never triggered yet" guard just above.
    const { rerender } = render(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 390 })} />);
    rerender(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 390, autoAppliedSub: { index: 0, at: 390 } })} />);
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByText(/Sub applied automatically/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5400));
    expect(screen.queryByText(/Sub applied automatically/)).not.toBeInTheDocument();

    rerender(<MatchView {...baseProps({ activeInterval: 0, elapsedSec: 390, autoAppliedSub: { index: 0, at: 700 } })} />);
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByText(/Sub applied automatically/)).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
//
// Component tests for SummaryModal (README > A5-Minutes, #11b). Shows the
// FULL GAME projection — "how many minutes will each player end up with by
// full time" — not a mid-game/elapsed-capped snapshot. An earlier pass of
// this redesign made it live-capped instead, but that was a deliberate
// behavior change from what the app had always shown, and it turned out
// that wasn't wanted — reverted back to the full plan. No elapsedSec prop
// at all now.
//
// The old "Injured" column is gone — injuredMin is still computed
// internally (computeMinutesSummary), but the redesigned screen doesn't
// surface it as a column; a deliberate copy/feature change, not an
// oversight.
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SummaryModal from "./SummaryModal.jsx";

afterEach(cleanup);

const NAMES = { p1: "Alice", p2: "Bob", p3: "Cara" };
const NUMBERS = { p1: 1, p2: 2, p3: 3 };
const nameOf = (id) => NAMES[id] || id;
const numberOf = (id) => NUMBERS[id] ?? "?";

function makeInterval(index, startMin, endMin, onFieldIds, gkId, bench) {
  return {
    index, startMin, endMin,
    onField: onFieldIds.map((id) => ({ id, isGk: id === gkId })),
    bench,
  };
}

// p1 keeps goal for interval 1 (0-6), hands off to p2 for interval 2
// (6-12); p3 is on the bench throughout the full 12-minute game. Full-game
// totals: p1 = 6 outfield + 6 goal, p2 = 6 outfield + 6 goal, p3 = 12 bench
// — every player ends up with exactly 12:00 total, a clean audit example.
const plan = [
  makeInterval(0, 0, 6, ["p1", "p2"], "p1", ["p3"]),
  makeInterval(1, 6, 12, ["p1", "p2"], "p2", ["p3"]),
];
const availableIds = ["p1", "p2", "p3"];

function baseProps(overrides = {}) {
  return { plan, availableIds, nameOf, numberOf, onClose: vi.fn(), ...overrides };
}

describe("SummaryModal", () => {
  it("shows full-game totals, not just what's been played so far", () => {
    render(<SummaryModal {...baseProps()} />);
    // Every player ends the full 12-minute game with exactly 12:00 total
    // pitch+goal+bench time (see the fixture comment above) — the totals
    // row should read 12:00 across all three columns.
    const totalsRow = screen.getByText("Total").closest("div");
    const values = within(totalsRow).getAllByText("12:00");
    expect(values).toHaveLength(3);
  });

  it("shows the full game length as the header's context chip", () => {
    render(<SummaryModal {...baseProps()} />);
    expect(screen.getAllByText("12:00").length).toBeGreaterThan(0);
  });

  it("orders rows by pitch time descending — no live 'current keeper' special case", () => {
    render(<SummaryModal {...baseProps()} />);
    // p1 and p2 tie on outfield minutes (6 each) — stable sort keeps them
    // in their original availableIds order; p3 (0 pitch minutes) last.
    const names = screen.getAllByText(/Alice|Bob|Cara/).map((el) => el.textContent);
    expect(names).toEqual(["Alice", "Bob", "Cara"]);
  });

  it("renders zero as an em dash, not 0:00", () => {
    render(<SummaryModal {...baseProps()} />);
    // p3 never left the bench — both pitch and goal read as a dash.
    const caraRow = screen.getByText("Cara").closest("div");
    const dashes = within(caraRow).getAllByText("—");
    expect(dashes).toHaveLength(2); // pitch, goal — bench has a real value (12:00)
  });

  it("has no Injured column — a deliberate change from the previous version", () => {
    render(<SummaryModal {...baseProps()} />);
    expect(screen.queryByText("Injured")).not.toBeInTheDocument();
    expect(screen.getByText("PITCH")).toBeInTheDocument();
    expect(screen.getByText("GOAL")).toBeInTheDocument();
    expect(screen.getByText("BENCH")).toBeInTheDocument();
  });

  // Real-use feedback: this note used to sit here, computed as a pure
  // outfield-minutes spread — removed because RotationProgressOverlay's
  // own "Pitch time is within N min" line uses a different metric
  // (goal+outfield combined via computeFairnessSpread) but identical
  // wording, so the two could legitimately disagree for the same
  // rotation and read as a bug. See SummaryModal.jsx's own comment.
  it("no longer shows a pitch-time-spread note — removed for conflicting with RotationProgressOverlay's differently-computed one", () => {
    render(<SummaryModal {...baseProps()} />);
    expect(screen.queryByText(/Pitch time is within/)).not.toBeInTheDocument();
  });

  it("gives every player the same plain green disc — no gold keeper-eligible variant, per explicit feedback", () => {
    render(<SummaryModal {...baseProps()} />);
    // p1/p2 are both keeper-eligible in the source data this fixture is
    // drawn from (rotation.js's plan generation) — this screen just
    // doesn't care. Season (#10c) matches this exactly, see its own test.
    const discs = screen.getAllByText(/^[123]$/); // the number-disc spans (Alice=1, Bob=2, Cara=3)
    discs.forEach((disc) => {
      expect(disc).toHaveStyle({ backgroundColor: "rgb(46, 125, 83)" }); // tokens.color.pitchGreen
    });
  });

  it("calls onClose when the back button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SummaryModal {...baseProps({ onClose })} />);
    await user.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

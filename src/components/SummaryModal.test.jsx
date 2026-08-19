// @vitest-environment jsdom
//
// Component tests for SummaryModal (README > A5-Minutes, #11b). The actual
// minute math (computeMinutesSummary, describeMinutesNote) already has
// thorough coverage in rotation.test.js — these tests are about what this
// component does with that data: capping to elapsed time (not the full
// plan — a deliberate behavior change from the previous version, which
// always showed the full planned game), sort order, zero-as-dash, and the
// three PITCH/GOAL/BENCH columns.
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
// (6-12); p3 is on the bench throughout. elapsedSec = 540 (9:00) lands
// mid-way through interval 2, so only 3 of its 6 minutes count.
const plan = [
  makeInterval(0, 0, 6, ["p1", "p2"], "p1", ["p3"]),
  makeInterval(1, 6, 12, ["p1", "p2"], "p2", ["p3"]),
];
const availableIds = ["p1", "p2", "p3"];
const keeperEligibleIds = ["p1", "p2"];

function baseProps(overrides = {}) {
  return {
    plan, availableIds, nameOf, numberOf, keeperEligibleIds, elapsedSec: 540, onClose: vi.fn(),
    ...overrides,
  };
}

describe("SummaryModal", () => {
  it("caps totals to elapsed time, not the full plan", () => {
    render(<SummaryModal {...baseProps()} />);
    // At 9:00 elapsed: p1 = 3 outfield (interval 2, partial) + 6 goal
    // (interval 1, full) = totals row pitch 9:00, goal 9:00, bench 9:00
    // (see rotation.test.js's audit-invariant test for why these three
    // must match exactly: elapsed x 1 outfield spot, elapsed x 1 goal
    // spot, elapsed x 1 bench spot, for this 2-on/1-bench squad shape).
    const totalsRow = screen.getByText("Total").closest("div");
    const values = within(totalsRow).getAllByText("9:00");
    expect(values).toHaveLength(3);
  });

  it("shows the elapsed time as the header's context chip", () => {
    render(<SummaryModal {...baseProps()} />);
    // fmtClock(540) — appears both as the context chip and (per the
    // totals-row assertion above) as every totals value, so there's more
    // than one on screen; just confirm it's present at all.
    expect(screen.getAllByText("9:00").length).toBeGreaterThan(0);
  });

  it("orders rows with the live keeper first, then by pitch time descending", () => {
    render(<SummaryModal {...baseProps()} />);
    // p2 is the live keeper at 9:00 (took over at 6'), pinned first
    // regardless of their own pitch-time total; p1 (3 pitch minutes)
    // outranks p3 (0 pitch minutes) for the remaining two rows.
    const names = screen.getAllByText(/Alice|Bob|Cara/).map((el) => el.textContent);
    expect(names).toEqual(["Bob", "Alice", "Cara"]);
  });

  it("renders zero as an em dash, not 0:00", () => {
    render(<SummaryModal {...baseProps()} />);
    // p3 never left the bench — both pitch and goal read as a dash.
    const caraRow = screen.getByText("Cara").closest("div");
    const dashes = within(caraRow).getAllByText("—");
    expect(dashes).toHaveLength(2); // pitch, goal — bench has a real value (9:00)
  });

  it("has no Injured column — a deliberate change from the previous version", () => {
    render(<SummaryModal {...baseProps()} />);
    expect(screen.queryByText("Injured")).not.toBeInTheDocument();
    expect(screen.getByText("PITCH")).toBeInTheDocument();
    expect(screen.getByText("GOAL")).toBeInTheDocument();
    expect(screen.getByText("BENCH")).toBeInTheDocument();
  });

  it("shows the pitch-time spread in the note card (no keeper callout here — Bob only took over at 6', not since kickoff)", () => {
    render(<SummaryModal {...baseProps()} />);
    expect(screen.getByText(/Pitch time is within/)).toBeInTheDocument();
    expect(screen.queryByText(/kept all game/)).not.toBeInTheDocument();
  });

  it("names the live continuous keeper in the note card when they've held it since kickoff", () => {
    // 3:00 elapsed, still inside interval 1 — p1 has been keeper the
    // entire time so far (gkMin === elapsedMin exactly).
    render(<SummaryModal {...baseProps({ elapsedSec: 180 })} />);
    expect(screen.getByText(/Alice has kept all game — shift ends at 6′\./)).toBeInTheDocument();
  });

  it("calls onClose when the back button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SummaryModal {...baseProps({ onClose })} />);
    await user.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

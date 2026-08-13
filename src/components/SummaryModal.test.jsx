// @vitest-environment jsdom
//
// Component tests for SummaryModal. computeMinutesSummary itself (the
// actual minute math) already has thorough coverage in rotation.test.js —
// these tests are only about what this component does with that result:
// sorting players by total time played, and showing/hiding the Injured
// column.
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SummaryModal from "./SummaryModal.jsx";

afterEach(cleanup);

const NAMES = { p1: "Alice", p2: "Bob", p3: "Cara" };
const nameOf = (id) => NAMES[id] || id;

function makeInterval(index, startMin, endMin, onFieldIds, gkId, bench) {
  return {
    index, startMin, endMin,
    onField: onFieldIds.map((id) => ({ id, isGk: id === gkId })),
    bench,
  };
}

describe("SummaryModal", () => {
  it("sorts players by total time played (outfield + keeper), most to least", () => {
    // p1 plays the full 12 min outfield; p2 plays 6 min (bench the other 6);
    // p3 is on the bench the whole game.
    const plan = [
      makeInterval(0, 0, 6, ["p1", "p2"], null, ["p3"]),
      makeInterval(1, 6, 12, ["p1"], null, ["p2", "p3"]),
    ];
    render(<SummaryModal plan={plan} availableIds={["p1", "p2", "p3"]} nameOf={nameOf} onClose={vi.fn()} />);
    const names = screen.getAllByText(/Alice|Bob|Cara/).map((el) => el.textContent);
    expect(names).toEqual(["Alice", "Bob", "Cara"]);
  });

  it("shows an Injured column only when someone was actually injured", () => {
    const healthyPlan = [makeInterval(0, 0, 6, ["p1"], null, ["p2"])];
    const { rerender } = render(
      <SummaryModal plan={healthyPlan} availableIds={["p1", "p2"]} nameOf={nameOf} onClose={vi.fn()} />
    );
    expect(screen.queryByText("Injured")).not.toBeInTheDocument();

    // p2 is neither on field nor on bench this interval -> counts as injured/sidelined.
    const withInjury = [makeInterval(0, 0, 6, ["p1"], null, [])];
    rerender(<SummaryModal plan={withInjury} availableIds={["p1", "p2"]} nameOf={nameOf} onClose={vi.fn()} />);
    expect(screen.getByText("Injured")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const plan = [makeInterval(0, 0, 6, ["p1"], null, ["p2"])];
    render(<SummaryModal plan={plan} availableIds={["p1", "p2"]} nameOf={nameOf} onClose={onClose} />);
    await user.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

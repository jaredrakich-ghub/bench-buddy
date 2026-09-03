// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import RotationProgressOverlay from "./RotationProgressOverlay.jsx";

// Stubs window.matchMedia — jsdom doesn't implement it at all, and the
// component's own reduced-motion hook guards against that (falls back to
// "not reduced"), but a real stub lets tests actually exercise both sides.
function stubMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  stubMatchMedia(false);
  // jsdom doesn't implement real scrolling — calling the component's own
  // scroll-reset-on-mount (see its own comment) logs a virtual-console
  // "not implemented" error otherwise, which the no-console-errors test
  // below would (rightly, for a real error) fail on.
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Flushes the rAF the component schedules for mount/focus — under fake
// timers, requestAnimationFrame is itself faked, so advancing by a frame's
// worth of time (16ms) is enough for it to fire, same as a real one would.
function flushFrame() {
  act(() => vi.advanceTimersByTime(16));
}

describe("RotationProgressOverlay", () => {
  // Real-device feedback: mounting this over a long, scrolled-down
  // settings form left "View my rotation" untappable until the coach
  // manually scrolled — traced to a stale scrollTop against the (shorter)
  // match screen underneath breaking this overlay's own position:fixed
  // centering. See the component's own comment on its scroll-reset effect.
  it("resets scroll to the top on mount", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("opens as a labelled, busy dialog over a scrim", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Balancing the squad…")).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby", screen.getByText("Balancing the squad…").id);
  });

  it("moves focus into the card once mounted, not before", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    expect(document.activeElement).not.toBe(screen.getByRole("dialog"));
    flushFrame();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("shows all three steps, progressing pending -> active -> finished roughly 530ms apart", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    expect(screen.getByText("Checking playing time")).toBeInTheDocument();
    expect(screen.getByText("Balancing rotations")).toBeInTheDocument();
    expect(screen.getByText("Finding the fairest setup")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(530));
    // Step 1 is now active/revealed, step 0 finished — no direct way to
    // query "finished" from text alone, so this just confirms the timeline
    // hasn't jumped straight to success yet.
    expect(screen.queryByText("✨ Rotation ready!")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(530));
    expect(screen.queryByText("✨ Rotation ready!")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(740)); // total 1800ms
    expect(screen.getByText("✨ Rotation ready!")).toBeInTheDocument();
  });

  it("flips to the success state at ~1800ms, aria-busy false, border/title changed", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    act(() => vi.advanceTimersByTime(1800));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("✨ Rotation ready!")).toBeInTheDocument();
    // Real-use feedback: the checklist used to unmount here, which snapped
    // the card's height straight to the result's and made it lurch. It
    // stays mounted now (crossfading out, not disappearing) — hidden from
    // the accessibility tree and click-through, not removed from the DOM.
    const checklistLayer = screen.getByText("Checking playing time").closest('[aria-hidden]');
    expect(checklistLayer).toHaveAttribute("aria-hidden", "true");
    expect(checklistLayer).toHaveStyle({ opacity: "0", pointerEvents: "none" });
  });

  it("never unmounts either layer — both stay in the DOM the whole time, only crossfading via opacity", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    // Building: the result layer already exists, just hidden.
    const resultLayer = screen.getByText("Average pitch time").closest('[aria-hidden]');
    expect(resultLayer).toHaveAttribute("aria-hidden", "true");
    expect(resultLayer).toHaveStyle({ opacity: "0", pointerEvents: "none" });
    // Its "View my rotation" button is present but never focusable early —
    // { hidden: true } because it's inside an aria-hidden ancestor right
    // now, which getByRole excludes by default.
    expect(screen.getByRole("button", { name: "View my rotation", hidden: true })).toHaveAttribute("tabindex", "-1");

    act(() => vi.advanceTimersByTime(1800));
    // Success: same result-layer node, now revealed — and the checklist
    // (asserted above) is still there too, just hidden the other way.
    expect(resultLayer).toHaveAttribute("aria-hidden", "false");
    expect(resultLayer).toHaveStyle({ opacity: "1", pointerEvents: "auto" });
    expect(screen.getByRole("button", { name: "View my rotation" })).not.toHaveAttribute("tabindex", "-1");
  });

  it("shows the fairness mark, the supporting pitch-time line, and the average row", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    act(() => vi.advanceTimersByTime(1800));
    expect(screen.getByRole("img", { name: "Fair" })).toBeInTheDocument(); // spread 2 -> Fair
    expect(screen.getByText("Pitch time is within 2 min for every child.")).toBeInTheDocument();
    expect(screen.getByText("Average pitch time")).toBeInTheDocument();
    expect(screen.getByText("≈ 22 min")).toBeInTheDocument();
  });

  it("moves focus to View my rotation once success appears, and it calls onContinue", () => {
    const onContinue = vi.fn();
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={onContinue} />);
    act(() => vi.advanceTimersByTime(1800));
    flushFrame();
    const button = screen.getByRole("button", { name: "View my rotation" });
    expect(document.activeElement).toBe(button);
    button.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("traps Tab inside the card — building phase has nothing focusable, so it bounces back to the card", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    const dialog = screen.getByRole("dialog");
    const preventDefault = vi.fn();
    act(() => {
      dialog.dispatchEvent(Object.assign(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }), { preventDefault }));
    });
    // jsdom's dispatchEvent doesn't call React's synthetic preventDefault
    // spy directly; assert the practical outcome instead — focus stayed on
    // (or returned to) the dialog itself, not somewhere behind it.
    expect(document.activeElement === dialog || document.activeElement === document.body).toBe(true);
  });

  it("renders 16 confetti pieces on success, none when reduced motion is preferred", () => {
    const { container } = render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    act(() => vi.advanceTimersByTime(1800));
    // 16 confetti pieces sit inside the aria-hidden confetti layer.
    expect(container.querySelectorAll('[aria-hidden="true"] div[style*="position: absolute"]').length).toBeGreaterThanOrEqual(16);

    cleanup();
    stubMatchMedia(true); // prefers-reduced-motion: reduce
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    act(() => vi.advanceTimersByTime(1800));
    expect(document.querySelectorAll("style")).toHaveLength(0); // no keyframes injected, no pieces rendered
  });

  it("cleans up its timers on unmount — no state updates fire after the component's gone", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<RotationProgressOverlay averageMinutes={22} maxDifference={2} intervalLen={5} onContinue={() => {}} />);
    unmount();
    act(() => vi.advanceTimersByTime(3000));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// "Needs attention" no longer dead-ends at the same single button every
// other tier gets — see fairness.js: maxDifference 30 vs intervalLen 5
// (well past both the interval-scaled and game-share needsAttention
// thresholds) puts every test below solidly in that tier.
describe("RotationProgressOverlay — needs-attention Solve flow", () => {
  function fakeCandidate(overrides = {}) {
    return {
      intervals: [{ startMin: 0, endMin: 5, onField: [], bench: [] }],
      stats: { averageMinutes: 20, maxDifference: 1, intervalLen: 5, gameMinutes: 45 },
      rows: [
        { id: "p1", outfieldMin: 20, gkMin: 15, benchMin: 10 },
        { id: "p2", outfieldMin: 30, gkMin: 0, benchMin: 15 },
      ],
      ...overrides,
    };
  }

  it("falls back to the plain 'View my rotation' button when onImprove/onUseImprovedPlan aren't wired, even at needs-attention", () => {
    render(<RotationProgressOverlay averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45} onContinue={() => {}} />);
    act(() => vi.advanceTimersByTime(1800));
    expect(screen.getByRole("button", { name: "View my rotation" })).toBeInTheDocument();
    expect(screen.queryByText("Improve pitch fairness")).not.toBeInTheDocument();
  });

  it("shows the three-choice menu instead, once onImprove/onUseImprovedPlan are wired", () => {
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={() => {}} onImprove={() => fakeCandidate()} onUseImprovedPlan={() => {}}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    expect(screen.getByRole("button", { name: "Improve pitch fairness" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Improve bench fairness" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View rotation anyway" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View my rotation" })).not.toBeInTheDocument();
  });

  it("'View rotation anyway' behaves exactly like the plain button — calls onContinue directly", () => {
    const onContinue = vi.fn();
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={onContinue} onImprove={() => fakeCandidate()} onUseImprovedPlan={() => {}}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    screen.getByRole("button", { name: "View rotation anyway" }).click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("tapping Improve pitch fairness calls onImprove('pitch') and shows the candidate's own preview", () => {
    const onImprove = vi.fn(() => fakeCandidate());
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={() => {}} onImprove={onImprove} onUseImprovedPlan={() => {}}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    act(() => screen.getByRole("button", { name: "Improve pitch fairness" }).click());

    expect(onImprove).toHaveBeenCalledWith("pitch");
    // The candidate's own stats now drive the top card — Fair (spread 1 vs
    // interval 5), not the original Needs attention.
    expect(screen.getByRole("img", { name: "Fair" })).toBeInTheDocument();
    expect(screen.getByText("Pitch time is within 1 min for every child.")).toBeInTheDocument();
    // Per-player preview rows.
    expect(screen.getByRole("button", { name: "Use this rotation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Improve pitch fairness" })).not.toBeInTheDocument();
  });

  it("Improve bench fairness calls onImprove('bench')", () => {
    const onImprove = vi.fn(() => fakeCandidate());
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={() => {}} onImprove={onImprove} onUseImprovedPlan={() => {}}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    act(() => screen.getByRole("button", { name: "Improve bench fairness" }).click());
    expect(onImprove).toHaveBeenCalledWith("bench");
  });

  it("Use this rotation calls onUseImprovedPlan with the candidate's intervals, then onContinue", () => {
    const candidate = fakeCandidate();
    const onUseImprovedPlan = vi.fn();
    const onContinue = vi.fn();
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={onContinue} onImprove={() => candidate} onUseImprovedPlan={onUseImprovedPlan}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    act(() => screen.getByRole("button", { name: "Improve pitch fairness" }).click());
    act(() => screen.getByRole("button", { name: "Use this rotation" }).click());

    expect(onUseImprovedPlan).toHaveBeenCalledWith(candidate.intervals);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("Try again re-invokes onImprove with the same metric the preview was already showing", () => {
    const onImprove = vi.fn(() => fakeCandidate());
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={() => {}} onImprove={onImprove} onUseImprovedPlan={() => {}}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    act(() => screen.getByRole("button", { name: "Improve bench fairness" }).click());
    act(() => screen.getByRole("button", { name: "Try again" }).click());

    expect(onImprove).toHaveBeenCalledTimes(2);
    expect(onImprove).toHaveBeenNthCalledWith(1, "bench");
    expect(onImprove).toHaveBeenNthCalledWith(2, "bench");
    // Still on the preview, not bounced back to the menu.
    expect(screen.getByRole("button", { name: "Use this rotation" })).toBeInTheDocument();
  });

  it("Back discards the candidate and returns to the three-choice menu, without calling onUseImprovedPlan", () => {
    const onUseImprovedPlan = vi.fn();
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={() => {}} onImprove={() => fakeCandidate()} onUseImprovedPlan={onUseImprovedPlan}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    act(() => screen.getByRole("button", { name: "Improve pitch fairness" }).click());
    act(() => screen.getByRole("button", { name: "Back" }).click());

    expect(screen.getByRole("button", { name: "Improve pitch fairness" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Improve bench fairness" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this rotation" })).not.toBeInTheDocument();
    expect(onUseImprovedPlan).not.toHaveBeenCalled();
    // Back at the ORIGINAL plan's own tier, not the candidate's.
    expect(screen.getByRole("img", { name: "Needs attention" })).toBeInTheDocument();
  });

  it("shows player names via nameOf/numberOf when provided, falling back to the raw id otherwise", () => {
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={() => {}} onImprove={() => fakeCandidate()} onUseImprovedPlan={() => {}}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    act(() => screen.getByRole("button", { name: "Improve pitch fairness" }).click());
    expect(screen.getByText("p1")).toBeInTheDocument(); // no nameOf given — falls back to the raw id

    cleanup();
    stubMatchMedia(false);
    window.scrollTo = vi.fn();
    render(
      <RotationProgressOverlay
        averageMinutes={22} maxDifference={30} intervalLen={5} gameMinutes={45}
        onContinue={() => {}} onImprove={() => fakeCandidate()} onUseImprovedPlan={() => {}}
        nameOf={(id) => ({ p1: "Atu", p2: "Eli" })[id]} numberOf={(id) => ({ p1: 2, p2: 3 })[id]}
      />
    );
    act(() => vi.advanceTimersByTime(1800));
    act(() => screen.getByRole("button", { name: "Improve pitch fairness" }).click());
    expect(screen.getByText("Atu")).toBeInTheDocument();
    expect(screen.getByText("Eli")).toBeInTheDocument();
  });
});

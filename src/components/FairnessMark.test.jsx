// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import FairnessMark from "./FairnessMark.jsx";

afterEach(cleanup);

describe("FairnessMark", () => {
  it("Fair (spread 0-2): green ring, no beam tilt", () => {
    render(<FairnessMark spreadMin={1} />);
    const mark = screen.getByRole("img", { name: "Fair" });
    expect(mark).toHaveStyle({ borderColor: "rgb(46, 125, 83)" }); // #2E7D53
    expect(mark.querySelector("g")).toHaveAttribute("transform", "rotate(0 12 8)");
  });

  it("Nearly fair (spread 3-4): amber ring, tilted beam", () => {
    render(<FairnessMark spreadMin={3} />);
    const mark = screen.getByRole("img", { name: "Nearly fair" });
    expect(mark).toHaveStyle({ borderColor: "rgb(245, 185, 59)" }); // #F5B93B
    expect(mark.querySelector("g")).toHaveAttribute("transform", "rotate(9 12 8)");
  });

  it("Needs attention (spread 5+): red ring, steepest tilt", () => {
    render(<FairnessMark spreadMin={9} />);
    const mark = screen.getByRole("img", { name: "Needs attention" });
    expect(mark).toHaveStyle({ borderColor: "rgb(196, 72, 42)" }); // #C4482A
    expect(mark.querySelector("g")).toHaveAttribute("transform", "rotate(21 12 8)");
  });

  it("never changes the glyph itself — same beam/post/base paths regardless of state", () => {
    render(<FairnessMark spreadMin={1} />);
    const paths = screen.getByRole("img").querySelectorAll("svg path");
    expect(paths).toHaveLength(3); // beam bar, post, base triangle
  });

  it("defaults to 44px with a 3px ring; accepts overrides for the compact toast usage", () => {
    render(<FairnessMark spreadMin={0} />);
    expect(screen.getByRole("img")).toHaveStyle({ width: "44px", height: "44px", borderWidth: "3px" });
    cleanup();
    render(<FairnessMark spreadMin={0} size={32} ringWidth={2.5} glyphSize={17} />);
    const mark = screen.getByRole("img");
    expect(mark).toHaveStyle({ width: "32px", height: "32px", borderWidth: "2.5px" });
    expect(mark.querySelector("svg")).toHaveAttribute("width", "17");
  });
});

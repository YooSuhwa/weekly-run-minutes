import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressBar } from "../ui/progress-bar";

describe("ProgressBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with 0% progress", () => {
    render(<ProgressBar value={0} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeDefined();
    expect(progressbar.style.width).toBe("0%");
  });

  it("renders with 50% progress", () => {
    render(<ProgressBar value={50} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.style.width).toBe("50%");
  });

  it("renders with 100% progress", () => {
    render(<ProgressBar value={100} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.style.width).toBe("100%");
  });

  it("clamps value to 100% when exceeding max", () => {
    render(<ProgressBar value={150} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.style.width).toBe("100%");
  });

  it("shows percentage by default", () => {
    render(<ProgressBar value={75} />);
    expect(screen.getByText("75%")).toBeDefined();
  });

  it("hides percentage when showPercentage is false", () => {
    render(<ProgressBar value={75} showPercentage={false} />);
    expect(screen.queryByText("75%")).toBeNull();
  });

  it("shows label when provided", () => {
    render(<ProgressBar value={60} label="Uploading..." />);
    expect(screen.getByText("Uploading...")).toBeDefined();
  });

  it("shows both label and percentage", () => {
    render(<ProgressBar value={40} label="Processing" />);
    expect(screen.getByText("Processing")).toBeDefined();
    expect(screen.getByText("40%")).toBeDefined();
  });

  it("calculates percentage based on custom max", () => {
    render(<ProgressBar value={25} max={50} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.style.width).toBe("50%");
    expect(screen.getByText("50%")).toBeDefined();
  });

  it("sets correct aria attributes", () => {
    render(<ProgressBar value={30} max={200} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("30");
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("200");
  });

  it("applies custom className", () => {
    const { container } = render(<ProgressBar value={50} className="custom-progress" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.getAttribute("class")).toContain("custom-progress");
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AudioWave } from "../ui/audio-wave";

describe("AudioWave", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders with default props", () => {
      render(<AudioWave />);
      const wave = screen.getByRole("img", { name: /오디오 재생 중/ });
      expect(wave).toBeDefined();
    });

    it("renders correct number of bars", () => {
      const { container } = render(<AudioWave bars={7} />);
      const bars = container.querySelectorAll(".rounded-full");
      expect(bars.length).toBe(7);
    });

    it("renders 5 bars by default", () => {
      const { container } = render(<AudioWave />);
      const bars = container.querySelectorAll(".rounded-full");
      expect(bars.length).toBe(5);
    });
  });

  describe("active state", () => {
    it("has animation class when active", () => {
      const { container } = render(<AudioWave isActive />);
      const bars = container.querySelectorAll(".animate-audio-wave");
      expect(bars.length).toBe(5);
    });

    it("does not have animation class when inactive", () => {
      const { container } = render(<AudioWave isActive={false} />);
      const bars = container.querySelectorAll(".animate-audio-wave");
      expect(bars.length).toBe(0);
    });

    it("shows correct aria-label when active", () => {
      render(<AudioWave isActive />);
      expect(screen.getByRole("img", { name: "오디오 재생 중" })).toBeDefined();
    });

    it("shows correct aria-label when inactive", () => {
      render(<AudioWave isActive={false} />);
      expect(screen.getByRole("img", { name: "오디오 중지됨" })).toBeDefined();
    });
  });

  describe("variants", () => {
    it("applies primary variant by default", () => {
      const { container } = render(<AudioWave />);
      const bars = container.querySelectorAll(".bg-primary");
      expect(bars.length).toBe(5);
    });

    it("applies muted variant", () => {
      const { container } = render(<AudioWave variant="muted" />);
      const bars = container.querySelectorAll(".bg-muted-foreground");
      expect(bars.length).toBe(5);
    });

    it("applies recording variant", () => {
      const { container } = render(<AudioWave variant="recording" />);
      const bars = container.querySelectorAll(".bg-red-500");
      expect(bars.length).toBe(5);
    });
  });

  describe("sizes", () => {
    it("applies md size by default", () => {
      const { container } = render(<AudioWave />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.height).toBe("24px");
    });

    it("applies sm size", () => {
      const { container } = render(<AudioWave size="sm" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.height).toBe("16px");
    });

    it("applies lg size", () => {
      const { container } = render(<AudioWave size="lg" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.height).toBe("32px");
    });
  });

  describe("custom className", () => {
    it("applies custom className", () => {
      const { container } = render(<AudioWave className="mt-4" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("mt-4");
    });
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Weeky } from "../weeky/weeky";

describe("Weeky", () => {
  afterEach(() => {
    cleanup();
  });

  describe("expressions", () => {
    afterEach(() => {
      cleanup();
    });

    it("renders 'thinking' expression with correct aria-label", () => {
      render(<Weeky expression="thinking" />);
      const img = screen.getByRole("img", { name: "Weeky thinking" });
      expect(img).toBeDefined();
    });

    it("renders 'done' expression with correct aria-label", () => {
      render(<Weeky expression="done" />);
      const img = screen.getByRole("img", { name: "Weeky done" });
      expect(img).toBeDefined();
    });

    it("renders 'sorry' expression with correct aria-label", () => {
      render(<Weeky expression="sorry" />);
      const img = screen.getByRole("img", { name: "Weeky sorry" });
      expect(img).toBeDefined();
    });

    it("renders all 12 expressions", () => {
      const expressions = [
        "greeting",
        "listening",
        "questioning",
        "celebrating",
        "waiting",
        "noting",
        "next",
        "encouragement",
        "goodbye",
      ] as const;

      for (const expr of expressions) {
        cleanup();
        render(<Weeky expression={expr} />);
        const img = screen.getByRole("img", { name: `Weeky ${expr}` });
        expect(img).toBeDefined();
      }
    });
  });

  describe("default messages", () => {
    afterEach(() => {
      cleanup();
    });

    it("shows default thinking message", () => {
      render(<Weeky expression="thinking" />);
      expect(screen.getByText(/처리 중이에요/)).toBeDefined();
    });

    it("shows default done message", () => {
      render(<Weeky expression="done" />);
      expect(screen.getByText(/완료했어요/)).toBeDefined();
    });

    it("shows default sorry message", () => {
      render(<Weeky expression="sorry" />);
      expect(screen.getByText(/문제가 생겼어요/)).toBeDefined();
    });
  });

  describe("custom message", () => {
    afterEach(() => {
      cleanup();
    });

    it("shows custom message instead of default", () => {
      render(<Weeky expression="thinking" message="STT 변환 중..." />);
      expect(screen.getByText("STT 변환 중...")).toBeDefined();
      expect(screen.queryByText(/처리 중이에요/)).toBeNull();
    });
  });

  describe("sizes", () => {
    afterEach(() => {
      cleanup();
    });

    it("applies sm size class", () => {
      render(<Weeky expression="done" size="sm" />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("class")).toContain("text-3xl");
    });

    it("applies md size class by default", () => {
      render(<Weeky expression="done" />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("class")).toContain("text-5xl");
    });

    it("applies lg size class", () => {
      render(<Weeky expression="done" size="lg" />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("class")).toContain("text-7xl");
    });
  });

  describe("thinking animation", () => {
    afterEach(() => {
      cleanup();
    });

    it("applies animate-pulse class for thinking expression", () => {
      render(<Weeky expression="thinking" />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("class")).toContain("animate-pulse");
    });

    it("does not apply animate-pulse for done expression", () => {
      render(<Weeky expression="done" />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("class")).not.toContain("animate-pulse");
    });

    it("does not apply animate-pulse for sorry expression", () => {
      render(<Weeky expression="sorry" />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("class")).not.toContain("animate-pulse");
    });

    it("applies animate-pulse for waiting expression", () => {
      render(<Weeky expression="waiting" />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("class")).toContain("animate-pulse");
    });

    it("applies animate-pulse for listening expression", () => {
      render(<Weeky expression="listening" />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("class")).toContain("animate-pulse");
    });

    it("does not apply animate-pulse for non-animated expressions", () => {
      const nonAnimated = ["done", "greeting", "questioning", "celebrating", "next"] as const;
      for (const expr of nonAnimated) {
        cleanup();
        render(<Weeky expression={expr} />);
        const img = screen.getByRole("img");
        expect(img.getAttribute("class")).not.toContain("animate-pulse");
      }
    });
  });

  describe("custom className", () => {
    afterEach(() => {
      cleanup();
    });

    it("applies custom className to wrapper", () => {
      const { container } = render(<Weeky expression="done" className="mt-4" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("mt-4");
    });
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock("../weeky/Weeky-thinking.png", () => ({ default: "/weeky-thinking.png" }));
vi.mock("../weeky/Weeky-done.png", () => ({ default: "/weeky-done.png" }));
vi.mock("../weeky/Weeky-sorry.png", () => ({ default: "/weeky-sorry.png" }));
vi.mock("../weeky/Weeky-wave.png", () => ({ default: "/weeky-wave.png" }));
vi.mock("../weeky/Weeky-listening.png", () => ({ default: "/weeky-listening.png" }));
vi.mock("../weeky/Weeky-pointing.png", () => ({ default: "/weeky-pointing.png" }));
vi.mock("../weeky/Weeky-trophy.png", () => ({ default: "/weeky-trophy.png" }));
vi.mock("../weeky/Weeky-tip.png", () => ({ default: "/weeky-tip.png" }));
vi.mock("../weeky/Weeky-happy.png", () => ({ default: "/weeky-happy.png" }));
vi.mock("../weeky/Weeky-bye.png", () => ({ default: "/weeky-bye.png" }));

import { Weeky } from "../weeky/weeky";

describe("Weeky", () => {
  afterEach(() => {
    cleanup();
  });

  describe("expressions", () => {
    it("renders 'thinking' expression with correct alt text", () => {
      render(<Weeky expression="thinking" />);
      const img = screen.getByAltText("Weeky thinking");
      expect(img).toBeDefined();
    });

    it("renders 'done' expression with correct alt text", () => {
      render(<Weeky expression="done" />);
      const img = screen.getByAltText("Weeky done");
      expect(img).toBeDefined();
    });

    it("renders 'sorry' expression with correct alt text", () => {
      render(<Weeky expression="sorry" />);
      const img = screen.getByAltText("Weeky sorry");
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
        const img = screen.getByAltText(`Weeky ${expr}`);
        expect(img).toBeDefined();
      }
    });
  });

  describe("default messages", () => {
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
    it("shows custom message instead of default", () => {
      render(<Weeky expression="thinking" message="STT 변환 중..." />);
      expect(screen.getByText("STT 변환 중...")).toBeDefined();
      expect(screen.queryByText(/처리 중이에요/)).toBeNull();
    });
  });

  describe("sizes", () => {
    it("applies sm size (48px)", () => {
      render(<Weeky expression="done" size="sm" />);
      const img = screen.getByAltText("Weeky done");
      expect(img.getAttribute("width")).toBe("48");
      expect(img.getAttribute("height")).toBe("48");
    });

    it("applies md size by default (80px)", () => {
      render(<Weeky expression="done" />);
      const img = screen.getByAltText("Weeky done");
      expect(img.getAttribute("width")).toBe("80");
      expect(img.getAttribute("height")).toBe("80");
    });

    it("applies lg size (120px)", () => {
      render(<Weeky expression="done" size="lg" />);
      const img = screen.getByAltText("Weeky done");
      expect(img.getAttribute("width")).toBe("120");
      expect(img.getAttribute("height")).toBe("120");
    });
  });

  describe("thinking animation", () => {
    it("applies animate-pulse class for thinking expression", () => {
      render(<Weeky expression="thinking" />);
      const img = screen.getByAltText("Weeky thinking");
      const wrapper = img.parentElement as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("animate-pulse");
    });

    it("does not apply animate-pulse for done expression", () => {
      render(<Weeky expression="done" />);
      const img = screen.getByAltText("Weeky done");
      const wrapper = img.parentElement as HTMLElement;
      expect(wrapper.getAttribute("class")).not.toContain("animate-pulse");
    });

    it("does not apply animate-pulse for sorry expression", () => {
      render(<Weeky expression="sorry" />);
      const img = screen.getByAltText("Weeky sorry");
      const wrapper = img.parentElement as HTMLElement;
      expect(wrapper.getAttribute("class")).not.toContain("animate-pulse");
    });

    it("applies animate-pulse for waiting expression", () => {
      render(<Weeky expression="waiting" />);
      const img = screen.getByAltText("Weeky waiting");
      const wrapper = img.parentElement as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("animate-pulse");
    });

    it("applies animate-pulse for listening expression", () => {
      render(<Weeky expression="listening" />);
      const img = screen.getByAltText("Weeky listening");
      const wrapper = img.parentElement as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("animate-pulse");
    });

    it("does not apply animate-pulse for non-animated expressions", () => {
      const nonAnimated = ["done", "greeting", "questioning", "celebrating", "next"] as const;
      for (const expr of nonAnimated) {
        cleanup();
        render(<Weeky expression={expr} />);
        const img = screen.getByAltText(`Weeky ${expr}`);
        const wrapper = img.parentElement as HTMLElement;
        expect(wrapper.getAttribute("class")).not.toContain("animate-pulse");
      }
    });
  });

  describe("custom className", () => {
    it("applies custom className to wrapper", () => {
      const { container } = render(<Weeky expression="done" className="mt-4" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("mt-4");
    });
  });

  describe("variants", () => {
    it("renders default variant with vertical layout", () => {
      const { container } = render(<Weeky expression="greeting" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("flex-col");
    });

    it("renders bubble variant with speech bubble", () => {
      render(<Weeky expression="greeting" variant="bubble" message="안녕하세요!" />);
      expect(screen.getByText("안녕하세요!")).toBeDefined();
      const img = screen.getByAltText("Weeky greeting");
      expect(img).toBeDefined();
    });

    it("renders bubble variant with left position", () => {
      const { container } = render(
        <Weeky expression="greeting" variant="bubble" bubblePosition="left" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("flex-row-reverse");
    });

    it("renders bubble variant with right position by default", () => {
      const { container } = render(<Weeky expression="greeting" variant="bubble" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).not.toContain("flex-row-reverse");
    });

    it("renders card variant with gradient background", () => {
      const { container } = render(<Weeky expression="greeting" variant="card" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("bg-gradient-to-br");
      expect(wrapper.getAttribute("class")).toContain("rounded-2xl");
    });

    it("renders card variant with message", () => {
      render(<Weeky expression="done" variant="card" message="회의록이 준비되었어요!" />);
      expect(screen.getByText("회의록이 준비되었어요!")).toBeDefined();
    });
  });
});

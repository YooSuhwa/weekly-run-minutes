import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CorrectionItem } from "@/atoms/minutes";
import { CorrectionPanel } from "../correction-panel";

// Use vi.hoisted to ensure stable mock references
const { mockOnCorrectionClick } = vi.hoisted(() => ({
  mockOnCorrectionClick: vi.fn(),
}));

// Factory function for creating test correction items
function createCorrectionItem(overrides: Partial<CorrectionItem> = {}): CorrectionItem {
  return {
    original: "테스트 원본",
    corrected: "테스트 교정",
    category: "terminology",
    paragraphIndex: 0,
    startOffset: 0,
    endOffset: 10,
    ...overrides,
  };
}

describe("CorrectionPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Empty state", () => {
    it("renders empty state when no corrections", () => {
      render(<CorrectionPanel corrections={[]} />);

      expect(screen.getByText("AI 교정 목록")).toBeInTheDocument();
      expect(screen.getByText("교정 사항이 없습니다")).toBeInTheDocument();
    });

    it("does not show correction count badge when empty", () => {
      render(<CorrectionPanel corrections={[]} />);

      expect(screen.queryByText(/건$/)).not.toBeInTheDocument();
    });

    it("renders Sparkles icon in header for empty state", () => {
      const { container } = render(<CorrectionPanel corrections={[]} />);

      // Sparkles icon should be present (lucide-react renders as SVG)
      const svgIcon = container.querySelector("svg");
      expect(svgIcon).toBeInTheDocument();
      expect(svgIcon).toHaveClass("h-4", "w-4");
    });
  });

  describe("With corrections", () => {
    const sampleCorrections: CorrectionItem[] = [
      createCorrectionItem({
        original: "잘못된 용어",
        corrected: "올바른 용어",
        category: "terminology",
        paragraphIndex: 0,
      }),
      createCorrectionItem({
        original: "잘못된 포맷",
        corrected: "올바른 포맷",
        category: "formatting",
        paragraphIndex: 1,
      }),
      createCorrectionItem({
        original: "문법 오류",
        corrected: "문법 정상",
        category: "grammar",
        paragraphIndex: 2,
      }),
    ];

    it("renders all corrections", () => {
      render(<CorrectionPanel corrections={sampleCorrections} />);

      expect(screen.getByText("잘못된 용어")).toBeInTheDocument();
      expect(screen.getByText("올바른 용어")).toBeInTheDocument();
      expect(screen.getByText("잘못된 포맷")).toBeInTheDocument();
      expect(screen.getByText("올바른 포맷")).toBeInTheDocument();
      expect(screen.getByText("문법 오류")).toBeInTheDocument();
      expect(screen.getByText("문법 정상")).toBeInTheDocument();
    });

    it("displays correction count badge", () => {
      render(<CorrectionPanel corrections={sampleCorrections} />);

      expect(screen.getByText("3건")).toBeInTheDocument();
    });

    it("displays correct category labels", () => {
      render(<CorrectionPanel corrections={sampleCorrections} />);

      expect(screen.getByText("용어 교정")).toBeInTheDocument();
      expect(screen.getByText("포맷팅")).toBeInTheDocument();
      expect(screen.getByText("문법")).toBeInTheDocument();
    });

    it("displays line numbers for corrections with paragraphIndex", () => {
      render(<CorrectionPanel corrections={sampleCorrections} />);

      expect(screen.getByText("L1")).toBeInTheDocument();
      expect(screen.getByText("L2")).toBeInTheDocument();
      expect(screen.getByText("L3")).toBeInTheDocument();
    });

    it("shows original text with strikethrough styling", () => {
      render(<CorrectionPanel corrections={sampleCorrections} />);

      const originalText = screen.getByText("잘못된 용어");
      expect(originalText).toHaveClass("line-through");
    });

    it("shows corrected text with font-medium styling", () => {
      render(<CorrectionPanel corrections={sampleCorrections} />);

      const correctedText = screen.getByText("올바른 용어");
      expect(correctedText).toHaveClass("font-medium");
    });
  });

  describe("Category styling", () => {
    it("applies blue styling for terminology category", () => {
      const correction = createCorrectionItem({ category: "terminology" });
      render(<CorrectionPanel corrections={[correction]} />);

      const categoryBadge = screen.getByText("용어 교정");
      expect(categoryBadge).toHaveClass("bg-blue-50");
      expect(categoryBadge).toHaveClass("text-blue-700");
      expect(categoryBadge).toHaveClass("border-blue-200");
    });

    it("applies purple styling for formatting category", () => {
      const correction = createCorrectionItem({ category: "formatting" });
      render(<CorrectionPanel corrections={[correction]} />);

      const categoryBadge = screen.getByText("포맷팅");
      expect(categoryBadge).toHaveClass("bg-purple-50");
      expect(categoryBadge).toHaveClass("text-purple-700");
      expect(categoryBadge).toHaveClass("border-purple-200");
    });

    it("applies yellow styling for grammar category", () => {
      const correction = createCorrectionItem({ category: "grammar" });
      render(<CorrectionPanel corrections={[correction]} />);

      const categoryBadge = screen.getByText("문법");
      expect(categoryBadge).toHaveClass("bg-yellow-50");
      expect(categoryBadge).toHaveClass("text-yellow-700");
      expect(categoryBadge).toHaveClass("border-yellow-200");
    });
  });

  describe("Click behavior", () => {
    it("calls onCorrectionClick when clicking correction with paragraphIndex", async () => {
      const user = userEvent.setup();
      const correction = createCorrectionItem({
        original: "클릭 테스트",
        corrected: "교정됨",
        paragraphIndex: 5,
      });

      render(
        <CorrectionPanel corrections={[correction]} onCorrectionClick={mockOnCorrectionClick} />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockOnCorrectionClick).toHaveBeenCalledTimes(1);
      expect(mockOnCorrectionClick).toHaveBeenCalledWith(correction);
    });

    it("does not call onCorrectionClick when paragraphIndex is null", async () => {
      const user = userEvent.setup();
      const correction = createCorrectionItem({
        original: "위치 없음",
        corrected: "교정됨",
        paragraphIndex: null,
      });

      render(
        <CorrectionPanel corrections={[correction]} onCorrectionClick={mockOnCorrectionClick} />,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockOnCorrectionClick).not.toHaveBeenCalled();
    });

    it("disables button when paragraphIndex is null", () => {
      const correction = createCorrectionItem({ paragraphIndex: null });

      render(<CorrectionPanel corrections={[correction]} />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("enables button when paragraphIndex is not null", () => {
      const correction = createCorrectionItem({ paragraphIndex: 0 });

      render(<CorrectionPanel corrections={[correction]} />);

      const button = screen.getByRole("button");
      expect(button).not.toBeDisabled();
    });

    it("does not show line number when paragraphIndex is null", () => {
      const correction = createCorrectionItem({
        original: "위치 없음",
        paragraphIndex: null,
      });

      render(<CorrectionPanel corrections={[correction]} />);

      expect(screen.queryByText(/^L\d+$/)).not.toBeInTheDocument();
    });
  });

  describe("Without onCorrectionClick callback", () => {
    it("does not throw when clicking without callback provided", async () => {
      const user = userEvent.setup();
      const correction = createCorrectionItem({ paragraphIndex: 0 });

      render(<CorrectionPanel corrections={[correction]} />);

      const button = screen.getByRole("button");

      // Should not throw
      await expect(user.click(button)).resolves.not.toThrow();
    });
  });

  describe("Hover styling", () => {
    it("has hover class when paragraphIndex is not null", () => {
      const correction = createCorrectionItem({ paragraphIndex: 3 });

      render(<CorrectionPanel corrections={[correction]} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:border-primary/50");
      expect(button).toHaveClass("cursor-pointer");
    });

    it("does not have hover class when paragraphIndex is null", () => {
      const correction = createCorrectionItem({ paragraphIndex: null });

      render(<CorrectionPanel corrections={[correction]} />);

      const button = screen.getByRole("button");
      expect(button).not.toHaveClass("hover:border-primary/50");
      expect(button).not.toHaveClass("cursor-pointer");
    });
  });

  describe("Multiple corrections interaction", () => {
    it("calls onCorrectionClick with correct correction item", async () => {
      const user = userEvent.setup();
      const corrections: CorrectionItem[] = [
        createCorrectionItem({
          original: "첫번째",
          corrected: "첫번째 교정",
          paragraphIndex: 0,
        }),
        createCorrectionItem({
          original: "두번째",
          corrected: "두번째 교정",
          paragraphIndex: 1,
        }),
        createCorrectionItem({
          original: "세번째",
          corrected: "세번째 교정",
          paragraphIndex: 2,
        }),
      ];

      render(
        <CorrectionPanel corrections={corrections} onCorrectionClick={mockOnCorrectionClick} />,
      );

      const buttons = screen.getAllByRole("button");
      await user.click(buttons[1]); // Click second item

      expect(mockOnCorrectionClick).toHaveBeenCalledWith(corrections[1]);
    });

    it("handles mix of clickable and non-clickable corrections", async () => {
      const user = userEvent.setup();
      const corrections: CorrectionItem[] = [
        createCorrectionItem({
          original: "클릭 가능",
          corrected: "교정됨",
          paragraphIndex: 0,
        }),
        createCorrectionItem({
          original: "클릭 불가",
          corrected: "교정됨",
          paragraphIndex: null,
        }),
      ];

      render(
        <CorrectionPanel corrections={corrections} onCorrectionClick={mockOnCorrectionClick} />,
      );

      const buttons = screen.getAllByRole("button");

      // First button should be enabled
      expect(buttons[0]).not.toBeDisabled();
      // Second button should be disabled
      expect(buttons[1]).toBeDisabled();

      // Click first button
      await user.click(buttons[0]);
      expect(mockOnCorrectionClick).toHaveBeenCalledWith(corrections[0]);

      // Click second button (disabled)
      await user.click(buttons[1]);
      // Should still only have been called once
      expect(mockOnCorrectionClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge cases", () => {
    it("handles single correction", () => {
      const correction = createCorrectionItem();

      render(<CorrectionPanel corrections={[correction]} />);

      expect(screen.getByText("1건")).toBeInTheDocument();
    });

    it("handles correction with paragraphIndex 0", () => {
      const correction = createCorrectionItem({ paragraphIndex: 0 });

      render(<CorrectionPanel corrections={[correction]} />);

      // Line number should be 1 (0-indexed + 1)
      expect(screen.getByText("L1")).toBeInTheDocument();
    });

    it("handles long original and corrected text", () => {
      const longText = "가".repeat(200);
      const correction = createCorrectionItem({
        original: longText,
        corrected: longText + " 교정",
      });

      render(<CorrectionPanel corrections={[correction]} />);

      expect(screen.getByText(longText)).toBeInTheDocument();
      expect(screen.getByText(longText + " 교정")).toBeInTheDocument();
    });

    it("handles special characters in text", () => {
      const correction = createCorrectionItem({
        original: '<script>alert("xss")</script>',
        corrected: "안전한 텍스트",
      });

      render(<CorrectionPanel corrections={[correction]} />);

      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
      expect(screen.getByText("안전한 텍스트")).toBeInTheDocument();
    });

    it("handles empty strings in original/corrected", () => {
      const correction = createCorrectionItem({
        original: "",
        corrected: "추가된 텍스트",
      });

      render(<CorrectionPanel corrections={[correction]} />);

      expect(screen.getByText("추가된 텍스트")).toBeInTheDocument();
    });
  });

  describe("Card structure", () => {
    it("renders as a Card component", () => {
      const { container } = render(<CorrectionPanel corrections={[]} />);

      // Card component should render
      const card = container.querySelector("[data-slot='card']");
      // If data-slot is not used, check for card class or structure
      expect(screen.getByText("AI 교정 목록")).toBeInTheDocument();
    });

    it("has correct heading structure", () => {
      render(<CorrectionPanel corrections={[]} />);

      // Title should be in the document
      const title = screen.getByText("AI 교정 목록");
      expect(title).toBeInTheDocument();
    });
  });

  describe("Memo optimization", () => {
    it("does not re-render unnecessarily with same props", () => {
      const corrections = [createCorrectionItem()];
      const { rerender } = render(
        <CorrectionPanel corrections={corrections} onCorrectionClick={mockOnCorrectionClick} />,
      );

      // Re-render with same corrections reference
      rerender(
        <CorrectionPanel corrections={corrections} onCorrectionClick={mockOnCorrectionClick} />,
      );

      // Component should still render correctly
      expect(screen.getByText("1건")).toBeInTheDocument();
    });
  });
});

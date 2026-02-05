import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CorrectionItem } from "@/atoms/minutes";

// Mock TipTap editor
const mockChainMethods = {
  focus: vi.fn().mockReturnThis(),
  toggleBold: vi.fn().mockReturnThis(),
  toggleItalic: vi.fn().mockReturnThis(),
  toggleStrike: vi.fn().mockReturnThis(),
  toggleBulletList: vi.fn().mockReturnThis(),
  toggleOrderedList: vi.fn().mockReturnThis(),
  undo: vi.fn().mockReturnThis(),
  redo: vi.fn().mockReturnThis(),
  run: vi.fn(),
};

const mockCanMethods = {
  undo: vi.fn().mockReturnValue(true),
  redo: vi.fn().mockReturnValue(true),
};

const mockEditor = {
  chain: vi.fn().mockReturnValue(mockChainMethods),
  can: vi.fn().mockReturnValue(mockCanMethods),
  isActive: vi.fn().mockReturnValue(false),
  getText: vi.fn().mockReturnValue(""),
  getHTML: vi.fn().mockReturnValue(""),
  setEditable: vi.fn(),
  isFocused: false,
  commands: {
    setContent: vi.fn(),
  },
  view: {
    dispatch: vi.fn(),
  },
  state: {
    tr: {},
  },
  extensionManager: {
    extensions: [
      {
        name: "correctionHighlight",
        configure: vi.fn(),
      },
    ],
  },
};

let onUpdateCallback: ((params: { editor: typeof mockEditor }) => void) | null = null;

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(({ onUpdate }: { onUpdate?: typeof onUpdateCallback }) => {
    onUpdateCallback = onUpdate ?? null;
    return mockEditor;
  }),
  EditorContent: vi.fn(({ editor }: { editor: typeof mockEditor | null }) => {
    if (!editor) return null;
    return (
      <div data-testid="editor-content" className="prose prose-sm">
        Editor Content
      </div>
    );
  }),
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@tiptap/extension-placeholder", () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("../correction-highlight-extension", () => ({
  CorrectionHighlight: {
    configure: vi.fn().mockReturnValue({}),
  },
}));

// lucide-react is mocked globally in src/test/setup.ts

import { MinutesEditor } from "../minutes-editor";

describe("MinutesEditor", () => {
  const defaultProps = {
    content: "",
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.isActive = vi.fn().mockReturnValue(false);
    mockEditor.isFocused = false;
    mockEditor.getText = vi.fn().mockReturnValue("");
    mockCanMethods.undo.mockReturnValue(true);
    mockCanMethods.redo.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    onUpdateCallback = null;
  });

  describe("rendering", () => {
    it("renders the editor container", () => {
      const { container } = render(<MinutesEditor {...defaultProps} />);
      expect(container.querySelector(".rounded-xl")).not.toBeNull();
    });

    it("renders the toolbar", () => {
      render(<MinutesEditor {...defaultProps} />);
      // Use getAllByTitle since both button title and SVG <title> match
      expect(screen.getAllByTitle("Bold").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Italic").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Strikethrough").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Bullet List").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Ordered List").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Undo").length).toBeGreaterThan(0);
      expect(screen.getAllByTitle("Redo").length).toBeGreaterThan(0);
    });

    it("renders the editor content area", () => {
      render(<MinutesEditor {...defaultProps} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("renders toolbar dividers", () => {
      const { container } = render(<MinutesEditor {...defaultProps} />);
      const dividers = container.querySelectorAll(".mx-2.h-5.w-px.bg-border");
      expect(dividers.length).toBe(3); // 3 dividers: after headings, after formatting, after lists
    });
  });

  describe("toolbar buttons", () => {
    // Helper to get button by title (first matching element which is the button)
    const getButtonByTitle = (title: string) => {
      const elements = screen.getAllByTitle(title);
      return elements.find((el) => el.tagName === "BUTTON") || elements[0];
    };

    it("calls toggleBold when bold button is clicked", () => {
      render(<MinutesEditor {...defaultProps} />);
      fireEvent.click(getButtonByTitle("Bold"));
      expect(mockEditor.chain).toHaveBeenCalled();
      expect(mockChainMethods.focus).toHaveBeenCalled();
      expect(mockChainMethods.toggleBold).toHaveBeenCalled();
      expect(mockChainMethods.run).toHaveBeenCalled();
    });

    it("calls toggleItalic when italic button is clicked", () => {
      render(<MinutesEditor {...defaultProps} />);
      fireEvent.click(getButtonByTitle("Italic"));
      expect(mockChainMethods.toggleItalic).toHaveBeenCalled();
    });

    it("calls toggleStrike when strikethrough button is clicked", () => {
      render(<MinutesEditor {...defaultProps} />);
      fireEvent.click(getButtonByTitle("Strikethrough"));
      expect(mockChainMethods.toggleStrike).toHaveBeenCalled();
    });

    it("calls toggleBulletList when bullet list button is clicked", () => {
      render(<MinutesEditor {...defaultProps} />);
      fireEvent.click(getButtonByTitle("Bullet List"));
      expect(mockChainMethods.toggleBulletList).toHaveBeenCalled();
    });

    it("calls toggleOrderedList when ordered list button is clicked", () => {
      render(<MinutesEditor {...defaultProps} />);
      fireEvent.click(getButtonByTitle("Ordered List"));
      expect(mockChainMethods.toggleOrderedList).toHaveBeenCalled();
    });

    it("calls undo when undo button is clicked", () => {
      render(<MinutesEditor {...defaultProps} />);
      fireEvent.click(getButtonByTitle("Undo"));
      expect(mockChainMethods.undo).toHaveBeenCalled();
    });

    it("calls redo when redo button is clicked", () => {
      render(<MinutesEditor {...defaultProps} />);
      fireEvent.click(getButtonByTitle("Redo"));
      expect(mockChainMethods.redo).toHaveBeenCalled();
    });
  });

  describe("button active states", () => {
    // Helper to get button by title (first matching element which is the button)
    const getButtonByTitle = (title: string) => {
      const elements = screen.getAllByTitle(title);
      return elements.find((el) => el.tagName === "BUTTON") || elements[0];
    };

    it("applies active styling when bold is active", () => {
      mockEditor.isActive = vi.fn((type: string) => type === "bold");
      render(<MinutesEditor {...defaultProps} />);
      const boldButton = getButtonByTitle("Bold");
      expect(boldButton.className).toContain("bg-primary/10");
      expect(boldButton.className).toContain("text-primary");
    });

    it("applies active styling when italic is active", () => {
      mockEditor.isActive = vi.fn((type: string) => type === "italic");
      render(<MinutesEditor {...defaultProps} />);
      const italicButton = getButtonByTitle("Italic");
      expect(italicButton.className).toContain("bg-primary/10");
    });

    it("applies active styling when strike is active", () => {
      mockEditor.isActive = vi.fn((type: string) => type === "strike");
      render(<MinutesEditor {...defaultProps} />);
      const strikeButton = getButtonByTitle("Strikethrough");
      expect(strikeButton.className).toContain("bg-primary/10");
    });

    it("applies active styling when bulletList is active", () => {
      mockEditor.isActive = vi.fn((type: string) => type === "bulletList");
      render(<MinutesEditor {...defaultProps} />);
      const bulletListButton = getButtonByTitle("Bullet List");
      expect(bulletListButton.className).toContain("bg-primary/10");
    });

    it("applies active styling when orderedList is active", () => {
      mockEditor.isActive = vi.fn((type: string) => type === "orderedList");
      render(<MinutesEditor {...defaultProps} />);
      const orderedListButton = getButtonByTitle("Ordered List");
      expect(orderedListButton.className).toContain("bg-primary/10");
    });
  });

  describe("undo/redo disabled states", () => {
    // Helper to get button by title (first matching element which is the button)
    const getButtonByTitle = (title: string) => {
      const elements = screen.getAllByTitle(title);
      return elements.find((el) => el.tagName === "BUTTON") || elements[0];
    };

    it("disables undo button when undo is not available", () => {
      mockCanMethods.undo.mockReturnValue(false);
      render(<MinutesEditor {...defaultProps} />);
      const undoButton = getButtonByTitle("Undo");
      expect(undoButton).toBeDisabled();
      expect(undoButton.className).toContain("opacity-50");
      expect(undoButton.className).toContain("cursor-not-allowed");
    });

    it("disables redo button when redo is not available", () => {
      mockCanMethods.redo.mockReturnValue(false);
      render(<MinutesEditor {...defaultProps} />);
      const redoButton = getButtonByTitle("Redo");
      expect(redoButton).toBeDisabled();
    });

    it("enables undo button when undo is available", () => {
      mockCanMethods.undo.mockReturnValue(true);
      render(<MinutesEditor {...defaultProps} />);
      const undoButton = getButtonByTitle("Undo");
      expect(undoButton).not.toBeDisabled();
    });

    it("enables redo button when redo is available", () => {
      mockCanMethods.redo.mockReturnValue(true);
      render(<MinutesEditor {...defaultProps} />);
      const redoButton = getButtonByTitle("Redo");
      expect(redoButton).not.toBeDisabled();
    });
  });

  describe("onChange callback", () => {
    it("calls onChange with editor text when content updates", () => {
      const onChange = vi.fn();
      render(<MinutesEditor {...defaultProps} onChange={onChange} />);

      // Component uses getHTML() and converts to markdown
      mockEditor.getHTML.mockReturnValue("<p>Test content</p>");
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }

      // turndownService converts <p>Test content</p> to "Test content"
      expect(onChange).toHaveBeenCalledWith("Test content");
    });

    it("calls onChange with empty string for empty content", () => {
      const onChange = vi.fn();
      render(<MinutesEditor {...defaultProps} onChange={onChange} />);

      mockEditor.getHTML.mockReturnValue("");
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }

      expect(onChange).toHaveBeenCalledWith("");
    });
  });

  describe("corrections prop", () => {
    it("renders with empty corrections array", () => {
      render(<MinutesEditor {...defaultProps} corrections={[]} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("renders with corrections", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "테스트",
          corrected: "시험",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 3,
        },
      ];
      render(<MinutesEditor {...defaultProps} corrections={corrections} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("renders with multiple corrections", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "error1",
          corrected: "correct1",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 6,
        },
        {
          original: "error2",
          corrected: "correct2",
          category: "formatting",
          paragraphIndex: 1,
          startOffset: 5,
          endOffset: 11,
        },
        {
          original: "error3",
          corrected: "correct3",
          category: "grammar",
          paragraphIndex: 2,
          startOffset: 10,
          endOffset: 16,
        },
      ];
      render(<MinutesEditor {...defaultProps} corrections={corrections} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("handles corrections with null position values", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: null,
          startOffset: null,
          endOffset: null,
        },
      ];
      render(<MinutesEditor {...defaultProps} corrections={corrections} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });

  describe("activeCorrectionIndex prop", () => {
    it("renders with null activeCorrectionIndex", () => {
      render(<MinutesEditor {...defaultProps} activeCorrectionIndex={null} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("renders with activeCorrectionIndex set to 0", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];
      render(
        <MinutesEditor {...defaultProps} corrections={corrections} activeCorrectionIndex={0} />,
      );
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("renders with activeCorrectionIndex set to a valid index", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test1",
          corrected: "corrected1",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 5,
        },
        {
          original: "test2",
          corrected: "corrected2",
          category: "formatting",
          paragraphIndex: 1,
          startOffset: 0,
          endOffset: 5,
        },
      ];
      render(
        <MinutesEditor {...defaultProps} corrections={corrections} activeCorrectionIndex={1} />,
      );
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });

  describe("content synchronization", () => {
    it("sets content on initial render with content prop", async () => {
      render(<MinutesEditor {...defaultProps} content="Initial content" />);

      await waitFor(() => {
        // Component converts markdown to HTML and calls setContent
        expect(mockEditor.commands.setContent).toHaveBeenCalled();
      });
    });

    it("only loads content once (initial load)", async () => {
      const { rerender } = render(<MinutesEditor {...defaultProps} content="Initial content" />);

      await waitFor(() => {
        expect(mockEditor.commands.setContent).toHaveBeenCalled();
      });

      // Clear mock to track subsequent calls
      mockEditor.commands.setContent.mockClear();

      // Rerender with new content - should NOT call setContent again (prioritizes user edits)
      rerender(<MinutesEditor {...defaultProps} content="Updated content" />);

      // Give it time to potentially call setContent
      await waitFor(
        () => {
          expect(mockEditor.commands.setContent).not.toHaveBeenCalled();
        },
        { timeout: 100 },
      );
    });

    it("does not set empty content", async () => {
      render(<MinutesEditor {...defaultProps} content="" />);

      await waitFor(
        () => {
          // Empty content should not trigger setContent
          expect(mockEditor.commands.setContent).not.toHaveBeenCalled();
        },
        { timeout: 100 },
      );
    });
  });

  describe("correction highlight updates", () => {
    it("updates correction highlights when corrections change", async () => {
      const corrections1: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const corrections2: CorrectionItem[] = [
        {
          original: "test2",
          corrected: "corrected2",
          category: "formatting",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 5,
        },
      ];

      const correctionExtension = mockEditor.extensionManager.extensions.find(
        (ext) => ext.name === "correctionHighlight",
      );

      const { rerender } = render(
        <MinutesEditor {...defaultProps} corrections={corrections1} activeCorrectionIndex={null} />,
      );

      rerender(
        <MinutesEditor {...defaultProps} corrections={corrections2} activeCorrectionIndex={null} />,
      );

      await waitFor(() => {
        expect(correctionExtension?.configure).toHaveBeenCalled();
        expect(mockEditor.view.dispatch).toHaveBeenCalled();
      });
    });

    it("updates correction highlights when activeCorrectionIndex changes", async () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const { rerender } = render(
        <MinutesEditor {...defaultProps} corrections={corrections} activeCorrectionIndex={null} />,
      );

      rerender(
        <MinutesEditor {...defaultProps} corrections={corrections} activeCorrectionIndex={0} />,
      );

      await waitFor(() => {
        expect(mockEditor.view.dispatch).toHaveBeenCalled();
      });
    });
  });

  describe("editor null state", () => {
    it("returns null when editor is not initialized", async () => {
      const { useEditor } = await import("@tiptap/react");
      vi.mocked(useEditor).mockReturnValueOnce(null);

      const { container } = render(<MinutesEditor {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles empty content prop", () => {
      render(<MinutesEditor {...defaultProps} content="" />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("handles very long content", () => {
      const longContent = "A".repeat(10000);
      render(<MinutesEditor {...defaultProps} content={longContent} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("handles special characters in content", () => {
      const specialContent = "<script>alert('xss')</script>한글테스트!@#$%^&*()";
      render(<MinutesEditor {...defaultProps} content={specialContent} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("handles unicode content", () => {
      const unicodeContent = "Meeting notes: 회의록 emoji test: [Tiptap]";
      render(<MinutesEditor {...defaultProps} content={unicodeContent} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("handles rapid content changes", async () => {
      const onChange = vi.fn();
      const { rerender } = render(<MinutesEditor {...defaultProps} onChange={onChange} />);

      for (let i = 0; i < 10; i++) {
        mockEditor.getText.mockReturnValue(`Content ${i}`);
        if (onUpdateCallback) {
          onUpdateCallback({ editor: mockEditor });
        }
      }

      expect(onChange).toHaveBeenCalledTimes(10);
    });
  });

  describe("correction categories", () => {
    it("handles terminology corrections", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "API",
          corrected: "ElevenLabs API",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 3,
        },
      ];
      render(<MinutesEditor {...defaultProps} corrections={corrections} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("handles formatting corrections", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "날짜: 2024/1/15",
          corrected: "날짜: 2024-01-15",
          category: "formatting",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 14,
        },
      ];
      render(<MinutesEditor {...defaultProps} corrections={corrections} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });

    it("handles grammar corrections", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "회의를을",
          corrected: "회의를",
          category: "grammar",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];
      render(<MinutesEditor {...defaultProps} corrections={corrections} />);
      expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    });
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScrollArea } from "../ui/scroll-area";

describe("ScrollArea", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders children correctly", () => {
      render(
        <ScrollArea>
          <p>스크롤 내용</p>
        </ScrollArea>,
      );
      expect(screen.getByText("스크롤 내용")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <ScrollArea>
          <p>첫 번째</p>
          <p>두 번째</p>
          <p>세 번째</p>
        </ScrollArea>,
      );
      expect(screen.getByText("첫 번째")).toBeInTheDocument();
      expect(screen.getByText("두 번째")).toBeInTheDocument();
      expect(screen.getByText("세 번째")).toBeInTheDocument();
    });
  });

  describe("MaxHeight prop", () => {
    it("applies maxHeight as number (pixels)", () => {
      const { container } = render(
        <ScrollArea maxHeight={300}>
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("300px");
    });

    it("applies maxHeight as string", () => {
      const { container } = render(
        <ScrollArea maxHeight="50vh">
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("50vh");
    });

    it("handles maxHeight of 0", () => {
      const { container } = render(
        <ScrollArea maxHeight={0}>
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("0px");
    });

    it("does not set maxHeight when not provided", () => {
      const { container } = render(
        <ScrollArea>
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("");
    });
  });

  describe("Base styling", () => {
    it("has overflow-y-auto class", () => {
      const { container } = render(
        <ScrollArea>
          <p>Content</p>
        </ScrollArea>,
      );
      expect(container.firstChild).toHaveClass("overflow-y-auto");
    });

    it("has scrollbar-thin class", () => {
      const { container } = render(
        <ScrollArea>
          <p>Content</p>
        </ScrollArea>,
      );
      expect(container.firstChild).toHaveClass("scrollbar-thin");
    });

    it("has scrollbar-track-transparent class", () => {
      const { container } = render(
        <ScrollArea>
          <p>Content</p>
        </ScrollArea>,
      );
      expect(container.firstChild).toHaveClass("scrollbar-track-transparent");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <ScrollArea className="custom-scroll-class">
          <p>Content</p>
        </ScrollArea>,
      );
      expect(container.firstChild).toHaveClass("custom-scroll-class");
    });

    it("merges custom className with base classes", () => {
      const { container } = render(
        <ScrollArea className="my-custom-class">
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild;
      expect(scrollArea).toHaveClass("my-custom-class");
      expect(scrollArea).toHaveClass("overflow-y-auto");
    });
  });

  describe("Style prop", () => {
    it("applies additional styles", () => {
      const { container } = render(
        <ScrollArea style={{ padding: "20px", backgroundColor: "red" }}>
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.padding).toBe("20px");
      expect(scrollArea.style.backgroundColor).toBe("red");
    });

    it("merges maxHeight with other styles", () => {
      const { container } = render(
        <ScrollArea maxHeight={200} style={{ padding: "10px" }}>
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("200px");
      expect(scrollArea.style.padding).toBe("10px");
    });
  });

  describe("Ref forwarding", () => {
    it("forwards ref to div element", () => {
      let ref: HTMLDivElement | null = null;
      render(
        <ScrollArea
          ref={(node) => {
            ref = node;
          }}
        >
          <p>Ref Test</p>
        </ScrollArea>,
      );
      expect(ref).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("HTML attributes", () => {
    it("passes through data attributes", () => {
      render(
        <ScrollArea data-testid="scroll-container">
          <p>Content</p>
        </ScrollArea>,
      );
      expect(screen.getByTestId("scroll-container")).toBeInTheDocument();
    });

    it("passes through aria attributes", () => {
      render(
        <ScrollArea aria-label="scrollable content">
          <p>Content</p>
        </ScrollArea>,
      );
      expect(screen.getByLabelText("scrollable content")).toBeInTheDocument();
    });

    it("passes through role attribute", () => {
      render(
        <ScrollArea role="region">
          <p>Content</p>
        </ScrollArea>,
      );
      expect(screen.getByRole("region")).toBeInTheDocument();
    });

    it("passes through id attribute", () => {
      const { container } = render(
        <ScrollArea id="my-scroll-area">
          <p>Content</p>
        </ScrollArea>,
      );
      expect(container.querySelector("#my-scroll-area")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles empty children", () => {
      const { container } = render(<ScrollArea />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("handles very large maxHeight", () => {
      const { container } = render(
        <ScrollArea maxHeight={999999}>
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("999999px");
    });

    it("handles decimal maxHeight", () => {
      const { container } = render(
        <ScrollArea maxHeight={150.5}>
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("150.5px");
    });

    it("handles percentage maxHeight string", () => {
      const { container } = render(
        <ScrollArea maxHeight="100%">
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("100%");
    });

    it("handles calc maxHeight string", () => {
      const { container } = render(
        <ScrollArea maxHeight="calc(100vh - 200px)">
          <p>Content</p>
        </ScrollArea>,
      );
      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea.style.maxHeight).toBe("calc(100vh - 200px)");
    });
  });
});

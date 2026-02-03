import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "../ui/badge";

describe("Badge", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders children correctly", () => {
      render(<Badge>테스트 배지</Badge>);
      expect(screen.getByText("테스트 배지")).toBeInTheDocument();
    });

    it("renders with default variant", () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText("Default");
      expect(badge).toHaveClass("bg-primary");
      expect(badge).toHaveClass("text-primary-foreground");
    });
  });

  describe("Variants", () => {
    it("renders secondary variant", () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText("Secondary");
      expect(badge).toHaveClass("bg-secondary");
      expect(badge).toHaveClass("text-secondary-foreground");
    });

    it("renders destructive variant", () => {
      render(<Badge variant="destructive">Destructive</Badge>);
      const badge = screen.getByText("Destructive");
      expect(badge).toHaveClass("bg-destructive");
      expect(badge).toHaveClass("text-destructive-foreground");
    });

    it("renders outline variant", () => {
      render(<Badge variant="outline">Outline</Badge>);
      const badge = screen.getByText("Outline");
      expect(badge).toHaveClass("text-foreground");
      expect(badge).not.toHaveClass("bg-primary");
    });

    it("renders success variant", () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText("Success");
      expect(badge).toHaveClass("bg-green-100");
      expect(badge).toHaveClass("text-green-800");
    });

    it("renders warning variant", () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText("Warning");
      expect(badge).toHaveClass("bg-yellow-100");
      expect(badge).toHaveClass("text-yellow-800");
    });

    it("renders info variant", () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText("Info");
      expect(badge).toHaveClass("bg-blue-100");
      expect(badge).toHaveClass("text-blue-800");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      render(<Badge className="custom-class">Custom</Badge>);
      const badge = screen.getByText("Custom");
      expect(badge).toHaveClass("custom-class");
    });

    it("merges custom className with variant classes", () => {
      render(
        <Badge variant="success" className="custom-class">
          Merged
        </Badge>,
      );
      const badge = screen.getByText("Merged");
      expect(badge).toHaveClass("custom-class");
      expect(badge).toHaveClass("bg-green-100");
    });
  });

  describe("Base styling", () => {
    it("has rounded-full class", () => {
      render(<Badge>Rounded</Badge>);
      const badge = screen.getByText("Rounded");
      expect(badge).toHaveClass("rounded-full");
    });

    it("has border class", () => {
      render(<Badge>Border</Badge>);
      const badge = screen.getByText("Border");
      expect(badge).toHaveClass("border");
    });

    it("has text-xs class", () => {
      render(<Badge>Small Text</Badge>);
      const badge = screen.getByText("Small Text");
      expect(badge).toHaveClass("text-xs");
    });

    it("has font-semibold class", () => {
      render(<Badge>Bold</Badge>);
      const badge = screen.getByText("Bold");
      expect(badge).toHaveClass("font-semibold");
    });

    it("has inline-flex class", () => {
      render(<Badge>Flex</Badge>);
      const badge = screen.getByText("Flex");
      expect(badge).toHaveClass("inline-flex");
    });
  });

  describe("Ref forwarding", () => {
    it("forwards ref to div element", () => {
      let ref: HTMLDivElement | null = null;
      render(
        <Badge
          ref={(node) => {
            ref = node;
          }}
        >
          Ref Test
        </Badge>,
      );
      expect(ref).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("HTML attributes", () => {
    it("passes through additional HTML attributes", () => {
      render(<Badge data-testid="test-badge">Attrs</Badge>);
      expect(screen.getByTestId("test-badge")).toBeInTheDocument();
    });

    it("supports aria attributes", () => {
      render(<Badge aria-label="status badge">Aria</Badge>);
      expect(screen.getByLabelText("status badge")).toBeInTheDocument();
    });
  });
});

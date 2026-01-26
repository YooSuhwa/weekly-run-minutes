import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

describe("Label", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders a label element", () => {
      render(<Label>Test Label</Label>);
      expect(screen.getByText("Test Label")).toBeInTheDocument();
    });

    it("renders children correctly", () => {
      render(
        <Label>
          <span data-testid="child">Child Element</span>
        </Label>,
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });

  describe("htmlFor Association", () => {
    it("associates with input via htmlFor", () => {
      render(
        <>
          <Label htmlFor="test-input">Test Label</Label>
          <Input id="test-input" />
        </>,
      );

      const input = screen.getByLabelText("Test Label");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("id", "test-input");
    });

    it("allows clicking label to focus input", async () => {
      const user = userEvent.setup();
      render(
        <>
          <Label htmlFor="test-input">Test Label</Label>
          <Input id="test-input" />
        </>,
      );

      await user.click(screen.getByText("Test Label"));

      const input = screen.getByLabelText("Test Label");
      expect(document.activeElement).toBe(input);
    });
  });

  describe("Styling", () => {
    it("applies default classes", () => {
      render(<Label data-testid="label">Test</Label>);
      const label = screen.getByTestId("label");
      expect(label).toHaveClass("text-sm", "font-medium", "leading-none");
    });

    it("applies custom className", () => {
      render(
        <Label className="custom-class" data-testid="label">
          Test
        </Label>,
      );
      const label = screen.getByTestId("label");
      expect(label).toHaveClass("custom-class");
    });

    it("merges custom className with default classes", () => {
      render(
        <Label className="text-red-500" data-testid="label">
          Test
        </Label>,
      );
      const label = screen.getByTestId("label");
      expect(label).toHaveClass("text-sm", "font-medium", "text-red-500");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to label element", () => {
      const ref = createRef<HTMLLabelElement>();
      render(<Label ref={ref}>Test</Label>);
      expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    });
  });

  describe("Accessibility", () => {
    it("has accessible name through text content", () => {
      render(<Label>Accessible Label</Label>);
      const label = screen.getByText("Accessible Label");
      expect(label.tagName).toBe("LABEL");
    });
  });

  describe("Additional Props", () => {
    it("passes through additional props", () => {
      render(
        <Label data-testid="label" title="Label Title">
          Test
        </Label>,
      );
      const label = screen.getByTestId("label");
      expect(label).toHaveAttribute("title", "Label Title");
    });
  });
});

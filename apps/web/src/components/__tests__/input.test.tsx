import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "../ui/input";

describe("Input", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders an input element", () => {
      render(<Input />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders with placeholder", () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    });

    it("renders with default value", () => {
      render(<Input defaultValue="Default" />);
      expect(screen.getByDisplayValue("Default")).toBeInTheDocument();
    });

    it("renders with controlled value", () => {
      render(<Input value="Controlled" onChange={() => {}} />);
      expect(screen.getByDisplayValue("Controlled")).toBeInTheDocument();
    });
  });

  describe("Types", () => {
    it("renders text input by default", () => {
      render(<Input />);
      // Input without type attribute defaults to text, but the attribute may not be present
      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });

    it("renders password input", () => {
      render(<Input type="password" />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it("renders email input", () => {
      render(<Input type="email" />);
      expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
    });

    it("renders number input", () => {
      render(<Input type="number" />);
      expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
    });
  });

  describe("User Interaction", () => {
    it("handles text input", async () => {
      const user = userEvent.setup();
      render(<Input />);

      const input = screen.getByRole("textbox");
      await user.type(input, "Hello World");

      expect(input).toHaveValue("Hello World");
    });

    it("calls onChange handler", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "A");

      expect(handleChange).toHaveBeenCalled();
    });

    it("handles focus and blur", async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      render(<Input onFocus={handleFocus} onBlur={handleBlur} />);

      const input = screen.getByRole("textbox");

      await user.click(input);
      expect(handleFocus).toHaveBeenCalled();

      await user.tab();
      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("renders disabled input", () => {
      render(<Input disabled />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("does not accept input when disabled", async () => {
      const user = userEvent.setup();
      render(<Input disabled defaultValue="Initial" />);

      const input = screen.getByRole("textbox");
      await user.type(input, "New");

      expect(input).toHaveValue("Initial");
    });
  });

  describe("Required State", () => {
    it("renders required input", () => {
      render(<Input required />);
      expect(screen.getByRole("textbox")).toBeRequired();
    });
  });

  describe("Styling", () => {
    it("applies default classes", () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId("input");
      expect(input).toHaveClass("flex", "h-10", "w-full", "rounded-md");
    });

    it("applies custom className", () => {
      render(<Input className="custom-class" data-testid="input" />);
      const input = screen.getByTestId("input");
      expect(input).toHaveClass("custom-class");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to input element", () => {
      const ref = createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it("allows programmatic focus via ref", () => {
      const ref = createRef<HTMLInputElement>();
      render(<Input ref={ref} />);

      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe("Accessibility", () => {
    it("supports aria-label", () => {
      render(<Input aria-label="Custom label" />);
      expect(screen.getByLabelText("Custom label")).toBeInTheDocument();
    });

    it("supports aria-describedby", () => {
      render(
        <>
          <Input aria-describedby="description" />
          <p id="description">Helper text</p>
        </>,
      );
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", "description");
    });

    it("supports aria-invalid", () => {
      render(<Input aria-invalid="true" />);
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    });
  });
});

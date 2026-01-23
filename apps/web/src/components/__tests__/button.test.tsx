import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../ui/button";

describe("Button", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("applies default variant classes", () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("class")).toContain("bg-primary");
  });

  it("applies destructive variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("class")).toContain("bg-destructive");
  });

  it("applies outline variant classes", () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole("button");
    const cls = button.getAttribute("class") ?? "";
    expect(cls).toContain("border");
    expect(cls).toContain("bg-background");
  });

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("class")).toContain("bg-secondary");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("class")).toContain("hover:bg-accent");
  });

  it("applies link variant classes", () => {
    render(<Button variant="link">Link</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("class")).toContain("underline-offset-4");
  });

  it("applies sm size classes", () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("class")).toContain("h-8");
  });

  it("applies lg size classes", () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("class")).toContain("h-12");
  });

  it("handles click events", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not trigger click when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Disabled
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("has disabled attribute when disabled", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("class")).toContain("custom-class");
  });
});

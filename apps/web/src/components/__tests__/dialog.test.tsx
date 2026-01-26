import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

describe("Dialog", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  describe("Controlled Mode", () => {
    it("renders dialog when open is true", () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Test Title")).toBeInTheDocument();
    });

    it("does not render dialog when open is false", () => {
      render(
        <Dialog open={false}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("calls onOpenChange when closing", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Uncontrolled Mode", () => {
    it("opens dialog via trigger", async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByText("Open Dialog"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes dialog via close button", async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Open Dialog"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Overlay Behavior", () => {
    it("closes dialog when clicking overlay", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogContent data-testid="dialog-content">
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      // Click on the overlay (outside the dialog content)
      const overlay = document.querySelector(".fixed.inset-0.bg-black\\/50");
      if (overlay) {
        await user.click(overlay);
      }

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Keyboard Navigation", () => {
    it("closes dialog on Escape key", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      await user.keyboard("{Escape}");

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Body Scroll Lock", () => {
    it("prevents body scroll when open", () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when closed", () => {
      const { rerender } = render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Dialog open={false}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("DialogHeader", () => {
    it("renders with proper styling", () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader data-testid="dialog-header">
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      const header = screen.getByTestId("dialog-header");
      expect(header).toHaveClass("flex", "flex-col");
    });
  });

  describe("DialogFooter", () => {
    it("renders with proper styling", () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogFooter data-testid="dialog-footer">
              <button type="button">Cancel</button>
              <button type="button">Submit</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );

      const footer = screen.getByTestId("dialog-footer");
      expect(footer).toHaveClass("flex");
    });
  });

  describe("DialogDescription", () => {
    it("renders description text", () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
              <DialogDescription>This is a description</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByText("This is a description")).toBeInTheDocument();
    });
  });

  describe("DialogTrigger", () => {
    it("renders with asChild prop", async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger asChild>
            <button type="button">Custom Trigger</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText("Custom Trigger"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("Custom ClassName", () => {
    it("applies custom className to DialogContent", () => {
      render(
        <Dialog open={true}>
          <DialogContent className="custom-class" data-testid="dialog-content">
            <DialogHeader>
              <DialogTitle>Test Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      const content = screen.getByTestId("dialog-content");
      expect(content).toHaveClass("custom-class");
    });
  });
});

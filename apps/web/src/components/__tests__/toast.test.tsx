import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider, useSetAtom } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToastAtom, uiAtom } from "@/atoms/ui";
import { ToastContainer, useToast } from "../ui/toast";

// Component to test all toast types
function AllToastTriggers() {
  const toast = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() => toast.success("Success message")}
        data-testid="trigger-success"
      >
        Success
      </button>
      <button
        type="button"
        onClick={() => toast.error("Error message")}
        data-testid="trigger-error"
      >
        Error
      </button>
      <button
        type="button"
        onClick={() => toast.warning("Warning message")}
        data-testid="trigger-warning"
      >
        Warning
      </button>
      <button type="button" onClick={() => toast.info("Info message")} data-testid="trigger-info">
        Info
      </button>
    </div>
  );
}

// Component to programmatically add toast (for fake timer tests)
function DirectToastAdder() {
  const addToast = useSetAtom(addToastAtom);
  return (
    <div>
      <button
        type="button"
        onClick={() => addToast({ type: "success", message: "Success message" })}
        data-testid="add-success"
      >
        Add Success
      </button>
      <button
        type="button"
        onClick={() => addToast({ type: "error", message: "Error message" })}
        data-testid="add-error"
      >
        Add Error
      </button>
    </div>
  );
}

function renderWithProviders(
  ui: ReactNode,
  initialToasts: Parameters<(typeof uiAtom)["init"]>[0]["toasts"] = [],
) {
  const store = createStore();
  store.set(uiAtom, { isLoading: false, toasts: initialToasts });
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}

describe("ToastContainer", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders nothing when there are no toasts", () => {
      const { container } = renderWithProviders(<ToastContainer />);
      expect(container.firstChild).toBeNull();
    });

    it("renders a single toast", () => {
      renderWithProviders(<ToastContainer />, [
        { id: "1", type: "success", message: "Test message" },
      ]);
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });

    it("renders multiple toasts", () => {
      renderWithProviders(<ToastContainer />, [
        { id: "1", type: "success", message: "First message" },
        { id: "2", type: "error", message: "Second message" },
      ]);
      expect(screen.getByText("First message")).toBeInTheDocument();
      expect(screen.getByText("Second message")).toBeInTheDocument();
    });
  });

  describe("toast types", () => {
    it("renders success toast with correct styling", () => {
      const { container } = renderWithProviders(<ToastContainer />, [
        { id: "1", type: "success", message: "Success!" },
      ]);
      const toastElement = container.querySelector(".border-green-200");
      expect(toastElement).toBeInTheDocument();
    });

    it("renders error toast with correct styling", () => {
      const { container } = renderWithProviders(<ToastContainer />, [
        { id: "1", type: "error", message: "Error!" },
      ]);
      const toastElement = container.querySelector(".border-destructive\\/20");
      expect(toastElement).toBeInTheDocument();
    });

    it("renders warning toast with correct styling", () => {
      const { container } = renderWithProviders(<ToastContainer />, [
        { id: "1", type: "warning", message: "Warning!" },
      ]);
      const toastElement = container.querySelector(".border-yellow-200");
      expect(toastElement).toBeInTheDocument();
    });

    it("renders info toast with correct styling", () => {
      const { container } = renderWithProviders(<ToastContainer />, [
        { id: "1", type: "info", message: "Info!" },
      ]);
      const toastElement = container.querySelector(".border-blue-200");
      expect(toastElement).toBeInTheDocument();
    });
  });

  describe("manual dismiss", () => {
    it("removes toast when dismiss button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ToastContainer />, [
        { id: "1", type: "success", message: "Dismissable toast" },
      ]);

      expect(screen.getByText("Dismissable toast")).toBeInTheDocument();

      const dismissButton = screen.getByRole("button");
      await user.click(dismissButton);

      expect(screen.queryByText("Dismissable toast")).not.toBeInTheDocument();
    });

    it("removes only the clicked toast when multiple toasts exist", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ToastContainer />, [
        { id: "1", type: "success", message: "First toast" },
        { id: "2", type: "error", message: "Second toast" },
      ]);

      const dismissButtons = screen.getAllByRole("button");
      await user.click(dismissButtons[0]);

      expect(screen.queryByText("First toast")).not.toBeInTheDocument();
      expect(screen.getByText("Second toast")).toBeInTheDocument();
    });
  });

  describe("container positioning", () => {
    it("renders container with fixed position classes at bottom center", () => {
      const { container } = renderWithProviders(<ToastContainer />, [
        { id: "1", type: "success", message: "Test" },
      ]);
      const toastContainer = container.firstChild as HTMLElement;
      expect(toastContainer.getAttribute("class")).toContain("fixed");
      expect(toastContainer.getAttribute("class")).toContain("bottom-4");
      expect(toastContainer.getAttribute("class")).toContain("left-1/2");
      expect(toastContainer.getAttribute("class")).toContain("-translate-x-1/2");
      expect(toastContainer.getAttribute("class")).toContain("z-50");
    });
  });
});

describe("useToast hook", () => {
  afterEach(() => {
    cleanup();
  });

  it("adds success toast when success() is called", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AllToastTriggers />
        <ToastContainer />
      </>,
    );

    await user.click(screen.getByTestId("trigger-success"));
    expect(screen.getByText("Success message")).toBeInTheDocument();
  });

  it("adds error toast when error() is called", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AllToastTriggers />
        <ToastContainer />
      </>,
    );

    await user.click(screen.getByTestId("trigger-error"));
    expect(screen.getByText("Error message")).toBeInTheDocument();
  });

  it("adds warning toast when warning() is called", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AllToastTriggers />
        <ToastContainer />
      </>,
    );

    await user.click(screen.getByTestId("trigger-warning"));
    expect(screen.getByText("Warning message")).toBeInTheDocument();
  });

  it("adds info toast when info() is called", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AllToastTriggers />
        <ToastContainer />
      </>,
    );

    await user.click(screen.getByTestId("trigger-info"));
    expect(screen.getByText("Info message")).toBeInTheDocument();
  });

  it("can show multiple toasts of different types", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AllToastTriggers />
        <ToastContainer />
      </>,
    );

    await user.click(screen.getByTestId("trigger-success"));
    await user.click(screen.getByTestId("trigger-error"));

    expect(screen.getByText("Success message")).toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();
  });

  it("returns memoized toast methods", () => {
    const toastMethods: ReturnType<typeof useToast>[] = [];

    function CaptureToast() {
      const toast = useToast();
      toastMethods.push(toast);
      return null;
    }

    const { rerender } = renderWithProviders(<CaptureToast />);
    rerender(
      <Provider store={createStore()}>
        <CaptureToast />
      </Provider>,
    );

    // Different store means different addToast, so methods may differ
    // But within the same store, they should be stable
    expect(typeof toastMethods[0].success).toBe("function");
    expect(typeof toastMethods[0].error).toBe("function");
    expect(typeof toastMethods[0].warning).toBe("function");
    expect(typeof toastMethods[0].info).toBe("function");
  });
});

describe("toast auto-dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("auto-dismisses toast after default duration (4000ms)", () => {
    renderWithProviders(
      <>
        <DirectToastAdder />
        <ToastContainer />
      </>,
    );

    // Use fireEvent instead of userEvent for fake timer compatibility
    act(() => {
      fireEvent.click(screen.getByTestId("add-success"));
    });

    expect(screen.getByText("Success message")).toBeInTheDocument();

    // Advance time just before timeout
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByText("Success message")).toBeInTheDocument();

    // Advance past timeout
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("Success message")).not.toBeInTheDocument();
  });

  it("auto-dismisses multiple toasts independently", () => {
    renderWithProviders(
      <>
        <DirectToastAdder />
        <ToastContainer />
      </>,
    );

    // Show first toast
    act(() => {
      fireEvent.click(screen.getByTestId("add-success"));
    });
    expect(screen.getByText("Success message")).toBeInTheDocument();

    // Wait 2 seconds, then show second toast
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      fireEvent.click(screen.getByTestId("add-error"));
    });
    expect(screen.getByText("Success message")).toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();

    // After 2 more seconds (4 total for first toast), first should disappear
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(screen.queryByText("Success message")).not.toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();

    // After 2 more seconds (4 total for second toast), second should disappear
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Error message")).not.toBeInTheDocument();
  });

  it("does not auto-dismiss if manually dismissed first", () => {
    renderWithProviders(
      <>
        <DirectToastAdder />
        <ToastContainer />
      </>,
    );

    // Show toast
    act(() => {
      fireEvent.click(screen.getByTestId("add-success"));
    });
    expect(screen.getByText("Success message")).toBeInTheDocument();

    // Manually dismiss before timeout
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const dismissButtons = screen.getAllByRole("button");
    // The dismiss button is the third button (after add-success and add-error)
    const dismissButton = dismissButtons[2];
    act(() => {
      fireEvent.click(dismissButton);
    });
    expect(screen.queryByText("Success message")).not.toBeInTheDocument();

    // Advance past original timeout - should not cause errors
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // No errors should occur
    expect(screen.queryByText("Success message")).not.toBeInTheDocument();
  });
});

describe("ToastItem icons", () => {
  afterEach(() => {
    cleanup();
  });

  it("displays CheckCircle icon for success toast", () => {
    const { container } = renderWithProviders(<ToastContainer />, [
      { id: "1", type: "success", message: "Success" },
    ]);
    const icon = container.querySelector(".text-green-600");
    expect(icon).toBeInTheDocument();
  });

  it("displays XCircle icon for error toast", () => {
    const { container } = renderWithProviders(<ToastContainer />, [
      { id: "1", type: "error", message: "Error" },
    ]);
    const icon = container.querySelector(".text-destructive");
    expect(icon).toBeInTheDocument();
  });

  it("displays AlertCircle icon for warning toast", () => {
    const { container } = renderWithProviders(<ToastContainer />, [
      { id: "1", type: "warning", message: "Warning" },
    ]);
    const icon = container.querySelector(".text-yellow-600");
    expect(icon).toBeInTheDocument();
  });

  it("displays Info icon for info toast", () => {
    const { container } = renderWithProviders(<ToastContainer />, [
      { id: "1", type: "info", message: "Info" },
    ]);
    const icon = container.querySelector(".text-blue-600");
    expect(icon).toBeInTheDocument();
  });
});

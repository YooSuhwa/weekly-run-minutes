import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "../use-keyboard-shortcuts";

describe("useKeyboardShortcuts", () => {
  afterEach(() => {
    cleanup();
  });

  it("should call handler when matching key is pressed", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Space", handler, description: "next" }],
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("should match by event.key", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Enter", handler, description: "confirm" }],
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("should not call handler when disabled globally", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Space", handler, description: "next" }],
        enabled: false,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("should not call handler when individual shortcut is disabled", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Space", handler, description: "next", enabled: false }],
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("should not trigger in input elements", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Space", handler, description: "next" }],
      }),
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", { code: "Space", bubbles: true });
    Object.defineProperty(event, "target", { value: input });
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("should not trigger in textarea elements", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Space", handler, description: "next" }],
      }),
    );

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    const event = new KeyboardEvent("keydown", { code: "Space", bubbles: true });
    Object.defineProperty(event, "target", { value: textarea });
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it("should prevent default on matching key press", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Space", handler, description: "next" }],
      }),
    );

    const event = new KeyboardEvent("keydown", { code: "Space", cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("should handle multiple shortcuts", () => {
    const spaceHandler = vi.fn();
    const enterHandler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [
          { key: "Space", handler: spaceHandler, description: "next item" },
          { key: "Enter", handler: enterHandler, description: "next speaker" },
        ],
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(spaceHandler).toHaveBeenCalledOnce();
    expect(enterHandler).toHaveBeenCalledOnce();
  });

  it("should only trigger the first matching shortcut", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [
          { key: "Space", handler: handler1, description: "first" },
          { key: "Space", handler: handler2, description: "second" },
        ],
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).not.toHaveBeenCalled();
  });

  it("should cleanup event listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Space", handler, description: "next" }],
      }),
    );

    unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle ArrowLeft and ArrowRight keys", () => {
    const leftHandler = vi.fn();
    const rightHandler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [
          { key: "ArrowLeft", handler: leftHandler, description: "prev" },
          { key: "ArrowRight", handler: rightHandler, description: "next" },
        ],
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

    expect(leftHandler).toHaveBeenCalledOnce();
    expect(rightHandler).toHaveBeenCalledOnce();
  });

  it("should handle Escape key", () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        shortcuts: [{ key: "Escape", handler, description: "end" }],
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledOnce();
  });
});

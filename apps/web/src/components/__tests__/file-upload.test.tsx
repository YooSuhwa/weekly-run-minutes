import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileUpload } from "../ui/file-upload";

describe("FileUpload", () => {
  const defaultProps = {
    file: null,
    onFileSelect: vi.fn(),
    onFileRemove: vi.fn(),
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("drop zone (no file selected)", () => {
    it("renders the drop zone area", () => {
      render(<FileUpload {...defaultProps} />);
      expect(screen.getByText(/녹음 파일을 드래그하거나 클릭하세요/)).toBeDefined();
    });

    it("shows accepted formats text", () => {
      render(<FileUpload {...defaultProps} />);
      expect(screen.getByText(/MP3, WAV, WebM, M4A, OGG, AAC, FLAC/)).toBeDefined();
    });

    it("shows max file size text", () => {
      render(<FileUpload {...defaultProps} />);
      expect(screen.getByText(/최대 100MB/)).toBeDefined();
    });

    it("renders file input", () => {
      const { container } = render(<FileUpload {...defaultProps} />);
      const input = container.querySelector("input");
      expect(input).not.toBeNull();
    });

    it("applies custom className", () => {
      const { container } = render(<FileUpload {...defaultProps} className="custom-upload" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("custom-upload");
    });
  });

  describe("file selected state", () => {
    it("shows file name when file is selected", () => {
      const file = new File(["audio"], "meeting-recording.mp3", {
        type: "audio/mpeg",
      });
      render(<FileUpload {...defaultProps} file={file} />);
      expect(screen.getByText("meeting-recording.mp3")).toBeDefined();
    });

    it("shows file size when file is selected", () => {
      const content = new Array(1024).fill("a").join("");
      const file = new File([content], "test.mp3", { type: "audio/mpeg" });
      render(<FileUpload {...defaultProps} file={file} />);
      expect(screen.getByText("1 KB")).toBeDefined();
    });

    it("renders remove button when file is selected", () => {
      const file = new File(["audio"], "test.mp3", { type: "audio/mpeg" });
      render(<FileUpload {...defaultProps} file={file} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("disabled state", () => {
    it("applies disabled styling when disabled", () => {
      const { container } = render(<FileUpload {...defaultProps} disabled />);
      const dropzone = container.querySelector("[class*='cursor-not-allowed']");
      expect(dropzone).not.toBeNull();
    });

    it("disables remove button when file selected and disabled", () => {
      const file = new File(["audio"], "test.mp3", { type: "audio/mpeg" });
      render(<FileUpload {...defaultProps} file={file} disabled />);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });
});

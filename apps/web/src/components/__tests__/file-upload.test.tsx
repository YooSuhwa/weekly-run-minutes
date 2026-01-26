import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock useDropzone to control its behavior
const mockUseDropzone = vi.fn();
vi.mock("react-dropzone", () => ({
  useDropzone: (options: any) => mockUseDropzone(options),
}));

import { FileUpload } from "../ui/file-upload";

describe("FileUpload", () => {
  const defaultProps = {
    file: null,
    onFileSelect: vi.fn(),
    onFileRemove: vi.fn(),
  };

  beforeEach(() => {
    // Default mock implementation
    mockUseDropzone.mockImplementation((options: any) => ({
      getRootProps: () => ({
        onClick: () => {},
        onDrop: (e: any) => {
          if (options.onDrop && e.dataTransfer?.files?.length > 0) {
            options.onDrop([e.dataTransfer.files[0]]);
          }
        },
      }),
      getInputProps: () => ({ type: "file" }),
      isDragActive: false,
      fileRejections: [],
    }));
  });

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

    it("calls onFileRemove when remove button is clicked", async () => {
      const user = userEvent.setup();
      const onFileRemove = vi.fn();
      const file = new File(["audio"], "test.mp3", { type: "audio/mpeg" });
      render(<FileUpload {...defaultProps} file={file} onFileRemove={onFileRemove} />);

      await user.click(screen.getByRole("button"));
      expect(onFileRemove).toHaveBeenCalled();
    });

    it("applies custom className when file is selected", () => {
      const file = new File(["audio"], "test.mp3", { type: "audio/mpeg" });
      const { container } = render(
        <FileUpload {...defaultProps} file={file} className="custom-selected" />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.getAttribute("class")).toContain("custom-selected");
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

  describe("drag active state", () => {
    it("shows drag active text when dragging", () => {
      mockUseDropzone.mockImplementationOnce(() => ({
        getRootProps: () => ({}),
        getInputProps: () => ({ type: "file" }),
        isDragActive: true,
        fileRejections: [],
      }));

      render(<FileUpload {...defaultProps} />);
      expect(screen.getByText("여기에 놓으세요")).toBeDefined();
    });

    it("applies drag active styling", () => {
      mockUseDropzone.mockImplementationOnce(() => ({
        getRootProps: () => ({}),
        getInputProps: () => ({ type: "file" }),
        isDragActive: true,
        fileRejections: [],
      }));

      const { container } = render(<FileUpload {...defaultProps} />);
      const dropzone = container.querySelector("[class*='border-primary']");
      expect(dropzone).not.toBeNull();
    });
  });

  describe("file rejection", () => {
    it("shows error message for file too large", () => {
      mockUseDropzone.mockImplementationOnce(() => ({
        getRootProps: () => ({}),
        getInputProps: () => ({ type: "file" }),
        isDragActive: false,
        fileRejections: [{ errors: [{ code: "file-too-large", message: "" }] }],
      }));

      render(<FileUpload {...defaultProps} />);
      expect(screen.getByText("파일 크기가 100MB를 초과합니다")).toBeDefined();
    });

    it("shows error message for invalid file type", () => {
      mockUseDropzone.mockImplementationOnce(() => ({
        getRootProps: () => ({}),
        getInputProps: () => ({ type: "file" }),
        isDragActive: false,
        fileRejections: [{ errors: [{ code: "file-invalid-type", message: "" }] }],
      }));

      render(<FileUpload {...defaultProps} />);
      expect(screen.getByText("지원하지 않는 파일 형식입니다")).toBeDefined();
    });

    it("shows no error when fileRejections is empty", () => {
      mockUseDropzone.mockImplementationOnce(() => ({
        getRootProps: () => ({}),
        getInputProps: () => ({ type: "file" }),
        isDragActive: false,
        fileRejections: [],
      }));

      render(<FileUpload {...defaultProps} />);
      expect(screen.queryByText(/파일 크기가|지원하지 않는/)).toBeNull();
    });
  });

  describe("onDrop callback", () => {
    it("calls onFileSelect with the first file when files are dropped", () => {
      const onFileSelect = vi.fn();
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementationOnce((options: any) => {
        capturedOnDrop = options.onDrop;
        return {
          getRootProps: () => ({}),
          getInputProps: () => ({ type: "file" }),
          isDragActive: false,
          fileRejections: [],
        };
      });

      render(<FileUpload {...defaultProps} onFileSelect={onFileSelect} />);

      // Simulate the onDrop callback being called with files
      const file = new File(["audio"], "test.mp3", { type: "audio/mpeg" });
      capturedOnDrop?.([file]);

      expect(onFileSelect).toHaveBeenCalledWith(file);
    });

    it("does not call onFileSelect when empty array is dropped", () => {
      const onFileSelect = vi.fn();
      let capturedOnDrop: ((files: File[]) => void) | undefined;

      mockUseDropzone.mockImplementationOnce((options: any) => {
        capturedOnDrop = options.onDrop;
        return {
          getRootProps: () => ({}),
          getInputProps: () => ({ type: "file" }),
          isDragActive: false,
          fileRejections: [],
        };
      });

      render(<FileUpload {...defaultProps} onFileSelect={onFileSelect} />);

      // Simulate the onDrop callback being called with empty array
      capturedOnDrop?.([]);

      expect(onFileSelect).not.toHaveBeenCalled();
    });
  });
});

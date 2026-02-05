import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock next/image to handle static imports with placeholder="blur"
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    ...props
  }: {
    src: string | { src: string };
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    [key: string]: unknown;
  }) => {
    // Handle static imports (objects with src property)
    const imgSrc = typeof src === "object" && src !== null ? src.src : src;
    return (
      // biome-ignore lint/a11y/useAltText: mock component
      <img
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        data-testid="next-image"
        {...props}
      />
    );
  },
}));

// Mock lucide-react icons globally to avoid partial mock issues
// Uses SVG elements to match the selector patterns used in tests (svg.lucide-pencil)
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const createMockIcon = (name: string) => {
    const kebabName = name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    const MockIcon = ({ className, ...props }: { className?: string; [key: string]: unknown }) => (
      <svg
        data-testid={`icon-${kebabName}`}
        className={`lucide lucide-${kebabName} ${className || ""}`}
        {...props}
      >
        <title>{name}</title>
      </svg>
    );
    MockIcon.displayName = name;
    return MockIcon;
  };

  return {
    ...actual,
    // Override commonly used icons with mocks for consistent testing
    AlertCircle: createMockIcon("AlertCircle"),
    Bold: createMockIcon("Bold"),
    BookText: createMockIcon("BookText"),
    Check: createMockIcon("Check"),
    CheckCircle: createMockIcon("CheckCircle"),
    ChevronDown: createMockIcon("ChevronDown"),
    ChevronLeft: createMockIcon("ChevronLeft"),
    ChevronRight: createMockIcon("ChevronRight"),
    ChevronUp: createMockIcon("ChevronUp"),
    Cloud: createMockIcon("Cloud"),
    Download: createMockIcon("Download"),
    Edit: createMockIcon("Edit"),
    ExternalLink: createMockIcon("ExternalLink"),
    FileText: createMockIcon("FileText"),
    Filter: createMockIcon("Filter"),
    GripVertical: createMockIcon("GripVertical"),
    Hash: createMockIcon("Hash"),
    Heading1: createMockIcon("Heading1"),
    Heading2: createMockIcon("Heading2"),
    Heading3: createMockIcon("Heading3"),
    Info: createMockIcon("Info"),
    Italic: createMockIcon("Italic"),
    Key: createMockIcon("Key"),
    Link: createMockIcon("Link"),
    List: createMockIcon("List"),
    ListOrdered: createMockIcon("ListOrdered"),
    ListTodo: createMockIcon("ListTodo"),
    Loader2: createMockIcon("Loader2"),
    MessageSquare: createMockIcon("MessageSquare"),
    MessageSquareOff: createMockIcon("MessageSquareOff"),
    Mic: createMockIcon("Mic"),
    MoreHorizontal: createMockIcon("MoreHorizontal"),
    MoreVertical: createMockIcon("MoreVertical"),
    Pencil: createMockIcon("Pencil"),
    Play: createMockIcon("Play"),
    Plus: createMockIcon("Plus"),
    Redo: createMockIcon("Redo"),
    RefreshCw: createMockIcon("RefreshCw"),
    RotateCcw: createMockIcon("RotateCcw"),
    Save: createMockIcon("Save"),
    Search: createMockIcon("Search"),
    Settings: createMockIcon("Settings"),
    Strikethrough: createMockIcon("Strikethrough"),
    Tag: createMockIcon("Tag"),
    Trash2: createMockIcon("Trash2"),
    Undo: createMockIcon("Undo"),
    Upload: createMockIcon("Upload"),
    Users: createMockIcon("Users"),
    X: createMockIcon("X"),
    XCircle: createMockIcon("XCircle"),
  };
});

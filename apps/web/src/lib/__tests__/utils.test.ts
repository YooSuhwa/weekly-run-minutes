import { describe, expect, it } from "vitest";
import { cn, formatDate, formatDuration, formatFileSize } from "../utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("should merge tailwind classes correctly", () => {
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    });

    it("should handle empty inputs", () => {
      expect(cn()).toBe("");
    });

    it("should handle undefined and null values", () => {
      expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
    });
  });

  describe("formatFileSize", () => {
    it("should return '0 B' for 0 bytes", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("should format bytes correctly", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("should format kilobytes correctly", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("should format megabytes correctly", () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
      expect(formatFileSize(10485760)).toBe("10 MB");
    });

    it("should format gigabytes correctly", () => {
      expect(formatFileSize(1073741824)).toBe("1 GB");
    });
  });

  describe("formatDate", () => {
    it("should format date string correctly in Korean locale", () => {
      const result = formatDate("2024-01-15");
      expect(result).toContain("2024");
      expect(result).toContain("1");
      expect(result).toContain("15");
    });

    it("should format Date object correctly", () => {
      const date = new Date("2024-06-20");
      const result = formatDate(date);
      expect(result).toContain("2024");
      expect(result).toContain("6");
      expect(result).toContain("20");
    });
  });

  describe("formatDuration", () => {
    it("should format 0 seconds as 0:00", () => {
      expect(formatDuration(0)).toBe("0:00");
    });

    it("should format seconds less than a minute", () => {
      expect(formatDuration(5)).toBe("0:05");
      expect(formatDuration(30)).toBe("0:30");
      expect(formatDuration(59)).toBe("0:59");
    });

    it("should format exact minutes", () => {
      expect(formatDuration(60)).toBe("1:00");
      expect(formatDuration(120)).toBe("2:00");
      expect(formatDuration(300)).toBe("5:00");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(65)).toBe("1:05");
      expect(formatDuration(90)).toBe("1:30");
      expect(formatDuration(125)).toBe("2:05");
      expect(formatDuration(3661)).toBe("61:01");
    });

    it("should handle fractional seconds by flooring", () => {
      expect(formatDuration(65.7)).toBe("1:05");
      expect(formatDuration(90.9)).toBe("1:30");
    });

    it("should pad seconds with leading zero", () => {
      expect(formatDuration(61)).toBe("1:01");
      expect(formatDuration(69)).toBe("1:09");
    });
  });
});

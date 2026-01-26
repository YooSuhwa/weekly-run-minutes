import { describe, it, expect } from "vitest";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { CorrectionHighlight } from "../correction-highlight-extension";
import type { CorrectionItem } from "@/atoms/minutes";

describe("CorrectionHighlight Extension", () => {
  describe("extension creation", () => {
    it("creates an extension with correct name", () => {
      const extension = CorrectionHighlight.configure();
      expect(extension.name).toBe("correctionHighlight");
    });

    it("is an instance of Extension", () => {
      const extension = CorrectionHighlight.configure();
      expect(extension).toBeInstanceOf(Extension);
    });

    it("has extension type", () => {
      const extension = CorrectionHighlight.configure();
      expect(extension.type).toBe("extension");
    });
  });

  describe("default options", () => {
    it("has empty corrections array by default", () => {
      const extension = CorrectionHighlight.configure();
      expect(extension.options.corrections).toEqual([]);
    });

    it("has null activeCorrectionIndex by default", () => {
      const extension = CorrectionHighlight.configure();
      expect(extension.options.activeCorrectionIndex).toBeNull();
    });

    it("returns default options from addOptions method", () => {
      // Access the raw extension definition
      const opts = (CorrectionHighlight as any).options;
      expect(opts).toBeDefined();
    });
  });

  describe("option configuration", () => {
    it("accepts custom corrections", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections).toEqual(corrections);
    });

    it("accepts custom activeCorrectionIndex", () => {
      const extension = CorrectionHighlight.configure({ activeCorrectionIndex: 2 });
      expect(extension.options.activeCorrectionIndex).toBe(2);
    });

    it("accepts both corrections and activeCorrectionIndex", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "error",
          corrected: "fix",
          category: "grammar",
          paragraphIndex: 1,
          startOffset: 5,
          endOffset: 10,
        },
      ];

      const extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 0,
      });

      expect(extension.options.corrections).toEqual(corrections);
      expect(extension.options.activeCorrectionIndex).toBe(0);
    });

    it("accepts empty corrections array explicitly", () => {
      const extension = CorrectionHighlight.configure({ corrections: [] });
      expect(extension.options.corrections).toEqual([]);
    });

    it("accepts activeCorrectionIndex of 0", () => {
      const extension = CorrectionHighlight.configure({ activeCorrectionIndex: 0 });
      expect(extension.options.activeCorrectionIndex).toBe(0);
    });

    it("preserves all correction properties", () => {
      const correction: CorrectionItem = {
        original: "API",
        corrected: "ElevenLabs API",
        category: "terminology",
        paragraphIndex: 2,
        startOffset: 10,
        endOffset: 13,
      };

      const extension = CorrectionHighlight.configure({ corrections: [correction] });
      expect(extension.options.corrections[0]).toEqual(correction);
      expect(extension.options.corrections[0].original).toBe("API");
      expect(extension.options.corrections[0].corrected).toBe("ElevenLabs API");
      expect(extension.options.corrections[0].category).toBe("terminology");
      expect(extension.options.corrections[0].paragraphIndex).toBe(2);
      expect(extension.options.corrections[0].startOffset).toBe(10);
      expect(extension.options.corrections[0].endOffset).toBe(13);
    });
  });

  describe("multiple corrections", () => {
    it("accepts multiple corrections", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "first",
          corrected: "1st",
          category: "formatting",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 5,
        },
        {
          original: "second",
          corrected: "2nd",
          category: "formatting",
          paragraphIndex: 1,
          startOffset: 0,
          endOffset: 6,
        },
        {
          original: "third",
          corrected: "3rd",
          category: "formatting",
          paragraphIndex: 2,
          startOffset: 0,
          endOffset: 5,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections).toHaveLength(3);
      expect(extension.options.corrections[0].original).toBe("first");
      expect(extension.options.corrections[1].original).toBe("second");
      expect(extension.options.corrections[2].original).toBe("third");
    });

    it("handles corrections with null position values", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "valid",
          corrected: "correct",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 5,
        },
        {
          original: "invalid",
          corrected: "bad",
          category: "grammar",
          paragraphIndex: null,
          startOffset: null,
          endOffset: null,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections).toHaveLength(2);
      expect(extension.options.corrections[1].paragraphIndex).toBeNull();
      expect(extension.options.corrections[1].startOffset).toBeNull();
      expect(extension.options.corrections[1].endOffset).toBeNull();
    });

    it("handles large number of corrections", () => {
      const corrections: CorrectionItem[] = Array.from({ length: 100 }, (_, i) => ({
        original: `error${i}`,
        corrected: `fix${i}`,
        category: "terminology" as const,
        paragraphIndex: i % 10,
        startOffset: 0,
        endOffset: 5,
      }));

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections).toHaveLength(100);
    });
  });

  describe("correction categories", () => {
    it("handles terminology category", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "STT",
          corrected: "Speech-to-Text",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 3,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].category).toBe("terminology");
    });

    it("handles formatting category", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "2024/1/15",
          corrected: "2024-01-15",
          category: "formatting",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 9,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].category).toBe("formatting");
    });

    it("handles grammar category", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "are",
          corrected: "is",
          category: "grammar",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 3,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].category).toBe("grammar");
    });

    it("handles mixed categories", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "API",
          corrected: "ElevenLabs API",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 3,
        },
        {
          original: "2024/1/1",
          corrected: "2024-01-01",
          category: "formatting",
          paragraphIndex: 1,
          startOffset: 0,
          endOffset: 8,
        },
        {
          original: "was",
          corrected: "were",
          category: "grammar",
          paragraphIndex: 2,
          startOffset: 0,
          endOffset: 3,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].category).toBe("terminology");
      expect(extension.options.corrections[1].category).toBe("formatting");
      expect(extension.options.corrections[2].category).toBe("grammar");
    });
  });

  describe("active correction index", () => {
    it("accepts null activeCorrectionIndex", () => {
      const extension = CorrectionHighlight.configure({ activeCorrectionIndex: null });
      expect(extension.options.activeCorrectionIndex).toBeNull();
    });

    it("accepts zero as activeCorrectionIndex", () => {
      const extension = CorrectionHighlight.configure({ activeCorrectionIndex: 0 });
      expect(extension.options.activeCorrectionIndex).toBe(0);
    });

    it("accepts positive activeCorrectionIndex", () => {
      const extension = CorrectionHighlight.configure({ activeCorrectionIndex: 5 });
      expect(extension.options.activeCorrectionIndex).toBe(5);
    });

    it("accepts activeCorrectionIndex matching corrections length", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "a",
          corrected: "A",
          category: "formatting",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 1,
        },
        {
          original: "b",
          corrected: "B",
          category: "formatting",
          paragraphIndex: 1,
          startOffset: 0,
          endOffset: 1,
        },
      ];

      const extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 1,
      });

      expect(extension.options.activeCorrectionIndex).toBe(1);
      expect(extension.options.corrections).toHaveLength(2);
    });

    it("accepts activeCorrectionIndex beyond corrections array", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 10,
      });

      expect(extension.options.activeCorrectionIndex).toBe(10);
    });
  });

  describe("unicode and special characters", () => {
    it("handles Korean text", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "회의록",
          corrected: "미팅 노트",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 3,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].original).toBe("회의록");
      expect(extension.options.corrections[0].corrected).toBe("미팅 노트");
    });

    it("handles emoji", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "😀",
          corrected: "😊",
          category: "formatting",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 1,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].original).toBe("😀");
      expect(extension.options.corrections[0].corrected).toBe("😊");
    });

    it("handles mixed language text", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "API 회의",
          corrected: "API Meeting",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 6,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].original).toBe("API 회의");
      expect(extension.options.corrections[0].corrected).toBe("API Meeting");
    });

    it("handles special characters", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "<script>",
          corrected: "&lt;script&gt;",
          category: "formatting",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 8,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].original).toBe("<script>");
      expect(extension.options.corrections[0].corrected).toBe("&lt;script&gt;");
    });
  });

  describe("edge cases - position values", () => {
    it("handles zero startOffset", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].startOffset).toBe(0);
    });

    it("handles zero endOffset", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "",
          corrected: "inserted",
          category: "grammar",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 0,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].endOffset).toBe(0);
    });

    it("handles large offset values", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 999,
          startOffset: 10000,
          endOffset: 10004,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].paragraphIndex).toBe(999);
      expect(extension.options.corrections[0].startOffset).toBe(10000);
      expect(extension.options.corrections[0].endOffset).toBe(10004);
    });

    it("handles negative paragraph index", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: -1,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].paragraphIndex).toBe(-1);
    });
  });

  describe("real-world scenarios", () => {
    it("handles WeeklyRun meeting minutes corrections", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "STT 처리",
          corrected: "ElevenLabs STT 처리",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 6,
        },
        {
          original: "GPT",
          corrected: "GPT-4",
          category: "terminology",
          paragraphIndex: 1,
          startOffset: 5,
          endOffset: 8,
        },
        {
          original: "2024/1/26",
          corrected: "2024-01-26",
          category: "formatting",
          paragraphIndex: 2,
          startOffset: 6,
          endOffset: 15,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections).toHaveLength(3);
      expect(extension.options.corrections[0].category).toBe("terminology");
      expect(extension.options.corrections[1].category).toBe("terminology");
      expect(extension.options.corrections[2].category).toBe("formatting");
    });

    it("handles navigation through corrections with active index", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "error1",
          corrected: "fix1",
          category: "grammar",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 6,
        },
        {
          original: "error2",
          corrected: "fix2",
          category: "grammar",
          paragraphIndex: 1,
          startOffset: 0,
          endOffset: 6,
        },
        {
          original: "error3",
          corrected: "fix3",
          category: "grammar",
          paragraphIndex: 2,
          startOffset: 0,
          endOffset: 6,
        },
      ];

      // Navigate to first
      let extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 0,
      });
      expect(extension.options.activeCorrectionIndex).toBe(0);

      // Navigate to second
      extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 1,
      });
      expect(extension.options.activeCorrectionIndex).toBe(1);

      // Navigate to third
      extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 2,
      });
      expect(extension.options.activeCorrectionIndex).toBe(2);

      // Back to no selection
      extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: null,
      });
      expect(extension.options.activeCorrectionIndex).toBeNull();
    });

    it("handles corrections from P1-lite scope", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "API",
          corrected: "ElevenLabs API",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 3,
        },
      ];

      const extension = CorrectionHighlight.configure({ corrections });
      expect(extension.options.corrections[0].original).toBe("API");
      expect(extension.options.corrections[0].corrected).toBe("ElevenLabs API");
      expect(extension.options.corrections[0].category).toBe("terminology");
    });
  });

  describe("immutability", () => {
    it("does not mutate original corrections array", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const originalLength = corrections.length;
      const originalFirst = { ...corrections[0] };

      CorrectionHighlight.configure({ corrections });

      expect(corrections.length).toBe(originalLength);
      expect(corrections[0]).toEqual(originalFirst);
    });

    it("creates new extension instance on each configure call", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const ext1 = CorrectionHighlight.configure({ corrections, activeCorrectionIndex: 0 });
      const ext2 = CorrectionHighlight.configure({ corrections, activeCorrectionIndex: 1 });

      expect(ext1).not.toBe(ext2);
      expect(ext1.options.activeCorrectionIndex).toBe(0);
      expect(ext2.options.activeCorrectionIndex).toBe(1);
    });
  });

  describe("extension compatibility", () => {
    it("can be configured multiple times with different options", () => {
      const corrections1: CorrectionItem[] = [
        {
          original: "test1",
          corrected: "corrected1",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 5,
        },
      ];

      const corrections2: CorrectionItem[] = [
        {
          original: "test2",
          corrected: "corrected2",
          category: "formatting",
          paragraphIndex: 1,
          startOffset: 0,
          endOffset: 5,
        },
      ];

      const ext1 = CorrectionHighlight.configure({ corrections: corrections1 });
      const ext2 = CorrectionHighlight.configure({ corrections: corrections2 });

      expect(ext1.options.corrections[0].original).toBe("test1");
      expect(ext2.options.corrections[0].original).toBe("test2");
    });

    it("maintains extension properties after configuration", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      const extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 0,
      });

      expect(extension.name).toBe("correctionHighlight");
      expect(extension.type).toBe("extension");
      expect(extension.options.corrections).toEqual(corrections);
      expect(extension.options.activeCorrectionIndex).toBe(0);
    });
  });

  describe("TipTap extension API compliance", () => {
    it("extension can be used in TipTap extensions array", () => {
      const extension = CorrectionHighlight.configure();
      const extensions = [extension];

      expect(extensions).toHaveLength(1);
      expect(extensions[0].name).toBe("correctionHighlight");
      expect(extensions[0].type).toBe("extension");
    });

    it("has correct extension structure for TipTap", () => {
      const extension = CorrectionHighlight.configure();

      // TipTap extensions should have these properties
      expect(extension).toHaveProperty("name");
      expect(extension).toHaveProperty("type");
      expect(extension).toHaveProperty("options");

      expect(extension.name).toBe("correctionHighlight");
      expect(extension.type).toBe("extension");
    });

    it("can be combined with other TipTap extensions", () => {
      const ext1 = CorrectionHighlight.configure();
      const ext2 = CorrectionHighlight.configure({
        corrections: [
          {
            original: "test",
            corrected: "corrected",
            category: "terminology",
            paragraphIndex: 0,
            startOffset: 0,
            endOffset: 4,
          },
        ],
      });

      const extensions = [ext1, ext2];

      expect(extensions).toHaveLength(2);
      expect(extensions[0].options.corrections).toHaveLength(0);
      expect(extensions[1].options.corrections).toHaveLength(1);
    });

    it("maintains independent options for each instance", () => {
      const corrections1: CorrectionItem[] = [
        {
          original: "error1",
          corrected: "fix1",
          category: "grammar",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 6,
        },
      ];

      const corrections2: CorrectionItem[] = [
        {
          original: "error2",
          corrected: "fix2",
          category: "terminology",
          paragraphIndex: 1,
          startOffset: 0,
          endOffset: 6,
        },
      ];

      const ext1 = CorrectionHighlight.configure({ corrections: corrections1 });
      const ext2 = CorrectionHighlight.configure({ corrections: corrections2 });

      expect(ext1.options.corrections).toEqual(corrections1);
      expect(ext2.options.corrections).toEqual(corrections2);
      expect(ext1.options.corrections).not.toEqual(ext2.options.corrections);
    });
  });

  describe("option reconfiguration", () => {
    it("can update corrections via reconfigure", () => {
      let extension = CorrectionHighlight.configure({ corrections: [] });
      expect(extension.options.corrections).toHaveLength(0);

      const newCorrections: CorrectionItem[] = [
        {
          original: "new",
          corrected: "updated",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 3,
        },
      ];

      extension = CorrectionHighlight.configure({ corrections: newCorrections });
      expect(extension.options.corrections).toHaveLength(1);
      expect(extension.options.corrections[0].original).toBe("new");
    });

    it("can update activeCorrectionIndex via reconfigure", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      let extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 0,
      });
      expect(extension.options.activeCorrectionIndex).toBe(0);

      extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: null,
      });
      expect(extension.options.activeCorrectionIndex).toBeNull();
    });

    it("handles partial option updates", () => {
      const corrections: CorrectionItem[] = [
        {
          original: "test",
          corrected: "corrected",
          category: "terminology",
          paragraphIndex: 0,
          startOffset: 0,
          endOffset: 4,
        },
      ];

      // Set both options
      let extension = CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex: 1,
      });
      expect(extension.options.corrections).toHaveLength(1);
      expect(extension.options.activeCorrectionIndex).toBe(1);

      // Update only activeCorrectionIndex (corrections should reset to default)
      extension = CorrectionHighlight.configure({ activeCorrectionIndex: 2 });
      expect(extension.options.activeCorrectionIndex).toBe(2);
    });
  });
});

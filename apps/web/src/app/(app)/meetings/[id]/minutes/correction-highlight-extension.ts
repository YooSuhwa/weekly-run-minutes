import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { CorrectionItem } from "@/atoms/minutes";

export interface CorrectionHighlightOptions {
  corrections: CorrectionItem[];
  activeCorrectionIndex: number | null;
}

const correctionHighlightKey = new PluginKey("correctionHighlight");

export const CorrectionHighlight = Extension.create<CorrectionHighlightOptions>({
  name: "correctionHighlight",

  addOptions() {
    return {
      corrections: [],
      activeCorrectionIndex: null,
    };
  },

  addProseMirrorPlugins() {
    const { corrections, activeCorrectionIndex } = this.options;

    return [
      new Plugin({
        key: correctionHighlightKey,
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            for (let i = 0; i < corrections.length; i++) {
              const correction = corrections[i];
              if (
                correction.paragraphIndex === null ||
                correction.startOffset === null ||
                correction.endOffset === null
              ) {
                continue;
              }

              // Find the paragraph node at the given index
              let paragraphCount = 0;
              let from = -1;
              let to = -1;

              doc.descendants((node, pos) => {
                if (from >= 0) return false;
                if (node.isBlock && node.isTextblock) {
                  if (paragraphCount === correction.paragraphIndex) {
                    const startOff = correction.startOffset ?? 0;
                    const endOff = correction.endOffset ?? 0;
                    const maxOffset = node.content.size;
                    if (startOff <= maxOffset && endOff <= maxOffset) {
                      from = pos + 1 + startOff;
                      to = pos + 1 + endOff;
                    }
                  }
                  paragraphCount++;
                  return false;
                }
                return true;
              });

              if (from >= 0 && to >= 0) {
                const isActive = i === activeCorrectionIndex;
                const className = isActive
                  ? "bg-primary/30 ring-2 ring-primary/50 rounded-sm"
                  : "bg-yellow-100 dark:bg-yellow-900/30 rounded-sm";

                decorations.push(
                  Decoration.inline(from, to, {
                    class: className,
                    "data-correction-index": String(i),
                  }),
                );
              }
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

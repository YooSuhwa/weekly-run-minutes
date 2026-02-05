"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Redo, Strikethrough, Undo } from "lucide-react";
import { marked } from "marked";
import TurndownService from "turndown";
import { useEffect, useMemo, useRef } from "react";
import type { CorrectionItem } from "@/atoms/minutes";
import { cn } from "@/lib/utils";
import { CorrectionHighlight } from "./correction-highlight-extension";

// Configure marked for synchronous parsing
marked.use({ async: false });

// Create turndown instance for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

// Convert markdown to HTML
function markdownToHtml(markdown: string): string {
  return marked.parse(markdown) as string;
}

// Convert HTML to markdown
function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}

interface MinutesEditorProps {
  content: string;
  onChange: (content: string) => void;
  corrections?: CorrectionItem[];
  activeCorrectionIndex?: number | null;
  readOnly?: boolean;
}

export function MinutesEditor({
  content,
  onChange,
  corrections = [],
  activeCorrectionIndex = null,
  readOnly = false,
}: MinutesEditorProps) {
  const isInternalUpdate = useRef(false);

  // Convert markdown content to HTML for initial render
  const initialHtml = useMemo(() => markdownToHtml(content), []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "회의록을 작성하세요...",
      }),
      CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex,
      }),
    ],
    content: initialHtml,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      // Convert HTML back to markdown for storage
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      isInternalUpdate.current = true;
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[500px] p-4 ${readOnly ? "opacity-75 cursor-not-allowed" : ""}`,
      },
    },
  });

  // Update editable state when readOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Update correction highlights when corrections or active index change
  useEffect(() => {
    if (editor) {
      editor.extensionManager.extensions
        .find((ext) => ext.name === "correctionHighlight")
        ?.configure({ corrections, activeCorrectionIndex });
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, corrections, activeCorrectionIndex]);

  // Update editor content when external content changes
  useEffect(() => {
    if (!editor || !content) return;

    // Skip if this is an internal update from onUpdate
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    // In readOnly mode or when editor is not focused, always update content
    if (readOnly || !editor.isFocused) {
      const html = markdownToHtml(content);
      const currentHtml = editor.getHTML();
      if (currentHtml !== html) {
        editor.commands.setContent(html);
      }
    }
  }, [content, editor, readOnly]);

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Toolbar - 6번: 읽기 전용 모드에서 비활성화 */}
      <div className={`flex items-center gap-1 border-b border-border px-3 py-2 ${readOnly ? "opacity-50 pointer-events-none" : ""}`}>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          disabled={readOnly}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          disabled={readOnly}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          disabled={readOnly}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-2 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          disabled={readOnly}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          disabled={readOnly}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-2 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={readOnly || !editor.can().undo()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={readOnly || !editor.can().redo()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

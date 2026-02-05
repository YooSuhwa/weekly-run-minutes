"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Redo, Strikethrough, Undo } from "lucide-react";
import { marked } from "marked";
import TurndownService from "turndown";
import { useEffect, useRef } from "react";
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

// Preserve heading levels properly
turndownService.addRule("headings", {
  filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
  replacement: (content, node) => {
    const level = Number(node.nodeName.charAt(1));
    const prefix = "#".repeat(level);
    return `\n\n${prefix} ${content.trim()}\n\n`;
  },
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
  // Track if editor is currently being edited by user
  const isUserEditing = useRef(false);
  // Track if we're doing a programmatic update
  const isProgrammaticUpdate = useRef(false);
  // Track the initial content load
  const hasInitialContent = useRef(false);
  // Store the onChange callback in a ref to avoid re-creating editor
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "회의록을 작성하세요...",
      }),
      CorrectionHighlight.configure({
        corrections,
        activeCorrectionIndex,
      }),
    ],
    content: "",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      // Skip if this is a programmatic update (not user editing)
      if (isProgrammaticUpdate.current) {
        return;
      }
      // Mark as user editing
      isUserEditing.current = true;
      // Convert HTML back to markdown for storage
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChangeRef.current(markdown);
    },
    onFocus: () => {
      isUserEditing.current = true;
    },
    onBlur: () => {
      // Small delay before allowing external updates again
      setTimeout(() => {
        isUserEditing.current = false;
      }, 100);
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

  // Sync content from prop to editor - only on initial load or when user is not editing
  useEffect(() => {
    if (!editor) return;
    if (!content) return;

    // Always load initial content
    if (!hasInitialContent.current) {
      isProgrammaticUpdate.current = true;
      const html = markdownToHtml(content);
      editor.commands.setContent(html, false);
      hasInitialContent.current = true;
      isProgrammaticUpdate.current = false;
      return;
    }

    // Skip sync while user is actively editing
    if (isUserEditing.current) {
      return;
    }
  }, [content, editor]);

  // Reset initial content flag when content is cleared (e.g., loading new meeting)
  useEffect(() => {
    if (!content) {
      hasInitialContent.current = false;
    }
  }, [content]);

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Toolbar - 6번: 읽기 전용 모드에서 비활성화 */}
      <div className={`flex items-center gap-1 border-b border-border px-3 py-2 ${readOnly ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Heading buttons */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          disabled={readOnly}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          disabled={readOnly}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          disabled={readOnly}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-2 h-5 w-px bg-border" />

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

"use client";

import * as React from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { createLowlight, common } from "lowlight";
import { cn } from "@/lib/cn";
import { ensureEditorHtml } from "@/lib/note-content-html";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Minus,
  ImageIcon,
  Table2,
  Trash2,
  Rows2,
  Columns2,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";

const lowlight = createLowlight(common);

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40",
        active &&
          "bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] text-[var(--accent)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_38%,transparent)]"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-4 w-px shrink-0 self-center bg-[var(--border)]/55" aria-hidden />;
}

function currentTextAlign(editor: Editor): "left" | "center" | "right" {
  const p = editor.getAttributes("paragraph").textAlign as string | undefined;
  const h = editor.getAttributes("heading").textAlign as string | undefined;
  const raw = p ?? h;
  if (raw === "center" || raw === "right" || raw === "left") return raw;
  return "left";
}

function insertImageFromFile(editor: Editor | null, noteId: string | null, file: File) {
  if (!editor) return;
  if (!noteId || noteId.startsWith("draft-")) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    return;
  }
  const run = async () => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/notes/${noteId}/image`, { method: "POST", body: fd });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        console.error(j.error ?? "Upload failed");
        return;
      }
      editor.chain().focus().setImage({ src: j.url }).run();
    } catch (e) {
      console.error(e);
    }
  };
  void run();
}

function NoteEditorToolbar({ editor, noteId }: { editor: Editor; noteId: string | null }) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  useEditorState({
    editor,
    selector: (snap) => snap.transactionNumber,
  });

  const inTable = editor.isActive("table");
  const align = currentTextAlign(editor);
  const iconClass = "h-3.5 w-3.5";

  return (
    <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg)]">
      <div className="flex min-h-8 min-w-0 items-center gap-0 overflow-x-auto px-6 py-1 [scrollbar-width:none] md:py-1 [&::-webkit-scrollbar]:hidden">
        {/* 1) Undo / Redo */}
        <div className="flex shrink-0 items-center gap-px">
          <ToolbarButton
            title="Undo (⌘Z)"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Redo (⌘⇧Z)"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className={iconClass} strokeWidth={2} />
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* 2) Text style */}
        <div className="flex shrink-0 items-center gap-px">
          <ToolbarButton
            title="Bold (⌘B)"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Italic (⌘I)"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Underline (⌘U)"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className={iconClass} strokeWidth={2} />
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* 3) Headings */}
        <div className="flex shrink-0 items-center gap-px">
          <ToolbarButton
            title="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className={iconClass} strokeWidth={2} />
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* 4) Lists */}
        <div className="flex shrink-0 items-center gap-px">
          <ToolbarButton
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Checklist"
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListChecks className={iconClass} strokeWidth={2} />
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* 5) Insert: Table, Image, Divider */}
        <div className="flex shrink-0 items-center gap-px">
          <ToolbarButton
            title="Insert table"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            <Table2 className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton title="Insert image" onClick={() => fileRef.current?.click()}>
            <ImageIcon className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton title="Horizontal divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) insertImageFromFile(editor, noteId, f);
            }}
          />
        </div>

        <ToolbarDivider />

        {/* 6) Alignment */}
        <div className="flex shrink-0 items-center gap-px">
          <ToolbarButton
            title="Align left"
            active={align === "left"}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Align center"
            active={align === "center"}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className={iconClass} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Align right"
            active={align === "right"}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className={iconClass} strokeWidth={2} />
          </ToolbarButton>
        </div>

        {inTable ? (
          <>
            <ToolbarDivider />
            <div className="flex shrink-0 items-center gap-px">
              <ToolbarButton title="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
                <Rows2 className={`${iconClass} scale-y-[-1]`} strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
                <Rows2 className={iconClass} strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
                <Trash2 className={iconClass} strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton
                title="Add column before"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
              >
                <Columns2 className={`${iconClass} scale-x-[-1]`} strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <Columns2 className={iconClass} strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
                <Trash2 className={iconClass} strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
                <Table2 className={`${iconClass} opacity-60`} strokeWidth={2} />
              </ToolbarButton>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function NoteRichTextEditor({
  noteId,
  initialHtml,
  onHtmlChange,
  className,
  aiToolbar,
  statusBar,
}: {
  noteId: string | null;
  initialHtml: string;
  onHtmlChange: (html: string) => void;
  className?: string;
  aiToolbar?: React.ReactNode;
  statusBar?: React.ReactNode;
}) {
  const html = React.useMemo(() => ensureEditorHtml(initialHtml), [initialHtml]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: { class: "rounded-lg max-w-full border border-[var(--border)] my-2" },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "border-collapse border border-[var(--border)] text-sm" },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: { class: "border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1.5 font-semibold" },
      }),
      TableCell.configure({ HTMLAttributes: { class: "border border-[var(--border)] px-2 py-1.5 align-top" } }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: { class: "hljs studara-code-block" },
      }),
      Placeholder.configure({ placeholder: "Write your note…" }),
    ],
    content: html,
    editorProps: {
      attributes: {
        class:
          "studara-tiptap min-h-[min(40dvh,220px)] w-full max-w-none px-6 py-5 text-left text-base leading-[1.7] text-[var(--tiptap-body)] outline-none md:min-h-[260px] md:py-6",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onHtmlChange(ed.getHTML());
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const el = editor.view.dom;
    const root = el.closest(".studara-tiptap-root");
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) insertImageFromFile(editor, noteId, file);
          return;
        }
      }
    };
    root?.addEventListener("paste", onPaste);
    return () => root?.removeEventListener("paste", onPaste);
  }, [editor, noteId]);

  const editorRef = React.useRef(editor);
  editorRef.current = editor;

  const onDrop = React.useCallback((e: React.DragEvent) => {
    if (!editorRef.current) return;
    const f = e.dataTransfer.files?.[0];
    if (f?.type.startsWith("image/")) {
      e.preventDefault();
      insertImageFromFile(editorRef.current, noteId, f);
    }
  }, [noteId]);

  return (
    <div
      className={cn(
        "studara-tiptap-root flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-[var(--bg)]",
        className
      )}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {editor ? <NoteEditorToolbar editor={editor} noteId={noteId} /> : null}
      {aiToolbar != null ? (
        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg)]">{aiToolbar}</div>
      ) : null}
      <EditorContent
        editor={editor}
        className="note-editor-scrollbar min-h-0 flex-1 bg-[var(--bg)] [&_.tiptap]:bg-[var(--bg)] [&_.ProseMirror]:bg-[var(--bg)] [&_.ProseMirror]:text-left"
      />
      {statusBar != null ? (
        <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg)] px-6 py-1.5 md:px-6">
          {statusBar}
        </div>
      ) : null}
    </div>
  );
}

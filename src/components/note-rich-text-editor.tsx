"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
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
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40 md:h-8 md:w-8",
        active && "bg-[var(--btn-default-bg)] text-[var(--text)] ring-1 ring-[var(--border)]"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 self-center bg-[var(--border-subtle)]" aria-hidden />;
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

function NoteEditorToolbar({ editor, noteId }: { editor: Editor | null; noteId: string | null }) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const inTable = editor.isActive("table");

  return (
    <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--editor-chrome-bg)]">
      <div className="flex min-w-0 flex-wrap items-center gap-0.5 px-2 py-1.5 md:px-3 md:py-2">
        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton
            title="Bold (⌘B)"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Italic (⌘I)"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Underline (⌘U)"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton
            title="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Checklist"
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListChecks className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton
            title="Insert table"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            <Table2 className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton title="Insert image" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="h-4 w-4" strokeWidth={2} />
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

        {inTable ? (
          <>
            <ToolbarDivider />
            <div className="flex flex-wrap items-center gap-0.5">
              <ToolbarButton title="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
                <Rows2 className="h-4 w-4 scale-y-[-1]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
                <Rows2 className="h-4 w-4" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton
                title="Add column before"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
              >
                <Columns2 className="h-4 w-4 scale-x-[-1]" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <Columns2 className="h-4 w-4" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
                <Table2 className="h-4 w-4 opacity-60" strokeWidth={2} />
              </ToolbarButton>
            </div>
          </>
        ) : null}

        <div className="min-w-[4px] flex-1" aria-hidden />

        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton
            title="Undo (⌘Z)"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            title="Redo (⌘⇧Z)"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
        </div>
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
          "studara-tiptap note-editor-scrollbar min-h-[min(40dvh,220px)] max-w-[720px] mx-auto w-full px-4 py-5 text-[17px] leading-[1.65] text-[var(--tiptap-body)] outline-none md:min-h-[260px] md:px-8 md:py-8",
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
        "studara-tiptap-root flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-[var(--border)] bg-[var(--editor-surface)] md:rounded-xl md:border",
        className
      )}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <NoteEditorToolbar editor={editor} noteId={noteId} />
      {aiToolbar != null ? (
        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--editor-chrome-bg)]">{aiToolbar}</div>
      ) : null}
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto bg-[var(--editor-surface)]" />
      {statusBar != null ? (
        <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--editor-chrome-bg)] px-3 py-1.5 md:px-4">
          {statusBar}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
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
  Highlighter,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Minus,
  ImageIcon,
  Table2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Rows2,
  Columns2,
  ArrowLeft,
  ArrowRight,
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
        "flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40 md:h-8 md:w-8 md:rounded-md",
        active && "bg-purple-500/25 text-purple-200 ring-1 ring-purple-500/40"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-8 w-px shrink-0 self-center bg-white/10 md:mx-1 md:h-6" aria-hidden />;
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
    <div className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-white/10 bg-black/30 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max flex-nowrap items-center gap-0.5 px-1 py-1.5 md:min-w-0 md:flex-wrap md:px-2 md:py-2">
      <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-white/35 md:inline">Edit</span>
      <ToolbarButton
        title="Undo (⌘Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <ArrowLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Redo (⌘⇧Z)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <ArrowRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-white/35 md:inline">Text</span>
      <ToolbarButton
        title="Bold (⌘B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Italic (⌘I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Underline (⌘U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Highlight"
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-white/35 md:inline">Headings</span>
      <ToolbarButton
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Paragraph"
        active={editor.isActive("paragraph") && !editor.isActive("heading")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <span className="text-xs font-medium">¶</span>
      </ToolbarButton>

      <ToolbarDivider />

      <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-white/35 md:inline">Lists</span>
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Task list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-white/35 md:inline">Insert</span>
      <ToolbarButton
        title="Blockquote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Insert image" onClick={() => fileRef.current?.click()}>
        <ImageIcon className="h-4 w-4" />
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
      <ToolbarButton
        title="Insert table"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <Table2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-white/35 md:inline">Align</span>
      <ToolbarButton
        title="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      {inTable ? (
        <>
          <ToolbarDivider />
          <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-white/35 md:inline">
            Table
          </span>
          <ToolbarButton
            title="Add row before"
            onClick={() => editor.chain().focus().addRowBefore().run()}
          >
            <Rows2 className="h-4 w-4 scale-y-[-1]" />
          </ToolbarButton>
          <ToolbarButton title="Add row after" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <Rows2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Add column before"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
          >
            <Columns2 className="h-4 w-4 scale-x-[-1]" />
          </ToolbarButton>
          <ToolbarButton
            title="Add column after"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Columns2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
            <Trash2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Table2 className="h-4 w-4 opacity-60" />
          </ToolbarButton>
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
}: {
  noteId: string | null;
  initialHtml: string;
  onHtmlChange: (html: string) => void;
  className?: string;
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
        HTMLAttributes: { class: "rounded-lg max-w-full border border-white/10 my-2" },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "border-collapse border border-white/15 text-sm" },
      }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: "border border-white/15 bg-white/5 px-2 py-1.5 font-semibold" } }),
      TableCell.configure({ HTMLAttributes: { class: "border border-white/15 px-2 py-1.5 align-top" } }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: { class: "hljs studara-code-block" },
      }),
      Placeholder.configure({ placeholder: "Write your note…" }),
    ],
    content: html,
    editorProps: {
      attributes: {
        class: "studara-tiptap note-editor-scrollbar min-h-[min(42dvh,240px)] max-w-none flex-1 px-3 py-3 text-[16px] leading-relaxed text-white/90 outline-none md:min-h-[280px] md:px-4",
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

  // Fix handleDrop reference to editor - the initial handleDrop used wrong closure. Simplify: rely on effect paste + image button + drop via editorProps with editor from closure

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
        "studara-tiptap-root flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-white/10 bg-white/5 md:rounded-xl md:border",
        className
      )}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <NoteEditorToolbar editor={editor} noteId={noteId} />
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />
    </div>
  );
}

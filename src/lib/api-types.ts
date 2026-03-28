export interface Category {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Note {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  content: string;
  pinned: boolean;
  tags: string[];
  /** Set when AI Improve has been used on this note. */
  improved_at?: string | null;
  /** Set when Summarize has been used on this note. */
  summarized_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApiError {
  error: string;
  code?: string;
}

export type StudySetKind = "flashcards" | "quiz" | "concept_map";

export interface StudySetSummary {
  id: string;
  title: string;
  kind: StudySetKind;
  created_at: string;
  item_count: number;
  /** Primary source note when the set was saved from a single note. */
  note_id?: string | null;
  /** All source note ids when the set was saved (single or multi). */
  note_ids?: string[];
}

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
  created_at?: string;
  updated_at?: string;
}

export interface ApiError {
  error: string;
  code?: string;
}

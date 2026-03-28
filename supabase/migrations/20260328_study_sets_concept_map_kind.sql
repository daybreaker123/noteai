-- Allow saved concept maps in study_sets (same table as flashcards / quizzes).
alter table public.study_sets drop constraint if exists study_sets_kind_check;
alter table public.study_sets add constraint study_sets_kind_check
  check (kind in ('flashcards', 'quiz', 'concept_map'));

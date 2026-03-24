export type EssayAnnotationIssueType = "grammar" | "spelling" | "clarity" | "structure" | "word_choice";

export type EssayAnnotationRaw = {
  text: string;
  type: EssayAnnotationIssueType;
  suggestion: string;
};

/** API / client payload */
export type EssayAnnotation = EssayAnnotationRaw;

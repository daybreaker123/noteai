export type QuizQuestionPublic = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

/**
 * HTML fragments for new notes (Tiptap: headings, lists, tables, task lists).
 */

export type NoteTemplateId =
  | "cornell"
  | "lecture"
  | "lab"
  | "book"
  | "meeting"
  | "essay"
  | "studyPlan"
  | "problemSet";

export const NOTE_TEMPLATE_ORDER: NoteTemplateId[] = [
  "cornell",
  "lecture",
  "lab",
  "book",
  "meeting",
  "essay",
  "studyPlan",
  "problemSet",
];

const NOTE_TITLES: Record<NoteTemplateId, string> = {
  cornell: "Cornell notes",
  lecture: "Lecture notes",
  lab: "Lab report",
  book: "Book summary",
  meeting: "Meeting notes",
  essay: "Essay outline",
  studyPlan: "Study plan",
  problemSet: "Problem set",
};

export const NOTE_TEMPLATE_LABELS: Record<NoteTemplateId, { name: string; description: string }> = {
  cornell: {
    name: "Cornell Notes",
    description: "Cues on the left, notes on the right, summary below.",
  },
  lecture: {
    name: "Lecture Notes",
    description: "Date, subject, professor, key points, questions, summary.",
  },
  lab: {
    name: "Lab Report",
    description: "Hypothesis through conclusion in clear sections.",
  },
  book: {
    name: "Book Summary",
    description: "Themes, quotes, and your personal takeaways.",
  },
  meeting: {
    name: "Meeting Notes",
    description: "Attendees, agenda, discussion, and action items.",
  },
  essay: {
    name: "Essay Outline",
    description: "Thesis, intro, three body paragraphs, conclusion.",
  },
  studyPlan: {
    name: "Study Plan",
    description: "Goals, resources, schedule, and completion checkboxes.",
  },
  problemSet: {
    name: "Problem Set",
    description: "Given info, work, solution, and verification check.",
  },
};

export function noteTemplateDefaultTitle(id: NoteTemplateId): string {
  return NOTE_TITLES[id];
}

function em(text: string): string {
  return `<p><em>${text}</em></p>`;
}

function taskItemP(placeholder: string): string {
  return `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><em>${placeholder}</em></p></div></li>`;
}

export function noteTemplateHtml(id: NoteTemplateId): string {
  switch (id) {
    case "cornell":
      return [
        "<h2>Cornell notes</h2>",
        "<table>",
        "<tbody>",
        "<tr>",
        "<th><p>Cues</p></th>",
        "<th><p>Notes</p></th>",
        "</tr>",
        "<tr>",
        "<td>" + em("Keywords, questions, and reminders…") + "</td>",
        "<td>" + em("Main notes, diagrams, and details…") + "</td>",
        "</tr>",
        "</tbody>",
        "</table>",
        "<h3>Summary</h3>",
        em("After class, summarize the main ideas in your own words…"),
      ].join("");

    case "lecture":
      return [
        "<h2>Lecture notes</h2>",
        "<p><strong>Date:</strong> <em>Month DD, YYYY</em></p>",
        "<p><strong>Subject:</strong> <em>Course or topic</em></p>",
        "<p><strong>Professor:</strong> <em>Name</em></p>",
        "<h3>Key points</h3>",
        "<ul>",
        "<li><em>Main idea or definition…</em></li>",
        "<li><em>Example or illustration…</em></li>",
        "<li><em>Another important concept…</em></li>",
        "</ul>",
        "<h3>Questions</h3>",
        "<ul>",
        "<li><em>Something to clarify or research…</em></li>",
        "</ul>",
        "<h3>Summary</h3>",
        em("Brief recap of what was covered…"),
      ].join("");

    case "lab":
      return [
        "<h2>Lab report</h2>",
        "<h3>Title</h3>",
        em("Experiment or activity name"),
        "<h3>Hypothesis</h3>",
        em("What you expect to happen and why…"),
        "<h3>Materials</h3>",
        em("Equipment, chemicals, or tools used…"),
        "<h3>Procedure</h3>",
        em("Step-by-step what you did…"),
        "<h3>Results</h3>",
        em("Observations, data, tables, or graphs…"),
        "<h3>Conclusion</h3>",
        em("Was the hypothesis supported? What did you learn?"),
      ].join("");

    case "book":
      return [
        "<h2>Book summary</h2>",
        "<p><strong>Title:</strong> <em>Book title</em></p>",
        "<p><strong>Author:</strong> <em>Author name</em></p>",
        "<h3>Main themes</h3>",
        "<ul>",
        "<li><em>Central theme or argument…</em></li>",
        "<li><em>Another recurring idea…</em></li>",
        "</ul>",
        "<h3>Key quotes</h3>",
        "<blockquote><p><em>“Memorable quote from the text…”</em></p></blockquote>",
        "<h3>Personal takeaways</h3>",
        em("How this connects to you or what you’ll remember…"),
      ].join("");

    case "meeting":
      return [
        "<h2>Meeting notes</h2>",
        "<p><strong>Date:</strong> <em>Month DD, YYYY</em></p>",
        "<p><strong>Attendees:</strong> <em>Names or teams</em></p>",
        "<h3>Agenda</h3>",
        "<ul>",
        "<li><em>Topic one…</em></li>",
        "<li><em>Topic two…</em></li>",
        "</ul>",
        "<h3>Discussion points</h3>",
        em("Decisions, ideas, and notes from the conversation…"),
        "<h3>Action items</h3>",
        "<ul>",
        "<li><em>Owner — task — due date…</em></li>",
        "<li><em>…</em></li>",
        "</ul>",
      ].join("");

    case "essay":
      return [
        "<h2>Essay outline</h2>",
        "<h3>Thesis</h3>",
        em("One sentence: your main argument…"),
        "<h3>Introduction</h3>",
        "<ul>",
        "<li><em>Hook or context…</em></li>",
        "<li><em>Background the reader needs…</em></li>",
        "<li><em>Preview of main points…</em></li>",
        "</ul>",
        "<h3>Body — paragraph 1</h3>",
        "<ul>",
        "<li><em>Topic sentence…</em></li>",
        "<li><em>Evidence or example…</em></li>",
        "<li><em>How it supports the thesis…</em></li>",
        "</ul>",
        "<h3>Body — paragraph 2</h3>",
        "<ul>",
        "<li><em>Topic sentence…</em></li>",
        "<li><em>Evidence or example…</em></li>",
        "<li><em>How it supports the thesis…</em></li>",
        "</ul>",
        "<h3>Body — paragraph 3</h3>",
        "<ul>",
        "<li><em>Topic sentence…</em></li>",
        "<li><em>Evidence or example…</em></li>",
        "<li><em>How it supports the thesis…</em></li>",
        "</ul>",
        "<h3>Conclusion</h3>",
        "<ul>",
        "<li><em>Restate thesis in new words…</em></li>",
        "<li><em>Synthesis or broader takeaway…</em></li>",
        "</ul>",
      ].join("");

    case "studyPlan":
      return [
        "<h2>Study plan</h2>",
        "<h3>Topic</h3>",
        em("What you’re studying for…"),
        "<h3>Goals</h3>",
        "<ul>",
        "<li><em>Specific outcome you want…</em></li>",
        "<li><em>Another milestone…</em></li>",
        "</ul>",
        "<h3>Resources</h3>",
        "<ul>",
        "<li><em>Textbook chapters, videos, notes…</em></li>",
        "</ul>",
        "<h3>Schedule</h3>",
        '<ul data-type="taskList">',
        taskItemP("Session 1 — date / time — focus area"),
        taskItemP("Session 2 — date / time — focus area"),
        taskItemP("Session 3 — date / time — review & practice"),
        "</ul>",
      ].join("");

    case "problemSet":
      return [
        "<h2>Problem set</h2>",
        "<h3>Problem</h3>",
        em("Restate the question in your own words…"),
        "<h3>Given information</h3>",
        em("List known values, constraints, and assumptions…"),
        "<h3>Work shown</h3>",
        em("Equations, diagrams, and intermediate steps…"),
        "<h3>Solution</h3>",
        em("Final answer with units and reasoning…"),
        "<h3>Check</h3>",
        '<ul data-type="taskList">',
        taskItemP("Verify the solution (units, limiting cases, or substitution)"),
        "</ul>",
      ].join("");

    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

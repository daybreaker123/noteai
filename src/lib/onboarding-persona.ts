/**
 * Guided first-time onboarding: persona labels and sample note HTML (Tiptap-compatible).
 */

export const ONBOARDING_PERSONAS = ["high_school", "university", "graduate", "lifelong"] as const;
export type OnboardingPersona = (typeof ONBOARDING_PERSONAS)[number];

export function isOnboardingPersona(v: string): v is OnboardingPersona {
  return (ONBOARDING_PERSONAS as readonly string[]).includes(v);
}

export const ONBOARDING_PERSONA_LABELS: Record<OnboardingPersona, string> = {
  high_school: "High School Student",
  university: "University Student",
  graduate: "Graduate Student",
  lifelong: "Lifelong Learner",
};

function sampleHighSchool(): { title: string; html: string } {
  return {
    title: "Algebra II — quadratic functions",
    html: `<h2>Algebra II — Oct 14</h2>
<p><strong>Teacher:</strong> Ms. Rivera</p>
<h3>Topic</h3>
<p>Graphing <em>y = ax² + bx + c</em> and finding the vertex.</p>
<h3>Key ideas</h3>
<ul>
<li><strong>Vertex form:</strong> <em>y = a(x − h)² + k</em> with vertex <em>(h, k)</em>.</li>
<li>If <em>a &gt; 0</em>, parabola opens up; if <em>a &lt; 0</em>, opens down.</li>
<li>Axis of symmetry: <em>x = h</em> (or <em>x = −b/(2a)</em> in standard form).</li>
</ul>
<h3>Example we did in class</h3>
<p><em>For y = 2x² − 8x + 5, complete the square or use x = −b/(2a) to find the vertex…</em></p>
<h3>Homework</h3>
<p><em>Problems 12–20 — sketch each parabola and label vertex.</em></p>`,
  };
}

function sampleUniversity(): { title: string; html: string } {
  return {
    title: "BIO 201 — Cellular respiration",
    html: `<h2>BIO 201: Introductory Biology</h2>
<p><strong>Date:</strong> <em>Tuesday, Week 6</em> · <strong>Professor:</strong> <em>Dr. Chen</em></p>
<h3>Today's lecture: cellular respiration</h3>
<ul>
<li><strong>Glycolysis</strong> — cytoplasm; splits glucose → 2 pyruvate; net 2 ATP, 2 NADH.</li>
<li><strong>Pyruvate oxidation &amp; Krebs cycle</strong> — mitochondria; produces NADH, FADH₂, CO₂, small ATP.</li>
<li><strong>Electron transport chain (ETC)</strong> — inner mitochondrial membrane; uses NADH/FADH₂ to pump protons; ~26–28 ATP via chemiosmosis.</li>
</ul>
<h3>Exam-style takeaway</h3>
<p><em>Be able to compare aerobic vs anaerobic paths and where O₂ is used (as final electron acceptor in ETC).</em></p>
<h3>Questions for office hours</h3>
<p><em>Why does cyanide poisoning shut down ATP production? (Hint: ETC.)</em></p>`,
  };
}

function sampleGraduate(): { title: string; html: string } {
  return {
    title: "Methods meeting — thesis chapter 3",
    html: `<h2>Grad seminar notes</h2>
<p><strong>Date:</strong> <em>Mar 3</em> · <strong>Advisor:</strong> <em>Prof. Okonkwo</em></p>
<h3>Agenda</h3>
<ul>
<li>Finalize sampling frame for survey wave 2.</li>
<li>Pre-registration checklist for the experiment.</li>
</ul>
<h3>Decisions</h3>
<p><em>Use stratified random sample by region; IRB amendment submitted for one extra instrument item.</em></p>
<h3>Next steps</h3>
<ul>
<li><em>Clean pilot data by Friday.</em></li>
<li><em>Draft methods subsection on power analysis.</em></li>
</ul>`,
  };
}

function sampleLifelong(): { title: string; html: string } {
  return {
    title: "Learning log — climate & oceans",
    html: `<h2>Self-study session</h2>
<p><strong>Resource:</strong> <em>Open course + NOAA primer</em></p>
<h3>What I learned</h3>
<ul>
<li><em>Thermal expansion + ice melt both contribute to sea-level rise.</em></li>
<li><em>Gulf Stream moves heat north; slowdown could shift regional climates.</em></li>
</ul>
<h3>Vocab</h3>
<p><em>Albedo, thermohaline circulation, feedback loops…</em></p>
<h3>Apply</h3>
<p><em>How would I explain to a friend why “more snow in one winter” doesn’t disprove long-term warming?</em></p>`,
  };
}

export function getOnboardingSampleNote(persona: OnboardingPersona): { title: string; html: string } {
  switch (persona) {
    case "high_school":
      return sampleHighSchool();
    case "university":
      return sampleUniversity();
    case "graduate":
      return sampleGraduate();
    case "lifelong":
      return sampleLifelong();
    default: {
      const _x: never = persona;
      return _x;
    }
  }
}

/** If the Improve API fails during onboarding, swap in this HTML so the flow can continue. */
export function getOnboardingImprovedFallbackHtml(persona: OnboardingPersona): string {
  const s = getOnboardingSampleNote(persona);
  switch (persona) {
    case "university":
      return `${s.html}
<h3>AI-added summary</h3>
<p><strong>Big picture:</strong> Cellular respiration breaks down fuel (e.g. glucose) to capture energy in ATP. Glycolysis yields a small amount of ATP and electron carriers; the mitochondria complete the job via the Krebs cycle and ETC, using oxygen as the terminal electron acceptor.</p>
<p><strong>Study tip:</strong> Draw one diagram with glucose → pyruvate → acetyl-CoA → Krebs → NADH/FADH₂ → ETC → ATP + H₂O and label where CO₂ is released.</p>`;
    case "high_school":
      return `${s.html}
<h3>AI-added summary</h3>
<p><strong>Vertex recap:</strong> The vertex is the turning point of the parabola. In vertex form <em>y = a(x − h)² + k</em>, it is <em>(h, k)</em>. In standard form, the axis of symmetry is <em>x = −b/(2a)</em>; substitute back to find <em>y</em> at the vertex.</p>`;
    case "graduate":
      return `${s.html}
<h3>AI-added clarity</h3>
<p><strong>Methods thread:</strong> Tie every design choice to a threat to validity (selection, measurement, confounding). Note the IRB scope change explicitly in the methods section so reviewers see continuity with Wave 1.</p>`;
    case "lifelong":
      return `${s.html}
<h3>AI-added reflection</h3>
<p><strong>Explain simply:</strong> Weather is short-term; climate is long-term averages and trends. A cold spell is noise on top of a warming trend — like one bad day in a semester doesn’t define your GPA.</p>`;
    default: {
      const _x: never = persona;
      return _x;
    }
  }
}

export function getOnboardingDemoFlashcards(
  persona: OnboardingPersona
): { front: string; back: string }[] {
  switch (persona) {
    case "university":
      return [
        {
          front: "Where does glycolysis occur?",
          back: "In the cytoplasm — it does not require oxygen.",
        },
        {
          front: "What is the main role of the electron transport chain?",
          back: "It uses energy from electrons to pump protons and drive ATP synthase (chemiosmosis).",
        },
        {
          front: "Why do we say O₂ is the final electron acceptor?",
          back: "Oxygen pulls electrons through the chain; without it, the chain backs up and aerobic ATP yield collapses.",
        },
        {
          front: "Roughly how much ATP from one glucose (aerobic)?",
          back: "About 30–32 ATP depending on shuttle systems — most comes from the ETC, not glycolysis alone.",
        },
      ];
    case "high_school":
      return [
        { front: "Vertex form of a parabola?", back: "y = a(x − h)² + k with vertex (h, k)." },
        { front: "Axis of symmetry from standard form?", back: "x = −b/(2a) for y = ax² + bx + c." },
        { front: "If a < 0, which way does the parabola open?", back: "Downward." },
      ];
    case "graduate":
      return [
        { front: "Why stratify the sample?", back: "To ensure representation across regions and reduce variance in key estimates." },
        { front: "What triggers an IRB amendment?", back: "Material changes to risks, procedures, or data collected." },
      ];
    case "lifelong":
      return [
        { front: "Weather vs climate?", back: "Weather is short-term; climate is long-term patterns and averages." },
        { front: "One cause of sea-level rise?", back: "Thermal expansion of water and melting land ice." },
      ];
    default: {
      const _x: never = persona;
      return _x;
    }
  }
}

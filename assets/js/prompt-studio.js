/* ====================================================================
   prompt-studio.js — HMG CBT Pro AI Question Prompt Studio Engine
   ====================================================================
   Rule-based prompt engineering for question generation — NO AI API is
   called or needed (cost-effective by design). The studio composes a
   fully-structured prompt that a teacher pastes into any FREE AI chat
   (ChatGPT, Claude, Gemini, DeepSeek); the AI returns a strict CSV/JSON
   file that imports directly into the Teacher Hub question bank.

   ORGANIZATION (mirrors the School Connect Prompt Studio, adapted and
   extended for this platform's 20 question types):
     • HEADER               — the one and only CSV contract (17 columns)
     • EXPLANATION_STANDARD — the universal 4-move marking-scheme rule
                              injected into EVERY generated prompt
     • RULES                — per-question-type column rules
     • PACKS                — 24 tailored packs; each is a DIFFERENT
                              prompt: its own role, mission, scaled type
                              distribution, briefing sections, quality bar
                              and final checklist. Only the CSV OUTPUT
                              CONTRACT is shared — it must stay
                              character-identical across packs or files
                              stop importing.
     • mix()                — scales a pack's reference type distribution
                              to EXACTLY the requested question count
     • build()              — assembles the final prompt text
     • NEEDS                — which packs require extra form fields
                              (source material, subject list, board…)
     • STATIC               — one-click classic prompts (quick cards)

   The 20 supported question types (matching assets/js/cbt-types.js):
     mcq, multi_select, true_false, short_answer, numeric, multi_numeric,
     cloze, matching, ordering, categorization, matrix, hot_text,
     assertion_reason, case_study, image_based, hotspot, essay, code
   ==================================================================== */
const PromptStudio = {

  HEADER: 'Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section',

  JSON_SHAPE: [
    '{',
    '  "Question": "text (use <br> for line breaks, LaTeX inside $...$)",',
    '  "A": "option A", "B": "option B", "C": "…", "D": "…",',
    '  "CorrectAnswer": "C"  | "A,C" (multi_select) | "42.5" (numeric) | "True" | "short exact text" | "essay" ,',
    '  "Explanation": "marking-scheme explanation (4 moves, see standard)",',
    '  "Type": "one of the 20 types",',
    '  "Tolerance": "0.05", "Unit": "m/s", "Accept": "synonym1|synonym2",',
    '  "MRQ_AON": "false",',
    '  "Pairs": "[{\\"l\\":\\"left\\",\\"r\\":\\"right\\"}]",',
    '  "Items": "[{\\"assertion\\":\\"…\\",\\"reason\\":\\"…\\"}]",',
    '  "Difficulty": "easy|medium|hard",',
    '  "Tags": "topic,sub-topic",',
    '  "Section": "subject name"',
    '}'
  ].join('\n'),

  /* =====================================================================
     THE UNIVERSAL EXPLANATION STANDARD — injected into EVERY generated
     prompt ahead of the pack sections, so no pack can forget it and no
     pack can dilute it. "Be detailed" is advice a model ignores; "name
     the misconception behind each wrong option" is an instruction it can
     be graded against — and the FINAL CHECK grades it.
     ===================================================================== */
  EXPLANATION_STANDARD: [
    'Col7 (Explanation) is the single most valuable column in the file. It is',
    'the only teaching the student receives after the paper closes. Treat it as',
    'a marking-scheme entry written for a student sitting alone, not as a note',
    'to a colleague.',
    '',
    'EVERY row — every type, including numeric, matching, ordering and essay —',
    'must carry an explanation with these FOUR MOVES, in this order:',
    '',
    '  MOVE 1 — VERDICT. State the correct answer in full words, not just a',
    '           letter. Write "The correct answer is 3/4, option C" and never',
    '           "C" or "Option C is correct". The letter may have moved: this',
    '           platform can randomise option order per candidate, so a review',
    '           sheet that only says "B" is meaningless to the student reading it.',
    '',
    '  MOVE 2 — REASONING. Show HOW the answer is reached, step by numbered',
    '           step. For calculations, every line of working, with the rule or',
    '           formula named at the step where it is used ("multiply both sides',
    '           by the LCM, 6"). For language items, quote the exact words from',
    '           the passage or option that decide it.',
    '',
    '  MOVE 3 — MISCONCEPTIONS. Name the wrong option(s) that carry a real',
    '           misconception, and say what the student who picks that option',
    '           is probably thinking: "A student who chooses B has subtracted',
    '           before multiplying — BIDMAS applied in the wrong order."',
    '',
    '  MOVE 4 — TAKEAWAY. One closing line the student can memorise: "Rule:',
    '           the discriminant b²-4ac decides the number of real roots."',
    '',
    'An explanation that fails any move is a rejected row. Never write',
    '"Explanation: see textbook" or leave Col7 blank.'
  ].join('\n'),

  /* =====================================================================
     PER-TYPE COLUMN RULES — only the ones a pack uses are injected.
     ===================================================================== */
  RULES: {
    mcq: 'MCQ (Col8 "mcq")\n' +
      '  • Cols 2-5 (A-D): exactly 4 options, all plausible, similar length.\n' +
      '  • Col6: exactly one of A, B, C, D.\n' +
      '  • The longest option must not always be the answer. No "All of the\n' +
      '    above", no "None of the above", no joke options.',

    multi_select: 'MULTI-SELECT / MRQ (Col8 "multi_select")\n' +
      '  • Cols 2-5: 4 options; between 2 and 3 are correct — never 1, never 4.\n' +
      '  • Col6: comma-separated letters, ascending, e.g. "A,C".\n' +
      '  • Col12 (MRQ_AON): "false" for partial credit (default) or "true" for\n' +
      '    all-or-nothing marking. State which in the prompt distribution.',

    true_false: 'TRUE / FALSE (Col8 "true_false")\n' +
      '  • Col2 "True", Col3 "False", Cols 4-5 empty.\n' +
      '  • Col6: "True" or "False" (the word, not T/F).\n' +
      '  • Only statements that are unambiguously true or false — no "sometimes".',

    short_answer: 'SHORT ANSWER (Col8 "short_answer")\n' +
      '  • Col6: the ONE exact expected answer, shortest correct form.\n' +
      '  • Col11 (Accept): pipe-separated acceptable synonyms/variants,\n' +
      '    e.g. "photosynthesis|photosynthesis reaction". Case-insensitive.',

    numeric: 'NUMERIC (Col8 "numeric")\n' +
      '  • Col6: the exact numeric answer, no units, no commas (write 2500000,\n' +
      '    not 2,500,000 and not 2.5m).\n' +
      '  • Col9 (Tolerance): numeric margin, e.g. "0.05" — marking accepts\n' +
      '    answers within ± tolerance. Use "0" for exact integers.\n' +
      '  • Col10 (Unit): the unit symbol the candidate sees (m/s, kg, ₦, °C).\n' +
      '    The candidate types a number only.',

    multi_numeric: 'MULTI-PART NUMERIC (Col8 "multi_numeric")\n' +
      '  • Col14 (Items): JSON array of parts, e.g.\n' +
      '    "[{\\"label\\":\\"a) Speed\\",\\"answer\\":\\"12.5\\",\\"unit\\":\\"m/s\\",\\"tolerance\\":\\"0.1\\"},\n' +
      '     {\\"label\\":\\"b) Acceleration\\",\\"answer\\":\\"2.5\\",\\"unit\\":\\"m/s²\\",\\"tolerance\\":\\"0.1\\"}]"\n' +
      '  • Inner double quotes doubled (\\"…\\") inside the CSV cell, whole cell\n' +
      '    wrapped in outer double quotes.\n' +
      '  • Col6: comma-joined part answers in order, e.g. "12.5,2.5".',

    cloze: 'FILL THE GAPS / CLOZE (Col8 "cloze")\n' +
      '  • Col1: the sentence with each gap as {{1}}, {{2}}, …\n' +
      '  • Col14 (Items): JSON array of gap answers in order:\n' +
      '    "[{\\"blank\\":1,\\"answer\\":\"osmosis\\"},{\\"blank\\":2,\\"answer\\":\\"semi-permeable\\"}]"\n' +
      '  • Col6: comma-joined answers in order.',

    matching: 'MATCHING PAIRS (Col8 "matching")\n' +
      '  • Col13 (Pairs): JSON array [{"l":"left item","r":"right item"}, …]\n' +
      '    with 4-6 pairs. Left column is the prompt side; right column is\n' +
      '    shuffled for the candidate.',

    ordering: 'PUT IN ORDER (Col8 "ordering")\n' +
      '  • Col14 (Items): JSON array in the CORRECT order:\n' +
      '    "[\\"Evaporation\\",\\"Condensation\\",\\"Precipitation\\",\\"Collection\\"]"\n' +
      '  • The candidate sees these shuffled and drags them into order.',

    categorization: 'SORT INTO GROUPS (Col8 "categorization")\n' +
      '  • Col13 (Pairs): each pair {"l":"item","r":"group name"}.\n' +
      '  • Use 2-4 groups, 6-12 items total. Group names go in the "r" values.',

    matrix: 'GRID / MATRIX (Col8 "matrix")\n' +
      '  • Col14 (Items): JSON with "rows", "cols" and "cells":\n' +
      '    "[{\\"rows\\":[\\"Lagos\\"],\\"cols\\":[\\"Population > 10m?\\"],\\"cells\\":[[\\"Yes\\"]]}]"\n' +
      '  • Cells hold Yes/No or short answers.',

    hot_text: 'TAP THE RIGHT PARTS (Col8 "hot_text")\n' +
      '  • Col1: a sentence or paragraph; wrap each tappable correct span in\n' +
      '    [[double square brackets]].\n' +
      '  • Col6: the correct spans in order, comma-separated.',

    assertion_reason: 'ASSERTION & REASON (Col8 "assertion_reason")\n' +
      '  • Col14 (Items): JSON {"assertion":"…","reason":"…"}.\n' +
      '  • Cols 2-5: the five standard options, exactly:\n' +
      '    A "Both Assertion and Reason are true, and the Reason correctly\n' + '    explains the Assertion"\n' +
      '    B "Both are true, but the Reason does NOT correctly explain the\n' + '    Assertion"\n' +
      '    C "The Assertion is true, the Reason is false"\n' +
      '    D "The Assertion is false, the Reason is true"\n' +
      '    E (leave blank — the platform renders 4 options; map to A-D)\n' +
      '  • Col6: A, B, C or D.',

    case_study: 'PASSAGE / CASE STUDY (Col8 "case_study")\n' +
      '  • Col14 (Items): JSON {"passage":"the full passage text with \\n for\n' +
      '    paragraphs"} followed by the question in Col1.\n' +
      '  • When several questions share ONE passage, repeat the same passage\n' +
      '    JSON in each row (the platform pins it once for the candidate).\n' +
      '  • Line breaks inside cells: use \\n escape, never raw newlines.',

    image_based: 'IMAGE QUESTION (Col8 "image_based")\n' +
      '  • Col14 (Items): JSON {"image":"https://…public URL of the diagram"}\n' +
      '    or {"image_text":"ASCII/text diagram"}. The platform renders the\n' +
      '    image above the question. Public https links only.',

    range: 'RANGE / ESTIMATION (Col8 "range")\n' +
      '  • Col6: the accepted interval as min-max, e.g. 15-25.\n' +
      '  • Any value inside the interval (inclusive) earns the mark — ideal for\n' +
      '    estimation questions where several answers are defensible.\n' +
      '  • Alternatively Col14 Items: {"min":15,"max":25}.\n' +
      '  • The question text should make the expected precision clear ("to the\n' +
      '    nearest ten", "within 5%").',

    evidence_mcq: 'EVIDENCE-BASED MCQ (Col8 "evidence_mcq")\n' +
      '  • Col14 Items: {"part1":{"question":"...","options":["...","...","...","..."],' +
      '"answer":"exact option text"},"part2":{"question":"Which choice provides the best ' +
      'evidence for the answer to Part A?","options":[...],"answer":"exact option text"}}\n' +
      '  • Part B options must be quotable lines from the passage/material.\n' +
      '  • Both parts right = full mark; one part right = half mark.\n' +
      '  • Cols 2-5 stay empty for this type — the options live in the JSON.',

    hotspot: 'HOTSPOT / LABEL THE DIAGRAM (Col8 "hotspot")\n' +
      '  • Col14 (Items): JSON {"image":"https://…",\n' +
      '    "targets":[{"label":"A","x":20,"y":35},{"label":"B","x":60,"y":70}]}\n' +
      '    with x,y as percentages of the image size.\n' +
      '  • Col6: comma-separated correct labels in click order.',

    essay: 'ESSAY / STRUCTURED (Col8 "essay")\n' +
      '  • Col6: the word "essay".\n' +
      '  • Col14 (Items): JSON {"min_words":150,"max_words":300,\n' +
      '    "guide":["point 1 expected","point 2 expected"]} — the guide is the\n' +
      '    marking scheme shown to the teacher, not the student.\n' +
      '  • Col7 must carry a FULL model answer, not just key points.',

    code: 'CODE / SQL (Col8 "code")\n' +
      '  • Col1: the task, with any starter code inside <pre><code>…</code></pre>.\n' +
      '  • Col6: the exact expected output OR the canonical solution as a\n' +
      '    single-line string (\\n for newlines).\n' +
      '  • Col14 (Items): JSON {"language":"python","mode":"output"} or\n' +
      '    {"language":"sql","mode":"query"}.'
  },

  /* =====================================================================
     THE PACK LIBRARY — 24 tailored packs.
     ref = reference type distribution scaled to the requested count.
     ===================================================================== */
  PACKS: {
    simple: {
      label: 'Simple recall — confidence builder',
      role: 'a patient Nigerian classroom teacher who writes clear, confidence-building questions for learners still finding their feet',
      mission: 'Build fluency and confidence. This paper should reward a student who has done the reading, and never punish them for misreading a convoluted stem.',
      ref: { mcq: 14, true_false: 6 }, dominant: 'mcq',
      sections: [
        ['LANGUAGE', 'Use the shortest sentence that asks the question. No subordinate clauses.\nNo negatives ("which is NOT…"). No double negatives ever. A learner\nreading at two years below the nominal level should still understand the task.'],
        ['SCOPE', 'One idea per question. Never combine two skills in one item — if a\nstudent gets it wrong you must be able to say exactly which idea they missed.']
      ],
      quality: [
        'Every stem is under 25 words.',
        'Options are similar in length; the longest option is not always the answer.',
        'Explanations restate the rule in one plain sentence (plus the 4 moves).',
        'No trick questions of any kind.'
      ]
    },

    intermediate: {
      label: 'Intermediate — mixed skills paper',
      role: 'an experienced WAEC/NECO examiner who writes fair papers that separate genuine understanding from cramming',
      mission: 'Mix recall with application. A diligent student should pass comfortably; only a student who can APPLY the ideas should score above 70%.',
      ref: { mcq: 10, true_false: 4, short_answer: 3, numeric: 3 }, dominant: 'mcq',
      sections: [
        ['BALANCE', 'Roughly half recall, half application. Application items must set a\nshort scenario ("A trader buys 3 dozen eggs at ₦…") before asking the\nquestion — the scenario is where the thinking happens.'],
        ['LOCALISATION', 'Where a context helps, use Nigerian names, markets, Naira, Lagos/Kano\nrivers, WAEC-style phrasing. Never force it where it distorts the item.']
      ],
      quality: [
        'Numeric answers are clean (no rounding arguments); tolerance set honestly.',
        'Each short_answer has at least 2 accepted synonyms in Col11.',
        'Distractors come from real student errors, not random text.',
        'Explanations show every line of working for calculation items.'
      ]
    },

    advanced: {
      label: 'Advanced — high-order thinking (HOTS)',
      role: 'a university admissions examiner who writes questions that reward analysis, synthesis and evaluation, never memory alone',
      mission: 'Every item should force a judgement: compare, predict, diagnose a flaw, or transfer a rule to an unfamiliar context. A student who only memorised the notes should score under 40%.',
      ref: { mcq: 8, multi_select: 4, numeric: 3, assertion_reason: 3, case_study: 2 }, dominant: 'mcq',
      sections: [
        ['COGNITIVE FLOOR', 'Ban pure-recall stems. Every stem must contain a twist: an unfamiliar\ncontext, a comparison, an error to diagnose, or a prediction to justify.'],
        ['DISTRACTOR CRAFT', 'Each wrong option must be defensible-looking and traceable to a specific\nmisunderstanding you can name in Col7 Move 3.']
      ],
      quality: [
        'At least 2 items are multi-step (two concepts chained together).',
        'Assertion_reason items use genuine causal reasons, not trivia pairs.',
        'Case study passages are 80-150 words, self-contained.',
        'No item can be answered from general knowledge alone.'
      ]
    },

    enterprise: {
      label: 'ENTERPRISE CBT PRO — all 20 question types',
      role: 'the chief examiner of an enterprise computer-based testing programme, fluent in every modern CBT item format',
      mission: 'Produce a showcase paper that exercises EVERY interaction format this platform supports, so stakeholders see the full engine on one paper.',
      ref: { mcq: 6, multi_select: 3, true_false: 3, short_answer: 3, numeric: 3, range: 2, multi_numeric: 2, cloze: 2, matching: 2, ordering: 2, categorization: 2, matrix: 1, hot_text: 1, assertion_reason: 2, case_study: 2, image_based: 1, hotspot: 1, evidence_mcq: 1, essay: 1, code: 1 }, dominant: 'mcq', minOne: true,
      sections: [
        ['FORMAT TOUR', 'Every one of the 20 types appears at least once (the distribution below\nis scaled to the requested count and guarantees this when count ≥ 20).'],
        ['JSON CELLS', 'Cols 13/14 carry JSON. In CSV every inner double quote is doubled ("")\nand the whole cell is wrapped in double quotes. Test one cell mentally\nbefore writing the file.']
      ],
      quality: [
        'JSON cells parse cleanly (validate mentally: quotes doubled, brackets balanced).',
        'Each type is used where it is the BEST format for that content, not for variety alone.',
        'Image questions use public https links or clean ASCII diagrams.',
        'The essay item carries a full model answer in Col7.'
      ]
    },

    auto_graded: {
      label: '🎯 Auto-Graded Ultimate Pack (every auto-marked type)',
      role: 'an assessment architect building a reference paper that demonstrates ALL auto-graded question formats this platform supports',
      mission: 'Exercise the FULL range of auto-graded question types with 100% automated scoring. Do NOT use any type that needs teacher review (no essay, no code, no file uploads). Every mark on this paper is awarded by the engine the moment the candidate submits.',
      ref: { mcq: 3, true_false: 2, multi_select: 2, short_answer: 2, numeric: 2, range: 2, multi_numeric: 2, cloze: 2, matching: 2, ordering: 2, categorization: 2, matrix: 2, hot_text: 2, assertion_reason: 2, case_study: 2, image_based: 2, hotspot: 2, evidence_mcq: 2 },
      dominant: 'mcq', minOne: true,
      sections: [
        ['COVERAGE — EVERY AUTO-GRADED TYPE MUST SURVIVE', 'The distribution below guarantees at least one item of every auto-graded\ntype even at small counts. Strictly EXCLUDE essay, code and any manual-\nreview type. Do not silently drop a type because it is harder to write.'],
        ['SELF-DOCUMENTING', 'Because teachers read this paper to learn the formats, each Explanation\nshould also note in one clause why that TYPE suited that question.'],
        ['JSON CELLS', 'Structured types live in Col13 (Pairs) and Col14 (Items) as JSON with every\ninner double quote doubled (\"). One malformed JSON cell breaks the import\nof the whole row — validate each one mentally before moving on.']
      ],
      quality: [
        'All 18 auto-graded types present; strictly NO essay, NO code, NO manual-review types.',
        'Every JSON cell parses after un-doubling the quotes.',
        'Partial-credit types (matching, ordering, cloze, matrix, multi_numeric) have at least 3 rows/parts each so partial credit is meaningful.',
        'The paper still reads as a coherent assessment, not a format catalogue.'
      ]
    },

    material_upload: {
      label: '📄 Uploaded Material CBT (paste/attach a document)',
      role: 'an expert professional, seasoned educator and experienced world-class examiner creating a rigorous auto-graded assessment strictly from the provided document material',
      mission: 'Generate a comprehensive CBT strictly based on the material the teacher pastes or attaches into the chat. ONLY use facts found in the document — no external knowledge. Exclude any type requiring teacher review (no essay). Prepare students to local, national and international examination standards.',
      ref: { mcq: 5, true_false: 2, multi_select: 2, short_answer: 2, numeric: 2, matching: 2, ordering: 2, cloze: 2, categorization: 2, matrix: 2, hot_text: 2, assertion_reason: 2, case_study: 2 },
      dominant: 'mcq',
      sections: [
        ['SOURCE ADHERENCE', 'Every single question MUST be derivable directly from the uploaded/pasted\nmaterial. No hallucinated facts, no outside syllabus content. If the\nmaterial does not support the requested count, say so and produce fewer\nrather than inventing.'],
        ['TARGETED EXTRACTION', 'Focus entirely on the pages, chapters or sections the teacher names:\n{{SOURCE}}'],
        ['EXAMINATION RIGOR', 'Design questions that test critical thinking, analysis and application of\nthe text — not just line-by-line recall — matching world-class standards.']
      ],
      quality: [
        'No hallucinated information; every answer is verifiable against the text.',
        'Strictly auto-graded types only.',
        'Question difficulty spans recall, application and analysis of the material.'
      ]
    },

    material_link: {
      label: '🔗 Linked Material CBT (questions strictly from a URL)',
      role: 'an expert professional, seasoned educator and experienced world-class examiner creating a rigorous auto-graded assessment strictly from the material at the provided link(s)',
      mission: 'Analyse the material at the provided URL(s) and generate a comprehensive CBT strictly based on it. ONLY use facts found in the linked material. Exclude any type requiring teacher review. If you cannot open links, say so in ONE line and ask the teacher to paste the text, then continue from the pasted text.',
      ref: { mcq: 5, true_false: 2, multi_select: 2, short_answer: 2, numeric: 2, matching: 2, ordering: 2, cloze: 2, categorization: 2, matrix: 2, hot_text: 2, assertion_reason: 2, case_study: 2 },
      dominant: 'mcq',
      sections: [
        ['THE LINKED MATERIAL', 'The material is at this link (public https / Drive / web):\n{{SOURCE}}\nThis platform stores LINKS ONLY — never uploads — to protect free quotas.'],
        ['SOURCE ADHERENCE', 'Every single question MUST be derivable directly from the linked material.\nNo external facts. Reference specific sections, figures and arguments FROM\nthe material so only a student who read it can answer.'],
        ['EXAMINATION RIGOR', 'Design questions that test critical thinking, analysis and application of\nthe text, matching world-class standards.']
      ],
      quality: [
        'No hallucinated information; stick perfectly to the linked text.',
        'Strictly auto-graded types only.',
        'Every item cites something specific in the linked material.'
      ]
    },

    dl_article: {
      label: '📚 Reading Comprehension — article / material link',
      role: 'a reading-comprehension specialist preparing a linked-article assignment: the reading link plus the comprehension quiz that proves it was read',
      mission: 'The student opens the LINK the teacher shares, reads the article, then answers the quiz. Every question must be answerable ONLY by someone who actually engaged with the linked material — not from general knowledge.',
      ref: { mcq: 10, true_false: 3, short_answer: 3, cloze: 2, essay: 2 }, dominant: 'mcq',
      sections: [
        ['THE LINKED MATERIAL', 'The reading is at this link (article / Drive material):\n{{SOURCE}}\nThis platform stores LINKS ONLY — never uploads. If you cannot open\nlinks, say so in ONE line and ask the teacher to paste the text; then\ncontinue from the pasted text.'],
        ['QUESTIONS MUST PROVE READING', 'Reference specific sections, figures, arguments and examples FROM the\nmaterial ("According to the third paragraph...", "The author\'s example of\n..."). A student who has not opened the link should not be able to guess.'],
        ['TEACHER SETUP NOTE (include as a comment in Col7 of row 1)', 'Remind the teacher: share the same link with students (assignment\ninstructions or the exam\'s intro text), then import this CSV on the\nTeacher Hub — Create Assessment → upload CSV — so the quiz marks itself\nand feeds the results report.']
      ],
      quality: [
        'Every item cites something specific in the linked material.',
        'The two essay items ask for the author\'s argument, not opinion.',
        'Cloze items quote sentences from the material with key terms gapped.'
      ]
    },

    dl_video: {
      label: '📚 Video Comprehension — video link',
      role: 'a media-literacy teacher preparing a linked-video assignment: the video link plus the comprehension quiz that proves it was watched',
      mission: 'The student opens the VIDEO LINK the teacher shares, watches it, then answers. Every question must be answerable only by someone who actually watched — anchored to moments, demonstrations and spoken claims in the video.',
      ref: { mcq: 10, true_false: 3, short_answer: 3, ordering: 2, essay: 2 }, dominant: 'mcq',
      sections: [
        ['THE LINKED VIDEO', 'The video is at this link (YouTube / Drive):\n{{SOURCE}}\nThis platform stores LINKS ONLY — never uploads. If you cannot open\nlinks, say so in ONE line and ask the teacher for the transcript or a\ndescription of the video; then continue from that.'],
        ['ANCHOR TO THE TIMELINE', 'Reference visible moments ("the demonstration at the start", "the second\nexperiment", "the final summary"). Use ordering items to sequence the\nsteps the video actually shows.'],
        ['TEACHER SETUP NOTE (include as a comment in Col7 of row 1)', 'Remind the teacher: share the same link with students (assignment\ninstructions or the exam\'s intro text), then import this CSV on the\nTeacher Hub — Create Assessment → upload CSV — so the quiz marks itself\nand feeds the results report.']
      ],
      quality: [
        'Every item is anchored to a specific moment or claim in the video.',
        'Ordering items sequence steps exactly as demonstrated.',
        'No item is answerable from the title alone.'
      ]
    },

    assignment: {
      label: '📝 Assignment brief + rubric (link-based)',
      role: 'a curriculum-aligned assignment designer writing a complete take-home task',
      mission: 'Produce a professional assignment BRIEF (not an exam): the task, the linked resources, the submission expectations and a transparent marking rubric a parent could read. Then a short self-check quiz the teacher may optionally import as a CBT.',
      ref: { essay: 3, short_answer: 4, mcq: 3 }, dominant: 'short_answer',
      sections: [
        ['PART 1 — THE ASSIGNMENT BRIEF (plain text, BEFORE the CSV)', 'Write these sections in clear student-facing language:\n  TITLE — one line.\n  TASK — exactly what to produce, in numbered steps.\n  RESOURCES — this link (Drive/web, LINKS ONLY, never uploads):\n  {{SOURCE}}\n  DELIVERABLE — what the student hands in and HOW (a link or physical\n  work handed to the teacher).\n  DUE — leave as [DUE DATE] for the teacher to fill.\n  RUBRIC — a marks table totalling [TOTAL MARKS]: criterion, what full marks\n  looks like, marks available. Plain language a parent could read.'],
        ['PART 2 — THE SELF-CHECK QUIZ (the CSV)', 'After the brief, output the CSV: a short self-check the student answers\nBEFORE submitting, testing that they understood the task and the resource.\nThe teacher may import it on the Teacher Hub as a low-stakes check.'],
        ['TEACHER SETUP NOTE (last line of the brief)', 'Remind the teacher: paste the brief into the exam\'s intro/instructions\nfield when creating the assessment from this CSV, and share the resource\nlink with students.']
      ],
      quality: [
        'The brief is complete enough to hand out without editing (except the due date).',
        'The rubric criteria add up to exactly the stated total marks.',
        'Every resource is a LINK — the brief never asks for a file upload.',
        'The self-check quiz tests understanding of the TASK and RESOURCE, not new content.'
      ]
    },

    mcq_only: {
      label: 'MCQ-only strict paper',
      role: 'a professional item writer for large-scale standardized MCQ testing',
      mission: 'A pure, clean 4-option MCQ paper that a scanner or any CBT engine could mark — no other formats at all.',
      ref: { mcq: 20 }, dominant: 'mcq',
      sections: [
        ['OPTIONS', 'Exactly 4 options per item. One unambiguously correct. Three plausible\ndistractors, each traceable to a named misconception. No "All/None of the\nabove". No sequential correct letters (avoid A,A,A).'],
        ['STEM RULE', 'The stem must be answerable without looking at the options (a "complete\nquestion"), unless it is a sentence-completion item.']
      ],
      quality: [
        'Correct answers are spread roughly evenly across A, B, C, D.',
        'No two items test the same fact.',
        'Every explanation names all three distractor misconceptions.'
      ]
    },

    multi_subject: {
      label: 'Multi-Subject paper (UTME / Common Entrance style)',
      role: 'a UTME item-bank supervisor producing coordinated multi-subject papers under one exam code',
      mission: 'One CSV file containing ALL subjects of a sitting, each with its own question count, difficulty and topic focus — the file imports straight into the platform\'s Multi-Subject CBT page.',
      ref: { mcq: 20 }, dominant: 'mcq', needs: 'subjects',
      sections: [
        ['SUBJECT BUDGET', 'The per-subject counts and topics listed below are BINDING. The total\nrow count must equal the sum of the per-subject counts. Use each\nsubject\'s own topic list for its items only.'],
        ['SECTION COLUMN', 'Col17 (Section) MUST be the subject name, exactly as spelled in the\nsubject list — the platform splits the paper into subject tabs by this\ncolumn alone.']
      ],
      quality: [
        'No question from one subject mentions another subject\'s content.',
        'Each subject\'s items cover ALL of its listed topics roughly evenly.',
        'Explanation Standard applies to every row of every subject.'
      ]
    },

    exam_board: {
      label: 'Exam-board simulation (WAEC / NECO / IGCSE / SAT)',
      role: 'a veteran examiner of the selected board who knows its house style, rubrics and recurring question patterns',
      mission: 'Write a paper a candidate could mistake for a real release of the selected board — same register, same format expectations, same standard.',
      ref: { mcq: 12, true_false: 4, short_answer: 4 }, dominant: 'mcq',
      sections: [
        ['HOUSE STYLE', 'Match the selected board: WAEC/NECO formal register with Nigerian\ncontexts; IGCSE clean international English with SI units; SAT evidence-\nbased items that quote the passage line by line.'],
        ['RUBRIC HONESTY', 'Where the board allocates marks for working, the explanation must show\nthe working the board would award marks for.']
      ],
      quality: [
        'Item difficulty matches the board\'s published distribution.',
        'Instructions in Col1 use the board\'s standard command words.',
        'No content outside the board\'s syllabus for the selected level.'
      ]
    },

    past_paper: {
      label: 'From source material (paste notes / textbook / past paper)',
      role: 'an assessment designer who converts supplied source material into a fair paper that tests exactly what the material teaches',
      mission: 'Every question must be answerable from the supplied material ALONE — no outside knowledge assumed beyond the stated level.',
      ref: { mcq: 12, short_answer: 4, cloze: 2, matching: 2 }, dominant: 'mcq', needs: 'source',
      sections: [
        ['SOURCE FIDELITY', 'Cover the source proportionally: sections with more content get more\nitems. Quote the source\'s own vocabulary in stems and explanations.'],
        ['NO INVENTION', 'Do not introduce facts, numbers or claims that are not in the source.\nIf the source is thin on a topic, write fewer items on it.']
      ],
      quality: [
        'Every explanation cites the idea in the source ("The passage states…").',
        'Coverage map: each major section of the source has at least one item.',
        'Col16 (Tags) names the source section each item came from.'
      ]
    },

    marking_scheme: {
      label: 'Marking-scheme explanations (teacher-graded depth)',
      role: 'a chief examiner writing both the paper AND the official marking scheme, with every mark allocation justified',
      mission: 'The explanations are the product: each Col7 is a full marking scheme entry with numbered steps and mark points a teacher can award against.',
      ref: { mcq: 10, numeric: 4, essay: 2, case_study: 2 }, dominant: 'mcq',
      sections: [
        ['MARK ALLOCATION', 'In Col7, number the reasoning steps and append the mark for each step\nin brackets: "1. Resolve forces vertically [1 mark] 2. Apply F=ma [1 mark]…".'],
        ['MODEL ANSWERS', 'Essay and case-study rows carry complete model answers with an\nintro-body-conclusion structure a teacher can read aloud.']
      ],
      quality: [
        'Every explanation has numbered steps with bracketed marks.',
        'Numeric items state the penalty rule for missing units.',
        'Model answers are within the stated word limits.'
      ]
    },

    differentiated: {
      label: 'Differentiated (Support / Core / Stretch tiers)',
      role: 'a mixed-ability classroom specialist writing one paper in three visible difficulty tiers',
      mission: 'Every student meets the same topics at their level: FOUNDATION items secure the basics, CORE items meet the standard, STRETCH items extend beyond it.',
      ref: { mcq: 12, true_false: 4, numeric: 2, assertion_reason: 2 }, dominant: 'mcq',
      sections: [
        ['TIER TAGS', 'Col15 (Difficulty) MUST be exactly "easy" (Foundation), "medium" (Core)\nor "hard" (Stretch). Roughly 40% easy, 40% medium, 20% hard.'],
        ['SAME TOPICS', 'Each topic appears in at least two tiers so weak students still meet\nevery topic, just at accessible depth.']
      ],
      quality: [
        'Tier split ≈ 40/40/20 and totals exactly the requested count.',
        'Easy items have 2 distractors only distantly plausible.',
        'Stretch items require chaining two ideas minimum.'
      ]
    },

    multiline_math: {
      label: 'Multi-line mathematics & STEM rendering',
      role: 'a mathematics typesetter who writes CBT items that render beautifully with line breaks, fractions, exponents and symbols',
      mission: 'Every maths stem renders as clean multi-line working: no wall-of-text equations, no ambiguous ÷/of phrasing, no ASCII art that breaks.',
      ref: { mcq: 10, numeric: 6, multi_numeric: 2 }, dominant: 'mcq',
      sections: [
        ['RENDER RULES', 'Use <br> for line breaks inside Col1 (the platform renders HTML).\nWrite powers as x², fractions as (a+b)/(c+d), roots as √(x). Use the real\nsymbols π, °, ≤, ≥, ≠, ∞ — never "pi", "deg", "<=".'],
        ['NUMERIC DISCIPLINE', 'Col6 numeric answers: no units, no commas, no trailing zeros beyond\nneeded precision. Col9 tolerance reflects the rounding the stem allows.']
      ],
      quality: [
        'Each calculation shows the given data on its own line(s) via <br>.',
        'Answers are exact or tolerance is stated and justified.',
        'Distractors are the results of the 3 most likely slips (sign, BIDMAS, unit).'
      ]
    },

    misconception: {
      label: 'Diagnostic misconception hunter',
      role: 'a cognitive-science diagnostician who designs items to EXPOSE specific student misconceptions, not just to test knowledge',
      mission: 'Each item is built around ONE named misconception. The distractors ARE the misconception made visible; the explanation teaches out of it.',
      ref: { mcq: 14, multi_select: 3, true_false: 3 }, dominant: 'mcq',
      sections: [
        ['MISCONCEPTION-FIRST', 'Before writing each item, name the target misconception (e.g. "multiplication\nalways makes bigger", " heavier objects fall faster", "current is used up\nin a bulb"). Design the stem so the misconception produces a specific wrong\nanswer.'],
        ['REPORT VALUE', 'Col7 Move 3 must explicitly name the misconception and re-teach: "If you\nchose B you are thinking …; the truth is …".']
      ],
      quality: [
        'Every item targets a documented, real classroom misconception.',
        'The misconception-driven distractor is the most attractive wrong option.',
        'No two items target the same misconception.',
        'Tags (Col16) name the misconception in snake_case.'
      ]
    },

    comprehension: {
      label: 'Reading comprehension / passage set',
      role: 'an English examiner who writes evidence-based reading sets with passages and line-anchored questions',
      mission: 'One strong passage (or several), each followed by questions whose answers are provable from quoted lines — inference items must still be anchored.',
      ref: { case_study: 8, mcq: 6, cloze: 2, hot_text: 2 }, dominant: 'case_study', needs: 'source',
      sections: [
        ['PASSAGE DISCIPLINE', 'Passages are 150-350 words, self-contained, level-appropriate. The same\npassage shared by several questions repeats its full JSON in each row —\nthe platform pins it once for the candidate.'],
        ['EVIDENCE ANCHORING', 'Every explanation quotes the deciding words from the passage (Move 2).\nInference items name the two lines that force the inference.']
      ],
      quality: [
        'No question answerable without the passage.',
        'Vocabulary-in-context items include the quoted context sentence.',
        'Cloze gaps test grammar/function words that the passage disambiguates.'
      ]
    },

    enterprise_cbt: {
      label: 'Proctored enterprise certification paper',
      role: 'a certification-body exam developer producing a secured, high-stakes professional paper with psychometric balance',
      mission: 'A defensible certification paper: balanced blueprint coverage, difficulty distribution, and explanations usable as official candidate feedback.',
      ref: { mcq: 12, multi_select: 4, numeric: 2, matching: 2, hotspot: 1, code: 1 }, dominant: 'mcq',
      sections: [
        ['BLUEPRINT', 'Col16 (Tags) maps every item to a syllabus domain. Domain coverage must\nbe roughly proportional to the domain list weights (tag format:\n"domain:operations,weight:high").'],
        ['SECURITY', 'No item leaks the answer in its stem. Options never form an obvious\npattern. No item can be solved by elimination alone without domain knowledge.']
      ],
      quality: [
        'Difficulty spread 30% easy / 50% medium / 20% hard.',
        'Every domain in the tag list is covered by ≥ 1 item.',
        'Explanations are suitable for publication to candidates post-exam.'
      ]
    },

    junior_primary: {
      label: 'Early years / primary readability',
      role: 'a primary-school teacher who writes joyful, concrete, picture-first questions for 6-11 year olds',
      mission: 'Every child can read every question. Short sentences, everyday objects, one idea at a time, generous encouragement in the explanations.',
      ref: { mcq: 14, true_false: 4, image_based: 2 }, dominant: 'mcq',
      sections: [
        ['READABILITY', 'Stems under 15 words. Present tense. Concrete nouns a child knows\n(mango, kobo, ball, goat). No idioms, no passive voice, no commas in\nthe stem.'],
        ['KINDNESS', 'Explanations encourage: start with the verdict in words, teach the rule\nin one sentence, and end with a friendly takeaway. Never scold.']
      ],
      quality: [
        'Options are single words or very short phrases.',
        'Image items use simple public https images or clean text drawings.',
        'Numbers under 100 unless the topic is place value.'
      ]
    },

    stem_units: {
      label: 'Physics / Chemistry with units & constants',
      role: 'a science practical examiner obsessed with units, significant figures and honest tolerances',
      mission: 'Every quantitative item states its units, expects its answer in clean units, and sets a tolerance that matches the data given.',
      ref: { numeric: 10, mcq: 6, multi_numeric: 2 }, dominant: 'numeric',
      sections: [
        ['UNITS CONTRACT', 'Col10 (Unit) is filled for EVERY numeric item. Answers in base or\nstandard units (m, s, kg, m/s², V, mol/dm³) unless the stem says otherwise.\ng = 9.8 or 10 m/s² only if the stem declares it.'],
        ['SIG FIGS', 'Tolerance in Col9 must match the precision the stem allows (data given\nto 2 s.f. → tolerance covers the 3rd s.f.).']
      ],
      quality: [
        'Constants used are stated in the stem.',
        'Distractors include the classic unit-conversion slips (minutes→seconds, g→kg).',
        'No item silently mixes unit systems.'
      ]
    },

    professional: {
      label: 'Professional / clinical / legal scenarios',
      role: 'a professional-licensing exam writer (nursing, law, engineering, finance) who builds realistic short scenarios with defensible best-answer judgements',
      mission: 'Every item is a mini-case: a realistic situation, competing valid options, and ONE best answer justified by a named rule, statute, protocol or formula.',
      ref: { case_study: 8, mcq: 8, multi_select: 2, code: 2 }, dominant: 'case_study',
      sections: [
        ['SCENARIO QUALITY', 'Scenarios are 60-140 words, realistic, culturally plausible, and contain\nexactly the details needed — no decoration, no red herrings that change\nthe answer.'],
        ['BEST-ANSWER HONESTY', 'Where two options are partially correct, the explanation must say WHY the\nrejected one loses (Move 3 names the rule it breaks).']
      ],
      quality: [
        'Every best-answer justification cites the governing rule by name.',
        'Scenarios avoid stereotypes and stay clinically/professionally accurate.',
        'Code items (if any) test reasoning, not syntax trivia.'
      ]
    },

    from_syllabus: {
      label: 'Syllabus → full term paper',
      role: 'a curriculum officer converting an official syllabus outline into a complete termly assessment paper',
      mission: 'Coverage first: every syllabus theme in the pasted outline appears, weighted by its importance, producing a paper a school can use as its term exam.',
      ref: { mcq: 12, true_false: 4, short_answer: 2, numeric: 2, cloze: 2 }, dominant: 'mcq', needs: 'source',
      sections: [
        ['BLUEPRINT TABLE', 'Before the CSV, output a short coverage table (chat text, NOT in the\nfile): theme → number of items. The table must account for every row.'],
        ['WEIGHTING', 'Themes earlier/higher in the outline get proportionally more items.\nNothing in the outline is skipped; anything not in the outline is not asked.']
      ],
      quality: [
        'Every outline theme has ≥ 1 item.',
        'Col16 tags each item with its theme.',
        'The paper as a whole matches the requested difficulty mix.'
      ]
    }
  },

  /* Packs that need extra fields in the studio UI */
  NEEDS: {
    past_paper: ['source'],
    comprehension: ['source'],
    from_syllabus: ['source'],
    material_upload: ['source'],
    material_link: ['source'],
    dl_article: ['source'],
    dl_video: ['source'],
    assignment: ['source'],
    multi_subject: ['subjects']
  },

  /* =====================================================================
     mix() — scale a reference distribution to EXACTLY n items.
     Guarantees: sum == n; minOne packs keep every type present when n
     is large enough; the dominant type absorbs rounding remainders.
     ===================================================================== */
  mix(ref, n, dominant, minOne) {
    const keys = Object.keys(ref);
    // minOne is impossible when fewer items than types — clamp gracefully
    if (minOne && n < keys.length) minOne = false;
    const total = keys.reduce((a, k) => a + ref[k], 0);
    const out = {}; let running = 0;
    keys.forEach(k => {
      let v = Math.floor(ref[k] * n / total);
      if (minOne && v < 1) v = 1;
      if (v > 0) { out[k] = v; running += v; }
    });
    const d = dominant || keys[0];
    if (running > n) {
      out[d] = Math.max(minOne ? 1 : 0, (out[d] || 0) - (running - n));
      running = keys.reduce((a, k) => a + (out[k] || 0), 0);
      let guard = 0;
      while (running > n && guard++ < 500) {
        const biggest = keys.filter(k => (out[k] || 0) > 1).sort((a, b) => out[b] - out[a])[0];
        if (!biggest) break;
        out[biggest] -= 1; running -= 1;
      }
    } else {
      out[d] = (out[d] || 0) + Math.max(0, n - running);
    }
    // drop zero entries
    Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
    return out;
  },

  /* =====================================================================
     build() — assemble the final prompt for the studio form.
     opts: { pack, subject, topic, level, count, board, difficulty, language,
             source, subjects: [{name, count, topic}], format }
     ===================================================================== */
  build(opts) {
    const P = this.PACKS[opts.pack] || this.PACKS.simple;
    const n = Math.max(1, Math.min(200, parseInt(opts.count, 10) || 20));
    const subject = (opts.subject || '[SUBJECT]').trim();
    const topic = (opts.topic || '[TOPIC]').trim();
    const lv = (opts.level || '[CLASS/LEVEL]').trim();
    const board = (opts.board || 'the selected exam style').trim();
    const diff = (opts.difficulty || 'Balanced (40% medium, 30% easy, 30% hard)').trim();
    const lang = (opts.language || 'English').trim();
    const fmt = opts.format === 'json' ? 'json' : 'csv';
    const school = (window.App && App.institutionName) || 'HMG Academy CBT Pro';

    /* multi-subject: build a binding per-subject budget */
    let subjectsRaw = '', subjectBudget = null;
    if (opts.pack === 'multi_subject' && Array.isArray(opts.subjects) && opts.subjects.length) {
      subjectBudget = opts.subjects.filter(s => s.name && parseInt(s.count, 10) > 0);
      subjectsRaw = subjectBudget.map(s =>
        `  • ${s.name.trim()} — exactly ${parseInt(s.count, 10)} items` +
        (s.topic && s.topic.trim() ? ` on "${s.topic.trim()}"` : '')).join('\n');
    }

    const fill = (t) => String(t)
      /* {{SOURCE}} in a pack's own sections (material/link packs) receives the
         teacher's source text directly; function form avoids $-pattern leaks. */
      .replace(/\{\{SOURCE\}\}/g, () => (opts.source && String(opts.source).trim()) || '[PASTE YOUR NOTES / TEXTBOOK SECTION / LINK OR PASTED TEXT HERE]')
      .replace(/\[SUBJECT\]/g, subject)
      .replace(/\[TOPIC\]/g, topic)
      .replace(/\[CLASS\/LEVEL\]/g, lv)
      .replace(/\[BOARD\]/g, board)
      .replace(/\[DIFFICULTY\]/g, diff)
      .replace(/\[LANGUAGE\]/g, lang);

    const mixed = this.mix(P.ref, n, P.dominant, P.minOne);
    const usedTypes = Object.keys(mixed);
    const distribution = usedTypes.map(k => k + '=' + mixed[k]).join(', ');
    const rule = '===================================================================';
    const fname = (topic === '[TOPIC]' ? 'questions' : topic).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'questions';

    const sections = (P.sections || []).map(s => rule + '\n' + fill(s[0]) + '\n' + rule + '\n' + fill(s[1])).join('\n\n');
    const quality = (P.quality || []).map(q => '- ' + fill(q)).join('\n');
    const checks = [
      'Output is a DOWNLOADABLE .' + fmt + ' FILE named "' + fname + '.' + fmt + '".',
      fmt === 'csv'
        ? 'Exactly ' + n + ' data rows, plus the one header row.'
        : 'Exactly ' + n + ' JSON objects in one array.',
      fmt === 'csv' ? 'Header matches the contract character for character (17 columns).' : 'Every object has all the keys of the JSON shape above.',
      'Type counts match the distribution and sum to exactly ' + n + '.',
      fmt === 'csv' ? 'Every JSON cell has inner quotes doubled ("") and the whole cell quoted.' : 'JSON is valid — parse it mentally before answering.',
      'Every objective row has a non-empty, unambiguous key in Col6.',
      subjectsRaw ? 'Col17 (Section) is the subject name on every row, exactly as spelled in the subject budget.' : 'Col17 (Section) is "' + subject + '" on every row.',
      'Col15 (Difficulty) tags reflect the requested difficulty mix: ' + diff + '.',
      'EVERY row\'s Col7 contains all four moves: verdict in words, numbered reasoning, a named misconception for EACH wrong option, and a takeaway.',
      'No Col7 is under 45 words. No Col7 says only "Option X is correct".',
      'No Col7 refers to another question, to "the above", or to notes the student does not have in front of them.',
      'Col7 names the correct answer in WORDS, never by letter alone, because option order can be randomised per candidate.',
      'The whole paper reads as ONE author\'s work — consistent register, consistent difficulty logic.'
    ].map(c => '[ ] ' + fill(c)).join('\n');

    const sourceBlock = P.needs === 'source' || this.NEEDS[opts.pack]
      ? rule + '\nSOURCE MATERIAL — the paper must stay inside this material\n' + rule + '\n' +
        ((opts.source && opts.source.trim()) ? opts.source.trim() : '[PASTE YOUR NOTES / TEXTBOOK SECTION / PAST PAPER HERE]') + '\n\n'
      : '';

    const subjectsBlock = subjectsRaw
      ? rule + '\nSUBJECT BUDGET — BINDING (multi-subject paper)\n' + rule + '\n' + subjectsRaw + '\n\n'
      : '';

    const out =
'PACK: ' + P.label.toUpperCase() + '\n\n' +
'ROLE\nYou are ' + fill(P.role) + '.\n' +
'You are writing for ' + school + ' — an enterprise CBT platform\n(by HMG Academy) that imports question banks as one strict file per paper.\nNo paid AI APIs are involved in delivery: you produce the file, the teacher\nimports it.\n\n' +
'MISSION FOR THIS PARTICULAR PAPER\n' + fill(P.mission) + '\n\n' +
'TASK\nProduce EXACTLY ' + n + ' assessment items on "' + topic + '" for ' + lv + '\n' +
'prepared for ' + board + ', in ' + subject + '.\n' +
'Difficulty mix: ' + diff + '. Write everything (questions AND explanations) in ' + lang + '.\n\n' +
subjectsBlock +
sourceBlock +
rule + '\nOUTPUT CONTRACT — READ TWICE. THIS IS THE MOST IMPORTANT PART.\n' + rule + '\n\n' +
'0. OUTPUT A DOWNLOADABLE FILE — NOT RAW TEXT.\n' +
'   Produce a real, clickable file attachment named "' + fname + '.' + fmt + '" that the\n' +
'   teacher can download and import directly on the Teacher Hub. Use whatever\n' +
'   file-generating capability you have.\n' +
'   Only if you genuinely cannot emit a file, say so in ONE short line, then\n' +
'   output a single raw ' + (fmt === 'csv' ? 'CSV' : 'JSON') + ' code block instead.\n\n' +
'1. The file contains the assessment data and nothing else — no preamble, no\n' +
'   commentary, no markdown fences.\n\n' +
(fmt === 'csv'
  ? '2. The FIRST line must be exactly this header, character for character:\n' + this.HEADER + '\n\n' +
    '3. Then EXACTLY ' + n + ' data rows — one item per row.\n\n' +
    '4. Wrap EVERY field in double quotes. Escape any inner double quote by\n' +
    '   doubling it (""). This is what lets JSON live inside a CSV cell.\n\n'
  : '2. The file is ONE valid JSON array of ' + n + ' objects with EXACTLY this shape:\n' + this.JSON_SHAPE + '\n\n') +
'5. Use correct UTF-8 symbols: H₂O, CO₂, π, Ω, ≤, ≥, °C, ₦. Write them as real\n' +
'   characters, never as LaTeX \\alpha-style commands.\n\n' +
'6. "Section" (Col17) must be exactly: ' + (subjectsRaw ? 'the subject name for that row' : subject) + '\n\n' +
'7. Never leave "CorrectAnswer" empty on an objective item.\n\n' +
'8. Any media must be a public https link. The platform never accepts file\n' +
'   uploads inside question files — links only.\n\n' +
rule + '\nQUESTION TYPE DISTRIBUTION — MUST SUM TO EXACTLY ' + n + '\n' + rule + '\n' + distribution + '\n\n' +
rule + '\nCOLUMN RULES FOR THE TYPES THIS PACK USES\n' +
'Columns: 1 Question | 2 A | 3 B | 4 C | 5 D | 6 CorrectAnswer |\n' +
'7 Explanation | 8 Type | 9 Tolerance | 10 Unit | 11 Accept |\n' +
'12 MRQ_AON | 13 Pairs | 14 Items | 15 Difficulty | 16 Tags | 17 Section\n' + rule + '\n\n' +
usedTypes.map(t => this.RULES[t]).filter(Boolean).join('\n\n') + '\n\n' +
rule + '\nEXPLANATION STANDARD — APPLIES TO EVERY ROW, EVERY TYPE\n' + rule + '\n' + this.EXPLANATION_STANDARD + '\n\n' +
sections + '\n\n' +
rule + '\nQUALITY BAR FOR THIS PACK — an item failing any of these is rejected\n' + rule + '\n' + quality + '\n\n' +
rule + '\nFINAL CHECK BEFORE YOU ANSWER — tick every box mentally\n' + rule + '\n' + checks;

    return out;
  },

  /* =====================================================================
     STATIC quick prompts — one-click classics (no form needed).
     (Assigned after the object literal so HEADER is referenceable.)
     ===================================================================== */
  STATIC: null,

  /* Subject suggestion lists for the multi-subject pack (NERDC-aligned) */
  SUBJECT_SUGGESTIONS: {
    'Junior (BECE)': ['English Studies', 'Mathematics', 'Basic Science', 'Social Studies', 'Civic Education', 'Business Studies', 'Basic Technology', 'Agricultural Science', 'Computer Studies', 'CRS/IRS'],
    'Senior (SSCE/UTME)': ['English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Further Mathematics', 'Economics', 'Government', 'Literature-in-English', 'Geography', 'Commerce', 'Accounting', 'Agricultural Science', 'CRS/IRS', 'Yoruba/Igbo/Hausa', 'Computer Studies', 'Civic Education'],
    'Primary': ['English Studies', 'Mathematics', 'Basic Science & Technology', 'Civic Education', 'Social Studies', 'Agricultural Science', 'Creative Arts', 'Christian/Islamic Studies']
  },

  /* ── UI helpers (wired by cbt-prompts.html) ── */
  syncFields() {
    const packSel = document.getElementById('ps-pack');
    const pack = packSel ? packSel.value : 'simple';
    const need = this.NEEDS[pack] || [];
    document.querySelectorAll('[data-ps-need]').forEach(el => {
      el.hidden = need.indexOf(el.dataset.psNeed) === -1;
    });
    document.querySelectorAll('[data-ps-hide]').forEach(el => {
      el.hidden = need.indexOf(el.dataset.psHide) !== -1;
    });
    if (need.indexOf('subjects') !== -1) this.syncSubjectTopics();
  },

  syncSubjectTopics() {
    const host = document.getElementById('ps-subject-topics');
    if (!host) return;
    const list = (document.getElementById('ps-subjects-list').value || '').split(',').map(x => x.trim()).filter(Boolean);
    const keep = {};
    host.querySelectorAll('[data-ps-subject-topic]').forEach(i => { keep[i.dataset.psSubjectTopic] = i.value; });
    const escq = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    host.innerHTML = list.length
      ? list.map(sub => '<div style="display:flex;align-items:center;gap:10px;margin:4px 0"><label style="min-width:130px;font-weight:700;font-size:.85rem">' + escq(sub) + '</label><input class="form-input" data-ps-subject-topic="' + escq(sub) + '" value="' + escq(keep[sub] || '') + '" placeholder="Topic for ' + escq(sub) + '"></div>').join('')
      : '<p style="color:var(--text-muted,#888);margin:0;font-size:.85rem">Type the subjects above and a topic box will appear for each.</p>';
    host.querySelectorAll('[data-ps-subject-topic]').forEach(i => i.addEventListener('input', () => PS.buildFromForm()));
  },

  /* Read the studio form and build the prompt into #ps-out */
  buildFromForm() {
    const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const subjects = [];
    document.querySelectorAll('#ps-subject-topics [data-ps-subject-topic]').forEach(i => {
      subjects.push({ name: i.dataset.psSubjectTopic, topic: i.value });
    });
    document.querySelectorAll('#ps-subject-counts [data-ps-subject-count]').forEach(i => {
      const name = i.dataset.psSubjectCount;
      const row = subjects.find(s => s.name === name);
      if (row) row.count = i.value;
    });
    const opts = {
      pack: val('ps-pack'),
      subject: val('ps-subject'),
      topic: val('ps-topic'),
      level: val('ps-level'),
      count: val('ps-count'),
      board: val('ps-board'),
      difficulty: val('ps-difficulty'),
      language: val('ps-language'),
      source: (document.getElementById('ps-source') || {}).value || '',
      subjects,
      format: val('ps-format') || 'csv'
    };
    const out = this.build(opts);
    const target = document.getElementById('ps-out');
    if (target) target.value = out;
    const dist = document.getElementById('ps-distribution');
    if (dist) {
      const P = this.PACKS[opts.pack] || this.PACKS.simple;
      const mixed = this.mix(P.ref, Math.max(1, parseInt(opts.count, 10) || 20), P.dominant, P.minOne);
      dist.textContent = Object.keys(mixed).map(k => k + ' = ' + mixed[k]).join('  ·  ');
    }
    return out;
  },

  copy(id) {
    const t = document.getElementById(id || 'ps-out');
    /* textareas carry .value; static library prompts are <pre> blocks — read textContent */
    const text = t ? String(t.value || t.textContent || '').trim() : '';
    if (!text) { if (window.showToast) showToast('Generate a prompt first.', 'info'); return; }
    const done = () => { if (window.showToast) showToast('Prompt copied — paste it into any free AI chat ✓', 'success', 5000); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, () => PS.fallbackCopy(text, done)); return; }
      PS.fallbackCopy(text, done);
    } catch (e) { PS.fallbackCopy(text, done); }
  },

  /* execCommand fallback that works for <pre> blocks (no .select()) */
  fallbackCopy(text, done) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      done();
    } catch (e) { if (window.showToast) showToast('Copy blocked — select the text manually.', 'warning'); }
  },

  download(id) {
    const t = document.getElementById(id || 'ps-out');
    if (!t || !t.value) { if (window.showToast) showToast('Generate a prompt first.', 'info'); return; }
    const P = this.PACKS[(document.getElementById('ps-pack') || {}).value] || this.PACKS.simple;
    const fname = 'prompt-' + (document.getElementById('ps-pack') || {}).value + '-' + Date.now() + '.txt';
    if (window.DataPort && DataPort.downloadText) DataPort.downloadText(t.value, fname, 'text/plain');
    else {
      const blob = new Blob([t.value], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
    }
    if (window.showToast) showToast('Prompt downloaded as ' + fname, 'success');
    void P;
  }
};

/* Short alias used by generated HTML */
const PS = PromptStudio;
window.PS = PromptStudio;
window.PromptStudio = PromptStudio;

/* STATIC quick prompts — defined after the literal so HEADER resolves. */
PromptStudio.STATIC = {
  utme: {
    label: 'UTME / Common Entrance — multi-subject strict CSV',
    text: [
      'You are a UTME item-bank supervisor. Produce ONE downloadable .csv file',
      'for a full UTME-pattern sitting with this EXACT header:',
      '',
      PromptStudio.HEADER,
      '',
      'Subjects and counts (BINDING): English Comprehension=15, English',
      'Lexis & Structure=10, then each chosen subject=15. Col17 (Section) is',
      'the subject name on every row — the platform splits the paper into',
      'subject tabs by this column alone. All items are 4-option MCQ (Col8',
      '"mcq"), one correct answer, three distractors each traceable to a',
      'named misconception. Explanations follow the 4-move marking-scheme',
      'standard: verdict in words, numbered reasoning, misconception for each',
      'wrong option, one-line takeaway. Every field double-quoted; inner',
      'quotes doubled. Exactly the requested rows, no preamble, no markdown.'
    ].join('\n')
  },
  mcq_only: {
    label: 'MCQ-only strict CSV — any subject',
    text: [
      'You are a professional MCQ item writer. Produce ONE downloadable .csv',
      'file with this EXACT header:',
      '',
      PromptStudio.HEADER,
      '',
      'Every row: Type="mcq", 4 plausible options (A-D), exactly one correct,',
      'distractors from real student errors, correct letters spread evenly.',
      'Difficulty mix 30% easy / 50% medium / 20% hard in Col15. Explanations',
      'follow the 4-move standard: verdict in words (never a bare letter),',
      'numbered reasoning, the misconception behind each wrong option, and a',
      'memorable takeaway. No "All/None of the above". Every field quoted.'
    ].join('\n')
  }
};

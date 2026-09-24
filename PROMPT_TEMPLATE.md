# PROMPT_TEMPLATE.md — AI Question-Bank Generator (Copy-Paste, No API)

> **What this is:** a complete, copy-paste prompt you give to any AI assistant
> (ChatGPT, Claude, DeepSeek, Gemini, Copilot — free tiers are fine) to generate
> a **ready-to-upload CSV question bank** for this platform. The platform itself
> never calls an AI API — you generate the file here, validate it on the
> **AI Prompts Studio** page (`cbt-prompts.html`, Teacher Hub sidebar), and load
> it into the Teacher Hub. The interactive studio builds this same prompt for
> you with one click; this file is the offline, always-available master copy.

---

## 1. How to use this file (3 steps)

1. **Copy the master prompt** in Section 4 below (from `You are…` to the end).
2. **Fill the four `{{…}}` placeholders** — subject, exam board / level,
   question count with type mix, and any source material notes.
3. **Paste it into any AI chat**, receive a CSV code block, save it as
   `questions.csv`, then open **Teacher Hub → AI Prompts Studio → Validator &
   Loader** to check and import it. The validator catches format problems
   per-row before anything touches your question bank.

---

## 2. The CSV contract (17 columns — exact header row)

```text
Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section
```

| # | Column | What goes in it |
|---|--------|-----------------|
| 1 | `Question` | The full question text. Use `___` (three underscores) for typed blanks in `short` and `cloze` questions. |
| 2–5 | `A`,`B`,`C`,`D` | The option texts for `mcq` / `mrq` / `tf`. For `tf`: `A=True`, `B=False`. Leave blank for other types. |
| 6 | `CorrectAnswer` | `mcq`: one letter `A`–`D`. `mrq`: comma-separated letters, e.g. `A,C`. `tf`: `A` (true) or `B` (false). `short`/`numeric`: the exact answer. Blank for `matching` / `ordering` / `cloze` (their key lives in `Pairs` / `Items`). |
| 7 | `Explanation` | **Mandatory.** The post-answer teaching explanation (see the standard in §3). |
| 8 | `Type` | One of: `mcq`, `mrq`, `tf`, `short`, `numeric`, `matching`, `ordering`, `cloze`, `essay`, `code`, `assertion_reason`, `case_study`, `image_mcq`, `matrix`, `hot_text`, `categorization`, `multi_numeric`. |
| 9 | `Tolerance` | `numeric` only: allowed error, e.g. `0.05`. |
| 10 | `Unit` | `numeric` only: unit label, e.g. `km/h`. |
| 11 | `Accept` | `short` only: alternative accepted spellings, pipe-separated, e.g. `abuja\|fct`. |
| 12 | `MRQ_AON` | `mrq` only: `true` = all-or-nothing marking, `false` = partial credit. |
| 13 | `Pairs` | `matching` only: JSON array `[{"left":"…","right":"…"}]`; add decoys as `{"left":"DISTRACTOR","right":"…"}`. |
| 14 | `Items` | `ordering`: JSON array of items **in the correct order** (system scrambles them). `cloze`: JSON array of answers, one per `___` blank, in order. |
| 15 | `Difficulty` | `Easy`, `Medium`, or `Hard`. |
| 16 | `Tags` | Pipe-separated topics, e.g. `Algebra\|Linear Equations`. |
| 17 | `Section` | Paper section label, e.g. `Section A` — or the subject name for multi-subject banks. |

**CSV rules the AI must follow:**
- Wrap every cell in double quotes; escape inner double-quotes as `""`.
- No cell may contain a raw newline — use spaces.
- JSON in `Pairs`/`Items` stays on ONE line inside its quoted cell.

---

## 3. The Explanation Standard (every question, no exceptions)

Every `Explanation` cell uses **four moves**, 40–70 words total:

1. **VERDICT** — state the correct answer plainly (repeat the full answer text, not just the letter).
2. **REASONING** — show the working or the rule that produces it, in order.
3. **DISTRACTOR AUTOPSY** — for `mcq`/`mrq`: why each tempting wrong option is wrong, in one clause each.
4. **TAKEAWAY** — one transferable rule the candidate should remember.

Example (mcq):
> B. x = 5. Subtract 7 from both sides to get 3x = 15, then divide by 3. A (3) forgets to divide; C (7) subtracted 7 but skipped the division check; D (15) is 3x, not x. Rule: isolate the variable by undoing operations in reverse order.

For `short`/`numeric`/`tf`, move 3 becomes: the one mistake that produces the most common wrong answer.

---

## 4. MASTER PROMPT (copy from here ↓)

```text
You are an expert examination author with 20 years of experience writing
standardised, curriculum-aligned assessments for African secondary schools
(WAEC, NECO, JAMB/UTME, Common Entrance) and international boards (IGCSE, SAT).

MISSION
Generate a CSV question bank of exactly {{N}} questions for:
  SUBJECT : {{subject, class/year, and curriculum/syllabus area}}
  LEVEL   : {{exam board + level, e.g. "JAMB UTME", "WAEC SS3", "IGCSE Core"}}
  MIX     : {{type mix, e.g. "18 mcq, 4 mrq, 2 tf, 4 short, 2 numeric, 2 matching,
             2 ordering, 1 cloze" — or "your expert choice, balanced"}}
  SOURCE  : {{optional: "based on the attached past questions / lesson notes /
             textbook chapter" or "original questions only"}}

OUTPUT FORMAT — one CSV code block, nothing else outside it.
First line exactly:
Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section

HARD RULES
1. 17 columns per row, in the exact header order above. Quote every cell;
    escape inner double-quotes as "" (two double-quotes). No raw line breaks
    inside any cell — ever.
2. CorrectAnswer: mcq = one letter A–D. mrq = comma letters (A,C). tf = A or B
    (A=True, B=False; put "True" in column A and "False" in column B).
    short/numeric = the exact answer text/number. matching/ordering/cloze leave
    CorrectAnswer empty — their keys go in Pairs (col 13) / Items (col 14) as
    ONE-LINE JSON arrays.
3. matching: Pairs = [{"left":"item","right":"match"},…]; add 1–2 decoys as
    {"left":"DISTRACTOR","right":"wrong match"}. 4–6 pairs per question.
4. ordering: Items = ["first","second","third",…] listed in the CORRECT order;
    the platform scrambles them for the student.
5. cloze: write ___ for each blank in the Question; Items = ["ans1","ans2",…]
    one answer per blank in order.
6. numeric: put the answer in CorrectAnswer, a numeric Tolerance in col 9
    (e.g. 0.05), and the unit in col 10.
7. short: put the primary answer in CorrectAnswer and accepted alternative
    spellings in Accept (col 11) pipe-separated (e.g. ninety|90).
8. mrq: set MRQ_AON (col 12) to false for partial credit, true for
    all-or-nothing. Exactly one is correct per single-answer types; 2–3 are
    correct for mrq. NEVER make "all of the above"/"none of the above" an
    option.
9. EXPLANATION IS MANDATORY for every question: 40–70 words using the four
    moves — (a) VERDICT: restate the correct answer in full; (b) REASONING:
    the working/rule in order; (c) DISTRACTOR AUTOPSY: why each tempting wrong
    option fails (or the one classic mistake for typed types); (d) TAKEAWAY:
    one transferable rule.
10. Quality bar: one clearly correct answer per mcq; wrong options must be
    plausible but definitively wrong; difficulty spread roughly 40% Easy /
    40% Medium / 20% Hard, recorded in col 15; tags in col 16 as
    Topic|Subtopic; section label in col 17.
11. Curriculum fidelity: only content assessable at the stated level; no
    trick questions, no opinion questions, no negative wording unless testing
    it is the stated skill.
12. Number every aspect concretely: real values, real names, real contexts —
    no "something", "X", "etc." placeholders.
13. Maths notation: plain text only (x^2, sqrt(x), 3/4, π). No LaTeX.
14. Output ONLY the CSV code block. No preamble, no commentary, no markdown
    fences other than the one csv block.

SELF-CHECK BEFORE ANSWERING (silently verify, then fix):
- Does every row have exactly 17 quoted columns?
- Does every Explanation have all four moves?
- Is the count exactly {{N}} with the requested type mix?
- Are all JSON cells valid one-line JSON?
Then output the final CSV.
```

---

## 5. Variant prompts (append to the master)

**Strict UTME/JAMB mode** — append:
```text
ADDITIONAL: JAMB/UTME standard — 4-option mcq only; options of similar length;
no "all/none of the above"; stems state exactly one problem; 60-second-per-
question readability; Senior Secondary 2–3 syllabus scope only.
```

**Multi-subject bank** — append (and set Section = subject name):
```text
ADDITIONAL: This is a multi-subject bank. Subjects and question counts:
{{e.g. "English: 30, Mathematics: 25, Physics: 20, Chemistry: 20"}}.
Set col 17 (Section) to the SUBJECT NAME on every row. Keep the total count
exact. Difficulty mix per subject.
```

**From past questions / lesson notes** — paste the material below the master prompt and append:
```text
ADDITIONAL: Base every question strictly on the material I pasted after this
prompt. Do not import facts that are not in it. Where the material supplies
past questions, write NEW questions testing the same skills — do not copy them
verbatim.
```

**Marking-scheme / misconception mode** — append:
```text
ADDITIONAL: Target the top 5 documented student misconceptions for this topic
(listed in the material, or well-known ones if not). Each distractor must
embed one specific misconception, and its autopsy must name that misconception.
```

---

## 6. After the AI answers — the 60-second QA

1. Save the CSV block as `questions.csv` (UTF-8).
2. Open **AI Prompts Studio → Validator & Loader**, paste or upload the file:
   it checks the header, row shapes, answer keys, JSON cells, and reports
   problems per row — then loads valid questions straight into the Teacher Hub.
3. Spot-check three explanations for the four moves; regenerate any lazy rows
   by replying: *"Rewrite rows 7, 12, 19 with full four-move explanations."*
4. Import to an exam, preview as a student, and check one matching and one
   ordering question render correctly.

> **Never** accept an AI answer that ignores the checklist — ask it to fix
> itself; the validator is the final gate, but your read-through is the quality
> gate.

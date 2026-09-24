/* ====================================================================
   cbt-engine.js — HMG CBT Pro Assessment & Multi-Subject Engine
   ====================================================================
   Comprehensive assessment manager supporting Single-Subject and
   Multi-Subject (UTME / JAMB / WAEC) examination modes.
   ==================================================================== */
const CBTEngine = {
  exam: null,
  isMultiSubject: false,
  subjects: [], // [{ name, count, questions: [] }]
  activeSubjectIdx: 0,
  currentQIdx: 0,
  answers: {}, // { 'subjIdx_qIdx': answerValue } or { 'qIdx': answerValue }
  flagged: new Set(),
  timeRemaining: 0,
  timerInterval: null,
  draftInterval: null,
  startTime: null,
  proctorData: {
    intakePhotos: [],
    snapshots: [],
    violations: [],
    violationCount: 0
  },

  initExam(examData) {
    this.exam = examData;
    this.isMultiSubject = !!(examData.is_multi_subject || (examData.subjects_data && Array.isArray(examData.subjects_data) && examData.subjects_data.length > 0));

    if (this.isMultiSubject) {
      this.subjects = (examData.subjects_data || []).map((s, sIdx) => {
        let qs = s.questions || [];
        if (!qs.length && s.csv_data) {
          qs = typeof s.csv_data === 'string' ? JSON.parse(s.csv_data) : s.csv_data;
        }
        if (s.count && Number(s.count) > 0 && Number(s.count) < qs.length) {
          qs = qs.sort(() => Math.random() - 0.5).slice(0, Number(s.count));
        }
        return {
          name: s.subject_name || s.name || `Subject ${sIdx + 1}`,
          passmark: s.passmark || 50,
          questions: qs
        };
      });
      this.activeSubjectIdx = 0;
    } else {
      let raw = examData.csv_data;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (_) { raw = []; }
      }
      let qs = Array.isArray(raw) ? raw : [];
      if (examData.select_count && Number(examData.select_count) > 0 && Number(examData.select_count) < qs.length) {
        qs = qs.sort(() => Math.random() - 0.5).slice(0, Number(examData.select_count));
      }
      this.subjects = [{
        name: examData.subject ? examData.subject.split('|')[0] : 'General Assessment',
        passmark: 50,
        questions: qs
      }];
      this.activeSubjectIdx = 0;
    }

    this.currentQIdx = 0;
    this.answers = {};
    this.flagged.clear();
    this.timeRemaining = (Number(examData.duration) || 45) * 60;
    this.startTime = Date.now();
  },

  getActiveQuestions() {
    return this.subjects[this.activeSubjectIdx]?.questions || [];
  },

  getCurrentQuestion() {
    return this.getActiveQuestions()[this.currentQIdx] || null;
  },

  getAnswerKey(sIdx = this.activeSubjectIdx, qIdx = this.currentQIdx) {
    return this.isMultiSubject ? `${sIdx}_${qIdx}` : `${qIdx}`;
  },

  setAnswer(val, sIdx = this.activeSubjectIdx, qIdx = this.currentQIdx) {
    const k = this.getAnswerKey(sIdx, qIdx);
    this.answers[k] = val;
    this.saveDraft();
  },

  getAnswer(sIdx = this.activeSubjectIdx, qIdx = this.currentQIdx) {
    const k = this.getAnswerKey(sIdx, qIdx);
    return this.answers[k];
  },

  hasAnswer(sIdx, qIdx) {
    const k = this.getAnswerKey(sIdx, qIdx);
    const a = this.answers[k];
    return a !== undefined && a !== null && a !== '';
  },

  switchSubject(sIdx) {
    if (sIdx < 0 || sIdx >= this.subjects.length) return;
    this.activeSubjectIdx = sIdx;
    this.currentQIdx = 0;
  },

  toggleFlag(sIdx = this.activeSubjectIdx, qIdx = this.currentQIdx) {
    const k = this.getAnswerKey(sIdx, qIdx);
    if (this.flagged.has(k)) this.flagged.delete(k);
    else this.flagged.add(k);
  },

  isFlagged(sIdx = this.activeSubjectIdx, qIdx = this.currentQIdx) {
    const k = this.getAnswerKey(sIdx, qIdx);
    return this.flagged.has(k);
  },

  getTotalQuestionsCount() {
    return this.subjects.reduce((sum, s) => sum + s.questions.length, 0);
  },

  getAnsweredCount() {
    return Object.keys(this.answers).filter(k => this.answers[k] !== undefined && this.answers[k] !== null && this.answers[k] !== '').length;
  },

  /* ── Draft Auto-Save ── */
  saveDraft() {
    if (!this.exam) return;
    try {
      const draft = {
        examId: this.exam.id,
        answers: this.answers,
        flagged: Array.from(this.flagged),
        activeSubjectIdx: this.activeSubjectIdx,
        currentQIdx: this.currentQIdx,
        timeRemaining: this.timeRemaining,
        savedAt: Date.now()
      };
      localStorage.setItem(`cbt_draft_${this.exam.id}`, JSON.stringify(draft));
    } catch (_) {}
  },

  loadDraft() {
    if (!this.exam) return false;
    try {
      const raw = localStorage.getItem(`cbt_draft_${this.exam.id}`);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (Date.now() - d.savedAt > 7200000) {
        localStorage.removeItem(`cbt_draft_${this.exam.id}`);
        return false;
      }
      this.answers = d.answers || {};
      this.flagged = new Set(d.flagged || []);
      this.activeSubjectIdx = d.activeSubjectIdx || 0;
      this.currentQIdx = d.currentQIdx || 0;
      return true;
    } catch (_) {
      return false;
    }
  },

  clearDraft() {
    if (this.exam) localStorage.removeItem(`cbt_draft_${this.exam.id}`);
  },

  /* ── Grading & Result Compilation ── */
  computeResults() {
    let grandTotal = 0;
    let grandScore = 0;
    let grandCorrect = 0;
    let grandWrong = 0;
    let grandSkipped = 0;
    const subjectBreakdown = {};

    this.subjects.forEach((subj, sIdx) => {
      let sScore = 0;
      let sCorrect = 0;
      let sWrong = 0;
      let sSkipped = 0;
      const qBreakdown = [];

      subj.questions.forEach((q, qIdx) => {
        grandTotal++;
        const ans = this.getAnswer(sIdx, qIdx);
        if (ans === undefined || ans === null || ans === '') {
          sSkipped++;
          grandSkipped++;
          qBreakdown.push({ qIdx, q: q.q, type: q.type, answered: false, score: 0 });
          return;
        }

        // FIX (m6): CBTTypes.grade() returns { earned, max, correct } — the old code
        // read .fraction/.isCorrect (always undefined), turning every score into NaN.
        const res = window.CBTTypes ? CBTTypes.grade(q, ans) : { earned: 0, max: 1, correct: false };
        const fraction = Math.max(0, Math.min(1, res.max ? res.earned / res.max : 0));
        sScore += fraction;
        grandScore += fraction;
        if (res.correct) {
          sCorrect++;
          grandCorrect++;
        } else if (fraction > 0) {
          grandCorrect++;
        } else {
          sWrong++;
          grandWrong++;
        }
        qBreakdown.push({ qIdx, q: q.q, type: q.type, answered: true, studentAns: ans, score: fraction, isCorrect: res.correct });
      });

      // Apply negative marking penalty per subject
      const negMark = Math.max(0, Number(this.exam.negative_mark) || 0);
      const penalty = negMark > 0 ? (sWrong * negMark) : 0;
      const finalSubjectScore = Math.max(0, sScore - penalty);

      subjectBreakdown[subj.name] = {
        subjectName: subj.name,
        total: subj.questions.length,
        rawScore: Math.round(sScore * 10) / 10,
        penalty,
        finalScore: Math.round(finalSubjectScore * 10) / 10,
        percentage: subj.questions.length ? Math.round((finalSubjectScore / subj.questions.length) * 100) : 0,
        correct: sCorrect,
        wrong: sWrong,
        skipped: sSkipped,
        passmark: subj.passmark || 50,
        passed: subj.questions.length ? ((finalSubjectScore / subj.questions.length) * 100 >= (subj.passmark || 50)) : false
      };
    });

    const negMark = Math.max(0, Number(this.exam.negative_mark) || 0);
    const totalPenalty = negMark > 0 ? (grandWrong * negMark) : 0;
    const finalScore = Math.max(0, grandScore - totalPenalty);
    const roundedScore = Math.round(finalScore * 10) / 10;
    const percentage = grandTotal ? Math.round((finalScore / grandTotal) * 100) : 0;

    return {
      total: grandTotal,
      rawScore: Math.round(grandScore * 10) / 10,
      penalty: totalPenalty,
      finalScore: roundedScore,
      percentage,
      correct: grandCorrect,
      wrong: grandWrong,
      skipped: grandSkipped,
      subjectBreakdown,
      timeTakenSec: Math.round((Date.now() - (this.startTime || Date.now())) / 1000)
    };
  }
};

window.CBTEngine = CBTEngine;

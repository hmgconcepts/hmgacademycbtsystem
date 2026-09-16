/* ============================================================================*
   psychometrics.js — Phase 10 Psychometric Analytics Engine
   ----------------------------------------------------------------------------
   Enterprise CBT platforms (ExamSoft Enterprise Portal, Questionmark, D2L)
   ship a statistics pack that classroom CBT tools never had. This module
   brings that pack to this platform — 100% rule-based mathematics, free,
   no AI API, no dependencies. It runs entirely in the teacher's browser
   from data the platform ALREADY stores (results rows + question bank),
   so it costs zero extra database writes and works on the free tier.

   WHAT IT COMPUTES
   ────────────────
   Exam level
     • N               candidates scored
     • mean            average percentage score
     • SD              population standard deviation of percentages
     • KR-20           Kuder-Richardson 20 internal-consistency reliability
                       for dichotomous (right/wrong) items:
                           KR20 = k/(k-1) * (1 - Σ pᵢqᵢ / σ²)
                       Interpretation (ExamSoft/assessment practice):
                       ≥0.90 excellent (standardised testing), 0.80–0.89
                       very good, 0.70–0.79 acceptable for classroom tests,
                       <0.60 low — the test orders candidates weakly.
     • SEM             standard error of measurement, SD·√(1−KR20):
                       the ± band around an observed score.
     • pass rate, median, max, min.

   Question (item) level — for EVERY dichotomously-gradable item:
     • p               difficulty index = proportion correct (0..1).
                       >0.80 too easy, <0.20 too hard for most classrooms.
     • D               discrimination index = p(upper 27%) − p(lower 27%).
                       Range −1..+1. ≥0.20 acceptable, ≈0 bad item (top and
                       bottom performers answer equally), negative = top
                       performers MISS more than weak ones → defect.
     • r_pb            point-biserial correlation between the item (0/1)
                       and the total score. ≥0.20 good, <0.10 review.
     • response distribution per option + distractor analysis:
                       a functioning distractor attracts ≥5% of candidates
                       AND attracts weaker candidates (negative
                       discrimination); a distractor that attracts the TOP
                       performers is an item defect (probably mis-keyed).
     • fast-answer flag: mean correct-answer time < 2s (TestGorilla-style
                       suspicious-speed anomaly evidence).

   INTERFACE
   ──────────
   window.Psychometrics.computeExam(results, questions, options)
     results  : [{student_name, score, total, answers_data, time_taken}]
                exactly the rows teacher.html already loads for analytics.
     questions: [{q, a, b, c, d, ans, type, _orig}] the exam paper.
     options  : {passmark, negativeMark} optional.
     → {exam:{n,mean,sd,kr20,sem,median,passRate,...},
        items:[{key,p,d,rpb,counts,flags,...}]}

   The module is dependency-free and sets window.Psychometrics in the
   browser; a CommonJS tail makes the SAME file unit-testable in Node.
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------- tiny numeric helpers ---------- */
  function num(v, dflt) { const n = Number(v); return isFinite(n) ? n : (dflt || 0); }
  function round(v, dp) { const f = Math.pow(10, dp === undefined ? 3 : dp); return Math.round((v + Number.EPSILON) * f) / f; }
  function mean(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
  function median(a) {
    if (!a.length) return 0;
    const s = a.slice().sort(function (x, y) { return x - y; });
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  /* population SD of a series; optional itemVarianceTotal lets KR-20 reuse it */
  function stdev(a) {
    if (a.length < 1) return 0;
    if (a.length === 1) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / a.length);
  }

  /* ---------- per-result normalisation ----------
     A result row's answers_data maps ORIGINAL question key →
     {selected, is_correct, time_ms, ...}. Keys may be strings or ints
     (JSONB) so compare as String(). */
  function pctOfRow(r) {
    const total = num(r.total, 0);
    if (!total) return 0;
    return 100 * num(r.score, 0) / total;
  }

  /* Does this question type produce a clean 0/1 outcome we can correlate?
     Open-ended/graded-later types are excluded from item stats but still
     counted in the exam-level N. */
  const DICHOTOMOUS = { mcq: 1, tf: 1, mrq: 1, image_mcq: 1, assertion_reason: 1, hot_text: 1 };

  function qTypeOf(q) {
    if (!q) return '';
    const t = (q.type || q.qtype || '').toString().toLowerCase().replace(/\s+/g, '_');
    if (t) return t;
    return 'mcq'; /* bank default */
  }

  /* KR-20 needs a raw right/wrong vector per candidate. Build from
     answers_data when present; fall back to counting is_correct flags the
     engine already stores per question. */
  function buildCandidateVectors(results, itemKeys) {
    const vecs = results.map(function (r) {
      const ad = r.answers_data || {};
      const v = {};
      itemKeys.forEach(function (k) {
        const e = ad[k];
        if (e && typeof e.is_correct === 'boolean') v[k] = e.is_correct ? 1 : 0;
      });
      return v;
    });
    return vecs;
  }

  /* ---------- main ---------- */
  function computeExam(results, questions, options) {
    options = options || {};
    results = (results || []).filter(function (r) { return r && r.answers_data; });
    const passmark = num(options.passmark, 50);

    /* exam-level score stats on percentages */
    const pcts = results.map(pctOfRow);
    const sd = stdev(pcts);
    const passed = pcts.filter(function (p) { return p >= passmark; }).length;

    /* ---- item keys: only dichotomous ones ---- */
    const itemKeys = [];
    const qByKey = {};
    (questions || []).forEach(function (q) {
      if (!q) return;
      const key = String(q._orig !== undefined ? q._orig : (q.key !== undefined ? q.key : q.q));
      qByKey[key] = q;
      if (DICHOTOMOUS[qTypeOf(q)]) itemKeys.push(key);
    });

    const vecs = buildCandidateVectors(results, itemKeys);
    const n = vecs.length;
    const k = itemKeys.length;

    /* per-item p (difficulty): first pass right/answered counts */
    const itemStats = [];
    let sumPQ = 0;
    itemKeys.forEach(function (key) {
      let right = 0, answered = 0;
      vecs.forEach(function (v) {
        if (v[key] !== undefined) { answered++; if (v[key]) right++; }
      });
      itemStats.push({ key: key, right: right, answered: answered });
    });

    /* per-item response times (the engine already records time_ms) */
    const timesByKey = {}; itemKeys.forEach(function (k2) { timesByKey[k2] = []; });
    results.forEach(function (r) {
      const ad = r.answers_data || {};
      itemKeys.forEach(function (key) {
        const e = ad[key];
        if (e && typeof e.time_ms === 'number' && e.time_ms > 0) timesByKey[key].push(e.time_ms);
      });
    });

    /* response distribution for choice items (A/B/C/D style) */
    function optionLetters(q) {
      if (!q) return [];
      const out = [];
      ['a', 'b', 'c', 'd'].forEach(function (L) {
        const val = q[L];
        if (val !== undefined && val !== null && String(val).trim() !== '') out.push(L.toUpperCase());
      });
      return out;
    }

    itemKeys.forEach(function (key, idx) {
      const st = itemStats[idx];
      const q = qByKey[key] || {};
      const p = st.answered ? st.right / st.answered : 0;
      const pq = p * (1 - p);
      sumPQ += pq;

      /* discrimination: upper vs lower 27% groups by total percentage */
      let D = null;
      if (n >= 4) {
        const ranked = results.map(function (r, i) { return { i: i, pct: pctOfRow(r) }; })
          .sort(function (x, y) { return y.pct - x.pct; });
        const gSize = Math.max(1, Math.round(n * 0.27));
        const upper = ranked.slice(0, gSize), lower = ranked.slice(-gSize);
        const pU = upper.filter(function (u) { return (vecs[u.i][key] || 0) === 1; }).length / gSize;
        const pL = lower.filter(function (u) { return (vecs[u.i][key] || 0) === 1; }).length / gSize;
        D = pU - pL;

        /* point-biserial: r between item 0/1 and total pct */
        const xs = [], ys = [];
        results.forEach(function (r, i) {
          if (vecs[i][key] !== undefined) { xs.push(vecs[i][key]); ys.push(pctOfRow(r)); }
        });
        if (xs.length >= 3) {
          const mx = mean(xs), my = mean(ys);
          let sxy = 0, sxx = 0, syy = 0;
          xs.forEach(function (x, j) { sxy += (x - mx) * (ys[j] - my); sxx += (x - mx) * (x - mx); syy += (ys[j] - my) * (ys[j] - my); });
          st.rpb = (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : null;
        } else st.rpb = null;
      } else { D = null; st.rpb = null; }

      /* option-level response counts + distractor quality */
      const letters = optionLetters(q);
      const counts = {};
      letters.forEach(function (L) { counts[L] = 0; });
      let blank = 0;
      results.forEach(function (r, i) {
        const e = (r.answers_data || {})[key];
        const sel = e ? (e.selected !== undefined && e.selected !== null && e.selected !== '' ? String(e.selected) : '') : '';
        if (!sel) { blank++; return; }
        String(sel).split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean)
          .forEach(function (one) { if (counts[one] !== undefined) counts[one]++; });
      });
      const answeredN = results.length - blank;
      const correctLetter = String(q.ans || '').split(',')[0].trim().toUpperCase();
      const distractors = [];
      letters.forEach(function (L) {
        if (L === correctLetter) return;
        const share = answeredN ? counts[L] / answeredN : 0;
        /* upper/lower pull for THIS option */
        let pull = null;
        if (n >= 4) {
          const ranked = results.map(function (r, i) { return { i: i, pct: pctOfRow(r) }; })
            .sort(function (x, y) { return y.pct - x.pct; });
          const gSize = Math.max(1, Math.round(n * 0.27));
          const upper = ranked.slice(0, gSize), lower = ranked.slice(-gSize);
          const pickU = upper.filter(function (u) {
            const e = (results[u.i].answers_data || {})[key];
            return e && String(e.selected || '').toUpperCase().split(',').indexOf(L) >= 0;
          }).length / gSize;
          const pickL = lower.filter(function (u) {
            const e = (results[u.i].answers_data || {})[key];
            return e && String(e.selected || '').toUpperCase().split(',').indexOf(L) >= 0;
          }).length / gSize;
          pull = pickU - pickL;
        }
        distractors.push({
          letter: L, count: counts[L], share: round(share, 3), pull: pull === null ? null : round(pull, 3),
          functioning: share >= 0.05,
          defect: pull !== null && pull > 0.05 /* attracts TOP performers → mis-key or ambiguous */
        });
      });

      const tms = timesByKey[key] || [];
      const meanTime = tms.length ? mean(tms) / 1000 : null;

      /* interpretation flags — the phrases teachers can act on */
      const flags = [];
      if (p > 0.80) flags.push('too-easy');
      if (p < 0.20) flags.push('too-hard');
      if (D !== null && D < 0.20) flags.push('low-discrimination');
      if (D !== null && D < 0) flags.push('negative-discrimination');
      if (st.rpb !== null && st.rpb < 0.10) flags.push('weak-correlation');
      if (meanTime !== null && meanTime < 2 && p > 0.5) flags.push('fast-answers');
      if (answeredN > 0 && blank / results.length > 0.5) flags.push('mostly-skipped');
      const nonFunctioning = distractors.filter(function (d) { return !d.functioning; }).length;
      if (letters.length >= 3 && nonFunctioning > 0) flags.push('dead-distractors(' + nonFunctioning + ')');
      const defects = distractors.filter(function (d) { return d.defect; });
      if (defects.length) flags.push('distractor-defect(' + defects.map(function (d) { return d.letter; }).join('') + ')');

      st.p = round(p, 3); st.d = D === null ? null : round(D, 3); st.pq = pq;
      st.counts = counts; st.blank = blank; st.answeredN = answeredN;
      st.distractors = distractors; st.meanTime = meanTime === null ? null : round(meanTime, 1);
      st.flags = flags; st.type = qTypeOf(q);
    });

    /* ---- KR-20 ---- */
    /* Gated on the RAW 0/1 total-score variance (not the percentage SD — the
       two can diverge when non-dichotomous items carry the marks). */
    let kr20 = null;
    if (k >= 2 && n >= 2) {
      const rawScores = vecs.map(function (v) {
        let s = 0; itemKeys.forEach(function (key) { s += (v[key] || 0); }); return s;
      });
      const rawSD = stdev(rawScores);
      if (rawSD > 0) kr20 = (k / (k - 1)) * (1 - sumPQ / (rawSD * rawSD));
    }
    /* variance of raw 0/1 total scores; guard tiny negatives from fp error */
    if (kr20 !== null) { kr20 = Math.max(0, Math.min(1, kr20)); }

    const exam = {
      n: n, k: k,
      mean: round(mean(pcts), 1),
      median: round(median(pcts), 1),
      sd: round(sd, 1),
      min: pcts.length ? round(Math.min.apply(null, pcts), 1) : 0,
      max: pcts.length ? round(Math.max.apply(null, pcts), 1) : 0,
      passRate: pcts.length ? round(100 * passed / pcts.length, 1) : 0,
      kr20: kr20 === null ? null : round(kr20, 3),
      sem: (kr20 !== null && sd > 0) ? round(sd * Math.sqrt(1 - kr20), 1) : null,
      reliabilityLabel: kr20Label(kr20)
    };

    return { exam: exam, items: itemStats };
  }

  function kr20Label(v) {
    if (v === null || v === undefined) return 'n/a (need ≥2 items, ≥2 candidates, score spread)';
    if (v >= 0.90) return 'Excellent — standardised-test reliability';
    if (v >= 0.80) return 'Very good';
    if (v >= 0.70) return 'Acceptable for classroom testing';
    if (v >= 0.60) return 'Marginal — review weak items';
    return 'Low — this test ranks candidates weakly';
  }

  /* ---------- leaderboard (Phase 10) ----------
     Ranks released results, assigns medals / percentile badges. Hideable by
     the teacher (Quizizz-style) because public ranking stresses some
     learners. bestOf keeps only a candidate's highest attempt. */
  function leaderboard(results, options) {
    options = options || {};
    const best = {};
    (results || []).forEach(function (r) {
      if (r.is_released === false) return;
      const key = (r.student_name || '').toLowerCase() + '|' + (r.student_class || '').toLowerCase();
      const pct = num(r.total) ? 100 * num(r.score) / num(r.total) : 0;
      if (!best[key] || pct > best[key].pct) {
        best[key] = { name: r.student_name || '—', cls: r.student_class || '', pct: pct, score: num(r.score), total: num(r.total), time: num(r.time_taken), attempt: num(r.attempt_number, 1) };
      }
    });
    const rows = Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) { return b.pct - a.pct || a.time - b.time; });
    const N = rows.length;
    return rows.map(function (r, i) {
      const rank = i + 1;
      const percentile = N > 1 ? Math.round(100 * (N - rank) / (N - 1)) : 100;
      let medal = '';
      if (rank === 1) medal = '🥇';
      else if (rank === 2) medal = '🥈';
      else if (rank === 3) medal = '🥉';
      const badges = [];
      if (percentile >= 90 && N >= 5) badges.push('Top 10%');
      if (r.pct >= 90) badges.push('Distinction');
      else if (r.pct >= 75) badges.push('Merit');
      if (r.time && r.time > 0 && r.pct >= 50 && N >= 3) badges.push('Finisher');
      return { rank: rank, medal: medal, percentile: percentile, badges: badges, hidden: !!options.hideLeaderboard, row: r };
    });
  }

  /* ---------- answer-time & device anomaly evidence (Phase 10) ----------
     TestGorilla flags suspiciously-fast answering. Our engine already
     records time_ms per question in answers_data — surface it, plus the
     device_id each attempt came from (stored in answers_data.__meta). */
  function integritySignals(results) {
    const out = [];
    (results || []).forEach(function (r) {
      const ad = r.answers_data || {};
      const meta = ad.__meta || {};
      let fastCorrect = 0, timedCorrect = 0, totalMs = 0, timedN = 0;
      Object.keys(ad).forEach(function (key) {
        if (key.indexOf('__') === 0) return;
        const e = ad[key];
        if (!e) return;
        if (typeof e.time_ms === 'number' && e.time_ms > 0) { totalMs += e.time_ms; timedN++; }
        if (e.is_correct === true && typeof e.time_ms === 'number') {
          timedCorrect++;
          if (e.time_ms < 2000) fastCorrect++;
        }
      });
      const signals = [];
      if (timedCorrect >= 5 && fastCorrect / timedCorrect >= 0.5) signals.push('fast-answers');
      const avg = timedN ? totalMs / timedN / 1000 : 0;
      if (avg > 0 && avg < 3 && timedN >= 10) signals.push('very-fast-pace');
      if (num(r.violations) >= 3) signals.push('violations(' + num(r.violations) + ')');
      out.push({
        name: r.student_name, cls: r.student_class, attempt: num(r.attempt_number, 1),
        device_id: meta.device_id || '', devices_seen: meta.device_id || '',
        user_agent: meta.user_agent || '', avgSeconds: round(avg, 1),
        fastCorrect: fastCorrect, timedCorrect: timedCorrect, signals: signals
      });
    });
    /* group by candidate to expose device switching across attempts */
    const byStudent = {};
    out.forEach(function (o) {
      const k = (o.name || '').toLowerCase();
      if (!byStudent[k]) byStudent[k] = { name: o.name, devices: {}, rows: [] };
      if (o.device_id) byStudent[k].devices[o.device_id] = (byStudent[k].devices[o.device_id] || 0) + 1;
      byStudent[k].rows.push(o);
    });
    const deviceSwitchers = [];
    Object.keys(byStudent).forEach(function (k) {
      const g = byStudent[k];
      if (Object.keys(g.devices).length > 1) deviceSwitchers.push({ name: g.name, devices: Object.keys(g.devices).length, attempts: g.rows.length });
    });
    return { rows: out, deviceSwitchers: deviceSwitchers };
  }

  const api = { computeExam: computeExam, leaderboard: leaderboard, integritySignals: integritySignals, kr20Label: kr20Label, _stdev: stdev, _mean: mean };

  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* Node tests */
  root.Psychometrics = api; /* browser */
})(typeof window !== 'undefined' ? window : globalThis);

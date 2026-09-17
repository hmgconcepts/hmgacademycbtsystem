/* ====================================================================
   csv-bridge.js — Universal CBT Question CSV Compatibility Bridge
   ====================================================================
   PURPOSE
   A question CSV written for School Connect or GOSA Portal must import
   into HMG CBT Pro without any edit — and a CSV exported from HMG CBT
   Pro must import straight back into School Connect / GOSA Portal.

   HOW IT DECIDES (in this order)
   1. HEADER ROW DETECTED  → columns are mapped by NAME using the union
      of every alias both platforms understand. Column order is then
      irrelevant.
   2. NO HEADER, 14+ cells → the HMG 17-column positional contract:
      Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,
      Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section
   3. NO HEADER, fewer     → the School Connect positional layout:
      question,a,b,c,d,answer,explanation,type,mark

   TYPE NAMES
   School Connect / GOSA names (true_false, multi_select, short_answer,
   fill_blank, comprehension, long_answer …) are canonicalised to the
   HMG CBT internal names (tf, mrq, short, cloze, case_study, essay …)
   on import, and converted back on export. The full alias table is the
   UNION of both platforms' alias maps, so legacy spellings from either
   side keep working.

   NO DEPENDENCIES. Works in every browser; safe in a test VM.
   ==================================================================== */
(function (w) {
  'use strict';

  /* ---- the HMG CBT 17-column contract ---- */
  var CBT17_HEADER = ['Question','A','B','C','D','CorrectAnswer','Explanation','Type','Tolerance','Unit','Accept','MRQ_AON','Pairs','Items','Difficulty','Tags','Section'];

  /* ---- the School Connect / GOSA header (their AI prompt contract) ---- */
  var SC_HEADER = ['question','type','a','b','c','d','answer','explanation','mark','difficulty','topic','tolerance','section'];

  /* ---- type canonicalisation: ANY spelling → HMG internal name ---- */
  var TYPE_ALIASES = {
    /* HMG native names map to themselves */
    mcq: 'mcq', mrq: 'mrq', tf: 'tf', short: 'short', numeric: 'numeric',
    matching: 'matching', ordering: 'ordering', assertion_reason: 'assertion_reason',
    case_study: 'case_study', image_mcq: 'image_mcq', matrix: 'matrix',
    hot_text: 'hot_text', code: 'code', cloze: 'cloze', essay: 'essay',
    categorization: 'categorization', multi_numeric: 'multi_numeric',
    range: 'range', estimate: 'range', interval: 'range',
    hotspot: 'hotspot', image_hotspot: 'hotspot', click_image: 'hotspot',
    evidence_mcq: 'evidence_mcq', evidence: 'evidence_mcq', evidence_based: 'evidence_mcq',
    two_part_evidence: 'evidence_mcq',

    /* School Connect / GOSA names → HMG */
    true_false: 'tf', boolean: 'tf',
    multi_select: 'mrq', multiple_select: 'mrq', multiple_response: 'mrq', checkbox: 'mrq',
    short_answer: 'short', subjective: 'short', fill_blank: 'cloze', fill: 'cloze',
    fill_in_the_blank: 'cloze', gap_fill: 'cloze', gapfill: 'cloze', fill_in: 'cloze',
    comprehension: 'case_study', reading: 'case_study', passage: 'case_study',
    long_answer: 'essay', oral_prompt: 'essay', peer_review: 'essay',
    file_upload: 'essay',
    code_output: 'code', programming: 'code',
    error_spotting: 'hot_text', hottext: 'hot_text',
    sorting: 'categorization', classification: 'categorization', grouping: 'categorization',
    likert: 'matrix', grid: 'matrix',
    drag_drop: 'ordering', dragdrop: 'ordering', timeline: 'ordering',
    sequence: 'ordering', sequencing: 'ordering', ranking: 'ordering',
    multinumeric: 'multi_numeric', multi_part_numeric: 'multi_numeric',
    image: 'image_mcq', picture: 'image_mcq', image_based: 'image_mcq',
    assertion: 'assertion_reason', assertion_reason: 'assertion_reason',

    /* PHASE 12D — canon forms: the header canonicaliser strips underscores,
       hyphens and spaces before lookup, so every multi-word spelling
       ("assertion-reason", "case study", "true-false", "multi select"…)
       must also resolve here. */
    assertionreason: 'assertion_reason', casestudy: 'case_study',
    truefalse: 'tf', multiselect: 'mrq', multipleselect: 'mrq',
    multipleresponse: 'mrq', multipartnumeric: 'multi_numeric',
    imagemcq: 'image_mcq', imagebased: 'image_mcq',
    evidencemcq: 'evidence_mcq', evidencebased: 'evidence_mcq',
    twopartevidence: 'evidence_mcq', fillintheblank: 'cloze',
    fillin: 'cloze', gapfilling: 'cloze', longanswer: 'essay',
    oralprompt: 'essay', peerreview: 'essay', fileupload: 'essay',
    codeoutput: 'code', sortintogroups: 'categorization',
    matchthefollowing: 'matching', numericparts: 'multi_numeric',
    passagebased: 'case_study', ar: 'assertion_reason'
  };

  /* HMG internal name → School Connect export name */
  var TO_SC_TYPE = {
    mcq: 'mcq', mrq: 'multi_select', tf: 'true_false', short: 'short_answer',
    numeric: 'numeric', matching: 'matching', ordering: 'ordering',
    assertion_reason: 'mcq', case_study: 'comprehension', image_mcq: 'mcq',
    matrix: 'matrix', hot_text: 'hot_text', code: 'code', cloze: 'fill_blank',
    essay: 'essay', categorization: 'categorization', multi_numeric: 'multi_numeric'
  };

  /* ---- header canonicaliser (same rule School Connect uses) ---- */
  function canon(h) {
    return String(h == null ? '' : h).replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /* ---- union of every header alias both platforms understand ---- */
  var COLS = {
    question: ['question', 'prompt', 'text', 'q', 'questions', 'questiontext'],
    a: ['a', 'optiona', 'opta', 'choicea'],
    b: ['b', 'optionb', 'optb', 'choiceb'],
    c: ['c', 'optionc', 'optc', 'choicec'],
    d: ['d', 'optiond', 'optd', 'choiced'],
    answer: ['answer', 'correct', 'correctanswer', 'correctanswers', 'answerkey', 'answers',
             'key', 'correctoption', 'correctoption', 'answerkeytext', 'correctoptiontext'],
    explanation: ['explanation', 'reason', 'solution', 'rationale', 'why'],
    type: ['type', 'questiontype', 'qtype', 'format'],
    mark: ['mark', 'marks', 'score', 'points', 'weight'],
    difficulty: ['difficulty', 'level', 'complexity'],
    topic: ['topic', 'lesson', 'strand'],
    tolerance: ['tolerance', 'tol', 'margin'],
    section: ['section', 'subjectsection', 'examsubject', 'paper'],
    subject: ['subject', 'section', 'subjectsection', 'examsubject'],
    passage: ['passage', 'context', 'casetext', 'comprehension', 'scenario'],
    media: ['mediaurl', 'media', 'imageurl', 'image', 'audiourl', 'videourl', 'imagepath'],
    unit: ['unit', 'units', 'measure'],
    accept: ['accept', 'acceptedanswers', 'alternatives', 'acceptable'],
    mrq_aon: ['mrqaon', 'allornothing', 'aon'],
    pairs: ['pairs', 'pair', 'matches'],
    items: ['items', 'item', 'list', 'optionslist'],
    tags: ['tags', 'tag', 'labels']
  };

  var HEADER_WORDS = ['question','prompt','text','answer','correct','correctanswer',
                      'optiona','a','b','c','d','type','mark','marks','explanation'];

  /* ---- RFC4180 row splitter (quotes, escaped quotes, CRLF) ---- */
  function splitRows(text) {
    var rows = [], row = [], cur = '', q = false, i, ch, nx;
    text = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    for (i = 0; i < text.length; i++) {
      ch = text[i]; nx = text[i + 1];
      if (ch === '"' && q && nx === '"') { cur += '"'; i++; }
      else if (ch === '"') q = !q;
      else if (ch === ',' && !q) { row.push(cur); cur = ''; }
      else if ((ch === '\n' || ch === '\r') && !q) {
        if (ch === '\r' && nx === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function cleanField(v) {
    var s = String(v == null ? '' : v).trim();
    return s;
  }

  /* ------------------------------------------------------------------
     detect(text) → 'cbt17-header' | 'sc-header' | 'headerless-cbt17'
                  | 'headerless-sc' | 'unknown'
     ------------------------------------------------------------------ */
  function detect(text) {
    var rows = splitRows(text).filter(function (r) { return r.some(function (v) { return String(v == null ? '' : v).trim() !== ''; }); });
    if (!rows.length) return 'unknown';
    var probe = rows[0].map(canon);
    var hits = probe.filter(function (x) { return HEADER_WORDS.indexOf(x) !== -1; }).length;
    if (hits >= 2) {
      /* a header row exists — is it the exact HMG 17 contract? */
      var is17 = CBT17_HEADER.every(function (h, idx) { return probe[idx] === canon(h); });
      return is17 ? 'cbt17-header' : 'sc-header';
    }
    if (rows.length < 2 && rows[0].length < 2) return 'unknown';  /* a lone single cell is not a bank */
    if (rows[0].length >= 14) return 'headerless-cbt17';
    return 'headerless-sc';
  }

  /* ------------------------------------------------------------------
     parse(text) → { questions:[…], format:'…', detectedColumns:{…} }
     Every question is in the HMG internal shape:
     { q,a,b,c,d,ans,exp,type,tolerance,unit,accept,mrq_aon,pairs,items,
       difficulty,tags,section,passage,media,mark }
     ------------------------------------------------------------------ */
  function parse(text) {
    var rows = splitRows(text).filter(function (r) { return r.some(function (v) { return String(v == null ? '' : v).trim() !== ''; }); });
    var out = { questions: [], format: detect(text), detectedColumns: {} };
    if (!rows.length) return out;

    var probe = rows[0].map(canon);
    var hits = probe.filter(function (x) { return HEADER_WORDS.indexOf(x) !== -1; }).length;
    var hasHeader = hits >= 2;
    var head = hasHeader ? probe : [];
    var dataRows = hasHeader ? rows.slice(1) : rows;
    var positional = hasHeader ? null : (rows[0].length >= 14 ? 'cbt17' : 'sc');

    /* index resolver for the header path */
    var idxMap = {};
    Object.keys(COLS).forEach(function (k) {
      for (var i = 0; i < head.length; i++) {
        if (COLS[k].indexOf(head[i]) !== -1) { idxMap[k] = i; out.detectedColumns[k] = rows[0][i]; break; }
      }
    });

    dataRows.forEach(function (vals) {
      if (!vals.some(function (v) { return String(v == null ? '' : v).trim() !== ''; })) return;

      var get = function (k) {
        if (hasHeader) {
          var i = idxMap[k];
          return (i === undefined || i === null) ? '' : cleanField(vals[i]);
        }
        /* positional layouts */
        if (positional === 'cbt17') {
          var p = { question: 0, a: 1, b: 2, c: 3, d: 4, answer: 5, explanation: 6, type: 7,
                    tolerance: 8, unit: 9, accept: 10, mrq_aon: 11, pairs: 12, items: 13,
                    difficulty: 14, tags: 15, section: 16 }[k];
          return p === undefined ? '' : cleanField(vals[p]);
        }
        var s = { question: 0, a: 1, b: 2, c: 3, d: 4, answer: 5, explanation: 6, type: 7,
                  mark: 8, difficulty: 9, topic: 10, tolerance: 11, section: 12 }[k];
        return s === undefined ? '' : cleanField(vals[s]);
      };

      var rawType = get('type');
      var canonType = canon(rawType);
      var type = TYPE_ALIASES[canonType] || TYPE_ALIASES[rawType.toLowerCase()] || (canonType || 'mcq');
      var qText = get('question');
      if (!qText) return;

      var q = {
        q: qText,
        a: get('a'), b: get('b'), c: get('c'), d: get('d'),
        ans: get('answer'),
        exp: get('explanation'),
        type: type,
        tolerance: (get('tolerance') !== '' && isFinite(Number(get('tolerance')))) ? Number(get('tolerance')) : undefined,
        unit: get('unit'),
        accept: get('accept'),
        mrq_aon: undefined,
        pairs: get('pairs'),
        items: get('items'),
        difficulty: get('difficulty'),
        tags: get('tags'),
        section: get('section') || get('subject'),
        passage: get('passage'),
        media: get('media'),
        mark: (get('mark') !== '' && isFinite(Number(get('mark')))) ? Number(get('mark')) : undefined
      };
      var aon = get('mrq_aon').toLowerCase();
      if (aon === 'true' || aon === '1' || aon === 'yes') q.mrq_aon = true;

      /* numeric tolerance sometimes shipped in the "accept" column */
      if (q.tolerance === undefined && !q.items && !q.pairs && q.accept !== '' && /^[0-9.]+$/.test(q.accept) && type === 'numeric') {
        q.tolerance = Number(q.accept);
      }

      /* School Connect ships topic in its own column — fold into tags */
      var topic = get('topic');
      if (topic && !q.tags) q.tags = topic;

      /* passage/media prefixed onto the question text so nothing is lost */
      if (q.passage) q.q = q.passage + '\n\n' + qText;
      if (q.media && type === 'mcq') { type = q.type = 'image_mcq'; try { q.items = JSON.stringify({ image: q.media }); } catch (e) {} }

      /* structured types must parse their JSON keys — silently degrade to
         a plain question with the raw JSON dropped ONLY if it is invalid */
      ['pairs', 'items'].forEach(function (f) {
        if (!q[f]) return;
        var looksJson = q[f].charAt(0) === '[' || q[f].charAt(0) === '{';
        var hasPipe = q[f].indexOf('|') !== -1;
        if (looksJson) {
          try { JSON.parse(q[f]); }                     /* valid JSON — keep as is */
          catch (e) { if (hasPipe) q[f] = fromPipe(q[f], f); else q[f] = ''; }
        } else if (hasPipe) {
          q[f] = fromPipe(q[f], f);                     /* plain pipe-separated list */
        }
      });

      /* types that need no answer key (manual / tutor review) */
      var manualTypes = ['essay', 'code', 'short', 'case_study', 'matrix', 'hot_text', 'categorization'];
      var structuredTypes = ['matching', 'ordering', 'cloze', 'categorization', 'matrix', 'multi_numeric', 'hot_text'];
      var hasKey = q.ans !== '' || (structuredTypes.indexOf(type) !== -1 && (q.pairs || q.items));
      if (!hasKey && manualTypes.indexOf(type) === -1) {
        /* still include it as an MCQ fallback ONLY if options exist */
        if (type === 'mcq' || type === 'mrq' || type === 'tf') { if (!q.a && !q.b) return; }
      }
      out.questions.push(q);
    });
    return out;
  }

  /* ------------------------------------------------------------------
     CSV quoting helper
     ------------------------------------------------------------------ */
  function csvCell(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  /* ------------------------------------------------------------------
     toCBT17(questions) → CSV text in the HMG 17-column contract.
     `questions` may be internal-shape objects OR raw CSV-row arrays.
     ------------------------------------------------------------------ */
  function toCBT17(questions) {
    var lines = [CBT17_HEADER.map(csvCell).join(',')];
    (questions || []).forEach(function (q) {
      var v = (q && q.q !== undefined) ? q : normalizeAny(q);
      if (!v) return;
      var row = [
        v.q, v.a, v.b, v.c, v.d, v.ans, v.exp, v.type,
        (v.tolerance === undefined || v.tolerance === null) ? '' : v.tolerance,
        v.unit || '', v.accept || '',
        v.mrq_aon ? 'TRUE' : '',
        typeof v.pairs === 'object' ? JSON.stringify(v.pairs) : (v.pairs || ''),
        typeof v.items === 'object' ? JSON.stringify(v.items) : (v.items || ''),
        v.difficulty || '', v.tags || '', v.section || ''
      ];
      lines.push(row.map(csvCell).join(','));
    });
    return lines.join('\r\n');
  }

  /* ------------------------------------------------------------------
     toSchoolConnect(questions) → CSV text that imports cleanly into
     School Connect and GOSA Portal (their exact header contract).
     ------------------------------------------------------------------ */
  function toSchoolConnect(questions) {
    var lines = [SC_HEADER.map(csvCell).join(',')];
    (questions || []).forEach(function (q) {
      var v = (q && q.q !== undefined) ? q : normalizeAny(q);
      if (!v) return;
      var t = TO_SC_TYPE[v.type] || v.type || 'mcq';
      var row = [
        v.q, t, v.a, v.b, v.c, v.d, v.ans, v.exp,
        (v.mark === undefined || v.mark === null) ? 1 : v.mark,
        v.difficulty || '', v.tags || '',
        (v.tolerance === undefined || v.tolerance === null) ? '' : v.tolerance,
        v.section || ''
      ];
      lines.push(row.map(csvCell).join(','));
    });
    return lines.join('\r\n');
  }

  /* Accept raw row arrays from old exporters too */
  function normalizeAny(r) {
    if (!Array.isArray(r)) return r;
    return {
      q: cleanField(r[0]), a: cleanField(r[1]), b: cleanField(r[2]), c: cleanField(r[3]), d: cleanField(r[4]),
      ans: cleanField(r[5]), exp: cleanField(r[6]), type: (cleanField(r[7]) || 'mcq').toLowerCase(),
      tolerance: r[8] !== undefined ? Number(r[8]) || undefined : undefined,
      unit: cleanField(r[9]), accept: cleanField(r[10]),
      mrq_aon: String(cleanField(r[11])).toLowerCase() === 'true',
      pairs: cleanField(r[12]), items: cleanField(r[13]),
      difficulty: cleanField(r[14]), tags: cleanField(r[15]), section: cleanField(r[16])
    };
  }

  /* School Connect ships lists as a|b|c and pairs as left=right|left=right.
     Convert to the JSON shapes the HMG engine expects. */
  function fromPipe(v, field) {
    var parts = String(v).split('|').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!parts.length) return '';
    if (field === 'pairs') {
      return JSON.stringify(parts.map(function (p) {
        var kv = p.split('=');
        return { left: (kv[0] || '').trim(), right: (kv[1] !== undefined ? kv[1] : kv[0] || '').trim() };
      }));
    }
    return JSON.stringify(parts);
  }

  w.CSVBridge = {
    CBT17_HEADER: CBT17_HEADER,
    SC_HEADER: SC_HEADER,
    TYPE_ALIASES: TYPE_ALIASES,
    detect: detect,
    parse: parse,
    toCBT17: toCBT17,
    toSchoolConnect: toSchoolConnect,
    splitRows: splitRows,
    csvCell: csvCell
  };
})(window);

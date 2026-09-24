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


  /* ═══════════════════════════════════════════════════════════════════
     PHASE 12G — CSVBridge.doctor / normalizeQuestions
     PUBLISH-TIME data healing. The student app has healed question payloads
     at load since Phase 12D — but a student running ANY older build (or a
     cached shell) still saw the raw authoring shapes: assertion–reason items
     stored as a JSON OBJECT crashed the old renderer before the options,
     Pairs-column payloads were unread, and shifted 5-option rows carried
     option text in the answer field. Doctoring AT PUBLISH means the database
     itself only ever stores the canonical contract, so EVERY student build
     — old, cached or current — renders the paper correctly.
     Idempotent: doctoring an already-doctored question changes nothing.
     ═══════════════════════════════════════════════════════════════════ */
  function canonType(t) {
    var s = String(t || 'mcq').toLowerCase();
    if (TYPE_ALIASES[s]) return TYPE_ALIASES[s];
    return TYPE_ALIASES[s.replace(/[^a-z0-9]/g, '')] || s;
  }
  function parseMaybeJson(v) {
    if (v && typeof v === 'object') return v;
    if (typeof v !== 'string' || !v.trim()) return null;
    try { return JSON.parse(v); } catch (e) { return null; }
  }
  function asArray(v) {
    if (Array.isArray(v)) return v;
    var p = parseMaybeJson(v);
    if (Array.isArray(p)) return p;
    return null;
  }
  function doctor(q) {
    if (!q || typeof q !== 'object') return q;
    try {
      q.type = canonType(q.type);
      var t = q.type;

      /* literal \n / \r escapes inside question cells (AI-authoring artefact
         that rendered on screen as the two characters "\n") */
      if (typeof q.q === 'string') q.q = q.q.replace(/\\+r\\+n|\\+n|\\+r/g, ' ').replace(/\s{2,}/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();

      /* q.options: string (JSON or pipe) or object array → plain string array;
         backfill the a–e columns so every renderer/grader path works */
      if (q.options !== undefined && q.options !== null) {
        var _o = q.options;
        if (typeof _o === 'string') {
          var pj = parseMaybeJson(_o);
          _o = Array.isArray(pj) ? pj : _o.split(/[|;]/).map(function (x) { return x.trim(); }).filter(Boolean);
        }
        if (typeof _o === 'string') _o = [_o];
        if (Array.isArray(_o)) {
          q.options = _o.map(function (o) {
            return (o && typeof o === 'object') ? String(o.text !== undefined ? o.text : (o.label !== undefined ? o.label : (o.value !== undefined ? o.value : ''))) : String(o);
          }).filter(function (x) { return x.trim() !== ''; });
        } else q.options = [];
      }
      if (['mcq','tf','assertion_reason','case_study','image_mcq','evidence_mcq'].indexOf(t) > -1 && Array.isArray(q.options) && q.options.length) {
        for (var bi = 0; bi < 5 && bi < q.options.length; bi++) {
          var L = 'abcde'[bi];
          if (!q[L] || !String(q[L]).trim()) q[L] = q.options[bi];
        }
      }

      /* Pairs-column routing (prompt-studio contract) for structured types */
      var empty = function (v) { return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length); };
      if (empty(q.items) && !empty(q.pairs) && ['categorization','multi_numeric','matrix','ordering','cloze','hot_text'].indexOf(t) > -1) q.items = q.pairs;

      /* items: OBJECT JSON → one-element ARRAY (the stale-student crash fix),
         string JSON → parsed array.
         PHASE 12H — IMAGE EXCEPTION: image_mcq / hotspot / evidence_mcq keep
         items as an OBJECT — their renderers parse q.items as
         {"image":…} / {"image":…,"regions":[…]} / {"part1":…,"part2":…}.
         Array-wrapping those objects made every figure vanish. */
      var IMG_TYPES = ['image_mcq', 'hotspot', 'evidence_mcq'];
      var isImgType = IMG_TYPES.indexOf(t) > -1;
      var it = q.items;
      if (isImgType) {
        var io = it;
        if (typeof io === 'string') { var ipo = parseMaybeJson(io); if (ipo) io = ipo; }
        if (Array.isArray(io)) {
          if (t === 'evidence_mcq' && io.length > 1 && !(io[0] && io[0].part1)) io = { part1: io[0] || {}, part2: io[1] || {} };
          else io = io.length ? io[0] : null;   /* unwrap 12G-era arrays */
        }
        if (io && typeof io === 'object' && !Array.isArray(io)) {
          q.items = io;                                         /* OBJECT is canonical here */
          if (io.image !== undefined && !q.image) q.image = String(io.image);
          if (io.image !== undefined && q.media_url === undefined) q.media_url = String(io.image);
        } else if (io === null || io === undefined) {
          /* no structured items — seed from any flat image field so the
             figure still renders (manual-form authors put the URL in accept) */
          var flat = q.image || q.media || q.media_url || (/^https?:\/\/|^assets\/|^data:image\//i.test(String(q.accept || '')) ? q.accept : '');
          if (flat) { q.items = { image: String(flat) }; q.image = String(flat); if (q.media_url === undefined) q.media_url = String(flat); }
        }
      } else {
        if (it && typeof it === 'object' && !Array.isArray(it)) q.items = [it];
        else if (typeof it === 'string' && it.trim().charAt(0) === '{') { var po = parseMaybeJson(it); if (po && typeof po === 'object' && !Array.isArray(po)) q.items = [po]; }
        else if (typeof it === 'string' && it.trim().charAt(0) === '[') { var pa = parseMaybeJson(it); if (Array.isArray(pa)) q.items = pa; }
        if (Array.isArray(q.items)) q.items = q.items.filter(function (x) { return x !== null && x !== undefined && x !== ''; });
      }

      /* PHASE 12H — a plain MCQ that carries a media/image link is an
         image_mcq (bridge parity: the CSV bridge already promotes these) */
      if (t === 'mcq' && (q.media || q.media_url || (/^https?:\/\/|^assets\/|^data:image\//i.test(String(q.image || ''))))) {
        t = q.type = 'image_mcq';
        var msrc = q.image || q.media || q.media_url;
        if (!q.image) q.image = String(msrc);
        if (!q.items || (typeof q.items === 'object' && !Array.isArray(q.items) && !q.items.image)) q.items = { image: String(msrc) };
      }

      /* key-spelling normalisation */
      if (t === 'matching') {
        var decoys = [];
        var pr = asArray(q.pairs) || [];
        var norm = pr.map(function (p) {
          if (!p || typeof p !== 'object') return null;
          var left = p.left !== undefined ? p.left : (p.l !== undefined ? p.l : (p.a !== undefined ? p.a : ''));
          var right = p.right !== undefined ? p.right : (p.r !== undefined ? p.r : (p.b !== undefined ? p.b : ''));
          if (!String(left).trim() || /DISTRACTOR/i.test(String(left))) { if (String(right).trim()) decoys.push(String(right).trim()); return null; }
          return { left: String(left), right: String(right) };
        }).filter(Boolean);
        q.pairs = norm;
        if (decoys.length) {
          var dd = asArray(q.distractors) || [];
          q.distractors = Array.isArray(dd) ? dd : [];
          decoys.forEach(function (d) { if (q.distractors.map(String).indexOf(d) === -1) q.distractors.push(d); });
        }
      }
      if (t === 'categorization' && Array.isArray(q.items)) {
        q.items = q.items.map(function (r) {
          if (!r || typeof r !== 'object') return null;
          var item = r.item !== undefined ? r.item : (r.l !== undefined ? r.l : (r.left !== undefined ? r.left : (r.statement !== undefined ? r.statement : '')));
          var cat = r.category !== undefined ? r.category : (r.r !== undefined ? r.r : (r.right !== undefined ? r.right : (r.answer !== undefined ? r.answer : '')));
          if (!String(item).trim()) return null;
          return { item: String(item), category: String(cat) };
        }).filter(Boolean);
      }
      if (t === 'matrix' && Array.isArray(q.items)) {
        q.items = q.items.map(function (r) {
          if (typeof r === 'string') return r;
          if (!r || typeof r !== 'object') return null;
          var st = r.statement !== undefined ? r.statement : (r.row !== undefined ? r.row : (r.item !== undefined ? r.item : (r.l !== undefined ? r.l : (r.label !== undefined ? r.label : ''))));
          var an = r.answer !== undefined ? r.answer : (r.correct !== undefined ? r.correct : (r.r !== undefined ? r.r : ''));
          if (!String(st).trim()) return null;
          return { statement: String(st), answer: String(an) };
        }).filter(Boolean);
      }
      if (t === 'multi_numeric' && Array.isArray(q.items)) {
        q.items = q.items.map(function (p) {
          if (!p || typeof p !== 'object') return null;
          var answer = p.answer !== undefined ? p.answer : (p.ans !== undefined ? p.ans : (p.value !== undefined ? p.value : ''));
          var tol = p.tolerance !== undefined ? p.tolerance : (p.tol !== undefined ? p.tol : 0);
          return { label: p.label !== undefined ? p.label : (p.part !== undefined ? p.part : ''), answer: answer, tolerance: tol, unit: p.unit !== undefined ? p.unit : '' };
        }).filter(function (p) { return p.label !== '' || p.answer !== ''; });
      }

      /* assertion–reason stems — extract to q.assertion/q.reason from the
         items JSON in either documented shape, or the "A: … R: …" text */
      if (t === 'assertion_reason') {
        var A = '', R = '';
        var arr = Array.isArray(q.items) ? q.items : [];
        for (var ai = 0; ai < arr.length; ai++) {
          var o2 = arr[ai];
          if (!o2 || typeof o2 !== 'object') continue;
          if (o2.assertion !== undefined && String(o2.assertion).trim()) A = String(o2.assertion);
          if (o2.reason !== undefined && String(o2.reason).trim()) R = String(o2.reason);
          if (o2.a !== undefined && String(o2.a).trim()) A = String(o2.a);
          if (o2.r !== undefined && String(o2.r).trim()) R = String(o2.r);
        }
        if (!A && !R && Array.isArray(q.options) && q.options.length >= 2) { A = q.options[0]; R = q.options[1]; }
        if (!A && !R && typeof q.q === 'string') {
          var m = q.q.match(/^\s*(?:assertion|a)\s*[:.()\-]*\s*\)?\s*(.+?)\s*(?:;|\.|!|\?)?\s*(?:reason|r)\s*[:.()\-]+\s*\)?\s*(.+?)\s*\.?\s*$/i);
          if (m && m[1] && m[2]) { A = m[1]; R = m[2]; q.q = 'Study the Assertion and the Reason above, then choose the correct option below.'; }
        }
        if (A) q.assertion = A;
        if (R) q.reason = R;
      }

      /* the 5-option shift: CorrectAnswer column holds the FIFTH option
         statement, the key letter sits in the Explanation column */
      if (['mcq','tf','assertion_reason','case_study','image_mcq','evidence_mcq'].indexOf(t) > -1) {
        var key = String(q.ans == null ? '' : q.ans).trim();
        var expKey = String(q.exp == null ? '' : q.exp).trim().toUpperCase();
        if (key && !/^[A-E]$/.test(key.toUpperCase())) {
          if (/^[A-E]$/.test(expKey)) { if (!q.e) q.e = key; q.ans = expKey; q.exp = ''; }
          else {
            var cols = ['a','b','c','d','e'];
            var hit = -1;
            for (var ci = 0; ci < cols.length; ci++) if (q[cols[ci]] && String(q[cols[ci]]).trim().toLowerCase() === key.toLowerCase()) { hit = ci; break; }
            if (hit > -1) { if (!q.e && hit === 4) q.e = key; q.ans = cols[hit].toUpperCase(); q.exp = ''; }
          }
        }
        if (t === 'tf' && q.ans) {
          var kk = String(q.ans).trim().toLowerCase();
          if (kk === 'true') q.ans = 'A'; else if (kk === 'false') q.ans = 'B';
        }
        var up = String(q.ans == null ? '' : q.ans).trim().toUpperCase();
        if (/^[A-E]$/.test(up)) q.ans = up;
      }
    } catch (e) { /* never block a publish on one bad question */ }
    return q;
  }
  function normalizeQuestions(list) {
    if (!Array.isArray(list)) return list;
    return list.map(doctor);
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
    csvCell: csvCell,
    /* PHASE 12G: publish-time data doctor — call on every question before
       saving an exam, so the database only ever stores the canonical
       contract (works for every student build, old or new). */
    doctor: doctor,
    normalizeQuestions: normalizeQuestions,
    canonType: canonType
  };
})(window);

# PHASE 12H — IMAGE QUESTION AUDIT & FIX
**Date: 2026-09-20 · 29/29 suites · smoke 298/298 · new phase12h suite 22/22**

## The audit trail (every path a figure can travel)

| Path | Before 12H | After 12H |
|---|---|---|
| Teacher CSV import, `items` = `{"image":…}` string (documented guide format) | 12G doctor array-wrapped it → renderer's object parse failed → **no image** | items stays an OBJECT + flat `q.image` extracted → image renders |
| Teacher CSV import, hotspot row | image lost as above **and** the answer key was letter-stripped to `""` (ungradeable) | regions + image + free-text key all survive |
| Manual form (image URL in the Accept column) | worked via `q.accept` fallback in the renderer only | doctor seeds `items.image` + `q.image` — works in every renderer, review and speech |
| JSON/bridge import with `media` / `media_url` | bridge promoted mcq→image_mcq, but raw JSON imports with media didn't | heal promotes mcq+media → image_mcq everywhere |
| Already-published 12G rows (items now arrays) | **no image on every build** | student heal unwraps at load — fixed the moment 12H deploys |
| Evidence-based MCQ (part1/part2) | array rows lost both parts | 1-element arrays unwrap; 2-element arrays map to `{part1,part2}` |

## Root causes found (3)

1. **12G regression:** the doctor's object→array wrap (right for AR/case-study stale-safety) was applied to image types whose contract is an object.
2. **Pre-existing:** `cleanAns()` letter-stripped hotspot region-label keys.
3. **Pre-existing:** `_renderImageMCQ` source chain omitted `q.media`/`q.media_url`, and no load-time promotion existed for mcq+media outside the CSV bridge.

## What ships

- `csv-bridge.js` doctor: IMAGE EXCEPTION block (object-canonical items, array unwrap, flat-field extraction, mcq+media promotion, accept-URL seeding).
- `student.html`: 12H heal block (object-canonical items, unwrap arrays, promote mcq+media) + `_items12H()` shared tolerant parser + hardened `_renderImageMCQ`/`_renderHotspot`/`_renderEvidenceMCQ`.
- `teacher.html`: `cleanAns` free-text branch for hotspot.
- `cbt-types.js`: array-tolerant `parseObj`.
- Generator templates: identical copies of all four files (placeholders intact).
- sw cache → `hmg-cbt-shell-v12-phase12h-v1`.

## Verification highlights (phase12h suite, 22 checks)

- Real renderers extracted from student.html and executed on a DOM stub: 12G-array, string-object, object, accept-URL, mcq+media, hotspot-regions, evidence-parts shapes ALL render `<img src="…">` with the right URL.
- Real teacher import machinery: the built-in guide's image_mcq + hotspot example rows land in the DB with items objects, regions and intact keys.
- Regression guards: AR and case-study still array-wrap (12G contract unchanged).

## Deploy & heal

1. Upload `cbt-system-PHASE12G`→**`cbt-system-PHASE12H.zip`** (and the generator package for client builds). Verify `sw.js` shows `phase12h-v1`.
2. **No re-import needed for rendering**: the student-side heal fixes 12G-damaged rows at load.
3. (Recommended) Re-save affected papers via Question Bank → Save All Edits so the DB stores the canonical object form too.

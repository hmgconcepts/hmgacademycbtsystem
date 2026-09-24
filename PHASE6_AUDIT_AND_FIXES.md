# PHASE 6 — ROBUSTNESS, WORKSPACE HYGIENE & SEARCH DISCOVERABILITY

**Date:** 2026-09-11 · **Scope:** HMG Academy CBT Pro (`fixed-cbt-system`) + CBT System Generator (`cbt-generator-package`) · **Rules honoured:** free tools only, no AI APIs, no feature removal.

---

## Issue 1 — Robust, self-contained, international standards ✅

- **Security headers hardened:** `Strict-Transport-Security: max-age=31536000; includeSubDomains` added to `_headers` (on top of the existing nosniff / X-Frame-Options / Referrer-Policy / Permissions-Policy / X-Robots-Tag set).
- **PWA manifest verified complete** to W3C installability standards: `lang: en-NG`, `dir: ltr`, `scope`, `id`, `categories`, `display_override`, `launch_handler`, maskable icons, app shortcuts — description corrected to 20 question types.
- **Deployment validator strengthened:** now verifies (a) the sitemap lists every public page, (b) every public page (student, certificate, feature guide) carries description + canonical + Open Graph, (c) the homepage binds the HMG Concepts ecosystem links.
- **All configuration surfaces audited** — robots/sitemap/canonical/OG/JSON-LD/manifest/`_headers` now agree with each other (one canonical domain, one URL per page), which is the definition of seamless, standards-compliant discoverability.

## Issue 2 — Workspace cleaned ✅

| Removed | Size | Why safe |
|---|---|---|
| `ref-schoolconnect/`, `ref-gosaportal/`, `ref-schoolconnectdemo/` | 76 MB | Public GitHub reference repos (hmgconcepts/*) — re-clonable at any time; parity work completed & documented in Phase 5 |
| `original-cbt-system/` | 9.4 MB | Baseline preserved as `deliverables/cbt-system-ORIGINAL.zip` |
| `schema_parts/` | 84 KB | Intermediate scratch from the schema work; master + module extracts live in `database/` |
| Superseded zips (FIXED, PHASE3, PHASE4 ×2, generator-old) | ~24 MB | Each phase zip supersedes the last; PHASE6 pair is now current |

**Result: ~150 MB → ~34 MB, 197 files** — far below every snapshot limit, with the two working products, the full analysis suite and the current deliverables intact.

## Issue 3 — Search-engine discoverability → client + HMG Concepts ecosystem ✅

### HMG CBT system (hmgcbtsystem.vercel.app)
- **One canonical domain everywhere:** robots.txt (Sitemap + Host), sitemap.xml (all 7 public URLs), canonical + og:url + og:image + Twitter card on every public page, and the JSON-LD `@id`/`url`/`SearchAction` all unified on `https://hmgcbtsystem.vercel.app` (previously three different domains fought each other).
- **Full SEO heads added** to `student.html`, `certificate.html` and `feature_guide.html` (description, robots, canonical, Open Graph, Twitter).
- **Ecosystem binding:** the homepage footer now links **School Connect, GOSA Portal and the CBT System Generator**, and the JSON-LD `Organization.sameAs` declares the same properties — search engines see (and surface) the whole HMG Concepts ecosystem, and every property funnels visitors to the others.

### Generated client systems (the generator's output)
- **New `brandSeo()` packaging pass** resolving the client-site-URL placeholder token in every HTML page, `llms.txt`, `robots.txt` and `sitemap.xml`:
  - **Deployment URL provided** → absolute, search-perfect URLs: canonical, og:url, og:image, JSON-LD, robots Sitemap, and a 7-page sitemap all point at the client's live domain from day one.
  - **No URL yet** → domain-agnostic root-relative canonical/OG URLs (correct on ANY domain they later deploy to — never a wrong-domain canonical), plus explicit `https://YOUR-DEPLOYMENT-URL` markers in robots/sitemap with in-file instructions.
- **Client identity + ecosystem attribution:** the packaged homepage keeps the client's brand (name, colours, fonts) and adds *"Explore the HMG Concepts ecosystem: School Connect · GOSA Portal · CBT System Generator"* — generated platforms point people to the client **and** back to the ecosystem.
- **Leak scan extended:** an unresolved client-site-URL placeholder token now aborts the build, exactly like credential tokens.
- **Wizard upgraded:** the Deployment URL field explains exactly what it powers (sitemap/canonical/social tags) and what happens when left blank.
- **`DEPLOYMENT.md` + "Make the platform searchable"** — step-by-step Google Search Console, Bing Webmaster Tools (which powers Yahoo) and DuckDuckGo submission, plus the one-line robots/sitemap fix for the no-URL case.

### Generator's own site (cbtgen.vercel.app)
- Landing page: keywords, robots, canonical, full Open Graph + Twitter cards, and a JSON-LD `@graph` (SoftwareApplication + WebSite) crediting HMG Concepts.
- `generator.html` (the 4-step wizard): description, robots, canonical and OG tags added.
- sitemap/robots already correct for the two public pages.

## Issue 4 — Every file updated across all repos ✅

- 16 changed files re-synced from the fixed system into `templates/` with **both** tokenisations (credentials + site URL) — verified zero unexplained differences after token application.
- Tests extended: generator E2E now builds **two** packages (with and without a deployment URL) and asserts canonical/og:url/robots/sitemap rewriting, ecosystem attribution, and zero unresolved tokens in both modes; HTTP smoke grew 85 → **100 checks** (per-page SEO heads, robots/sitemap domains, HSTS, tokenised templates, generator JSON-LD).

## Verification

| Suite | Result |
|---|---|
| All 13 JS suites (prompt studio 452, audit 583, csv-bridge 57, guard, runtime, calc 75, license 12, …) | ✅ pass |
| Generator build E2E (2 modes) | ✅ 82/82 files + 16 SEO assertions |
| HTTP smoke | ✅ **100 ok** |
| manifest.webmanifest / sitemap.xml ×3 | ✅ valid JSON / XML |

## Deliverables

- `cbt-system-PHASE6.zip` — full platform, original folder structure.
- `cbt-generator-PHASE6.zip` — generator + tokenised templates.

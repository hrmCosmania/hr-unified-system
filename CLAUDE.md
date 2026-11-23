# PeopleConnect — HR Unified System

Internal HR web app for two sister companies:
- **CMN** — บริษัท คอสเมเนีย แลบอราทอรี่ส์ จำกัด
- **CIL** — บริษัท คอสซูติค อินโนเวชั่น แลบอราทอรี่ส์ จำกัด

UI text is Thai. Most records carry a `company` field (`CMN` / `CIL`), and the top bar filters by CMN / CIL / ALL.

Live site: https://hr-unified-system.vercel.app (`/probation` for the probation form, `/namecard.html` for business cards).

## Working with the owner

- The owner works in HR and is not a developer. Explain things in Thai, step by step, in plain words. Spell out any terminal command they must run themselves.
- They switched from a Windows PC to this Mac on 2026-11-18. Excel source files (employee lists, JD workbook) stayed on the Windows Desktop and are not in this repo.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole main app (~8,100 lines, 3.8 MB). HTML, CSS and JS in one file. No build step, no framework. |
| `probation/form/index.html` | The one probation evaluation form. No Supabase: it posts to a Google Apps Script web app (`SHEET_URL`) and exports PDF with html2pdf. The HR dialog (`probationEvalOpen`) builds its link with the employee's details and KPI rows (`?emp_id=&…&job_code=&kpi=`), and the form fills itself from them. |
| `probation/results/index.html` | Search and print past probation evaluations, read from the same Apps Script (`doGet`). `?q=<code or name>` searches on load. **Known gap: it is public and needs no login, and the Google Sheet is "anyone with the link", so anyone with the URL can read evaluation scores. Protect it before relying on it.** |
| `probation/index.html` | Redirect only: old links to `/probation` go to `/probation/form/` and keep the query string. |
| `check.js` | `node check.js` — syntax check of every script, a check that `TAB_RENDERERS.x = fn` points to a function that already exists, unit tests of the employee Excel import (fake data), and a list of functions declared twice. `node sync.js push` runs it first and stops on failure. |
| `namecard.html` + `namecard-assets/` | Business-card QR generator. `cardbg*.js` are ~2.3 MB base64 card backgrounds; `index.html` also loads them. |
| `api/*.js` | Vercel serverless functions (Node, CommonJS `module.exports = handler`). |
| `*.sql` | One-time Supabase setup scripts. The owner runs them by hand in Supabase Dashboard → SQL Editor. |

There is no `package.json`, no tests and no linter.

## How `index.html` is organised

The file grew by stacking patches. **Later `<script>` blocks override earlier ones**, so a function name can be defined several times and only the last one wins. Examples: `showTab`, `renderEmployeesTable`, `editEmployee`, `renderProbationTable`, `setCompanyFilter`. Some blocks also wrap an earlier function, as in `var originalSaveDB = window.saveDB; window.saveDB = function(){ … }`.

Before you edit a function, `grep -n "function NAME"` and change the **last** definition, or the one that is actually live. Editing an earlier copy has no effect.

Rough layout (line numbers drift as the file changes):
- ~17: Supabase client (`SUPABASE_URL`, public anon key)
- ~576: `HR_SEED_DATA`, one ~2 MB line. Seed employees are **sanitized fake data**: `privacy: FULLY-SANITIZED-fake-names-phones-emails-DEV-ONLY`.
- ~771–3424: core app: `DB_KEY`, `defaultDB()`, `migrateDB()`, `saveDB()`, `showTab()`, renderers
- ~3426: `HR_V4_ORG_SEEDS` (org chart seed)
- After that, named blocks: `hr-v43-script`, `hr-v47-script`, `supabase-sync-script`, `sidebar-shell-script`, `jd-template-import-2025` (`JD_TEMPLATE_IMPORT_2025`, a ~1 MB line), `topbar-extras-script`, `company-scope-helpers`, `theme-toggle-script`, `calendar-sync-script`, `recruitment-module-script`

The ~2 MB and ~1 MB single lines will flood your output. Never `cat` the file or print those lines. Use `grep -n … | cut -c1-200` and `sed -n 'A,Bp'` on targeted ranges.

### Tabs / modules

`showTab(name)` switches tabs. The sidebar buttons are `.tab-btn[data-tab=…]`: dashboard, employees, orgchart, onboarding, jobpositions, training, reports, settings. Three tabs are injected later by script: `performance-tracking`, `documents` and `recruitment`. `body[data-module]` only sets the accent colour. There are **no roles or permissions**: every logged-in user can see and edit everything.

## Data model

All HR data is **one JSON object, `DB`**:
- It lives in `localStorage` under `cmncil_hr_unified_v1`, with local backups under `cmncil_hr_unified_v1_backups`.
- It is mirrored to Supabase table **`hr_db`**, row `id = 'main'`, column `data` (jsonb).
- `supabase-sync-script` loads the cloud row after login. The wrapped `saveDB()` pushes the whole object back, debounced 800 ms. **Whoever saves last overwrites the whole object.** There is no merge and no per-record locking.
- `migrateDB(raw)` runs on every load. It fills in missing keys from `defaultDB()` and upgrades legacy fields. **When you add a new top-level array to `DB`, add it to both `defaultDB()` and the array list in `migrateDB()`.** Otherwise old cloud data has `undefined` and every `.push()` breaks.
- The main keys are `employees`, `jd`, `kpiDefinitions`, `competencies`, `orgCharts` (`{CMN, CIL}`), `probationActions`, `trainingCourses`, `trainingEnrollments`, `performanceReviews`, `onboardingChecklists`, `recruitmentRequisitions`, `recruitmentCandidates` and `settings`.

## Supabase

Project ref: `zkqewnwulnugbhndtnkr`. The anon key is hard-coded in `index.html` and `api/*.js` on purpose, because it is public by design. Never put a `service_role` key in any file in this repo.

| Object | Used by | Access |
|---|---|---|
| table `hr_db` | main app data | logged-in users |
| storage bucket `resumes` (private) | recruitment résumé files | logged-in users (`recruit_setup.sql`) |
| `recruit_pulse_tokens`, `recruit_pulse_responses` + RPC `submit_recruit_pulse` | Click Pulse survey | RPC callable by anon; one-time token |
| `hr_calendar_feed` + RPC `get_calendar_feed` | HR calendar ICS feed | RPC callable by anon with a 48-hex secret token |

Users log in with email and password (`supabaseClient.auth.signInWithPassword`), through the `#authGate` overlay. `#authGate` is only a cover on the page — real protection is the database policy. **Logging out saves any pending edit first, then deletes the cached copy of the HR data in this browser** (`localStorage` keys starting with `cmncil_hr_unified_v1`). Locally kept résumé files in IndexedDB are not deleted, because they may be the only copy. RLS policies grant `auth.role() = 'authenticated'`.

## API routes (`/api/…`)

- `calendar.js` — `GET /api/calendar?token=<48 hex>` returns the ICS feed (Google Calendar subscription: birthdays, 1/3/5-year work anniversaries, probation dates).
- `pulse.js` — `GET /api/pulse?token=<32 hex>&score=1..5` is the hiring-manager satisfaction link from email. It returns a small Thai HTML page.
- `ocr.js` — `POST /api/ocr` (needs the Supabase user's Bearer token) is an *optional* AI résumé reader. It uses `GEMINI_API_KEY` or, if that is blank, `ANTHROPIC_API_KEY` from Vercel env vars. Without a key it returns `{status:'not_configured'}`. The app then reads résumés **in the browser** with pdf.js plus tesseract.js OCR (Thai and English) and rule-based parsing.

## Deploying

- Hosting is Vercel (team `hrm-5957s-projects`, project `hr-unified-system`). This folder is linked through `.vercel/`, which is gitignored.
- **A push to `main` on GitHub (`hrmCosmania/hr-unified-system`) deploys production automatically.** On 2026-11-18, a GitHub web-upload commit started a production deploy 3 seconds later. `vercel --prod --yes` also works for a manual deploy.
- Every push to `main` therefore goes live right away. Only commit or push when the owner asks.
- Vercel serves every file in the repo as a static file. `.vercelignore` keeps `CLAUDE.md` and local secrets off the site, so add any other internal-only file there.
- Commit message style: `Module: what changed in plain words`. Example: `Recruitment: keep local copy of resumes so attached files always open`.

## Syncing between computers (pull / push)

`sync.js` wraps git for the owner (Node only, no install). Run from this folder:

```bash
node sync.js status          # is this machine up to date?
node sync.js pull            # fetch latest work from GitHub (fast-forward only; refuses if local edits are unsaved)
node sync.js push "Module: what changed"   # commit + rebase onto GitHub + push (production deploys automatically)
```

Flags: `--yes` (no prompts, includes new files) and `--dry-run` (show only). Double-click launchers: `pull.cmd` / `push.cmd` (Windows), `pull.command` / `push.command` (Mac; first time `chmod +x *.command`). All of these are listed in `.vercelignore`. When the owner says "pull" or "push", run these.

## Checking changes

**Run `node check.js` before every commit.** It catches syntax errors and the "`X is not defined` at load" class of bug (a top-level statement that refers to a function declared in a *later* `<script>` — function hoisting only works inside one script block). When you add a new top-level `TAB_RENDERERS.x = fn` line, put it in the same block as `fn` or after it.

Beyond that there are no automated UI tests. Serve the folder and open it in a browser:

```bash
python3 -m http.server 8000
```

Use a server, not `file://`, because `index.html` loads `/namecard-assets/*.js` by absolute path. `/api/*` routes need `vercel dev`. Most screens sit behind the Supabase login, which uses the owner's real account. Don't enter credentials: ask the owner to sign in in the browser pane. Check the browser console for errors after each change.

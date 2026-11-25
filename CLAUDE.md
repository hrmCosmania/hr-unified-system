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
| `script#annual-appraisal-script` (end of `index.html`) | **ประเมินประจำปี** sub-menu of Performance Tracking. Layout and scoring follow HR's standalone appraisal app (home / evaluation list + form with live summary / results / HR attendance & discipline / cycle settings / criteria + calculator). Scoring (`AP_SCORING`: weights 70/20/10 or 60/30/10, behaviour max 50/75, attendance 50, discipline 40, grades A–E, bonus/raise rules) is copied unchanged and tested in `check.js`. Data is read from the main DB (employees + `level`, `jobCode` → `competencies` / `kpiDefinitions` / `competencyDictionary`, `attendanceRecords`); results live in `DB.annualAppraisal` (`settings`, and per-year `evals`/`att`/`disc`/`evaluators`/`flags`). Eligibility = full tenure of at least 1 year on the cycle's last day (`tenureOk`) and not exempted by HR; people who fail it are listed under "ไม่อยู่ในเกณฑ์" with the reason. Having an evaluator is NOT a condition: people for whom none can be found stay in the list with a "ยังไม่กำหนดผู้ประเมิน" tag (evaluator search falls back to the sister company), and HR picks one or exempts them (flag `exempt`). Evaluator = org-chart parent if level ≥ M1, else same-department M1+, overridable per person. No role gating: everyone can edit while phase ≤ 3. Do not copy employee names from the standalone app's `framework.json` into this public repo. |
| Startup loading screen | No login-form flash when returning from a sub-app: the first `<script>` in `<head>` adds `html.auth-checking` when a saved Supabase session exists (`localStorage['sb-zkqewnwulnugbhndtnkr-auth-token']`); CSS then shows `#authGateLoading` (HR mark + spinner) instead of `.auth-gate-box`. `supabase-sync-script` removes the class in `hideAuthGate()` (data loaded) or `showAuthGate()` (no/expired session → login form). After 4 s the text says the network is slow; if the session check itself has not answered in 15 s the form is shown. |
| Company selection | `script#company-select-script` (end of `index.html`). Only **CMN** or **CIL** (no ทุกบริษัท); the old toggle (`#companyToggle .cf-btn`) is hidden. Login first, then a required popup (no cancel) asks for the company; the choice is kept per browser tab in `sessionStorage.hru_company` (reload keeps it; logout/SIGNED_OUT or a new tab asks again, pre-selecting the last choice from `localStorage.hru_company`). Later: **⇄ เปลี่ยนบริษัท** in the top bar → dialog → **ยืนยันเปลี่ยนบริษัท**. Both call the existing `setCompanyFilter()`, so all filtering works as before; the launcher's counts follow it (`hrRefreshLauncher`). |
| App launcher (5 HR sub-apps) | `script#app-launcher-script` (end of `index.html`). After login the page shows **เลือกหมวดงาน HR** (`#appLauncher`, `body.app-home`): an Apple-style icon grid (panel หมวดงาน HR = 5 apps 01–05, panel เครื่องมือส่วนกลาง = 6–10). Icons are PNGs in `app-icons/` (`rec, cb, pm, ld, er, dashboard, employees, reports, documents, settings`), cut from the owner's design image; the sidebar header shows the current app's icon (`ICON(key)`). All apps share the same DB. `APPS` maps each card to sidebar tabs: 1 rec = orgchart, jobpositions, recruitment, onboarding (birthday sub hidden) · 2 cb = link to `/payroll/#/employees` (payroll menu has **ฐานข้อมูลพนักงาน** before step 1, `PL.Views.employees` in `payroll/js/views/settings.js`, reusing Settings > พนักงาน) · 3 pm = link to `/performance/` (GrowTogether). The old HR `performance-tracking` tab (attendance, leave quota, OKR, monthly KPI, 1-year and annual appraisal) is in no app any more, so it is hidden (owner's request 2026-11-25); its code and data stay (`allAttendanceRecords`/`getLeaveUsed` still feed the profile leave card, `DB.annualAppraisal` is kept) — add `'performance-tracking'` back to an `APPS[].tabs` list to show it again · 4 ld = link to `/training/` (the old HR `training` tab is no longer in any app) · 5 er = a virtual button `[data-al="er-bday"]` that opens onboarding > birthday. Shared tools row (`common`) = dashboard, employees, reports, documents, settings. The sidebar is filtered by generated CSS on `body[data-app]` (`style#app-launcher-filter`), and items are ordered with inline `order`. `showTab()` is wrapped: opening a tab outside the current app switches to the app that has it. Chosen app is kept in `sessionStorage.hru_app`; `/#home` (payroll's ← กลับระบบ HR) and logout return to the launcher. When adding a new tab, add it to one `APPS[].tabs` (or `COMMON`) or it is hidden. |
| `apps/performance/` → `performance/` | **GrowTogether** (the owner's PM module: React 19 + Vite 8 + Tailwind 4 + TypeScript) = Performance Management **sub-app** at `/performance/`, opened directly from launcher card 03. **Screen preview only:** every page still uses built-in sample data (`src/data/mock.ts`); `src/data/api.ts` (live calls to schema `pm`) is not wired in, and a banner says so. On 2026-11-25 the owner chose to open GrowTogether directly from card 03 and remove the old HR performance menus from the UI; GrowTogether is being connected to real data page by page. Its database (schemas `pm`, 38 tables + `pm_integration`) was installed earlier in this Supabase project from `apps/performance/supabase/` (see `MODULE-README.md`); live mode would also need `pm` added to Data API exposed schemas and HR employees synced into `pm.employees`. One login like the other sub-apps (`src/lib/supabase.ts` HOST/hosted, `HostGate` in `src/App.tsx` → `/?next=/performance/...`, logout clears HR cache, **กลับระบบ HR** → `/#home`; `?demo=1` = the app's own demo login). Build: `npm --prefix apps/performance ci` then `npm --prefix apps/performance run build` (writes `performance/`; runs `tsc` first). |
| `apps/training/` → `training/` | **PeopleGrow HRD** (the owner's TR Module: React 18 + Vite + Tailwind) = the L&D **sub-app** at `/training/`, like payroll. Source in `apps/training/` (not served: `.vercelignore` has `apps`; `node_modules` git-ignored); the **built files in `training/` are committed** because Vercel does no build. After changing the source: `npm --prefix apps/training ci` (first time) then `npm --prefix apps/training run build` (writes `training/`, base `/training/`, HashRouter). `check.js` 1c checks the build. **One login:** `src/lib/db.js` uses this Supabase project (public key, same as `payroll/js/config.js`) with the default storage key = same session; no session → `/?next=/training/...` (HR page allows `/payroll/` and `/training/`); logout clears HR cache keys and returns to `/`; sidebar has **กลับระบบ HR** → `/#home`. `?demo=1` = original demo mode with fake data in the browser only. **Shared DB:** tables `hrd_*` (migrations `apps/training/supabase/migrations/001–003`, **applied 2026-11-24** with the owner's go-ahead). `003` replaces `hrd_sync_from_hrm()` to read `hr_db` (company → business unit, `company-department` → department, `jobCode` → position with level O/S/M/D → job_level, `parentId` → manager, Inactive/missing → resigned, login email → `auth_user_id`); it runs automatically once per tab when an admin/HR opens the app, and from the page เชื่อมต่อระบบ HRM. Roles in `hrd_user_roles` (payroll admins were made admins; others = employee, see only themselves). Settings can import only the sample **catalog** (competencies, courses, modules, trainers) — never sample employees. |
| `payroll/` | **Payroll Full Loop** (time attendance in 9 steps → payroll, tax, social security, payslips) = the payroll **sub-app** of this system, full screen at `/payroll/` with its own look and menu (the owner likes its UX). Sidebar button **💰 เงินเดือน ↗** (`script#payroll-module-script`) just opens `/payroll/`; the payroll menu has **← กลับระบบ HR** (`.back-host` in `payroll/index.html`). **One login:** same Supabase project (`payroll/js/config.js`) and `PL_CONFIG.hostApp` makes `payroll/js/cloud.js` use Supabase's default storage key, i.e. the same browser session as this app. Not signed in → it redirects to `/?next=/payroll/...`; this page shows "เข้าสู่ระบบเพื่อไปที่ระบบเงินเดือน" and returns to `next` after login (only `/payroll/` paths are allowed). Logging out in either app logs out of both and clears the HR cache. **One employee list:** for admin/HR the payroll app auto-syncs codes/names/departments/positions/start dates from `hr_db` (`select employees:data->employees`) on open (`App.autoSyncHR`); salaries and bank data exist only in payroll. Data: tables `plfl_*` (`payroll/supabase/001_plfl_schema.sql`). **Done on 2026-11-24** (migration `plfl_schema` applied with the owner's go-ahead; both existing HR login accounts set to payroll `admin`). Do NOT run `002_plfl_hru_roles.sql` here (it is for the other HR app); the users page falls back to `plfl_profile`. Payroll access is role-based in `plfl_profile` (admin / hr / accountant / manager; new users are `pending` and see nothing). The embedded/iframe mode (`HRU`, `body.embedded`) is not used here any more. Docs `payroll/README.md`, `NEXT-STEPS.md`; tests `payroll/tests/*.test.js` run from `check.js`. **Shared ขาด ลา มาสาย (attendance):** payroll is the master. `script#payroll-attendance-script` in `index.html` reads `plfl_doc` (`employees`, `config`, every `period:*` → `data->calc`) after login, turns calc rows into HR-style records (`source:'payroll'`, `days` 0.5/1, late minutes, leave type mapped to `LEAVE_SUBTYPES`) and keeps them in memory as `window.payrollAttendance` (never saved to `hr_db`). `allAttendanceRecords()` (global) = HR's own `DB.attendanceRecords` minus any employee-day the payroll calc covers + the payroll rows; the attendance table/summary, `getLeaveUsed` (leave balance, sums days), the profile leave card and the annual appraisal `autoAtt` all use it. Payroll rows show "จากระบบเงินเดือน" and cannot be edited in HR. Accounts without a payroll role get nothing back (RLS) and see only HR's own records. Tests: `check.js` section 3d. |
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

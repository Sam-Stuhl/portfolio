# samstuhl.com/resume

Written 2026-09-03. The first thing to ever serve on `samstuhl.com`. The
portfolio site itself is explicitly not in scope; this plan builds only the
résumé endpoint, in a way that does not pre-decide how the portfolio is built
later.

## Goal

`https://samstuhl.com/resume` renders `Sam-Stuhl/resume`'s `resume.json` as
HTML that mirrors the compiled PDF's layout, and `https://samstuhl.com/resume.pdf`
downloads the PDF as `Samuel-Stuhl-Resume.pdf`. Both update on their own within
about a minute of Careerbase pushing a résumé change.

## Approach

A single Cloudflare Worker on the apex. The console cannot serve this: every
console project routes as ``Host(`<subdomain>.<domain>`)`` and `subdomain` is a
required field (`console/src/console/deploy/plan.py:59`,
`console/src/console/schema/console_toml.py:33`), so an apex path is outside
its model. A Worker also means the page does not depend on the Mac mini being
up, which matters for the one URL that goes on a job application.

Nothing is fetched at request time. A build step pulls `resume.json` and
`resume.pdf` from GitHub, renders the HTML once, and bakes both into the Worker
bundle. A request therefore touches Cloudflare and nothing else: no GitHub
dependency, no cold-path latency, no failure mode where the résumé 500s because
someone else's API is down. The cost is a deploy on every résumé change, which
is what the `repository_dispatch` wiring in phase 5 buys.

Design is prototype A from the interrogation: a faithful mirror of the PDF, so
the page and the download are recognisably the same document.

## Files

Created, all in a new `Sam-Stuhl/portfolio` repo (this worktree):

| path | what |
| --- | --- |
| `wrangler.jsonc` | Worker config, custom domain, PDF bundling rule |
| `package.json`, `package-lock.json` | wrangler + TypeScript, two npm scripts |
| `tsconfig.json` | strict TS, Workers types |
| `build/fetch-resume.mjs` | pulls resume.json and resume.pdf from GitHub |
| `build/render.mjs` | resume.json to HTML string, the prototype A renderer |
| `build/assets/resume.json`, `build/assets/resume.pdf` | fetched, gitignored |
| `src/generated/resume-html.ts` | generated, gitignored |
| `src/index.ts` | the Worker: routing, headers, 404 |
| `.github/workflows/deploy.yml` | build and `wrangler deploy` |
| `docs/plans/2026-09-03-resume-endpoint.md` | this file |
| `docs/prototype-pdf-mirror.html` | the approved design, committed as the renderer's reference |
| `CLAUDE.md` | project rules (replaces the copied workspace one) |
| `.gitignore` | node_modules, build/assets, src/generated |

Modified elsewhere:

| path | what |
| --- | --- |
| `Sam-Stuhl/resume/.github/workflows/notify-site.yml` | new: fires `repository_dispatch` |
| `~/Desktop/repos/CLAUDE.md` | new `portfolio` entry in the project map |

## Risks

- **The apex is claimed by this Worker.** A Workers custom domain takes the
  whole hostname, not one path, so `samstuhl.com/*` reaches the Worker and
  everything that is not `/resume` or `/resume.pdf` gets a bare 404. That is
  the agreed "leave the apex dead" behaviour, but it means the future portfolio
  either goes through this Worker or replaces the custom domain. Replacing it
  is a one-line wrangler change, so this is a note, not a trap.
- **`resume` is a machine-written repo.** Careerbase pushes to it on every
  save. Phase 5 adds a workflow file there, which Careerbase has no reason to
  touch (it commits `resume.json` and `resume.pdf` only), but the first live
  résumé edit after phase 5 is the real test, and phase 5's milestone is
  exactly that.
- **Push events may not fire if Careerbase pushes with a `GITHUB_TOKEN`.**
  Pushes made with a repository's own Actions token deliberately do not trigger
  workflows. Careerbase is an external app so this should not apply, but if the
  phase 5 milestone shows no workflow run, the fallback is the scheduled-poll
  variant (a cron workflow in `portfolio` comparing `resume.json`'s blob SHA),
  which needs no cooperation from the résumé repo at all.
- **Prototype A is a print layout on a phone.** 12.5px justified serif in a
  0.6in-margin sheet is fine at desktop width and cramped at 390px. Phase 3
  adds a narrow-viewport concession (larger base size, ragged-right instead of
  justified, tighter margins) that keeps the layout and only touches
  readability.
- **Contact details go public.** The page renders the phone number and personal
  email as the PDF does, by explicit decision. Expect scraping. If that turns
  out to be unpleasant, the fix is one line in the renderer, not a redesign.

## Phase 1: a Worker answering on the apex

The riskiest part is DNS and certificates, not rendering, so prove that first
with a Worker that has no content in it.

Scaffold the repo: `package.json` with `wrangler` as the only dependency,
`tsconfig.json`, `.gitignore`, and `src/index.ts` that returns `404` with a
plain `not found` body for every path except `/resume`, which returns a
`200 text/plain` placeholder. `wrangler.jsonc` declares `name: "portfolio"`,
today's `compatibility_date`, and a custom domain route:

```jsonc
"routes": [{ "pattern": "samstuhl.com", "custom_domain": true }]
```

A custom domain makes Cloudflare create the apex DNS record and issue the
certificate, which is why no placeholder A record is needed.

Before this phase runs: creating a public `Sam-Stuhl/portfolio` on GitHub and
pointing `samstuhl.com` at a Worker are both outward-facing, so I confirm with
Sam at the moment of doing each, not just here.

Deploy by hand this once (`npx wrangler deploy`), because CI does not exist
until phase 4.

**Milestone**

```bash
curl -sS -o /dev/null -w 'resume=%{http_code} root=' https://samstuhl.com/resume && curl -sS -o /dev/null -w '%{http_code}\n' https://samstuhl.com/
```

Expect `resume=200 root=404`, with a valid certificate (no `-k` needed).

## Phase 2: the renderer

`build/fetch-resume.mjs` downloads `resume.json` and `resume.pdf` from
`https://raw.githubusercontent.com/Sam-Stuhl/resume/main/` into `build/assets/`,
failing loudly on a non-200 or on JSON that does not parse.

`build/render.mjs` turns that JSON into the HTML string, porting the prototype
already built and approved at
`docs/prototype-pdf-mirror.html`. It handles all six section types present
in the file (`text`, `roles`, `projects`, `skills`, `education`), escapes every
interpolated value, omits the date line when `start_date` and `end_date` are
both empty (Leadership entries have neither), omits the GPA line when `gpa` is
empty (NJIT has none), and ignores the `_fact` blocks entirely. An unknown
section `type` is skipped with a warning rather than crashing the build, so a
future Careerbase section cannot take the site down.

Output is written to `src/generated/resume-html.ts` as
`export const RESUME_HTML = "..."`, and `src/index.ts` starts serving it at
`/resume` with `content-type: text/html; charset=utf-8`.

Two npm scripts: `build` (fetch then render) and `dev` (`build` then
`wrangler dev`).

**Milestone**

`npm run build && npx wrangler dev`, then load `http://localhost:8787/resume`
in the browser and screenshot it. The screenshot must match the approved
prototype: centred name, small-caps section headings with rules, two-column
role rows with dates right-aligned, four skill lines, both education entries
with only Timothy Christian showing a GPA.

## Phase 3: the PDF, the headers, and the mobile concession

Add the PDF bundling rule to `wrangler.jsonc`:

```jsonc
"rules": [{ "type": "Data", "globs": ["**/*.pdf"] }]
```

and `import resumePdf from "../build/assets/resume.pdf"` in the Worker, which
arrives as an `ArrayBuffer` (106 KB, far inside the bundle limit).

Routing in `src/index.ts` becomes explicit:

- `GET /resume` renders the HTML
- `GET /resume.pdf` returns the PDF with
  `content-type: application/pdf` and
  `content-disposition: attachment; filename="Samuel-Stuhl-Resume.pdf"`
- `GET /resume/` issues a `308` to `/resume`
- `HEAD` is handled for all three
- any other method gets `405` with an `allow` header
- everything else gets `404`

Both assets carry `cache-control: public, max-age=300, must-revalidate` and an
`etag` derived from the build (a hash of the rendered HTML and the PDF bytes),
with `304` on a matching `if-none-match`. Five minutes is short enough that a
résumé change is never stuck behind a stale edge cache for long.

The HTML gains a `<html lang="en">`, a `<title>`, a `<meta name="description">`
drawn from the summary section's first sentence, and Open Graph tags, so a link
pasted into a message unfurls as a résumé rather than a bare URL. The download
link in the page points at `/resume.pdf`, not GitHub.

The narrow-viewport block, the only deviation from the print layout:

```css
@media (max-width: 640px) {
  .sheet { margin: 0; padding: 24px 18px 32px; box-shadow: none; }
  li, p.summary { font-size: 15px; text-align: left; }
  .row { flex-direction: column; }
  .right { white-space: normal; }
}
```

**Milestone**

```bash
curl -sSI https://samstuhl.com/resume.pdf | grep -iE 'content-type|content-disposition|etag'
```

after the phase 4 deploy, and before it, the same against `wrangler dev`. Plus
the browser at 390px wide showing dates below titles rather than crushed
against them, and the downloaded file opening as the real résumé.

## Phase 4: CI deploy

`.github/workflows/deploy.yml`, triggered by `push` to `main`,
`repository_dispatch` with `types: [resume-updated]`, and `workflow_dispatch`
for manual reruns. Steps: checkout, `actions/setup-node` pinned to Node 22 with
npm cache, `npm ci`, `npm run build`, then `npx wrangler deploy`, with
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from repo secrets. Concurrency
group `deploy` with `cancel-in-progress: true`, so two résumé saves in quick
succession do not race each other onto the edge.

Sam sets both secrets; I never see the values. The token needs the
"Edit Cloudflare Workers" template, scoped to the `samstuhl.com` zone:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo Sam-Stuhl/portfolio
```

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --repo Sam-Stuhl/portfolio
```

Both read the value from the prompt, not from an argument, so neither lands in
shell history.

**Milestone**

Push a trivial commit to `main` and watch `gh run watch`. The run goes green and
`curl -sS https://samstuhl.com/resume | grep -c 'Samuel Stuhl'` returns `1`
against the freshly deployed Worker.

## Phase 5: the résumé repo notifies the site

`Sam-Stuhl/resume/.github/workflows/notify-site.yml`, on `push` to `main`
filtered to `resume.json` and `resume.pdf`, one step:

```yaml
- run: gh api repos/Sam-Stuhl/portfolio/dispatches -f event_type=resume-updated
  env:
    GH_TOKEN: ${{ secrets.PORTFOLIO_DISPATCH_TOKEN }}
```

`PORTFOLIO_DISPATCH_TOKEN` is a fine-grained PAT scoped to `Sam-Stuhl/portfolio`
alone with `Contents: Read and write`, which is what `repository_dispatch`
requires. Sam creates it and sets it:

```bash
gh secret set PORTFOLIO_DISPATCH_TOKEN --repo Sam-Stuhl/resume
```

**Milestone**

The real one: make a small edit in Careerbase and save. Then
`gh run list --repo Sam-Stuhl/resume --limit 1` shows the notify run, and
`gh run list --repo Sam-Stuhl/portfolio --limit 1` shows a `repository_dispatch`
deploy that followed it. The edit is visible at `https://samstuhl.com/resume`
within a minute or two of the save, and the same text appears in the downloaded
PDF.

If no notify run appears, the push came from a token that cannot trigger
workflows: drop this phase's workflow and replace it with the scheduled poll
described in Risks.

## Phase 6: docs

`portfolio/CLAUDE.md` currently holds a copy of the workspace `CLAUDE.md`, which
is wrong for a project repo. Replace it with the project's own rules: what this
serves, why it is a Worker and not a console app (with the apex constraint
spelled out so it is not rediscovered), the build-time-bake decision, the fact
that `resume.json` is upstream and owned by Careerbase, and how to deploy by
hand when CI is unavailable.

Add a `portfolio` entry to `~/Desktop/repos/CLAUDE.md`'s project map, in the
same shape as the others.

**Milestone**

`doc-drift` over `portfolio/CLAUDE.md` reports no stale claims, and every
command it names runs as written.

## What is deliberately not here

No portfolio site, no landing page, no navigation. No live console or GitHub
data: the "read from live systems" idea belongs to the portfolio and is
untouched by this. No `www` changes. No analytics. No `robots.txt` (the page is
meant to be findable, and the default is to allow).

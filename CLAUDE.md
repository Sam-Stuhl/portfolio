# portfolio

Whatever `samstuhl.com` serves. Today that is exactly one thing: the résumé at
`/resume`, plus the PDF at `/resume.pdf`. The portfolio site itself does not
exist yet and is deliberately not designed here.

A Cloudflare Worker, TypeScript, no framework. `npm run dev` builds and serves
on `localhost:8787`; `npm run check` typechecks; `npm run deploy` publishes.

## Why a Worker and not a console app

The console cannot serve an apex path. Every console project routes as
``Host(`<subdomain>.<domain>`)`` (`console/src/console/deploy/plan.py`) and
`subdomain` is a required, validated field
(`console/src/console/schema/console_toml.py`), so `samstuhl.com/resume` is
outside its model. Registering `portfolio` in the console would get you
`portfolio.samstuhl.com`, which is not the URL.

The second reason is uptime. This URL goes on job applications; it should not
depend on a Mac mini in a house being awake.

Do not "move this into the console" without changing the console's routing
model first. That is a real piece of work, not a config change.

## The apex belongs to this Worker

`wrangler.jsonc` declares a **custom domain**, not a path route, so Cloudflare
manages the apex DNS record and certificate. That means every request to
`samstuhl.com` reaches this Worker, and everything that is not `/resume` or
`/resume.pdf` gets a plain 404. That is the intended "nothing here yet"
behaviour: a bare 404 rather than a Cloudflare origin error page.

When the portfolio site arrives it either lives in this Worker or replaces the
custom domain. Both are fine; silently adding a second thing that also wants
the apex is not.

## The résumé is upstream and not editable here

`resume.json` and `resume.pdf` live in `Sam-Stuhl/resume`, which
[Careerbase](https://resume.kosmoskit.com) writes to on every save. This repo
**reads** them at build time (`build/fetch-resume.mjs`) into `build/assets/`,
which is gitignored. Never commit a copy, and never edit the résumé here: the
next Careerbase save would silently overwrite the change.

`build/render.mjs` turns the JSON into HTML and writes `src/generated/resume.ts`
(also gitignored). Both the HTML and the PDF are baked into the Worker bundle,
so a request touches Cloudflare and nothing else. The price is that a résumé
change requires a redeploy, which is what the dispatch wiring below is for.

The renderer skips unknown section types with a warning rather than throwing, so
a new Careerbase section type degrades to a missing section instead of a broken
site. If a section goes missing from the page, check the build log first.

## Design

The page mirrors the compiled PDF, so the two read as the same document:
serif, small-caps headings with rules, dates right-aligned. The approved
reference is committed at `docs/prototype-pdf-mirror.html`; a visual change
should be checked against it.

The one deliberate deviation is the `max-width: 640px` block, because a 0.6in
print sheet is unreadable on a phone. It relaxes type size and stacks the
title/date rows; it does not restyle the document.

## Deploys

Push to `main`, or a `repository_dispatch` of type `resume-updated` from the
résumé repo, runs `.github/workflows/deploy.yml`: build, typecheck,
`wrangler deploy`, then curl the live URL and fail if the résumé is not on it.

Two repo secrets, both set by Sam and never handled by Claude:
`CLOUDFLARE_API_TOKEN` (Edit Cloudflare Workers, scoped to the `samstuhl.com`
zone) and `CLOUDFLARE_ACCOUNT_ID`.

To deploy by hand when CI is unavailable:

```bash
npm run build && npx wrangler deploy
```

`build/` must have run first; a deploy without it fails on the missing
`src/generated/resume.ts` rather than shipping a stale page.

## Caching

Both responses carry `cache-control: public, max-age=300, must-revalidate` and
an ETag hashed from the build, so a repeat visitor gets a 304. A résumé change
is therefore live at the edge immediately but can sit in an individual
browser's cache for up to five minutes. That is the intended trade; do not
raise it without a reason.

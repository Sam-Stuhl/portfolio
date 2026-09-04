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

## The brand mark

Three stacked bars, ink `#2E2C29` with a teal `#136A6F` accent, designed 2026-09-04.
The Worker serves the set browsers actually ask for: `/favicon.svg` (a 3x3
`crispEdges` grid, deliberately pixel-exact at small sizes), `/favicon-32.png`
for browsers without SVG favicon support, and `/apple-touch-icon.png` at 180px.
All three are bundled, and `build/render.mjs` emits the matching `<link>` tags.

`docs/brand/` holds the delivery as received, including the 512px master and the
originals carrying their C2PA content credentials.

**The served small icons are rebuilt from that master, not copied from it.** As
delivered, `favicon.svg` and `favicon-16/32/48.png` were edge-to-edge tiles: the
corner pixel is ink, there are no transparent pixels, and the gaps that separate
the three bars are gone, so at 16px they read as a dark square with a teal block
rather than as the logo. `src/favicon.svg` and `src/favicon-32.png` are instead
generated from a 16-unit grid, which keeps every edge on a whole pixel at 16px
and gives the mark 1 unit of margin on all four sides. Three bars only has one
symmetric integer solution at that size (`1+4+1+4+1+4+1`), so do not nudge those
numbers without redoing the arithmetic.

The ground is **transparent**, by Sam's choice 2026-09-04: the mark sits on
whatever colour the tab strip is. The trade is that the ink bars have little
contrast against a very dark tab bar. A white plate fixes that and was tried; it
was rejected because it reads as a heavy tile. Do not reintroduce it without
asking. The 180px `apple-touch-icon.png` is the exception and keeps its white
plate, since iOS composites its own background behind the icon; it is served
exactly as delivered.

If the mark is ever redrawn, regenerate the small sizes the same way rather than
shipping a full-bleed reduction, and strip the C2PA manifest from anything served
(it was 7.7 KB of the 8.1 KB original, against 409 bytes of artwork).

## Deploys

Push to `main`, or a `repository_dispatch` of type `resume-updated` from the
résumé repo, runs `.github/workflows/deploy.yml`: build, typecheck,
`wrangler deploy`, then curl the live URL and fail if the résumé is not on it.

The dispatch is sent by `Sam-Stuhl/resume/.github/workflows/notify-site.yml`,
which fires on a push touching `resume.json` or `resume.pdf` and authenticates
with a `PORTFOLIO_DISPATCH_TOKEN` secret **in that repo** (a fine-grained PAT
scoped to this repo with `Contents: Read and write`). If the résumé stops
updating here, check that workflow's runs first, then whether that token has
expired. Trigger it by hand with
`gh workflow run notify-site.yml --repo Sam-Stuhl/resume`.
Measured 2026-09-03: 29 seconds from that trigger to deployed.

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
a weak ETag hashed from the build.

In practice only `/resume.pdf` gets 304s. **Cloudflare strips the ETag from the
HTML response**, verified 2026-09-03: it is absent with and without
`accept-encoding: gzip`, the tags are already weak, and nothing is being
injected into the body (byte count matches the render). The cause was not worth
chasing further, since the page is 8.7 KB and this costs a full 200 instead of a
304 at most once per five minutes per visitor. If you want it back, start by
checking the zone's HTML-modifying features (Rocket Loader, Auto Minify, Browser
Insights) rather than the Worker, which demonstrably sets the header. A résumé change
is therefore live at the edge immediately but can sit in an individual
browser's cache for up to five minutes. That is the intended trade; do not
raise it without a reason.

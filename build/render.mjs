// Renders build/assets/resume.json into the HTML the Worker serves.
//
// The design mirrors the compiled PDF (docs/prototype-pdf-mirror.html): the
// page and the download are meant to be recognisably the same document. The
// only deliberate deviation is the narrow-viewport block at the bottom of the
// stylesheet, because a 0.6in print sheet is not readable on a phone.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "assets");
const OUT = join(HERE, "..", "src", "generated");

const PDF_PATH = "/resume.pdf";
const CANONICAL = "https://samstuhl.com/resume";

const resume = JSON.parse(await readFile(join(ASSETS, "resume.json"), "utf8"));
const pdfBytes = await readFile(join(ASSETS, "resume.pdf"));

/** HTML-escape a value from the résumé. Everything interpolated goes through this. */
function e(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** "Jun 2026 – Aug 2026", or one side alone, or nothing at all. */
function dates(entry) {
  const start = entry.start_date?.trim();
  const end = entry.end_date?.trim();
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

function bullets(list) {
  if (!list?.length) return "";
  return `<ul>${list.map((b) => `<li>${e(b)}</li>`).join("")}</ul>`;
}

/** A title/date row plus an optional italic organisation/location row. */
function entryHead(left, right, subLeft, subRight) {
  const rows = [
    `<div class=row><span class=strong>${e(left)}</span>` +
      (right ? `<span class=right>${e(right)}</span>` : "") +
      `</div>`,
  ];
  if (subLeft || subRight) {
    rows.push(
      `<div class=row><span class=em>${e(subLeft)}</span>` +
        (subRight ? `<span class="right em">${e(subRight)}</span>` : "") +
        `</div>`,
    );
  }
  return rows.join("");
}

const RENDERERS = {
  text: (s) => `<p class=summary>${e(s.text)}</p>`,

  roles: (s) =>
    (s.entries ?? [])
      .map(
        (x) =>
          `<div class=entry>` +
          entryHead(x.title, dates(x), x.organization, x.location) +
          bullets(x.bullets) +
          `</div>`,
      )
      .join(""),

  projects: (s) =>
    (s.entries ?? [])
      .map(
        (x) =>
          `<div class=entry><div class=row><span><span class=strong>${e(x.name)}</span>` +
          (x.stack ? ` <span class=sep>|</span> <span class=em>${e(x.stack)}</span>` : "") +
          `</span></div>` +
          bullets(x.bullets) +
          `</div>`,
      )
      .join(""),

  skills: (s) =>
    (s.groups ?? [])
      .map(
        (g) =>
          `<p class=skill><span class=strong>${e(g.category)}</span>: ${e(g.items)}</p>`,
      )
      .join(""),

  education: (s) =>
    (s.entries ?? [])
      .map((x) => {
        const gpa = x.gpa?.trim() ? `GPA: ${x.gpa}` : "";
        const course = x.coursework?.trim()
          ? `<ul><li><span class=strong>Relevant Coursework:</span> ${e(x.coursework)}</li></ul>`
          : "";
        return (
          `<div class=entry>` +
          entryHead(x.school, dates(x), gpa, x.location) +
          course +
          `</div>`
        );
      })
      .join(""),
};

function renderSections(sections) {
  const out = [];
  for (const section of sections) {
    const render = RENDERERS[section.type];
    if (!render) {
      // A new Careerbase section type must not be able to take the site down.
      console.warn(`skipping unknown section type "${section.type}" (${section.title})`);
      continue;
    }
    out.push(`<section><h2>${e(section.title)}</h2>${render(section)}</section>`);
  }
  return out.join("\n");
}

function renderHeader(personal) {
  const parts = [
    personal.phone ? e(personal.phone) : "",
    personal.email ? `<a href="mailto:${e(personal.email)}">${e(personal.email)}</a>` : "",
    ...(personal.links ?? []).map(
      (l) => `<a href="https://${e(l.url)}" rel="me">${e(l.url)}</a>`,
    ),
  ].filter(Boolean);
  return (
    `<header>\n  <h1>${e(personal.name)}</h1>\n` +
    `  <p class=contact>${parts.join(" <span class=sep>|</span> ")}</p>\n</header>`
  );
}

/** First sentence of the summary, for <meta name=description> and Open Graph. */
function description(sections) {
  const summary = sections.find((s) => s.type === "text")?.text ?? "";
  const firstSentence = summary.match(/^.*?\.(?:\s|$)/)?.[0] ?? summary;
  return firstSentence.trim();
}

const STYLE = `
:root { --ink:#111; --rule:#111; --bg:#fff; }
* { box-sizing:border-box; }
body { margin:0; background:#e9e9ec; color:var(--ink);
  font-family:"Latin Modern Roman","Computer Modern",'Times New Roman',Times,serif; }
.sheet { max-width:8.5in; margin:24px auto; padding:0.55in 0.6in 0.7in; background:var(--bg);
  box-shadow:0 1px 3px rgba(0,0,0,.18); }
h1 { font-size:34px; font-weight:700; text-align:center; margin:0 0 6px; letter-spacing:.01em; }
.contact { text-align:center; margin:0 0 14px; font-size:13.5px; }
.contact a { color:inherit; }
.sep { padding:0 2px; }
h2 { font-variant:small-caps; font-size:16px; font-weight:400; letter-spacing:.03em;
  margin:14px 0 3px; padding-bottom:2px; border-bottom:1px solid var(--rule); }
section:first-of-type h2 { margin-top:10px; }
p.summary { margin:6px 0 0; font-size:13px; line-height:1.35; text-align:justify; }
.entry { margin:5px 0 7px; padding-left:10px; }
.row { display:flex; justify-content:space-between; gap:12px; font-size:13px; line-height:1.3; }
.strong { font-weight:700; }
.em { font-style:italic; }
.right { white-space:nowrap; }
ul { margin:2px 0 0; padding-left:17px; }
li { font-size:12.5px; line-height:1.34; margin:1px 0; text-align:justify; }
p.skill { margin:2px 0 0 10px; font-size:13px; line-height:1.35; }
.dl { margin:22px 0 0; text-align:center; font-size:12.5px; }
.dl a { color:#333; }

/* A print sheet is not readable at 390px. Keep the layout, relax the type. */
@media (max-width: 640px) {
  body { background:var(--bg); }
  .sheet { margin:0; padding:26px 18px 34px; box-shadow:none; max-width:none; }
  h1 { font-size:29px; }
  .contact { font-size:14px; line-height:1.9; }
  p.summary, li, p.skill, .row { font-size:15px; }
  p.summary, li { text-align:left; line-height:1.5; }
  .row { flex-direction:column; gap:0; }
  /* Stacked, the date would read as body text; hold the hierarchy instead. */
  .right { white-space:normal; font-size:13.5px; color:#555; }
  .entry { padding-left:0; }
  p.skill { margin-left:0; }
}
`.trim();

const desc = description(resume.sections);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(resume.personal.name)} — Résumé</title>
<meta name="description" content="${e(desc)}">
<link rel="canonical" href="${CANONICAL}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${e(resume.personal.name)} — Résumé">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${CANONICAL}">
<meta name="twitter:card" content="summary">
<style>
${STYLE}
</style>
</head>
<body>
<div class=sheet>
${renderHeader(resume.personal)}
${renderSections(resume.sections)}
<p class=dl><a href="${PDF_PATH}" download>Download PDF</a></p>
</div>
</body>
</html>
`;

// Weak, not strong: Cloudflare gzips the HTML at the edge and drops strong
// ETags on compressed responses, which would cost us the 304s entirely.
const etag = (bytes) => `W/"${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}"`;

await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, "resume.ts"),
  "// Generated by build/render.mjs. Do not edit; it is gitignored and rebuilt on deploy.\n" +
    `export const RESUME_HTML = ${JSON.stringify(html)};\n` +
    `export const HTML_ETAG = ${JSON.stringify(etag(html))};\n` +
    `export const PDF_ETAG = ${JSON.stringify(etag(pdfBytes))};\n`,
);

console.log(`rendered ${html.length} bytes of HTML to src/generated/resume.ts`);

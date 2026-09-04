// Pulls the résumé from its source of truth into build/assets/.
//
// Sam-Stuhl/resume is written by Careerbase on every save; nothing here ever
// writes back to it. Failing loudly matters more than failing gracefully: a
// half-fetched résumé that still deploys would put a broken page on the one
// URL that goes on a job application.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAW = "https://raw.githubusercontent.com/Sam-Stuhl/resume/main";
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "assets");

async function get(name) {
  const url = `${RAW}/${name}`;
  const res = await fetch(url, { headers: { "user-agent": "samstuhl.com-build" } });
  if (!res.ok) {
    throw new Error(`GET ${url} returned ${res.status} ${res.statusText}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

await mkdir(ASSETS, { recursive: true });

const json = await get("resume.json");
let parsed;
try {
  parsed = JSON.parse(new TextDecoder().decode(json));
} catch (cause) {
  throw new Error("resume.json did not parse as JSON", { cause });
}
if (!parsed?.personal?.name || !Array.isArray(parsed?.sections)) {
  throw new Error('resume.json is missing "personal.name" or "sections"');
}

const pdf = await get("resume.pdf");
if (new TextDecoder().decode(pdf.subarray(0, 5)) !== "%PDF-") {
  throw new Error("resume.pdf does not start with a PDF header");
}

await writeFile(join(ASSETS, "resume.json"), json);
await writeFile(join(ASSETS, "resume.pdf"), pdf);

console.log(
  `fetched resume.json (${json.length} bytes, ${parsed.sections.length} sections) ` +
    `and resume.pdf (${pdf.length} bytes)`,
);

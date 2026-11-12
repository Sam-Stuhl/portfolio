// On a phone the sheet runs edge to edge, so a fixed download button sits on
// top of the text column and hides words as they scroll under it (#9). It may
// stay fixed on desktop, where it lives in the margin beside the sheet.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../build/render.mjs", import.meta.url), "utf8");

/** The body of the first `@media <query> { ... }` block, braces balanced. */
function mediaBlock(query) {
  const start = source.indexOf(`@media ${query}`);
  assert.ok(start >= 0, `no @media ${query} block in render.mjs`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(source.indexOf("{", start) + 1, i);
  }
  throw new Error("unbalanced @media block");
}

test("the phone layout does not pin the download button over the text", () => {
  const rule = mediaBlock("(max-width: 640px)").match(/\.dl\s*\{([^}]*)\}/);
  assert.ok(rule, "the phone block sets no .dl rule");
  const position = rule[1].match(/position\s*:\s*([a-z]+)/);
  assert.ok(position, "the phone .dl rule leaves position:fixed from desktop");
  assert.notEqual(position[1], "fixed");
});

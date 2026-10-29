// Sam's style rule: no em dashes in anything the site serves (ETIQUETTE E19).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

async function files(dir) {
  const out = [];
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["generated", "assets"].includes(entry.name)) out.push(...(await files(path)));
    } else if (/\.(ts|mjs|html|svg)$/.test(entry.name)) out.push(path);
  }
  return out;
}

test("served code has no em dashes", async () => {
  const hits = [];
  for (const file of [...(await files("src")), ...(await files("build"))]) {
    (await readFile(join(ROOT, file), "utf8")).split("\n").forEach((line, i) => {
      if (line.includes("—")) hits.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, []);
});

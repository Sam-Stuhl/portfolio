// The Worker's routes, through a local wrangler dev of src/index.ts. Needs
// `npm run build` first (CI runs it before the tests); skipped without it.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { unstable_dev } from "wrangler";

const built = existsSync(new URL("../src/generated/resume.ts", import.meta.url));
let worker;

before(async () => {
  if (!built) return;
  worker = await unstable_dev("src/index.ts", { experimental: { disableExperimentalWarning: true }, logLevel: "error" });
});
after(async () => worker?.stop());

test("a trailing slash redirects to the page, not a 404 (#10)", { skip: !built && "run npm run build first" }, async () => {
  for (const path of ["/resume", "/atlas", "/privacy"]) {
    const res = await worker.fetch(`${path}/`, { redirect: "manual" });
    assert.equal(res.status, 308, `${path}/`);
    assert.equal(new URL(res.headers.get("location")).pathname, path, `${path}/`);
  }
});

test("other paths still 404", { skip: !built && "run npm run build first" }, async () => {
  for (const path of ["/", "/nope/", "/resume.pdf/"]) {
    const res = await worker.fetch(path, { redirect: "manual" });
    assert.equal(res.status, 404, path);
  }
});

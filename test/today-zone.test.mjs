// The Today page renders in Sam's zone (data.tz) whatever zone the phone is
// in. This runs the page's own script against a stub DOM, with a fixed clock,
// with the process (the "phone") set to zones other than Sam's.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../src/today/page.html", import.meta.url), "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

// A snapshot shaped like atlas/today.py's: the hours, sunset and all-day dates
// are wall-clock times in America/New_York with no offset.
function snapshot(generatedAt) {
  const hours = ["01", "02", "03", "04"].map((h, i) => ({
    t: `2026-10-29T${h}:00`, temp: 50, rain: i === 2 ? 70 : 5, code: 1,
  }));
  return {
    generated_at: generatedAt, date: "2026-10-29", tz: "America/New_York",
    weather: { temp: 50, feels: 48, code: 1, label: "Clear", hi: 60, lo: 45, rain: 70,
      sunrise: "2026-10-29T07:20", sunset: "2026-10-29T17:55", hours },
    day: [], tomorrow: [], exams: [], needs: [],
    due: [
      { title: "Due today", when: "2026-10-29", all_day: true, exam: false },
      { title: "Due tomorrow", when: "2026-10-30", all_day: true, exam: false },
    ],
  };
}

async function render(phoneZone, nowIso) {
  process.env.TZ = phoneZone;
  const now = Date.parse(nowIso);
  class FixedDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(now); }
    static now() { return now; }
  }
  const els = {};
  const el = () => ({ innerHTML: "", textContent: "", hidden: false, className: "",
    addEventListener() {}, querySelector() { return el(); } });
  const document = { hidden: false, addEventListener() {},
    getElementById: (id) => (els[id] ??= el()) };
  const data = snapshot(nowIso);
  const fetch = async () => ({ ok: true, json: async () => data });
  new Function("document", "location", "fetch", "setInterval", "Date", script)(
    document, { pathname: "/today/key" }, fetch, () => 0, FixedDate);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const text = (id) => els[id].innerHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return { wx: text("wx"), due: text("due") };
}

for (const zone of ["America/New_York", "America/Los_Angeles", "Asia/Tokyo"]) {
  test(`weather and due read in Sam's zone with the phone in ${zone}`, async () => {
    // 1:33 am in New York.
    const { wx, due } = await render(zone, "2026-10-29T05:33:00Z");
    assert.match(wx, /Now 50° .* 2am /);
    assert.match(wx, /Rain likely around 3am/);
    assert.match(wx, /Sunset 5:55\sPM/);
    assert.match(due, /Today Due today .* Tomorrow Due tomorrow/);
  });
}

test("an all-day item due today stays listed all evening with the phone in Paris", async () => {
  // 7:30 pm in New York, already 00:30 tomorrow in Paris.
  const { due } = await render("Europe/Paris", "2026-10-29T23:30:00Z");
  assert.match(due, /Today Due today/);
});

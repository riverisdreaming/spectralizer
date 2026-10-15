// Usage: serve site/ on :8765, then `node posters.js`. Renders stills into ../imagery/.
const { chromium } = require(process.env.PW || "playwright");
const path = require("path");
const SHOTS = [
  { name: "after-the-storm-wide", w: 1920, h: 1080, life: 1 },
  { name: "the-storm-wide", w: 1920, h: 1080, life: 0.02 },
  { name: "first-light-wide", w: 1920, h: 1080, life: 0.42 },
  { name: "after-the-storm-portrait", w: 1080, h: 1920, life: 1 },
  { name: "share-card", w: 1200, h: 630, life: 0.95 },
];
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const s of SHOTS) {
    const p = await b.newPage({ viewport: { width: s.w, height: s.h } });
    await p.goto("http://localhost:8765/new-dawn/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.NEW_DAWN);
    await p.addStyleTag({ content: "#gate,#compass{display:none!important}" });
    await p.evaluate((v) => window.NEW_DAWN.setLife(v), s.life);
    await p.waitForTimeout(7000);
    await p.screenshot({ path: path.join(__dirname, "..", "imagery", s.name + ".png"), timeout: 180000 });
    console.log(s.name);
    await p.close();
  }
  await b.close();
})();

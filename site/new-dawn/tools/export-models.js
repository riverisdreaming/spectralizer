// Usage: `npx serve site` (or set BASE to another server), then `node export-models.js` (needs Playwright).
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage();
  p.on("pageerror", (e) => console.error(e.message));
  await p.goto((process.env.BASE || "http://localhost:3000") + "/new-dawn/tools/export.html");
  await p.waitForFunction(() => window.exportNames);
  const names = await p.evaluate(() => window.exportNames);
  for (const n of names) {
    const bytes = await p.evaluate((n) => window.exportModel(n), n);
    const out = path.join(__dirname, "..", "models", n + ".glb");
    fs.writeFileSync(out, Buffer.from(bytes));
    console.log(n, bytes.length, "bytes");
  }
  await b.close();
})();

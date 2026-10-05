// Halulu ブログのサムネイル（1200x630）を作る: node scripts/render-blog-thumb.js "タイトル" "カテゴリ" out.png
// タイトルは \n で改行できる。Playwright（Chromium）を使う。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SPROUT = `<svg width="170" height="170" viewBox="0 0 100 100">
  <path d="M50 96 C50 80 50 66 50 52" stroke="#7FA889" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M50 58 C34 58 22 46 20 30 C36 30 48 40 50 58 Z" fill="#7FA889"/>
  <path d="M50 52 C54 34 68 22 84 22 C82 40 68 52 50 52 Z" fill="#7FA889" opacity=".85"/></svg>`;

function html(title, cat) {
  const t = esc(title).replace(/\\n|\n/g, "<br>");
  const len = String(title).replace(/\\n|\n/g, "").length;
  const size = len <= 14 ? 76 : len <= 24 ? 64 : len <= 34 ? 54 : 46;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:#FBF7F4;color:#2F2A28;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}
.d1{position:absolute;width:520px;height:520px;border-radius:50%;right:-160px;top:-200px;background:#F3DDE1}
.d2{position:absolute;width:300px;height:300px;border-radius:50%;left:-120px;bottom:-150px;background:#E3EEE5}
.sp{position:absolute;right:90px;top:70px}
.wrap{position:absolute;inset:0;padding:70px 90px;display:flex;flex-direction:column}
.brand{font-size:30px;font-weight:700;letter-spacing:.08em;color:#C9677A}
.brand small{font-size:22px;letter-spacing:.2em;color:#6E6461;font-weight:500;margin-left:14px}
.cat{margin-top:56px;align-self:flex-start;font-size:24px;font-weight:700;color:#fff;background:#7FA889;padding:8px 22px;border-radius:999px}
.title{margin-top:26px;font-family:"Noto Serif CJK JP","Noto Serif JP",serif;font-weight:700;line-height:1.4;max-width:900px;font-size:${size}px}
.foot{margin-top:auto;font-size:22px;color:#6E6461;letter-spacing:.04em}
</style></head><body><div class="d1"></div><div class="d2"></div><div class="sp">${SPROUT}</div>
<div class="wrap"><div class="brand">Halulu<small>渋谷歯科</small></div>
${cat ? `<div class="cat">${esc(cat)}</div>` : ""}<div class="title">${t}</div>
<div class="foot">Halulu渋谷歯科｜渋谷駅近く・完全自費診療</div></div></body></html>`;
}

(async () => {
  const [, , title, cat, out] = process.argv;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html(title, cat), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, type: "png" });
  await b.close();
  console.log(out);
})();

// Haguruma ブログのアイキャッチ（1200x630）を作る: node scripts/render-haguruma-thumb.js "タイトル" out.png
// タイトルは \n で改行できる。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const GEAR = (size, color) => {
  const teeth = 12, r1 = 0.36, r2 = 0.46, hole = 0.15;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth * 0.55;
    [[a - w * 1.25, r1], [a - w * 0.75, r2], [a + w * 0.75, r2], [a + w * 1.25, r1]].forEach(([ang, r], j) => {
      d += (i === 0 && j === 0 ? "M" : "L") + (0.5 + Math.cos(ang) * r).toFixed(4) + " " + (0.5 + Math.sin(ang) * r).toFixed(4) + " ";
    });
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 1 1"><path d="${d}Z" fill="${color}"/><circle cx=".5" cy=".5" r="${r1 - 0.01}" fill="${color}"/><circle cx=".5" cy=".5" r="${hole}" fill="#F2F5F9"/></svg>`;
};

function html(title) {
  const t = esc(title).replace(/\\n|\n/g, "<br>");
  const w = l => [...l].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
  const longest = Math.max(...String(title).split(/\\n|\n/).map(w));
  const size = Math.max(40, Math.min(72, Math.floor(720 / longest)));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:#F2F5F9;color:#15263F;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}
.g1{position:absolute;right:-110px;top:-120px}.g2{position:absolute;right:190px;top:140px}.g3{position:absolute;right:20px;bottom:-130px}
.wrap{position:absolute;inset:0;padding:70px 80px;display:flex;flex-direction:column;width:900px}
.brand{font-size:30px;font-weight:700;letter-spacing:.12em;color:#2F6DB5}
.title{margin-top:auto;font-size:${size}px;line-height:1.35;font-weight:900;word-break:keep-all}
.bar{margin-top:30px;width:110px;height:9px;border-radius:5px;background:#E9A23B}
.foot{margin-top:auto;white-space:nowrap;font-size:19px;color:#4A5B73;letter-spacing:.04em}
</style></head><body>
<div class="g1">${GEAR(420, "#DCE6F2")}</div><div class="g2">${GEAR(150, "#2F6DB5")}</div><div class="g3">${GEAR(300, "#E4EAF2")}</div>
<div class="wrap"><div class="brand">HAGURUMA</div><div class="title">${t}</div><div class="bar"></div>
<div class="foot">人生の歯車を、心地よく回すきっかけに｜審査制・実名制の歯科人材マッチング</div></div></body></html>`;
}

(async () => {
  const [, , title, out] = process.argv;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html(title), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, type: "png" });
  await b.close();
  console.log(out);
})();

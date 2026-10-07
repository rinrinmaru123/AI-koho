// ブログ本文の途中に入れる「章の画像」（1200x675）を作る: node scripts/render-section.js spec.json
// spec.json は配列: [{ "brand":"halulu"|"haguruma", "out":"blog-queue/<id>-img1.png",
//   "label":"POINT 1", "heading":"見出し（\nで2行まで・1行14字前後）",
//   "points":["要点（20字以内）", …最大3つ], "chara":"（Haluluのみ・省略可）" }]
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
const CH = require("./chara");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const br = s => esc(s).replace(/\\n|\n/g, "<br>");
const wlen = l => [...l].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
const fit = (text, budget, min, max) => {
  const longest = Math.max(1, ...String(text || "").split(/\\n|\n/).map(wlen));
  return Math.max(min, Math.min(max, Math.floor(budget / longest)));
};

const BASE = `*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:675px;position:relative;overflow:hidden;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif}
.heading{word-break:keep-all;font-weight:700;line-height:1.4}
ul{list-style:none;margin-top:34px;display:flex;flex-direction:column;gap:18px}
li{display:flex;align-items:flex-start;gap:16px;line-height:1.45;word-break:keep-all}`;

function halulu(s) {
  const pts = (s.points || []).slice(0, 3);
  const pSize = fit(pts.join("\n"), 600, 24, 32);
  const chara = CH.pick("cover", (s.heading || "") + " " + pts.join(" "), 0, s.chara);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
body{background:linear-gradient(120deg,#FFF9F6 0%,#FDEEF1 65%,#FBE3E8 100%);color:#3A2E2E}
.halo{position:absolute;width:600px;height:600px;border-radius:50%;right:-120px;top:20px;background:radial-gradient(circle,#FFFFFF 0%,#FFF3F5 45%,rgba(255,243,245,0) 70%)}
.dot{position:absolute;border-radius:50%;background:#F7CBD4;opacity:.55}
.chara{position:absolute;right:30px;bottom:-10px;height:440px;max-width:400px;object-fit:contain;object-position:right bottom}
.wrap{position:absolute;left:70px;top:60px;bottom:60px;width:740px;display:flex;flex-direction:column;justify-content:center}
.label{align-self:flex-start;font-size:22px;font-weight:700;color:#fff;background:#E58BA0;padding:7px 22px;border-radius:999px;letter-spacing:.12em}
.heading{margin-top:22px;font-family:"Noto Serif CJK JP","Noto Serif JP",serif;font-size:${fit(s.heading, 700, 38, 58)}px}
.line{margin-top:22px;width:90px;height:6px;border-radius:3px;background:#8DBE99}
li{font-size:${pSize}px}
li::before{content:"";flex:none;width:26px;height:26px;margin-top:${(pSize * 1.45 - 26) / 2}px;border-radius:50%;background:#E58BA0 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/18px no-repeat}
.brand{position:absolute;left:70px;bottom:28px;font-size:18px;color:#B49A9F;letter-spacing:.08em}
</style></head><body>
<div class="halo"></div>
<div class="dot" style="width:24px;height:24px;left:860px;top:70px"></div><div class="dot" style="width:14px;height:14px;left:900px;top:115px"></div>
<img class="chara" src="${CH.dataUri(chara)}">
<div class="wrap">${s.label ? `<div class="label">${esc(s.label)}</div>` : ""}
<div class="heading">${br(s.heading)}</div><div class="line"></div>
${pts.length ? `<ul>${pts.map(p => `<li><span>${esc(p)}</span></li>`).join("")}</ul>` : ""}</div>
<div class="brand">Halulu渋谷歯科</div></body></html>`;
}

const GEAR = (size, color, holeColor) => {
  const teeth = 12, r1 = 0.36, r2 = 0.46, hole = 0.15;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth * 0.55;
    [[a - w * 1.25, r1], [a - w * 0.75, r2], [a + w * 0.75, r2], [a + w * 1.25, r1]].forEach(([ang, r], j) => {
      d += (i === 0 && j === 0 ? "M" : "L") + (0.5 + Math.cos(ang) * r).toFixed(4) + " " + (0.5 + Math.sin(ang) * r).toFixed(4) + " ";
    });
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 1 1"><path d="${d}Z" fill="${color}"/><circle cx=".5" cy=".5" r="${r1 - 0.01}" fill="${color}"/><circle cx=".5" cy=".5" r="${hole}" fill="${holeColor}"/></svg>`;
};

function haguruma(s) {
  const pts = (s.points || []).slice(0, 3);
  const pSize = fit(pts.join("\n"), 700, 24, 32);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
body{background:#F2F5F9;color:#15263F}
.g1{position:absolute;right:-120px;top:-110px}.g2{position:absolute;right:110px;bottom:170px}.g3{position:absolute;right:-60px;bottom:-140px}
.wrap{position:absolute;left:80px;top:40px;bottom:80px;width:820px;display:flex;flex-direction:column;justify-content:center}
.label{align-self:flex-start;font-size:22px;font-weight:700;color:#fff;background:#2F6DB5;padding:7px 22px;border-radius:6px;letter-spacing:.14em}
.heading{margin-top:22px;font-weight:900;font-size:${fit(s.heading, 800, 40, 60)}px}
.bar{margin-top:22px;width:100px;height:8px;border-radius:4px;background:#E9A23B}
li{font-size:${pSize}px;background:#fff;border-radius:12px;padding:14px 22px;box-shadow:0 2px 0 #DCE6F2}
li b{flex:none;width:36px;height:36px;border-radius:50%;background:#15263F;color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;margin-top:${(pSize * 1.45 - 36) / 2}px}
.brand{position:absolute;left:80px;bottom:26px;font-size:18px;font-weight:700;color:#7C8CA3;letter-spacing:.14em}
</style></head><body>
<div class="g1">${GEAR(380, "#DCE6F2", "#F2F5F9")}</div><div class="g2">${GEAR(110, "#2F6DB5", "#F2F5F9")}</div><div class="g3">${GEAR(280, "#E4EAF2", "#F2F5F9")}</div>
<div class="wrap">${s.label ? `<div class="label">${esc(s.label)}</div>` : ""}
<div class="heading">${br(s.heading)}</div><div class="bar"></div>
${pts.length ? `<ul>${pts.map((p, i) => `<li><b>${i + 1}</b><span>${esc(p)}</span></li>`).join("")}</ul>` : ""}</div>
<div class="brand">HAGURUMA</div></body></html>`;
}

(async () => {
  const specs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 675 } });
  for (const s of specs) {
    fs.mkdirSync(path.dirname(path.resolve(s.out)), { recursive: true });
    await p.setContent(s.brand === "haguruma" ? haguruma(s) : halulu(s), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: s.out, type: "png" });
    console.log(s.out);
  }
  await b.close();
})();

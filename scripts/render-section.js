// ブログ本文の途中に入れる「章の画像」（1200x675）を作る: node scripts/render-section.js spec.json
// spec.json は配列: [{ "brand":"halulu"|"haguruma", "out":"blog-queue/<id>-img1.png",
//   "label":"POINT 1", "heading":"見出し（\nで2行まで・1行14字前後）",
//   "points":["要点（20字以内）", …最大3つ], "chara":"（省略可。キャラクターの名前）" }]
// "kind":"table" を付けると図解（表）の画像になる（下の table() を参照）。
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

const HG = require("./haguru");
function haguruma(s, idx) {
  const pts = (s.points || []).slice(0, 3);
  const pSize = fit(pts.join("\n"), 600, 24, 31);
  const text = (s.heading || "") + " " + pts.join(" ");
  const article = path.basename(String(s.out || "")).replace(/-img\d+\.\w+$/, "");
  const chara = HG.WORRY.test(text) && !s.chara ? "komari" : HG.pick("section", article, idx, s.chara);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
body{background:linear-gradient(115deg,#FFFFFF 0%,#F2F9F4 60%,#E2F3E8 100%);color:#16382A}
.halo{position:absolute;width:560px;height:560px;border-radius:50%;right:-110px;top:40px;background:radial-gradient(circle,#FFFFFF 0%,#EEF8F1 50%,rgba(238,248,241,0) 72%)}
.dot{position:absolute;border-radius:50%;background:#74D19F;opacity:.35}
.chara{position:absolute;right:36px;bottom:20px;height:400px;max-width:330px;object-fit:contain;object-position:right bottom;filter:drop-shadow(0 14px 16px rgba(30,90,55,.18))}
.wrap{position:absolute;left:72px;top:40px;bottom:80px;width:760px;display:flex;flex-direction:column;justify-content:center}
.label{align-self:flex-start;font-size:22px;font-weight:700;color:#fff;background:#22994F;padding:7px 22px;border-radius:999px;letter-spacing:.14em}
.heading{margin-top:22px;font-weight:900;font-size:${fit(s.heading, 740, 38, 58)}px}
.bar{margin-top:22px;width:100px;height:8px;border-radius:4px;background:#74D19F}
li{font-size:${pSize}px;background:#fff;border-radius:14px;padding:14px 22px;box-shadow:0 2px 0 #D6EBDD}
li b{flex:none;width:36px;height:36px;border-radius:50%;background:#22994F;color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;margin-top:${(pSize * 1.45 - 36) / 2}px}
.brand{position:absolute;left:72px;bottom:26px;font-size:18px;font-weight:700;color:#5E8A6F;letter-spacing:.14em}
</style></head><body>
<div class="halo"></div>
<div class="dot" style="width:22px;height:22px;left:880px;top:60px"></div><div class="dot" style="width:12px;height:12px;left:920px;top:100px"></div>
<img class="chara" src="${HG.dataUri(chara)}">
<div class="wrap">${s.label ? `<div class="label">${esc(s.label)}</div>` : ""}
<div class="heading">${br(s.heading)}</div><div class="bar"></div>
${pts.length ? `<ul>${pts.map((p, i) => `<li><b>${i + 1}</b><span>${esc(p)}</span></li>`).join("")}</ul>` : ""}</div>
<div class="brand">HAGURUMA</div></body></html>`;
}


// 図解（表）の画像: { "kind":"table", "brand", "out", "heading":"表のタイトル", "rows":[{ "rank":"1位", "label":"項目（14字以内）", "desc":"説明（30字以内）" }]（3〜5行）, "note":"出典や注記（任意）" }
function table(s) {
  const hg = s.brand === "haguruma";
  const C = hg ? { bg:"linear-gradient(115deg,#FFFFFF 0%,#F2F9F4 60%,#E2F3E8 100%)", ink:"#16382A", main:"#22994F", soft:"#5E8A6F", line:"#D6EBDD", rankBg:"#22994F", band:"#EAF6EE", font:'"Noto Sans CJK JP",sans-serif' }
                : { bg:"linear-gradient(120deg,#FFF9F6 0%,#FDEEF1 65%,#FBE3E8 100%)", ink:"#3A2E2E", main:"#E58BA0", soft:"#9C8A8C", line:"#F3D9DF", rankBg:"#E58BA0", band:"#FFF4F6", font:'"Noto Serif CJK JP",serif' };
  const rows = (s.rows || []).slice(0, 5);
  const n = Math.max(rows.length, 1);
  const rowH = Math.floor((675 - 190 - 40) / n);
  const lSize = Math.min(30, fit(rows.map(r => r.label).join("\n"), 330, 20, 30));
  const dSize = Math.min(24, fit(rows.map(r => r.desc).join("\n"), 640, 16, 24));
  const chara = hg ? HG.pick("section", s.heading || "", 3, s.chara) : CH.pick("mini", s.heading || "", 0, s.chara);
  const img = hg ? HG.dataUri(chara) : CH.dataUri(chara);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
body{background:${C.bg};color:${C.ink}}
.top{position:absolute;left:60px;top:40px;right:220px;height:110px;display:flex;align-items:center}
.ttl{font-family:${C.font};font-weight:900;font-size:${fit(s.heading, 880, 30, 46)}px;line-height:1.3;word-break:keep-all}
.chara{position:absolute;right:40px;top:14px;height:160px;object-fit:contain}
.tbl{position:absolute;left:60px;right:60px;top:170px;bottom:${s.note ? 58 : 40}px;background:#fff;border-radius:18px;box-shadow:0 3px 0 ${C.line};overflow:hidden;display:flex;flex-direction:column}
.row{flex:1;display:flex;align-items:center;gap:22px;padding:0 26px;border-top:2px solid ${C.line}}
.row:first-child{border-top:0}
.row:nth-child(odd){background:${C.band}}
.rk{flex:none;min-width:84px;height:${Math.min(52, rowH - 18)}px;border-radius:999px;background:${C.rankBg};color:#fff;font-weight:900;font-size:${Math.min(24, rowH / 3)}px;display:flex;align-items:center;justify-content:center;padding:0 14px}
.lb{flex:none;width:340px;font-weight:900;font-size:${lSize}px;line-height:1.3;word-break:keep-all}
.ds{flex:1;font-size:${dSize}px;line-height:1.45;color:${C.soft};word-break:keep-all}
.note{position:absolute;left:62px;bottom:20px;font-size:16px;color:${C.soft}}
</style></head><body>
<img class="chara" src="${img}">
<div class="top"><div class="ttl">${br(s.heading)}</div></div>
<div class="tbl">${rows.map(r => `<div class="row"><div class="rk">${esc(r.rank)}</div><div class="lb">${esc(r.label)}</div><div class="ds">${esc(r.desc)}</div></div>`).join("")}</div>
${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}
</body></html>`;
}

// 文章の合間に入れる「挿絵」: { "kind":"illust", "brand", "out", "say":"キャラクターのひと言（16字以内・任意）", "mood":"worry なら困り顔／しょんぼり（任意）", "chara":"（任意）" }
function illust(s, idx) {
  const hg = s.brand === "haguruma";
  const seed = path.basename(String(s.out || "")).replace(/-img\w+\.\w+$/, "");
  const worry = s.mood === "worry";
  const chara = s.chara || (hg ? (worry ? "komari" : HG.pick("section", seed, idx)) : (worry ? "shonbori" : CH.pick("mini", seed, idx)));
  const img = hg ? HG.dataUri(chara) : CH.dataUri(chara);
  const C = hg ? { bg:"radial-gradient(ellipse at 62% 45%,#FFFFFF 0%,#EEF8F1 45%,#DDF0E4 100%)", dot:"#9FDDB8", dot2:"#FFE9A8", ink:"#16382A", line:"#BFE3CB", floor:"rgba(34,153,79,.12)" }
                : { bg:"radial-gradient(ellipse at 62% 45%,#FFFFFF 0%,#FFF3F5 45%,#FBE3E8 100%)", dot:"#F7CBD4", dot2:"#C9E6CF", ink:"#3A2E2E", line:"#F3C9D3", floor:"rgba(229,139,160,.14)" };
  const say = String(s.say || "").slice(0, 24);
  const bubble = say ? `<div class="bubble">${esc(say)}</div>` : "";
  const dots = [[90,90,60,.5],[180,520,34,.6],[300,140,22,.7],[1040,110,40,.5],[1110,480,26,.6],[220,330,14,.8],[1000,600,18,.7]]
    .map(([x,y,r,o],i) => `<div class="d" style="left:${x}px;top:${y}px;width:${r}px;height:${r}px;opacity:${o};background:${i%2?C.dot2:C.dot}"></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
body{background:${C.bg}}
.d{position:absolute;border-radius:50%}
.floor{position:absolute;left:50%;bottom:58px;width:520px;height:60px;margin-left:${say ? 40 : -260}px;border-radius:50%;background:${C.floor};filter:blur(6px)}
.chara{position:absolute;bottom:70px;height:500px;max-width:520px;object-fit:contain;${say ? "right:150px" : "left:50%;transform:translateX(-50%)"};filter:drop-shadow(0 14px 16px rgba(0,0,0,.10))}
.bubble{position:absolute;left:90px;top:170px;max-width:500px;background:#fff;border:4px solid ${C.line};border-radius:40px;padding:30px 40px;font-size:${fit(say, 420, 32, 44)}px;font-weight:900;color:${C.ink};line-height:1.45;word-break:keep-all;box-shadow:0 6px 0 ${C.line}}
.bubble::after{content:"";position:absolute;right:-30px;top:60%;border:18px solid transparent;border-left:30px solid #fff;filter:drop-shadow(4px 0 0 ${C.line})}
</style></head><body>${dots}<div class="floor"></div>${bubble}<img class="chara" src="${img}"></body></html>`;
}

(async () => {
  const specs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 675 } });
  let hi = 0;
  for (const s of specs) {
    fs.mkdirSync(path.dirname(path.resolve(s.out)), { recursive: true });
    await p.setContent(s.kind === "illust" ? illust(s, hi++) : s.kind === "table" ? table(s) : (s.brand === "haguruma" ? haguruma(s, hi++) : halulu(s)), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: s.out, type: "png" });
    console.log(s.out);
  }
  await b.close();
})();

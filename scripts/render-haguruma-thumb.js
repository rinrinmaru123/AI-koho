// Haguruma ブログのアイキャッチ（1200x630）を作る: node scripts/render-haguruma-thumb.js "タイトル" out.png [はぐるんの名前]
// タイトルは \n で改行できる。キャラクター「はぐるん」入り（assets/haguru）。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
const HG = require("./haguru");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LOGO = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "assets", "haguru", "logo.png")).toString("base64");

// 背景は2色グラデーション6種を記事の日付から順番に（2026-11-08 本人希望「Hagurumaもデザイン毎回変えて」）
const BG = {
  "green-white":  { g: "#FFFFFF 0%,#F2F9F4 55%,#E2F3E8 100%", dot: "#74D19F", leaf: "#9FDDB8", bar: "#22994F" },
  "mint-lemon":   { g: "#F2FBF5 0%,#E6F6EC 45%,#FFF6D6 100%", dot: "#F2C230", leaf: "#9FDDB8", bar: "#22994F" },
  "sky-mint":     { g: "#F1F8FD 0%,#E1EFFB 45%,#E4F5EB 100%", dot: "#5AA9E6", leaf: "#9FDDB8", bar: "#1F78C8" },
  "lavender-sky": { g: "#F7F4FD 0%,#ECE6FA 45%,#E5F0FB 100%", dot: "#A88BEB", leaf: "#B9D8F0", bar: "#7A55D3" },
  "peach-cream":  { g: "#FFF7F0 0%,#FFE9DA 45%,#FBF5E6 100%", dot: "#FF9F43", leaf: "#9FDDB8", bar: "#E8792A" },
  "lemon-sage":   { g: "#FFFCEC 0%,#FFF4CC 45%,#E6F3E2 100%", dot: "#F2C230", leaf: "#9FDDB8", bar: "#22994F" },
};
const ROTATE = ["green-white", "sky-mint", "peach-cream", "lavender-sky", "lemon-sage", "mint-lemon"];
let OUT = "";
function pickBG(title) {
  if (process.env.THUMB_THEME && BG[process.env.THUMB_THEME]) return BG[process.env.THUMB_THEME];
  const m = String(OUT).match(/(20\d{6})/);
  const n = m ? Math.floor(Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8)) / 864e5) : [...String(title)].reduce((a, c) => a + c.codePointAt(0), 0);
  return BG[ROTATE[n % ROTATE.length]];
}
function html(title, chara) {
  const B = pickBG(title);
  const t = esc(title).replace(/\\n|\n/g, "<br>");
  const w = l => [...l].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
  const longest = Math.max(...String(title).split(/\\n|\n/).map(w));
  const size = Math.max(38, Math.min(66, Math.floor(620 / longest)));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:linear-gradient(115deg,${B.g});color:#16382A;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}
.halo{position:absolute;width:620px;height:620px;border-radius:50%;right:-100px;top:10px;background:radial-gradient(circle,#FFFFFF 0%,rgba(255,255,255,.7) 50%,rgba(255,255,255,0) 72%)}
.leaf{position:absolute;width:70px;height:34px;border-radius:0 100% 0 100%;background:${B.leaf};opacity:.55}
.dot{position:absolute;border-radius:50%;background:${B.dot};opacity:.35}
.chara{position:absolute;right:40px;bottom:-6px;height:520px;max-width:440px;object-fit:contain;object-position:right bottom;filter:drop-shadow(0 16px 18px rgba(30,90,55,.18))}
.wrap{position:absolute;left:0;top:0;bottom:0;width:720px;padding:52px 0 50px 72px;display:flex;flex-direction:column}
.logo{width:250px;align-self:flex-start}
.title{margin-top:auto;font-size:${size}px;line-height:1.38;font-weight:900;word-break:keep-all}
.bar{margin-top:26px;width:100px;height:8px;border-radius:4px;background:${B.bar}}
.foot{margin-top:auto;white-space:nowrap;font-size:19px;color:#4F6B5B;letter-spacing:.04em}
</style></head><body>
<div class="halo"></div>
<div class="dot" style="width:22px;height:22px;left:700px;top:80px"></div><div class="dot" style="width:12px;height:12px;left:740px;top:125px"></div>
<div class="leaf" style="left:-14px;bottom:36px;transform:rotate(-22deg)"></div>
<img class="chara" src="${HG.dataUri(HG.pick("thumb", title, 0, chara))}">
<div class="wrap"><img class="logo" src="${LOGO}">
<div class="title">${t}</div><div class="bar"></div>
<div class="foot">審査制・実名制の歯科人材マッチング｜Haguruma</div></div></body></html>`;
}

(async () => {
  const [, , title, out, chara] = process.argv;
  OUT = out;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html(title, chara), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, type: "png" });
  await b.close();
  console.log(out);
})();

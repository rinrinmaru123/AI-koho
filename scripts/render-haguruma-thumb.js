// Haguruma ブログのアイキャッチ（1200x630）を作る: node scripts/render-haguruma-thumb.js "タイトル" out.png [はぐるんの名前]
// タイトルは \n で改行できる。キャラクター「はぐるん」入り（assets/haguru）。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
const HG = require("./haguru");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LOGO = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "assets", "haguru", "logo.png")).toString("base64");

function html(title, chara) {
  const t = esc(title).replace(/\\n|\n/g, "<br>");
  const w = l => [...l].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
  const longest = Math.max(...String(title).split(/\\n|\n/).map(w));
  const size = Math.max(38, Math.min(66, Math.floor(620 / longest)));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:linear-gradient(115deg,#FFFFFF 0%,#F2F9F4 55%,#E2F3E8 100%);color:#16382A;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}
.halo{position:absolute;width:620px;height:620px;border-radius:50%;right:-100px;top:10px;background:radial-gradient(circle,#FFFFFF 0%,#EEF8F1 50%,rgba(238,248,241,0) 72%)}
.leaf{position:absolute;width:70px;height:34px;border-radius:0 100% 0 100%;background:#9FDDB8;opacity:.55}
.dot{position:absolute;border-radius:50%;background:#74D19F;opacity:.35}
.chara{position:absolute;right:40px;bottom:-6px;height:520px;max-width:440px;object-fit:contain;object-position:right bottom;filter:drop-shadow(0 16px 18px rgba(30,90,55,.18))}
.wrap{position:absolute;left:0;top:0;bottom:0;width:720px;padding:52px 0 50px 72px;display:flex;flex-direction:column}
.logo{width:250px;align-self:flex-start}
.title{margin-top:auto;font-size:${size}px;line-height:1.38;font-weight:900;word-break:keep-all}
.bar{margin-top:26px;width:100px;height:8px;border-radius:4px;background:#22994F}
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
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html(title, chara), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, type: "png" });
  await b.close();
  console.log(out);
})();

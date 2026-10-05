// Halulu ブログのサムネイル（1200x630）を作る: node scripts/render-blog-thumb.js "タイトル" "カテゴリ" out.png
// タイトルは \n で改行できる。キャラクター画像は assets/halulu-chara.png。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CHARA = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "assets", "halulu-chara.png")).toString("base64");

function html(title, cat) {
  const t = esc(title).replace(/\\n|\n/g, "<br>");
  // 一番長い行が幅（約590px）に収まる文字サイズにする（半角は0.6文字分で数える）
  const w = l => [...l].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
  const longest = Math.max(...String(title).split(/\\n|\n/).map(w));
  const size = Math.max(36, Math.min(68, Math.floor(590 / longest)));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:linear-gradient(120deg,#FFF9F6 0%,#FDEEF1 60%,#FBE3E8 100%);color:#3A2E2E;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}
.halo{position:absolute;width:640px;height:640px;border-radius:50%;right:-110px;top:-10px;background:radial-gradient(circle,#FFFFFF 0%,#FFF3F5 45%,rgba(255,243,245,0) 70%)}
.dot{position:absolute;border-radius:50%;background:#F7CBD4;opacity:.55}
.leaf{position:absolute;width:90px;height:44px;border-radius:0 100% 0 100%;background:#B9D8BF;opacity:.7}
.chara{position:absolute;right:20px;bottom:-14px;height:560px}
.wrap{position:absolute;left:0;top:0;bottom:0;width:690px;padding:64px 0 56px 80px;display:flex;flex-direction:column}
.brand{font-family:"Noto Serif CJK JP",serif;font-size:34px;font-weight:700;color:#D9708A;letter-spacing:.04em}
.brand small{font-family:"Noto Sans CJK JP",sans-serif;font-size:20px;letter-spacing:.24em;color:#9C8A8C;font-weight:500;margin-left:12px}
.cat{margin-top:auto;align-self:flex-start;font-size:23px;font-weight:700;color:#fff;background:#E58BA0;padding:8px 24px;border-radius:999px;letter-spacing:.06em}
.title{margin-top:22px;word-break:keep-all;font-family:"Noto Serif CJK JP","Noto Serif JP",serif;font-weight:700;line-height:1.42;font-size:${size}px}
.line{margin-top:26px;width:96px;height:6px;border-radius:3px;background:#8DBE99}
.foot{margin-top:auto;font-size:20px;color:#9C8A8C;letter-spacing:.05em}
</style></head><body>
<div class="halo"></div>
<div class="dot" style="width:26px;height:26px;left:620px;top:70px"></div>
<div class="dot" style="width:14px;height:14px;left:660px;top:120px"></div>
<div class="dot" style="width:18px;height:18px;left:560px;bottom:70px"></div>
<div class="leaf" style="left:-20px;bottom:30px;transform:rotate(-20deg)"></div>
<img class="chara" src="${CHARA}">
<div class="wrap"><div class="brand">Halulu<small>渋谷歯科</small></div>
${cat ? `<div class="cat">${esc(cat)}</div>` : `<div style="margin-top:auto"></div>`}
<div class="title">${t}</div><div class="line"></div>
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

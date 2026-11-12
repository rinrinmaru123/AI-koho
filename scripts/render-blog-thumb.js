// Halulu ブログのサムネイル（1200x630）を作る: node scripts/render-blog-thumb.js "タイトル" "カテゴリ" out.png
// 4つ目にキャラクター名（assets/chara の名前）を渡すとそれを使う。省略するとタイトルから自動で選ぶ。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CH = require("./chara");

// 背景の色（2026-11-02 本人「ピンク微妙かも」→ 選べるように）。THUMB_THEME か5つ目の引数で指定
const BG = {
  pink:  { g: "#FFF9F6 0%,#FDEEF1 60%,#FBE3E8 100%", halo: "#FFF3F5", dot: "#F7CBD4", cat: "#E58BA0", brand: "#D9708A" },
  cream: { g: "#FFFDF8 0%,#FBF6EC 60%,#F3ECDD 100%", halo: "#FFFBF2", dot: "#EAD9B8", cat: "#B99A62", brand: "#B98A5A" },
  sage:  { g: "#FBFDF9 0%,#EEF5EC 60%,#DDEBDB 100%", halo: "#F6FBF4", dot: "#C3DCC0", cat: "#7FAE86", brand: "#6E9C76" },
  white: { g: "#FFFFFF 0%,#FFFFFF 55%,#F6F3F1 100%", halo: "#FFFFFF", dot: "#EADFDA", cat: "#E58BA0", brand: "#D9708A" },
  // 2色のグラデーション（2026-11-02 本人希望「グラデーションにしてほしい・記事ごとに色を変える」）
  "cream-pink":  { g: "#FFFBF2 0%,#FBF3E6 40%,#FBE6EA 100%", halo: "#FFFFFF", dot: "#F2D3D9", cat: "#D98AA0", brand: "#C9798F" },
  "sage-cream":  { g: "#F4FAF1 0%,#EAF3E6 40%,#F8F1E3 100%", halo: "#FFFFFF", dot: "#C9DFC3", cat: "#7FAE86", brand: "#6E9C76" },
  "sky-mint":    { g: "#F1F8FD 0%,#E6F1FA 45%,#E4F4EC 100%", halo: "#FFFFFF", dot: "#C6DDF0", cat: "#6FA3CF", brand: "#5B8FBD" },
  "lavender-pink": { g: "#F7F4FD 0%,#EEE8FA 45%,#FBE7EE 100%", halo: "#FFFFFF", dot: "#DCD0F2", cat: "#9C86CF", brand: "#8A74BF" },
  "lemon-sage":  { g: "#FFFCEE 0%,#FBF5D9 45%,#E8F2E1 100%", halo: "#FFFFFF", dot: "#EEDFA6", cat: "#BC9B3A", brand: "#A98A30" },
  "peach-cream": { g: "#FFF6F0 0%,#FDE9DE 45%,#FBF4E6 100%", halo: "#FFFFFF", dot: "#F4CDB8", cat: "#DE8D6A", brand: "#CC7B58" },
};
const ROTATE = ["cream-pink", "sage-cream", "sky-mint", "lavender-pink", "lemon-sage", "peach-cream"];
// 出力先の日付（…/YYYYMMDD-…）から順番に回す。日付がなければタイトルから
function autoTheme(out, title) {
  const m = String(out || "").match(/(20\d{6})/);
  const n = m ? Math.floor(Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8)) / 864e5) : [...String(title)].reduce((a, c) => a + c.codePointAt(0), 0);
  return ROTATE[n % ROTATE.length];
}
let OUT = "";
// 配置も4種類を記事ごとに順番に（2026-11-12 本人「色だけでなくデザインも変えて」）
// 0=文字左・キャラ右 1=左右反転 2=白いカードの上に文字 3=下に色の帯
function layoutNo(out, title) {
  if (process.env.THUMB_LAYOUT) return +process.env.THUMB_LAYOUT % 4;
  const m = String(out || "").match(/(20\d{6})/);
  if (!m) return [...String(title)].reduce((a, c) => a + c.codePointAt(0), 0) % 4;
  const days = Math.floor(Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8)) / 864e5);
  const week = Math.floor((days + 3) / 7), dow = (days + 3) % 7; // 0=月曜
  return (week * 2 + (dow >= 3 ? 1 : 0)) % 4;
}

function html(title, cat, chara, theme) {
  const B = BG[theme] || BG[process.env.THUMB_THEME] || BG[autoTheme(OUT, title)];
  const t = esc(title).replace(/\\n|\n/g, "<br>");
  // 一番長い行が幅（約590px）に収まる文字サイズにする（半角は0.6文字分で数える）
  const w = l => [...l].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
  const longest = Math.max(...String(title).split(/\\n|\n/).map(w));
  const size = Math.max(36, Math.min(68, Math.floor(560 / longest)));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{--band:${B.cat};width:1200px;height:630px;background:linear-gradient(120deg,${B.g});color:#3A2E2E;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}
.halo{position:absolute;width:640px;height:640px;border-radius:50%;right:-110px;top:-10px;background:radial-gradient(circle,#FFFFFF 0%,${B.halo} 45%,rgba(255,255,255,0) 70%)}
.dot{position:absolute;border-radius:50%;background:${B.dot};opacity:.55}
.leaf{position:absolute;width:90px;height:44px;border-radius:0 100% 0 100%;background:#B9D8BF;opacity:.7}
.chara{position:absolute;right:20px;bottom:-14px;height:560px;max-width:470px;object-fit:contain;object-position:right bottom}
.wrap{position:absolute;left:0;top:0;bottom:0;width:690px;padding:64px 0 56px 80px;display:flex;flex-direction:column}
.brand{font-family:"Noto Serif CJK JP",serif;font-size:34px;font-weight:700;color:${B.brand};letter-spacing:.04em}
.brand small{font-family:"Noto Sans CJK JP",sans-serif;font-size:20px;letter-spacing:.24em;color:#9C8A8C;font-weight:500;margin-left:12px}
.cat{margin-top:auto;align-self:flex-start;font-size:23px;font-weight:700;color:#fff;background:${B.cat};padding:8px 24px;border-radius:999px;letter-spacing:.06em}
.title{margin-top:22px;word-break:keep-all;font-family:"Noto Serif CJK JP","Noto Serif JP",serif;font-weight:700;line-height:1.42;font-size:${size}px}
.line{margin-top:26px;width:96px;height:6px;border-radius:3px;background:#8DBE99}
.foot{margin-top:auto;font-size:20px;color:#9C8A8C;letter-spacing:.05em}
.card{display:none}
.band{display:none}
.L1 .chara{right:auto;left:24px;object-position:left bottom}
.L1 .halo{right:auto;left:-110px}
.L1 .wrap{left:auto;right:0;padding-left:0;padding-right:70px;width:660px}
.L1 .leaf{left:auto!important;right:-14px;transform:rotate(200deg)!important}
.L2 .card{display:block;position:absolute;left:48px;top:46px;width:790px;height:538px;border-radius:40px;background:rgba(255,255,255,.86);box-shadow:0 14px 40px rgba(0,0,0,.06)}
.L2 .wrap{padding-top:92px;padding-bottom:84px;padding-left:104px;width:740px}
.L2 .chara{right:6px;height:500px}
.L2 .halo{opacity:.5}
.L3 .band{display:block;position:absolute;left:0;right:0;bottom:0;height:118px;background:var(--band)}
.L3 .wrap{width:780px;padding-bottom:42px}
.L3 .title{margin-top:30px}
.L3 .chara{bottom:-4px}
.L3 .leaf{display:none}
.L3 .foot{color:#fff}
.L3 .cat{margin-top:34px}
.L3 .line{background:#fff;opacity:.0}
</style></head><body class="L${layoutNo(OUT, title)}">
<div class="halo"></div><div class="card"></div><div class="band"></div>
<div class="dot" style="width:26px;height:26px;left:620px;top:70px"></div>
<div class="dot" style="width:14px;height:14px;left:660px;top:120px"></div>
<div class="dot" style="width:18px;height:18px;left:560px;bottom:70px"></div>
<div class="leaf" style="left:-20px;bottom:30px;transform:rotate(-20deg)"></div>
<img class="chara" src="${CH.dataUri(CH.pick("thumb", title, 0, chara))}">
<div class="wrap"><div class="brand">Halulu<small>渋谷歯科</small></div>
${cat ? `<div class="cat">${esc(cat)}</div>` : `<div style="margin-top:auto"></div>`}
<div class="title">${t}</div><div class="line"></div>
<div class="foot">Halulu渋谷歯科｜渋谷駅近く・完全自費診療</div></div></body></html>`;
}

(async () => {
  const [, , title, cat, out, chara, theme] = process.argv;
  OUT = out;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html(title, cat, chara, theme), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, type: "png" });
  await b.close();
  console.log(out);
})();

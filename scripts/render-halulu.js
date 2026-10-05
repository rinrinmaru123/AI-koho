// Halulu carousel renderer: node render-halulu.js slides.json outDir
// slides.json = {"slides":[{"type":"cover","title":"…","lead":"…"},{"type":"point","no":1,"heading":"…","body":"…"},{"type":"info","heading":"費用・リスク","body":"…"},{"type":"end"}]}
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");

const CH = require("./chara");
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const br = s => esc(s).replace(/\n/g, "<br>");
const rich = s => esc(s).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

// sprout motif: a stem with two leaves (the clinic's 「歯を育てる」)
const SPROUT = (size, leaf, stem) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
  <path d="M50 96 C50 80 50 66 50 52" stroke="${stem}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M50 58 C34 58 22 46 20 30 C36 30 48 40 50 58 Z" fill="${leaf}"/>
  <path d="M50 52 C54 34 68 22 84 22 C82 40 68 52 50 52 Z" fill="${leaf}" opacity=".85"/>
</svg>`;

const CSS = `
:root{--bg:#FFF8F6;--ink:#3A2E2E;--soft:#8A7A7C;--rose:#D9708A;--blush:#FBE3E8;--leaf:#8DBE99;--leafpale:#E6F1E8}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:linear-gradient(160deg,#FFF9F6 0%,#FDEEF1 70%,#FBE3E8 100%);color:var(--ink);font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}
.disc{position:absolute;border-radius:50%}
.d1{width:620px;height:620px;right:-220px;top:-220px;background:var(--blush)}
.d2{width:360px;height:360px;left:-160px;bottom:-140px;background:var(--leafpale)}
.sp{position:absolute;right:120px;top:120px}
.chara{position:absolute}
.chara.big{right:-30px;bottom:150px;height:460px}
.chara.end{right:-30px;top:150px;height:440px}
.chara.mini{right:70px;top:70px;height:170px}
.halo{position:absolute;border-radius:50%;background:radial-gradient(circle,#FFFFFF 0%,#FFF3F5 45%,rgba(255,243,245,0) 70%)}
.wrap{position:absolute;inset:0;padding:120px 96px 110px;display:flex;flex-direction:column}
.brand{display:flex;align-items:baseline;gap:18px;font-size:32px;font-weight:700;letter-spacing:.08em;color:var(--rose)}
.brand small{font-size:24px;letter-spacing:.2em;color:var(--soft);font-weight:500}
.serif{font-family:"Noto Serif CJK JP","Noto Serif JP",serif}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font-size:28px;color:var(--soft);letter-spacing:.04em}
.page{font-variant-numeric:tabular-nums;font-weight:700;color:var(--rose)}
.cover .title{margin-top:170px;font-size:92px;line-height:1.35;font-weight:700}
.cover .bar{margin-top:56px;width:120px;height:8px;background:var(--leaf);border-radius:4px}
.cover .lead{margin-top:48px;font-size:36px;line-height:1.75;color:var(--soft);max-width:520px}
.point .no{margin-top:190px;font-size:140px;font-weight:700;line-height:1;color:#F2BFCB}
.point .heading{margin-top:-24px;font-size:66px;line-height:1.4;font-weight:700}
.point .body{margin-top:56px;font-size:42px;line-height:1.85}
.point .body b,.info .body b{color:var(--rose)}
.info .label{margin-top:150px;display:inline-flex;align-self:flex-start;font-size:30px;font-weight:700;color:#fff;background:var(--leaf);padding:10px 26px;border-radius:999px;letter-spacing:.06em}
.info .heading{margin-top:36px;font-size:62px;line-height:1.4;font-weight:700}
.info .body{margin-top:44px;font-size:36px;line-height:1.8;background:#fff;border-radius:28px;padding:44px 48px}
.end .msg{margin-top:180px;font-size:96px;line-height:1.3;font-weight:700}
.end .tag{margin-top:44px;font-size:40px;line-height:1.75;color:var(--soft)}
.end .cta{margin-top:76px;display:inline-flex;align-self:flex-start;background:var(--rose);color:#fff;font-size:42px;font-weight:700;padding:28px 48px;border-radius:999px}
.end .note{margin-top:36px;font-size:26px;line-height:1.6;color:var(--soft)}
`;

const HANDLE = "@halulu.shibuya.dental";
const BRAND = `<div class="brand serif">Halulu<small>渋谷歯科</small></div>`;

function slideHTML(s, i, n, seed) {
  const page = `<span class="page">${i + 1}/${n}</span>`;
  let inner = "", deco = "";
  if (s.type === "cover") {
    deco = `<div class="disc d2"></div><div class="halo" style="width:760px;height:760px;right:-240px;bottom:-60px"></div><img class="chara big" src="${CH.dataUri(CH.pick("cover", seed, 0, s.chara))}">`;
    inner = `<div class="wrap cover">${BRAND}<div class="title serif">${br(s.title)}</div><div class="bar"></div>
      ${s.lead ? `<div class="lead">${br(s.lead)}</div>` : ""}<div class="foot"><span>スワイプして読む →</span>${page}</div></div>`;
  } else if (s.type === "end") {
    deco = `<div class="disc d2"></div><div class="halo" style="width:720px;height:720px;right:-260px;top:20px"></div><img class="chara end" src="${CH.dataUri(CH.pick("end", seed, 0, s.chara))}">`;
    inner = `<div class="wrap end">${BRAND}<div class="msg serif">${br(s.message || "歯を、\n育てよう。")}</div>
      <div class="tag">抜く・削る前に、育てる。<br>2度と笑顔を失わせないために。</div>
      <div class="cta">ご予約はプロフィールから</div>
      <div class="note">Halulu渋谷歯科｜渋谷駅近く・完全自費診療</div>
      <div class="foot"><span>${HANDLE}</span>${page}</div></div>`;
  } else if (s.type === "info") {
    deco = `<div class="halo" style="width:420px;height:420px;right:-60px;top:-80px"></div><img class="chara mini" src="${CH.dataUri(CH.pick("mini", seed, i, s.chara))}">`;
    inner = `<div class="wrap info">${BRAND}<div class="label">${esc(s.label || "費用・回数・リスク")}</div>
      <div class="heading serif">${br(s.heading)}</div><div class="body">${rich(s.body)}</div>
      <div class="foot"><span>${HANDLE}</span>${page}</div></div>`;
  } else {
    deco = `<div class="halo" style="width:420px;height:420px;right:-60px;top:-80px"></div><img class="chara mini" src="${CH.dataUri(CH.pick("mini", seed, i, s.chara))}">`;
    inner = `<div class="wrap point">${BRAND}<div class="no serif">${String(s.no || i).padStart(2, "0")}</div>
      <div class="heading serif">${br(s.heading)}</div><div class="body">${rich(s.body)}</div>
      <div class="foot"><span>${HANDLE}</span>${page}</div></div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${deco}${inner}</body></html>`;
}

(async () => {
  const [, , inFile, outDir] = process.argv;
  const { slides } = JSON.parse(fs.readFileSync(inFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  const out = [];
  for (let i = 0; i < slides.length; i++) {
    await p.setContent(slideHTML(slides[i], i, slides.length, (slides[0] && slides[0].title) || inFile), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    const f = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await p.screenshot({ path: f, type: "png" });
    out.push(f);
  }
  await b.close();
  console.log(JSON.stringify(out));
})();

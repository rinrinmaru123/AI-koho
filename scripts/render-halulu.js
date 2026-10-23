// Halulu carousel renderer: node render-halulu.js slides.json outDir
// slides.json = {"slides":[{"type":"cover","title":"…","lead":"…"},{"type":"point","no":1,"heading":"…","body":"…","say":"…"},{"type":"info","heading":"施術名","body":"…"},{"type":"end"}]}
// 文字の記法：**ことば** → ローズ色で強調。タイトル・見出しでは {ことば} → 小さめ（助詞などを小さくしてメリハリをつける）
// デザイン：2026-10-23 本人が作った見本（やわらかい水彩・花と若葉・大きいキャラ）に合わせた版
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
const CH = require("./chara");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// 見出し用：**強調** と {小さく} を解釈
const title = s => esc(s).split("\n").map(line =>
  line.replace(/\*\*(.+?)\*\*/g, '<em>$1</em>').replace(/\{(.+?)\}/g, '<small>$1</small>')
).join("<br>");
const rich = s => esc(s).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const plainLen = s => Math.max(...String(s || "").split("\n").map(l => l.replace(/\*\*|\{|\}/g, "").length), 1);

/* ---------- 飾り（SVG） ---------- */
const LEAF = (w, rot, fill = "#9FCB9F", vein = "#7FB07F") =>
  `<svg width="${w}" height="${w}" viewBox="0 0 100 100" style="transform:rotate(${rot}deg)"><path d="M10 90 C20 40 55 12 92 8 C88 48 60 84 10 90 Z" fill="${fill}" opacity=".9"/><path d="M14 86 C40 60 62 36 88 12" stroke="${vein}" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
const SPROUT = (s, c = "#8DBE99") =>
  `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M50 94 C50 78 50 64 50 52" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M50 58 C32 58 18 46 14 28 C34 28 48 40 50 58 Z" fill="${c}"/><path d="M50 52 C54 32 70 20 88 18 C86 38 70 52 50 52 Z" fill="${c}" opacity=".85"/></svg>`;
const FLOWER = (s, petal = "#FFFFFF", center = "#F6C66B") => {
  let p = "";
  for (let i = 0; i < 5; i++) p += `<ellipse cx="50" cy="27" rx="17" ry="24" fill="${petal}" stroke="#F3D9DE" stroke-width="1.5" transform="rotate(${i * 72} 50 50)"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 100 100">${p}<circle cx="50" cy="50" r="10" fill="${center}"/></svg>`;
};
const PETAL = (s, rot) => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" style="transform:rotate(${rot}deg)"><path d="M50 8 C78 24 82 70 50 92 C18 70 22 24 50 8 Z" fill="#F6C9D2" opacity=".75"/></svg>`;
const HEART = (s, c = "#E58BA0") => `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M50 86 C20 64 8 46 14 30 C20 14 42 12 50 30 C58 12 80 14 86 30 C92 46 80 64 50 86 Z" fill="${c}"/></svg>`;
const at = (x, y, svg, extra = "") => `<div class="deco" style="left:${x}px;top:${y}px;${extra}">${svg}</div>`;

// 右上の花の枝（毎回同じ位置。枚の種類で少し間引く）
const BRANCH = (light) => [
  `<svg class="deco" style="right:-20px;top:-30px" width="380" height="300" viewBox="0 0 380 300"><path d="M380 40 C300 60 240 110 160 120" stroke="#A9C9A4" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M300 70 C290 120 300 160 330 200" stroke="#A9C9A4" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  at(860, -10, LEAF(120, 200)), at(760, 70, LEAF(110, 160)), at(930, 120, LEAF(130, 250)),
  at(905, 20, FLOWER(120)), light ? "" : at(800, 150, FLOWER(80)), at(980, 210, FLOWER(70, "#FBE3E8")),
  light ? "" : at(700, 30, PETAL(44, 30)),
].join("");

const BG = `<div class="blob" style="width:820px;height:620px;right:-260px;top:-140px;background:radial-gradient(closest-side,#FBE3E8,rgba(251,227,232,0))"></div>
<div class="blob" style="width:700px;height:560px;left:-260px;bottom:-200px;background:radial-gradient(closest-side,#F9DDE3,rgba(249,221,227,0))"></div>
<div class="blob" style="width:520px;height:420px;left:-180px;top:520px;background:radial-gradient(closest-side,#EAF3EA,rgba(234,243,234,0))"></div>
<svg class="deco" style="left:0;top:0" width="1080" height="1350" viewBox="0 0 1080 1350"><path d="M-20 1180 C200 1120 380 1250 620 1190 C820 1140 960 1180 1100 1120" stroke="#F3CBD4" stroke-width="3" fill="none" opacity=".7"/><path d="M640 -10 C700 140 860 220 1100 230" stroke="#F3CBD4" stroke-width="3" fill="none" opacity=".6"/></svg>`;

const LOGO = `<div class="logo">${SPROUT(64)}<span>Halulu<span class="jp">渋谷歯科</span></span><svg class="logoline" width="460" height="40" viewBox="0 0 460 40"><path d="M4 20 C120 8 300 6 456 30" stroke="#D9B3A8" stroke-width="2.5" fill="none"/></svg><span class="lheart">${HEART(26)}</span></div>`;
const FOOT = (i, n) => `<div class="foot"><span class="handle">@halulu.shibuya.dental</span><span class="fline"></span>${SPROUT(40)}<span class="fline"></span><span class="page">${i + 1}<small>/${n}</small></span></div>`;

const CSS = `
:root{--ink:#4A3030;--soft:#7A6464;--rose:#D9708A;--rose2:#C9607A;--blush:#FBE3E8;--leaf:#8DBE99}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:#FCF7F3;color:var(--ink);font-family:"Noto Sans CJK JP",sans-serif;position:relative;overflow:hidden}
.blob{position:absolute;border-radius:50%}
.deco{position:absolute;line-height:0}
.chara{position:absolute;z-index:4;filter:drop-shadow(0 18px 28px rgba(217,112,138,.18))}
.serif{font-family:"Noto Serif CJK JP",serif}
.wrap{position:absolute;inset:0;padding:64px 70px 56px;display:flex;flex-direction:column;z-index:3}
.logo{position:relative;display:flex;align-items:center;gap:10px;font-family:"Noto Serif CJK JP",serif;font-size:44px;font-weight:600;color:#5A3D3D;letter-spacing:.04em;height:90px}
.logo .jp{font-size:40px;letter-spacing:.12em;margin-left:6px}
.logoline{position:absolute;left:60px;top:72px}
.lheart{position:absolute;left:72px;top:58px}
.foot{margin-top:auto;display:flex;align-items:center;gap:18px;font-size:28px;color:var(--soft);position:relative;z-index:4}
.foot .fline{flex:1;height:2px;background:#E2C9C2}
.foot .page{font-family:"Noto Serif CJK JP",serif;font-size:40px;color:#5A3D3D}
.foot .page small{font-size:28px}
em{font-style:normal;color:var(--rose)}
small{font-size:.66em}
b{color:var(--rose2);font-weight:700}
.ttl{font-family:"Noto Serif CJK JP",serif;font-weight:900;line-height:1.28;color:#4A2A2A;letter-spacing:.01em}
.ttl em{position:relative}
.ttl .line{position:relative;display:inline-block}
.brush{position:absolute;left:-14px;right:-30px;bottom:6%;height:34%;background:linear-gradient(90deg,rgba(242,190,203,.65),rgba(242,190,203,.25) 80%,rgba(242,190,203,0));border-radius:40px 10px 60px 14px;z-index:-1;transform:rotate(-1deg)}
.lead{margin-top:44px;width:540px;position:relative;border:3px dashed #EDBFCA;border-radius:46px;background:rgba(255,255,255,.55);padding:42px 36px 38px;font-size:31px;line-height:1.75;color:#4A3838}
.lead .sp{position:absolute;left:50%;top:-34px;transform:translateX(-50%);background:#FCF7F3;padding:0 10px}
.pill{display:inline-flex;align-items:center;gap:18px;align-self:flex-start;background:linear-gradient(180deg,#DE849A,#C9677F);color:#fff;font-size:44px;font-weight:600;padding:26px 54px 26px 40px;border-radius:999px;box-shadow:0 10px 24px rgba(201,103,127,.28),inset 0 2px 0 rgba(255,255,255,.35)}
.bubble{position:absolute;z-index:4;background:#fff;border:4px solid #F2BFCB;border-radius:50px;padding:30px 40px;font-size:42px;line-height:1.5;font-weight:700;color:#4A3030;box-shadow:0 10px 26px rgba(217,112,138,.16)}
.bubble::after{content:"";position:absolute;width:40px;height:40px;background:#fff;border-right:4px solid #F2BFCB;border-bottom:4px solid #F2BFCB}
.bubble.r::after{right:-24px;bottom:46px;transform:rotate(-45deg)}
.hb{position:absolute;z-index:4;width:150px;height:120px;background:#fff;border:4px solid #F2BFCB;border-radius:60px;display:flex;align-items:center;justify-content:center}
.hb::after{content:"";position:absolute;left:24px;bottom:-22px;width:30px;height:30px;background:#fff;border-left:4px solid #F2BFCB;border-bottom:4px solid #F2BFCB;transform:rotate(-30deg)}
.no{display:flex;align-items:center;gap:10px;font-family:"Noto Serif CJK JP",serif;font-weight:900;font-size:120px;line-height:1;color:var(--rose)}
.card{background:rgba(255,255,255,.72);border-radius:40px;padding:42px 46px;font-size:40px;line-height:1.8;color:#4A3838;box-shadow:0 8px 28px rgba(217,112,138,.10)}
.label{align-self:flex-start;display:inline-flex;align-items:center;gap:10px;background:#8DBE99;color:#fff;font-size:32px;font-weight:700;padding:12px 30px;border-radius:999px;letter-spacing:.06em}
.note{font-size:28px;line-height:1.6;color:var(--soft)}
`;

function fitSize(text, maxW, maxPx, minPx) {
  return Math.max(minPx, Math.min(maxPx, Math.floor(maxW / plainLen(text))));
}
function titleLines(s, size) {
  // **強調** を含む行に筆のようなピンクの下線を引く
  return String(s || "").split("\n").map(line => {
    const html = title(line);
    const brush = /\*\*/.test(line) ? `<span class="brush"></span>` : "";
    return `<span class="line">${brush}${html}</span>`;
  }).join("<br>");
}

function slideHTML(s, i, n, seed) {
  const type = s.type || "point";
  let deco = BG, inner = "";
  if (type === "cover") {
    const size = fitSize(s.title, 600, 150, 92);
    deco += BRANCH(false) + at(560, 300, LEAF(110, 120)) + at(980, 470, LEAF(70, 210)) + at(20, 1020, FLOWER(90)) + at(60, 1110, LEAF(80, 300)) + at(900, 1180, FLOWER(60));
    deco += `<img class="chara" style="right:-90px;bottom:96px;height:${s.lead ? 610 : 700}px" src="${CH.dataUri(CH.pick("cover", seed, 0, s.chara))}">`;
    deco += `<div class="hb" style="right:40px;top:${s.lead ? 600 : 520}px">${s.say ? `<span style="font-size:34px;font-weight:700;color:#4A3030;padding:0 14px;text-align:center;line-height:1.3">${esc(s.say)}</span>` : HEART(56)}</div>`;
    inner = `<div class="wrap">${LOGO}
      <div class="ttl" style="margin-top:56px;font-size:${size}px">${titleLines(s.title, size)}</div>
      ${s.lead ? `<div class="lead"><span class="sp">${SPROUT(52)}</span>${rich(s.lead)}</div>` : ""}
      <div class="pill" style="margin-top:56px">${SPROUT(46, "#FFFFFF")}スワイプして読む →</div>
      ${FOOT(i, n)}</div>`;
  } else if (type === "end") {
    deco += BRANCH(false) + at(40, 1060, FLOWER(80)) + at(110, 1130, LEAF(70, 300));
    deco += `<img class="chara" style="right:-110px;bottom:90px;height:470px" src="${CH.dataUri(CH.pick("end", seed, 0, s.chara))}">`;
    deco += `<div class="hb" style="right:30px;top:700px">${HEART(56)}</div>`;
    inner = `<div class="wrap">${LOGO}
      <div class="ttl" style="margin-top:100px;font-size:140px">${titleLines(s.message || "歯を、\n**育て**よう。", 140)}</div>
      <div style="margin-top:44px;max-width:600px;font-size:36px;line-height:1.75;color:#5A4444">抜く・削る前に、育てる。<br>2度と笑顔を失わせないために。</div>
      <div class="pill" style="margin-top:70px;font-size:38px">${SPROUT(46, "#FFFFFF")}ご予約はプロフィールから</div>
      <div class="note" style="margin-top:28px">Halulu渋谷歯科｜渋谷駅近く・完全自費診療</div>
      ${FOOT(i, n)}</div>`;
  } else if (type === "info") {
    deco += BRANCH(true);
    deco += `<img class="chara" style="right:30px;top:170px;height:240px" src="${CH.dataUri(CH.pick("mini", seed, i, s.chara))}">`;
    inner = `<div class="wrap">${LOGO}
      <div class="label" style="margin-top:130px">${SPROUT(36, "#FFFFFF")}${esc(s.label || "費用・回数・リスク")}</div>
      <div class="ttl" style="margin-top:30px;font-size:${fitSize(s.heading, 860, 76, 54)}px">${titleLines(s.heading)}</div>
      <div class="card" style="margin-top:44px;font-size:36px;border:3px dashed #EDBFCA">${rich(s.body)}</div>
      ${FOOT(i, n)}</div>`;
  } else {
    deco += BRANCH(true) + at(40, 1100, LEAF(80, 300));
    deco += `<img class="chara" style="right:-40px;bottom:96px;height:420px" src="${CH.dataUri(CH.pick("mini", seed, i, s.chara))}">`;
    const say = s.say ? `<div class="bubble r" style="left:70px;bottom:200px;max-width:560px">${esc(s.say).replace(/\n/g, "<br>")}</div>` : "";
    inner = `<div class="wrap">${LOGO}
      <div class="no" style="margin-top:40px">${SPROUT(70)}${String(s.no || i).padStart(2, "0")}</div>
      <div class="ttl" style="margin-top:22px;font-size:${fitSize(s.heading, 900, 84, 60)}px">${titleLines(s.heading)}</div>
      <div class="card" style="margin-top:34px;align-self:flex-start;max-width:820px">${rich(s.body)}</div>
      ${FOOT(i, n)}</div>${say}`;
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

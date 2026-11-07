// Halulu carousel renderer v2: node render-halulu-v2.js slides.json outDir [note|pop]
// 2026-11-03 本人希望「色を変えても同じようなデザインだと気になる。全く変えて」→ 水彩・明朝の型とは別の型を用意。
//   note … 手帳・ノート風（罫線の紙、マスキングテープ、蛍光ペンの線、手描きの枠）
//   pop  … ポップなカード風（ベタ塗りの背景にドット、太い丸ゴシック、影つきの白カード）
// slides の書き方は render-halulu.js と同じ（**強調**、{小さく}）。シンプル版はるみちゃん（assets/chara）を使う。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
const CH = require("./chara");

const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const fontFace = ["Medium:500", "Bold:700", "ExtraBold:800", "Black:900"].map(x => {
  const [n, w] = x.split(":");
  const b64 = fs.readFileSync(path.join(FONT_DIR, `MPLUSRounded1c-${n}.ttf`)).toString("base64");
  return `@font-face{font-family:"Maru";font-weight:${w};src:url(data:font/ttf;base64,${b64})}`;
}).join("");

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ttl = s => esc(s).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<em>$1</em>").replace(/\{(.+?)\}/g, "<small>$1</small>");
const rich = s => esc(s).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const lineLen = s => Math.max(...String(s || "").split("\n").map(l => [...l.replace(/\*\*/g, "").replace(/\{(.+?)\}/g, (m, a) => a.slice(0, Math.ceil(a.length * .66)))].length), 1);
const fit = (s, w, max, min) => Math.max(min, Math.min(max, Math.floor(w / lineLen(s))));
const img = (name, style, cls = "chara") => `<img class="${cls}" style="${style}" src="${CH.dataUri(name)}">`;


/* 費用・リスクの枚（自由診療の回。医療広告ガイドラインのため表で明記） */
function infoRows(s) {
  const rows = [["施術名", esc(s.heading), "big"]];
  if (s.price) rows.push(["費用<small>（税込）</small>", rich(s.price), "price"]);
  if (s.count) rows.push(["回数", rich(s.count), "big"]);
  if (s.risk) rows.push(["主なリスク", rich(s.risk), "txt"]);
  if (!s.price && !s.count && !s.risk && s.body) rows.push(["内容", rich(s.body), "txt"]);
  return rows;
}
const infoCSS = (line, accent, pill) => `
.itable{align-self:stretch;background:#fff;border:5px solid ${line};border-radius:30px;padding:10px 36px}
.irow{display:flex;align-items:center;gap:24px;padding:24px 0;border-bottom:3px dashed ${line}55}
.irow:last-child{border-bottom:0}
.irow .lb{flex:0 0 210px;text-align:center;background:${pill};border-radius:999px;padding:12px 8px;font-weight:800;font-size:30px;white-space:nowrap}
.irow .lb small{font-size:.7em}
.irow .vl{flex:1;min-width:0;font-weight:800;line-height:1.4}
.irow .vl.big{font-size:44px}
.irow .vl.price{font-size:50px;color:${accent};font-weight:900}
.irow .vl.txt{font-size:30px;line-height:1.65;font-weight:700}
.irow .vl b{background:none;color:inherit;padding:0}
`;
const infoTable = s => `<div class="itable">${infoRows(s).map(([lb, vl, k]) => `<div class="irow"><div class="lb">${lb}</div><div class="vl ${k}" ${k !== "txt" ? `style="font-size:${k === "price" ? fit(vl.replace(/<[^>]+>/g, ""), 560, 50, 30) : fit(vl.replace(/<[^>]+>/g, ""), 560, 44, 28)}px"` : ""}>${vl}</div></div>`).join("")}</div>`;

/* =========================== note：手帳・ノート風 =========================== */
const NOTE = {
  paper: "#FFFDF5", rule: "#E9E3D2", margin: "#F3B9C6", ink: "#4B3A32", soft: "#8A766C",
  pink: "#F07C98", mark: "#FFE27A", mark2: "#FFD3DE", tape: "#F7C9D4", tape2: "#CDE7D4", line: "#7A5A4E",
};
function noteCSS() {
  const C = NOTE;
  return `${fontFace}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;position:relative;overflow:hidden;color:${C.ink};font-family:"Maru",sans-serif;
 background:${C.paper} repeating-linear-gradient(180deg,transparent 0 69px,${C.rule} 69px 72px);background-position:0 30px}
.margin{position:absolute;left:112px;top:0;bottom:0;width:3px;background:${C.margin};opacity:.8}
.holes{position:absolute;left:36px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:space-around;padding:60px 0}
.holes i{display:block;width:34px;height:34px;border-radius:50%;background:#EFE8D8;box-shadow:inset 0 3px 4px rgba(0,0,0,.12)}
.wrap{position:absolute;left:160px;right:70px;top:60px;bottom:56px;display:flex;flex-direction:column;z-index:3}
.tape{position:absolute;z-index:5;height:70px;background:${C.tape};opacity:.92;transform:rotate(-3deg);
 -webkit-mask:linear-gradient(90deg,transparent 0,#000 8px calc(100% - 8px),transparent 100%);display:flex;align-items:center;justify-content:center;
 font-weight:800;font-size:30px;letter-spacing:.06em;color:#6B4450}
.tape::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 14px,transparent 14px 28px)}
.tape span{position:relative}
.ttl{font-weight:900;line-height:1.32;letter-spacing:.01em}
.ttl em{font-style:normal;color:${C.pink};background:linear-gradient(180deg,transparent 58%,${C.mark} 58% 92%,transparent 92%);padding:0 4px}
.ttl small{font-size:.62em;font-weight:800}
b{font-weight:800;background:linear-gradient(180deg,transparent 55%,${C.mark2} 55% 95%,transparent 95%);padding:0 2px}
.chara{position:absolute;z-index:4;filter:drop-shadow(0 0 0 #fff) drop-shadow(6px 0 0 #fff) drop-shadow(-6px 0 0 #fff) drop-shadow(0 6px 0 #fff) drop-shadow(0 -6px 0 #fff) drop-shadow(0 10px 14px rgba(90,60,40,.18))}
.bub{position:absolute;z-index:6;background:#fff;border:5px solid ${C.line};border-radius:38px;padding:22px 30px;font-weight:800;font-size:36px;line-height:1.35;text-align:center;white-space:nowrap;color:${C.ink}}
.bub::after{content:"";position:absolute;width:34px;height:34px;background:#fff;border-right:5px solid ${C.line};border-bottom:5px solid ${C.line};bottom:-20px;right:70px;transform:rotate(45deg)}
.memo{position:relative;align-self:stretch;background:#fff;border:4px solid ${C.line};border-radius:20px 26px 22px 30px;padding:40px 44px;font-size:40px;line-height:1.8;font-weight:500;box-shadow:8px 10px 0 ${C.mark2}}
.qmark{display:inline-flex;align-items:center;justify-content:center;width:150px;height:150px;border:6px solid ${C.pink};border-radius:50%;
 color:${C.pink};font-weight:900;font-size:96px;line-height:1;transform:rotate(-8deg);background:#fff}
.no{display:flex;align-items:center;gap:20px}
.no .c{width:160px;height:160px;border-radius:50%;border:6px solid ${C.line};background:${C.mark};display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-6deg)}
.no .c span{font-size:28px;font-weight:800;line-height:1}
.no .c strong{font-size:72px;font-weight:900;line-height:1}
.no .dash{flex:1;border-top:5px dotted ${C.line};opacity:.5}
.foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;font-size:26px;color:${C.soft};font-weight:700}
.foot .pg{font-size:34px;font-weight:900;color:${C.ink}}
.next{align-self:flex-start;display:inline-flex;align-items:center;gap:14px;background:${C.ink};color:#fff;font-weight:800;font-size:38px;padding:22px 42px;border-radius:999px;transform:rotate(-2deg)}
.check{display:flex;gap:16px;align-items:flex-start}
.check i{flex:0 0 46px;height:46px;border:4px solid ${C.line};border-radius:10px;margin-top:12px;position:relative;background:#fff}
.check i::after{content:"";position:absolute;left:10px;top:-6px;width:16px;height:30px;border:solid ${C.pink};border-width:0 7px 7px 0;transform:rotate(40deg)}
.doodle{position:absolute;z-index:2;line-height:0}${infoCSS(C.line, C.pink, C.mark)}
.wrap>*{flex-shrink:0}
.duo{display:flex;align-items:flex-end;justify-content:flex-end;gap:0;margin-top:auto;margin-right:-40px}
.duo img{position:static;display:block}
.duo .bub{position:relative;margin-bottom:180px;margin-right:-30px}
.duo .bub::after{right:-20px;bottom:40px;transform:rotate(-45deg)}
`;
}
const STAR = (s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M50 8 L61 38 L93 39 L67 58 L77 90 L50 71 L23 90 L33 58 L7 39 L39 38 Z" fill="${c}" stroke="#7A5A4E" stroke-width="4" stroke-linejoin="round"/></svg>`;
const SQUIG = (w, c) => `<svg width="${w}" height="40" viewBox="0 0 ${w} 40"><path d="M4 20 ${Array.from({ length: Math.floor(w / 40) }, (_, k) => `Q ${k * 40 + 24} ${k % 2 ? 36 : 4} ${k * 40 + 44} 20`).join(" ")}" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;
const TOOTH = (s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M30 14 C12 14 10 38 18 56 C24 70 24 88 33 89 C42 90 42 68 50 68 C58 68 58 90 67 89 C76 88 76 70 82 56 C90 38 88 14 70 14 C60 14 58 20 50 20 C42 20 40 14 30 14 Z" fill="#fff" stroke="${c}" stroke-width="6" stroke-linejoin="round"/><path d="M34 30 C30 34 30 42 32 46" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;

function noteSlide(s, i, n, seed) {
  const C = NOTE;
  const brand = `<div style="display:flex;align-items:center;gap:14px;font-weight:800;font-size:32px;color:${C.ink}">${TOOTH(46, C.line)}<span>Halulu渋谷歯科<span style="font-size:24px;color:${C.soft};margin-left:12px">歯のノート</span></span></div>`;
  const foot = `<div class="foot"><span>@halulu.shibuya.dental</span><span class="pg">${i + 1} / ${n}</span></div>`;
  const base = `<div class="margin"></div><div class="holes">${"<i></i>".repeat(9)}</div>`;
  let body = "", over = "";
  if (s.type === "cover") {
    const size = fit(s.title, 640, 124, 84);
    over += `<div class="tape" style="left:600px;top:40px;width:400px"><span>歯科衛生士の豆知識</span></div>`;
    over += img(CH.pick("cover", seed, 0, s.chara), "right:30px;bottom:110px;height:400px");
    over += `<div class="doodle" style="left:880px;top:300px">${STAR(80, C.mark)}</div><div class="doodle" style="left:970px;top:390px">${STAR(48, C.mark2)}</div>`;
    body = `${brand}
      <div style="margin-top:90px"><span class="qmark">Q.</span></div>
      <div class="ttl" style="margin-top:34px;font-size:${size}px">${ttl(s.title)}</div>
      <div style="margin-top:22px">${SQUIG(360, C.pink)}</div>
      ${s.lead ? `<div style="margin-top:26px;width:500px;font-size:32px;line-height:2.2;font-weight:700;color:${C.ink}">${rich(s.lead)}</div>` : ""}
      <div class="next" style="margin-top:36px">めくってね →</div>
      ${foot}`;
  } else if (s.type === "end") {
    over += `<div class="tape" style="left:180px;top:40px;width:360px;background:${C.tape2};color:#3F6650"><span>きょうのまとめ</span></div>`;
    over += img(CH.pick("end", seed, 0, s.chara), "right:50px;bottom:250px;height:380px");
    over += `<div class="bub" style="right:110px;top:560px">${esc(s.say || "まってるよ♡").replace(/\n/g, "<br>")}</div>`;
    body = `<div style="height:120px"></div>
      <div class="ttl" style="font-size:150px;line-height:1.25">歯を、<br><em>育てよう。</em></div>
      <div style="margin-top:40px;font-size:40px;line-height:1.8;font-weight:700">抜く・削る前に、<b>育てる。</b><br><span style="font-size:34px;color:${C.soft}">2度と笑顔を失わせないために。</span></div>
      <div class="next" style="margin-top:auto">ご予約はプロフィールから →</div>
      <div style="margin-top:28px;font-size:30px;font-weight:800">Halulu渋谷歯科<span style="font-size:26px;color:${C.soft};font-weight:700">　渋谷駅近く・完全自費診療</span></div>
      <div style="height:30px"></div>${foot}`;
  } else if (s.type === "info") {
    over += img(CH.pick("mini", seed, i, s.chara), "right:60px;top:70px;height:200px");
    body = `${brand}
      <div class="ttl" style="margin-top:70px;font-size:104px">${ttl(s.title || "**費用**・リスク")}</div>
      <div style="margin-top:44px">${infoTable(s)}</div>
      ${foot}`;
  } else {
    const hs = fit(s.heading, 820, 104, 66);
    const lines = String(s.body || "").split("\n");
    body = `${brand}
      <div class="no" style="margin-top:46px"><div class="c"><span>No.</span><strong>${s.no || i}</strong></div><span class="dash"></span></div>
      <div class="ttl" style="margin-top:36px;font-size:${hs}px">${ttl(s.heading)}</div>
      <div class="memo" style="margin-top:44px">
        <div class="check"><i></i><div>${rich(lines.join("\n"))}</div></div>
      </div>
      <div class="duo">${s.say ? `<div class="bub">${esc(s.say).replace(/\n/g, "<br>")}</div>` : ""}${img(CH.pick("mini", seed, i, s.chara), "height:290px", "chara")}</div>
      ${foot}`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${noteCSS()}</style></head><body>${base}<div class="wrap">${body}</div>${over}</body></html>`;
}

/* =========================== pop：ポップなカード風 =========================== */
const POP = { bg: "#C98A55", bg2: "#B97A47", dot: "rgba(255,255,255,.16)", card: "#FFF9EF", ink: "#3A2A21", soft: "#85705F", red: "#E2523B", yellow: "#FFD45C", shadow: "#5E3E28" };
function popCSS() {
  const C = POP;
  return `${fontFace}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;position:relative;overflow:hidden;color:${C.ink};font-family:"Maru",sans-serif;
 background:${C.bg} radial-gradient(${C.dot} 7px,transparent 8px) 0 0/54px 54px}
.card{position:absolute;left:64px;right:64px;top:150px;bottom:110px;background:${C.card};border:6px solid ${C.ink};border-radius:56px;box-shadow:18px 20px 0 ${C.shadow};z-index:2}
.wrap{position:absolute;left:120px;right:120px;top:210px;bottom:160px;display:flex;flex-direction:column;z-index:3}
.top{position:absolute;left:64px;right:64px;top:44px;display:flex;align-items:center;justify-content:space-between;z-index:3;color:#fff;font-weight:900}
.top .b{font-size:36px;letter-spacing:.04em}
.top .b small{font-size:24px;font-weight:700;margin-left:10px;opacity:.9}
.top .pg{background:${C.ink};border-radius:999px;padding:10px 26px;font-size:30px}
.bot{position:absolute;left:0;right:0;bottom:36px;text-align:center;color:#fff;font-weight:800;font-size:26px;z-index:3;letter-spacing:.04em}
.ttl{font-weight:900;line-height:1.24}
.ttl em{font-style:normal;color:${C.red}}
.ttl small{font-size:.6em;font-weight:800}
b{font-weight:900;color:${C.red}}
.chara{position:absolute;z-index:5}
.tag{display:inline-block;align-self:flex-start;background:${C.yellow};border:5px solid ${C.ink};border-radius:16px;padding:8px 24px;font-weight:900;font-size:34px;transform:rotate(-3deg);box-shadow:6px 6px 0 ${C.ink}}
.say{position:absolute;z-index:6;background:#fff;border:5px solid ${C.ink};border-radius:34px;padding:20px 30px;font-weight:900;font-size:36px;line-height:1.3;text-align:center;white-space:nowrap;box-shadow:8px 8px 0 ${C.ink}}
.say::after{content:"";position:absolute;width:30px;height:30px;background:#fff;border-left:5px solid ${C.ink};border-bottom:5px solid ${C.ink};left:60px;bottom:-19px;transform:rotate(-45deg)}
.num{position:absolute;z-index:6;left:20px;top:96px;width:190px;height:190px;border-radius:50%;background:${C.red};border:6px solid ${C.ink};box-shadow:8px 8px 0 ${C.ink};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-10deg)}
.num span{font-size:32px;font-weight:800;line-height:1}
.num strong{font-size:100px;font-weight:900;line-height:1}
.box{background:#fff;border:5px solid ${C.ink};border-radius:30px;padding:40px 44px;font-size:40px;line-height:1.75;font-weight:700}
.btn{align-self:flex-start;background:${C.ink};color:#fff;border-radius:999px;padding:22px 44px;font-weight:900;font-size:38px}
.burst{position:absolute;z-index:4;line-height:0}${infoCSS(C.ink, C.red, C.yellow)}
.wrap>*{flex-shrink:0}
.duo{display:flex;align-items:flex-end;justify-content:flex-end;margin-top:auto;margin-right:-30px;margin-bottom:-56px}
.duo img{position:static;display:block}
.duo .say{position:relative;margin-bottom:230px;margin-right:-20px}
.duo .say::after{left:auto;right:-19px;bottom:40px;transform:rotate(-135deg)}
`;
}
const BURST = (s, c) => { let d = ""; for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, r = k % 2 ? 36 : 50; d += `${k ? "L" : "M"}${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)} `; } return `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><path d="${d}Z" fill="${c}" stroke="#3A2A21" stroke-width="3" stroke-linejoin="round"/></svg>`; };
const CUP = s => `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M18 34 H74 V62 C74 78 62 88 46 88 C30 88 18 78 18 62 Z" fill="#fff" stroke="#3A2A21" stroke-width="5" stroke-linejoin="round"/><path d="M74 42 C90 42 90 66 72 66" fill="none" stroke="#3A2A21" stroke-width="5"/><path d="M34 22 C30 14 38 10 34 2 M50 22 C46 14 54 10 50 2" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;

function popSlide(s, i, n, seed) {
  const C = POP;
  const top = `<div class="top"><span class="b">Halulu渋谷歯科<small>ハルル</small></span><span class="pg">${i + 1}/${n}</span></div>`;
  const bot = `<div class="bot">@halulu.shibuya.dental</div>`;
  let body = "", over = "";
  if (s.type === "cover") {
    const size = fit(s.title, 760, 150, 96);
    over += img(CH.pick("cover", seed, 0, s.chara), "right:30px;bottom:70px;height:460px");
    over += `<div class="burst" style="left:840px;top:200px">${BURST(150, C.yellow)}</div><div class="burst" style="left:840px;top:200px;z-index:5;width:150px;height:150px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:38px;line-height:1;color:${C.ink};font-family:Maru;transform:rotate(10deg)">${/[？?]/.test(s.title || "") ? "なぜ？" : "豆知識"}</div>`;
    
    body = `<span class="tag">歯科衛生士がこたえる</span>
      <div class="ttl" style="margin-top:60px;font-size:${size}px">${ttl(s.title)}</div>
      ${s.lead ? `<div style="margin-top:44px;width:470px;font-size:31px;line-height:1.75;font-weight:700;color:${C.soft}">${rich(s.lead)}</div>` : ""}
      <div class="btn" style="margin-top:auto">スワイプ →</div>`;
  } else if (s.type === "end") {
    over += img(CH.pick("end", seed, 0, s.chara), "right:70px;bottom:120px;height:360px");
    over += `<div class="say" style="right:120px;top:740px">${esc(s.say || "まってるよ♡").replace(/\n/g, "<br>")}</div>`;
    body = `<span class="tag">まとめ</span>
      <div class="ttl" style="margin-top:56px;font-size:150px">歯を、<br><em>育てよう。</em></div>
      <div style="margin-top:40px;font-size:38px;line-height:1.7;font-weight:800">抜く・削る前に、<b>育てる。</b><br><span style="font-size:32px;color:${C.soft}">2度と笑顔を失わせないために。</span></div>
      <div class="btn" style="margin-top:auto">ご予約はプロフィールから →</div>
      <div style="margin-top:22px;font-size:28px;font-weight:800;color:${C.soft}">渋谷駅近く・完全自費診療</div>`;
  } else if (s.type === "info") {
    over += img(CH.pick("mini", seed, i, s.chara), "right:90px;top:190px;height:200px");
    body = `<span class="tag">自由診療のご案内</span>
      <div class="ttl" style="margin-top:40px;font-size:100px">${ttl(s.title || "**費用**・リスク")}</div>
      <div style="margin-top:44px">${infoTable(s)}</div>`;
  } else {
    const hs = fit(s.heading, 820, 108, 66);
    over += `<div class="num"><span>POINT</span><strong>${s.no || i}</strong></div>`;
    body = `<div style="height:120px"></div>
      <div class="ttl" style="font-size:${hs}px">${ttl(s.heading)}</div>
      <div class="box" style="margin-top:44px">${rich(s.body)}</div>
      <div class="duo">${s.say ? `<div class="say">${esc(s.say).replace(/\n/g, "<br>")}</div>` : ""}${img(CH.pick("mini", seed, i, s.chara), "height:380px", "chara")}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${popCSS()}</style></head><body>${top}<div class="card"></div><div class="wrap">${body}</div>${over}${bot}</body></html>`;
}

(async () => {
  const [, , inFile, outDir, style = "note"] = process.argv;
  const { slides } = JSON.parse(fs.readFileSync(inFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const make = style === "pop" ? popSlide : noteSlide;
  const seed = (slides[0] && slides[0].title) || inFile;
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  const out = [];
  for (let i = 0; i < slides.length; i++) {
    await p.setContent(make(slides[i], i, slides.length, seed), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    const f = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await p.screenshot({ path: f, type: "png" });
    out.push(f);
  }
  await b.close();
  console.log(JSON.stringify({ style, files: out }));
})();

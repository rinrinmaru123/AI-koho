// Haguruma carousel renderer v2: node render-haguruma-v2.js slides.json outDir chat|magazine|comic [themeName]
// 2026-11-12 本人希望「Haluluのカルーセルみたいに、ガラッと雰囲気を変えたい」→ 今の型（render-haguruma.js）とは別の型を3つ。
//   chat     … LINEのトーク画面風（はぐるんが話しかける吹き出し、スタンプ、入力欄）
//   magazine … 雑誌風（大きな文字・細い罫線・大きな番号・色のブロック）
//   comic    … 漫画風（太い枠のコマ、トーンの点、集中線、叫びの吹き出し）
// slides の書き方は render-haguruma.js と同じ（**強調**、行頭 ~ でマーカー、{小さく}）。色は render-haguruma.js の THEMES を使う。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
const HG = require("./haguru");

const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");
const fontFace = ["Medium:500", "Bold:700", "ExtraBold:800", "Black:900"].map(x => {
  const [n, w] = x.split(":");
  const b64 = fs.readFileSync(path.join(FONT_DIR, `MPLUSRounded1c-${n}.ttf`)).toString("base64");
  return `@font-face{font-family:"Maru";font-weight:${w};src:url(data:font/ttf;base64,${b64})}`;
}).join("");
const LOGO_V = HG.dataUri("logo-v");

const THEMES = {
  free:     { hl: "#FFF07A", pop: "#FFD43B", em: "#22A05A", wash: "#DDF3E5", ink: "#174A31" },
  care:     { hl: "#FBE6C8", pop: "#F4B49A", em: "#2E9C78", wash: "#F8EBDD", ink: "#1D4A3C" },
  money:    { hl: "#FFF07A", pop: "#F2C230", em: "#1F5FA8", wash: "#DCE7F7", ink: "#163A5C" },
  skill:    { hl: "#FFE2B0", pop: "#FF9F43", em: "#E8792A", wash: "#FFE9D2", ink: "#3A2A17" },
  sky:      { hl: "#D3ECFF", pop: "#5AA9E6", em: "#1F78C8", wash: "#DBECFB", ink: "#173A55" },
  pink:     { hl: "#FFDCE8", pop: "#F48FB1", em: "#D9467A", wash: "#FCE2EC", ink: "#4A2333" },
  lavender: { hl: "#E9DFFF", pop: "#A88BEB", em: "#7A55D3", wash: "#EAE2FB", ink: "#2E2350" },
};

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const em = s => s.replace(/\*\*(.+?)\*\*/g, "<em>$1</em>").replace(/\{(.+?)\}/g, "<small>$1</small>");
// 日本語の文節で改行する（BudouX）。文節の途中では折り返さない
let BX; try { BX = require("budoux").loadDefaultJapaneseParser(); } catch (e) { BX = null; }
const ph = t => BX ? BX.parse(String(t)).map(esc).join("<wbr>") : esc(t);
const inl = s => String(s == null ? "" : s).split(/(\*\*.+?\*\*|\{.+?\})/).filter(x => x !== "").map(seg =>
  seg.startsWith("**") ? `<em>${ph(seg.slice(2, -2))}</em>` : seg.startsWith("{") && seg.endsWith("}") ? `<small>${ph(seg.slice(1, -1))}</small>` : ph(seg)).join("<wbr>");
// 見出し：行頭 ~ の行（無ければ1行目）にマーカー
const ttl = s => { const L = String(s || "").split("\n"); const any = L.some(l => l.startsWith("~")); return L.map((l, k) => { const t = inl(l.replace(/^~/, "")); return (any ? l.startsWith("~") : k === 0) ? `<span class="mk">${t}</span>` : t; }).join("<br>"); };
const plain = s => esc(String(s || "").replace(/^~/gm, "").replace(/\*\*|\{|\}/g, "")).replace(/\n/g, "<br>");
const rich = s => esc(String(s || "").replace(/^~/gm, "")).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const rows = s => String(s || "").replace(/([。！？])\*\*/g, "**$1").split(/\n/).flatMap(l => l.match(/[^。！？]+[。！？]?/g) || [l]).map(t => t.trim()).filter(Boolean);
const lineLen = s => Math.max(...String(s || "").split("\n").map(l => [...l.replace(/^~|\*\*|\{|\}/g, "")].length), 1);
const fit = (s, w, max, min) => Math.max(min, Math.min(max, Math.floor(w / lineLen(s))));
const chara = (name, style, cls = "chara") => `<img class="${cls}" style="${style}" src="${HG.dataUri(name)}">`;
const POSES = ["iine", "nikkori", "ganbaru", "wink", "tere", "ureshii", "bikkuri", "tsujo"];
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pose = (s, seed, i) => s.chara && HG.NAMES.includes(s.chara) ? s.chara
  : (s.type === "point" && HG.WORRY.test([s.heading, s.body].join(""))) ? "komari" : POSES[(hash(seed) + i * 3) % POSES.length];
const SAY = { cover: "知ってた？", point: "なるほど！", check: "要チェック！", end: "登録してね！" };
const say = s => esc(s.say || SAY[s.type] || SAY.point).replace(/\n/g, "<br>");
const ENDMSG = s => s.message || "~歯科の仕事を、\nもっと**自由**に。";

/* =========================== chat：トーク画面風 =========================== */
function chatSlide(s, i, n, seed, T) {
  const icon = `<span class="ic"><img src="${HG.dataUri("nikkori")}"></span>`;
  const head = `<div class="hd"><span class="back">‹</span>${icon}<div class="nm">はぐるん<small>Haguruma公式</small></div><span class="pg">${i + 1}/${n}</span></div>`;
  const foot = `<div class="ft"><span class="plus">＋</span><span class="in">${i + 1 < n ? "スワイプで続きを読む →" : "公式LINEで新着をチェック"}</span><span class="send">➤</span></div>`;
  const L = (html, cls = "") => `<div class="msg l ${cls}">${icon}<div class="bb">${html}</div></div>`;
  const R = (html, cls = "") => `<div class="msg r ${cls}"><div class="bb">${html}</div><span class="rd">既読</span></div>`;
  let body = "", over = "";
  const p = pose(s, seed, i);
  if (s.type === "cover") {
    const size = fit(s.title, 760, 112, 76);
    body = `<div class="day">${s.sub ? plain(s.sub).replace(/<br>/g, "") : "きょうのトピック"}</div>
      ${L(say(s), "small")}
      <div class="msg l big">${icon}<div class="bb card"><div class="ttl" style="font-size:${size}px">${ttl(s.title)}</div></div></div>
      ${s.lead ? L(rich(s.lead), "small") : ""}
      ${R("くわしく知りたい！")}`;
    over = chara(p, "left:60px;bottom:140px;height:300px", "chara stamp");
  } else if (s.type === "end") {
    body = `<div class="day">まとめ</div>
      <div class="msg l big">${icon}<div class="bb card"><div class="ttl" style="font-size:${fit(ENDMSG(s), 760, 108, 80)}px">${ttl(ENDMSG(s))}</div></div></div>
      ${L(rich(s.lead || "新着の案件は公式LINEでお知らせしています。"), "small")}
      <div class="stkrow"><div class="stk2">${say(s)}</div>${chara(p, "height:250px", "stamp")}</div>
      <div class="linebtn"><span>LINE</span>公式LINEで新着をチェック →</div>`;
  } else if (s.type === "check") {
    body = `<div class="day">チェックリスト</div>
      ${L(`<div class="ttl" style="font-size:${fit(s.heading || s.title, 700, 76, 54)}px">${ttl(s.heading || s.title)}</div>`, "card")}
      <div class="msg l">${icon}<div class="bb list">${rows(s.body).map(t => `<div class="ck"><i></i><span>${inl(t)}</span></div>`).join("")}</div></div>`;
    over = chara(p, "right:24px;bottom:150px;height:300px", "chara stamp") + `<div class="stk" style="right:290px;bottom:400px">${say(s)}</div>`;
  } else {
    body = `<div class="day">POINT ${s.no || i}</div>
      <div class="msg l big">${icon}<div class="bb card"><div class="ttl" style="font-size:${fit(s.heading, 740, 92, 60)}px">${ttl(s.heading)}</div></div></div>
      ${L(rows(s.body).map(t => inl(t)).join("<br>"))}
      ${R(say(s), "say")}`;
    over = chara(p, "left:150px;bottom:140px;height:330px", "chara stamp");
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}
*{box-sizing:border-box;margin:0;padding:0;word-break:keep-all;overflow-wrap:anywhere}
body{width:1080px;height:1350px;position:relative;overflow:hidden;font-family:"Maru",sans-serif;color:#1F2A24;background:${T.wash}}
body::before{content:"";position:absolute;inset:0;background:radial-gradient(rgba(255,255,255,.7) 3px,transparent 4px) 0 0/40px 40px}
.hd{position:absolute;left:0;right:0;top:0;height:150px;background:#fff;display:flex;align-items:center;gap:22px;padding:0 44px;box-shadow:0 4px 0 rgba(0,0,0,.05);z-index:3}
.hd .back{font-size:80px;color:#9AA;line-height:1;margin-top:-10px}
.ic{flex:0 0 96px;width:96px;height:96px;border-radius:50%;background:${T.hl};overflow:hidden;display:block;border:4px solid #fff;box-shadow:0 0 0 3px ${T.pop}}
.ic img{width:150%;margin:-6% 0 0 -25%}
.nm{font-weight:900;font-size:44px;flex:1;line-height:1.1}
.nm small{display:block;font-size:24px;font-weight:700;color:#7A8A82}
.pg{background:${T.em};color:#fff;font-weight:900;font-size:32px;padding:10px 26px;border-radius:999px}
.wrap{position:absolute;left:40px;right:40px;top:186px;bottom:140px;display:flex;flex-direction:column;gap:26px;z-index:2}
.day{align-self:center;background:rgba(0,0,0,.28);color:#fff;font-weight:800;font-size:28px;padding:8px 28px;border-radius:999px}
.msg{display:flex;align-items:flex-start;gap:18px}
.msg .ic{flex-basis:84px;width:84px;height:84px}
.msg.r{justify-content:flex-end;align-items:flex-end}
.bb{background:#fff;border-radius:12px 40px 40px 40px;padding:26px 34px;font-weight:700;font-size:38px;line-height:1.6;max-width:820px;box-shadow:0 4px 0 rgba(0,0,0,.05)}
.msg.small .bb{font-size:32px;padding:20px 30px}
.msg.r .bb{background:#8DE055;border-radius:40px 12px 40px 40px;font-weight:800}
.msg.r.say .bb{font-size:44px}
.rd{font-size:22px;color:#6B7A72;order:-1;margin-bottom:6px}
.bb.card{border:6px solid ${T.em};border-radius:14px 44px 44px 44px;padding:34px 40px;max-width:860px}
.ttl{font-weight:900;line-height:1.25;color:${T.ink}}
.ttl em,b,.bb em{font-style:normal;color:${T.em};font-weight:900}
.ttl small{font-size:.62em}
.mk{background:linear-gradient(180deg,transparent 55%,${T.hl} 55% 92%,transparent 92%)}
.list{padding:18px 34px}
.ck{display:flex;gap:18px;align-items:flex-start;padding:14px 0;border-bottom:3px dashed #DDE5E0;font-size:36px}
.ck:last-child{border-bottom:0}
.ck i{flex:0 0 44px;height:44px;border-radius:12px;background:${T.em};margin-top:6px;position:relative}
.ck i::after{content:"";position:absolute;left:14px;top:4px;width:12px;height:24px;border:solid #fff;border-width:0 6px 6px 0;transform:rotate(40deg)}
.ft{position:absolute;left:0;right:0;bottom:0;height:120px;background:#fff;display:flex;align-items:center;gap:20px;padding:0 36px;z-index:3}
.ft .plus{font-size:52px;color:#9AA}
.ft .in{flex:1;background:#F1F4F2;border-radius:999px;padding:18px 34px;font-size:32px;color:#6B7A72;font-weight:700}
.ft .send{font-size:46px;color:${T.em}}
.chara{position:absolute;z-index:4}
.stamp{filter:drop-shadow(0 0 0 #fff) drop-shadow(7px 0 0 #fff) drop-shadow(-7px 0 0 #fff) drop-shadow(0 7px 0 #fff) drop-shadow(0 -7px 0 #fff) drop-shadow(0 12px 16px rgba(0,0,0,.15))}
.stk{position:absolute;z-index:5;background:#fff;border:6px solid ${T.ink};border-radius:30px;padding:16px 28px;font-weight:900;font-size:40px;line-height:1.25;text-align:center;transform:rotate(-5deg)}
.stkrow{display:flex;align-items:center;justify-content:flex-end;gap:20px;margin-top:-10px}
.stk2{background:#fff;border:6px solid ${T.ink};border-radius:30px;padding:16px 28px;font-weight:900;font-size:40px;line-height:1.25;transform:rotate(-5deg)}
.linebtn{align-self:stretch;margin-top:auto;background:#06C755;color:#fff;border-radius:999px;padding:30px;text-align:center;font-weight:900;font-size:46px;display:flex;align-items:center;justify-content:center;gap:24px}
.linebtn span{background:#fff;color:#06C755;font-size:28px;padding:12px 18px;border-radius:40%}
.brand{display:flex;align-items:center;gap:24px;font-weight:800;font-size:30px;line-height:1.45;color:${T.ink}}
.brand img{height:150px}
</style></head><body>${head}<div class="wrap">${body}</div>${over}${foot}</body></html>`;
}

/* =========================== magazine：雑誌風 =========================== */
function magSlide(s, i, n, seed, T) {
  const mast = `<div class="mast"><div class="mt">Haguruma<span>WORK STYLE MAGAZINE</span></div><div class="vol">No.${String(i + 1).padStart(2, "0")}<small> / ${String(n).padStart(2, "0")}</small></div></div>`;
  const foot = `<div class="mf"><span>@haguruma_dental</span><span>${i + 1 < n ? "SWIPE →" : "歯科の仕事を、もっと自由に。"}</span></div>`;
  const p = pose(s, seed, i);
  let body = "", over = "";
  if (s.type === "cover") {
    const size = fit(s.title, 960, 150, 96);
    // タイトルが3行以上のときは、はぐるんを小さくして文字に重ならないように
    const tb = 200 + 94 + size * 1.18 * String(s.title).split("\n").length;
    const ch = Math.max(360, Math.min(560, 1350 - 120 - tb - 30));
    over = `<div class="blk" style="right:-60px;bottom:110px;width:${Math.round(ch * 1.14)}px;height:${ch}px;transform:rotate(-8deg)"></div>`
      + chara(p, `right:40px;bottom:120px;height:${ch}px`, "chara cut")
      + `<div class="quote" style="left:60px;bottom:200px">“${say(s)}”<small>— はぐるん</small></div>`;
    body = `<div class="kick">${s.sub ? plain(s.sub).replace(/<br>/g, " ") : "FEATURE"}</div>
      <div class="ttl" style="margin-top:34px;font-size:${size}px">${ttl(s.title)}</div>
      ${s.lead ? `<div class="lead">${rich(s.lead)}</div>` : ""}`;
  } else if (s.type === "end") {
    over = `<div class="blk" style="left:-80px;bottom:120px;width:1240px;height:300px;transform:rotate(-4deg)"></div>`
      + chara(p, "right:50px;bottom:140px;height:440px", "chara cut")
      + `<div class="quote" style="left:70px;bottom:250px;color:#fff">“${say(s)}”<small style="color:#fff">— はぐるん</small></div>`;
    body = `<div class="kick">EDITOR'S NOTE</div>
      <div class="ttl" style="margin-top:34px;font-size:${fit(ENDMSG(s), 960, 140, 96)}px">${ttl(ENDMSG(s))}</div>
      <div class="lead" style="width:560px">${rich(s.lead || "新着の案件は公式LINEでお知らせしています。登録・お問い合わせはプロフィールから。")}</div>
`;
  } else if (s.type === "check") {
    over = chara(p, "right:40px;bottom:110px;height:340px", "chara cut");
    body = `<div class="kick">CHECK LIST</div>
      <div class="ttl" style="margin-top:28px;font-size:${fit(s.heading || s.title, 960, 110, 70)}px">${ttl(s.heading || s.title)}</div>
      <ol class="ol">${rows(s.body).map(t => `<li>${inl(t)}</li>`).join("")}</ol>`;
  } else {
    over = `<div class="circ" style="right:60px;bottom:120px"></div>` + chara(p, "right:70px;bottom:120px;height:400px", "chara cut")
      + `<div class="quote" style="right:470px;bottom:200px;text-align:right">“${say(s)}”<small>— はぐるん</small></div>`;
    body = `<div class="bignum">${String(s.no || i).padStart(2, "0")}</div>
      <div class="ttl" style="margin-top:6px;font-size:${fit(s.heading, 960, 108, 68)}px">${ttl(s.heading)}</div>
      <div class="rule"></div>
      <div class="txt">${rows(s.body).map(t => `<p>${inl(t)}</p>`).join("")}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}
*{box-sizing:border-box;margin:0;padding:0;word-break:keep-all;overflow-wrap:anywhere}
body{width:1080px;height:1350px;position:relative;overflow:hidden;background:#FBFAF6;color:#151515;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif}
.mast{position:absolute;left:60px;right:60px;top:44px;display:flex;align-items:flex-end;justify-content:space-between;border-bottom:4px solid #151515;padding-bottom:16px;z-index:3}
.mt{font-family:"Noto Serif CJK JP",serif;font-weight:900;font-size:60px;letter-spacing:.02em;line-height:1}
.mt span{display:block;font-family:"Noto Sans CJK JP",sans-serif;font-size:20px;font-weight:700;letter-spacing:.42em;margin-top:10px;color:${T.em}}
.vol{font-weight:900;font-size:48px;line-height:1}
.vol small{font-size:26px;color:#888}
.wrap{position:absolute;left:60px;right:60px;top:200px;bottom:120px;display:flex;flex-direction:column;z-index:3}
.kick{align-self:flex-start;font-weight:900;font-size:30px;letter-spacing:.2em;color:#fff;background:${T.em};padding:10px 24px}
.ttl{font-weight:900;line-height:1.18;letter-spacing:-.01em}
.ttl em{font-style:normal;color:${T.em}}
.ttl small{font-size:.6em}
.mk{background:linear-gradient(180deg,transparent 62%,${T.hl} 62% 94%,transparent 94%)}
.lead{margin-top:40px;width:520px;font-size:32px;line-height:1.8;font-weight:500;border-left:8px solid ${T.pop};padding-left:24px}
.lead b,.txt b{color:${T.em}}
.bignum{font-family:"Noto Serif CJK JP",serif;font-weight:900;font-size:230px;line-height:.9;color:transparent;-webkit-text-stroke:5px ${T.em}}
.rule{margin-top:36px;height:3px;background:#151515;width:100%}
.txt{margin-top:30px;width:560px}
.txt p{font-size:38px;line-height:1.6;font-weight:700;padding:12px 0;border-bottom:1px solid #CCC}
.txt em{font-style:normal;color:${T.em}}
.ol{margin-top:44px;width:640px;list-style:none;counter-reset:c}
.ol li{counter-increment:c;font-size:40px;font-weight:700;line-height:1.5;padding:20px 0 20px 90px;border-bottom:2px solid #151515;position:relative}
.ol li::before{content:counter(c,decimal-leading-zero);position:absolute;left:0;top:18px;font-family:"Noto Serif CJK JP",serif;font-weight:900;font-size:48px;color:${T.em}}
.ol em{font-style:normal;color:${T.em}}
.blk{position:absolute;background:${T.pop};z-index:1}
.circ{position:absolute;width:400px;height:400px;border-radius:50%;background:${T.wash};border:4px solid ${T.pop};z-index:1}
.chara{position:absolute;z-index:2}
.cut{filter:drop-shadow(0 0 0 #fff) drop-shadow(6px 0 0 #fff) drop-shadow(-6px 0 0 #fff) drop-shadow(0 6px 0 #fff) drop-shadow(0 -6px 0 #fff)}
.quote{position:absolute;z-index:4;font-family:"Noto Serif CJK JP",serif;font-weight:900;font-size:46px;line-height:1.3;color:#151515}
.quote small{display:block;font-family:"Noto Sans CJK JP",sans-serif;font-size:24px;font-weight:700;color:#777;margin-top:8px}
.mf{position:absolute;left:60px;right:60px;bottom:40px;display:flex;justify-content:space-between;border-top:2px solid #151515;padding-top:14px;font-weight:800;font-size:26px;letter-spacing:.06em;z-index:3}
</style></head><body>${mast}<div class="wrap">${body}</div>${over}${foot}</body></html>`;
}

/* =========================== comic：漫画風 =========================== */
const SPIKE = (w, h, fill) => { let d = ""; const N = 26; for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, r = k % 2 ? .78 : 1; d += `${k ? "L" : "M"}${(w / 2 + Math.cos(a) * w / 2 * r).toFixed(1)} ${(h / 2 + Math.sin(a) * h / 2 * r).toFixed(1)} `; } return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0;overflow:visible"><path d="${d}Z" fill="${fill}" stroke="#111" stroke-width="7" stroke-linejoin="round"/></svg>`; };
const SPEED = (cx, cy, c) => `<svg class="speed" width="1080" height="1350"><g stroke="${c}" stroke-width="6" opacity=".55">${Array.from({ length: 44 }, (_, k) => { const a = k / 44 * Math.PI * 2; const r1 = 260 + (k % 3) * 40; return `<line x1="${cx + Math.cos(a) * r1}" y1="${cy + Math.sin(a) * r1}" x2="${cx + Math.cos(a) * 1400}" y2="${cy + Math.sin(a) * 1400}"/>`; }).join("")}</g></svg>`;
function comicSlide(s, i, n, seed, T) {
  const p = pose(s, seed, i);
  const pg = `<div class="pg">${i + 1}/${n}</div>`;
  const sig = `<div class="sig">Haguruma｜@haguruma_dental${i + 1 < n ? "　スワイプ →" : ""}</div>`;
  let body = "";
  if (s.type === "cover") {
    const size = fit(s.title, 860, 140, 90);
    body = `<div class="panel" style="left:40px;top:40px;width:1000px;height:640px;transform:rotate(-1deg)">
        ${s.sub ? `<div class="cap" style="left:-6px;top:-6px">${plain(s.sub).replace(/<br>/g, "")}</div>` : ""}
        <div class="ttl" style="position:absolute;left:50px;right:50px;top:${s.sub ? 130 : 80}px;font-size:${size}px">${ttl(s.title)}</div>
        ${s.lead ? `<div class="cap" style="left:50px;bottom:40px;top:auto;max-width:880px;font-size:30px;line-height:1.5;background:#fff">${rich(s.lead)}</div>` : ""}</div>
      <div class="panel tone" style="left:40px;top:710px;width:1000px;height:560px;transform:rotate(1deg)">${SPEED(720, 300, "#111")}
        ${chara(p, "right:60px;bottom:-10px;height:520px")}
        <div class="spk" style="left:40px;top:60px;width:480px;height:300px">${SPIKE(480, 300, "#fff")}<span>${say(s)}</span></div>
</div>`;
  } else if (s.type === "end") {
    body = `<div class="panel tone" style="left:40px;top:40px;width:1000px;height:1200px">${SPEED(760, 760, "#111")}
        <div class="cap" style="left:-6px;top:-6px">さいごに</div>
        <div class="ttl tbox" style="position:absolute;left:40px;right:40px;top:110px;font-size:${fit(ENDMSG(s), 700, 110, 76)}px">${ttl(ENDMSG(s))}</div>
        ${chara(p, "right:40px;bottom:170px;height:420px")}
        <div class="bal" style="left:80px;top:640px">${say(s)}</div>
        <div class="linebtn">公式LINEで新着をチェック →</div></div>`;
  } else if (s.type === "check") {
    body = `<div class="panel" style="left:40px;top:40px;width:1000px;height:1200px">
        <div class="cap" style="left:-6px;top:-6px">チェック！</div>
        <div class="ttl" style="position:absolute;left:50px;right:50px;top:120px;font-size:${fit(s.heading || s.title, 900, 110, 70)}px">${ttl(s.heading || s.title)}</div>
        <div class="nar" style="left:50px;top:420px;width:620px">${rows(s.body).map(t => `<div class="ck">☑ ${inl(t)}</div>`).join("")}</div>
        ${chara(p, "right:30px;bottom:90px;height:420px")}<div class="bal" style="right:60px;top:430px">${say(s)}</div></div>`;
  } else {
    body = `<div class="panel" style="left:40px;top:40px;width:1000px;height:470px;transform:rotate(-1deg)">
        <div class="cap" style="left:-6px;top:-6px">POINT ${s.no || i}</div>
        <div class="ttl" style="position:absolute;left:50px;right:50px;top:130px;font-size:${fit(s.heading, 800, 108, 66)}px">${ttl(s.heading)}</div></div>
      <div class="panel" style="left:40px;top:540px;width:560px;height:730px;transform:rotate(.6deg)">
        <div class="nar" style="left:34px;right:34px;top:40px">${rows(s.body).map(t => `<p>${inl(t)}</p>`).join("")}</div></div>
      <div class="panel tone" style="left:630px;top:540px;width:410px;height:730px;transform:rotate(-.6deg)">${SPEED(220, 520, "#111")}
        ${chara(p, "left:-30px;bottom:-10px;height:440px")}
        <div class="bal" style="left:30px;top:40px">${say(s)}</div></div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}
*{box-sizing:border-box;margin:0;padding:0;word-break:keep-all;overflow-wrap:anywhere}
body{width:1080px;height:1350px;position:relative;overflow:hidden;font-family:"Maru",sans-serif;color:#111;background:#fff}
.panel{position:absolute;background:#fff;border:9px solid #111;overflow:hidden}
.panel.tone{background:${T.wash} radial-gradient(${T.pop} 4px,transparent 5px) 0 0/22px 22px}
.speed{position:absolute;left:-400px;top:-400px;width:1880px;height:2150px;pointer-events:none}
.cap{position:absolute;z-index:3;background:${T.hl};border:6px solid #111;padding:12px 28px;font-weight:900;font-size:38px}
.ttl{font-weight:900;line-height:1.22;z-index:2}
.ttl em{font-style:normal;color:${T.em};-webkit-text-stroke:0}
.ttl small{font-size:.6em}
.tbox{background:#fff;border:7px solid #111;padding:30px 36px;box-shadow:10px 10px 0 #111}
.mk{background:linear-gradient(180deg,transparent 58%,${T.hl} 58% 94%,transparent 94%)}
.chara{position:absolute;z-index:2}
.spk{position:absolute;z-index:3}
.spk span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:54px;line-height:1.2;transform:rotate(-4deg)}
.bal{position:absolute;z-index:3;background:#fff;border:6px solid #111;border-radius:50%;padding:40px 46px;font-weight:900;font-size:42px;line-height:1.25;text-align:center;white-space:nowrap}
.nar{position:absolute;z-index:2;font-weight:700;font-size:36px;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere}
.nar p{padding:18px 0;border-bottom:4px dotted #111;font-size:40px}
.nar p:last-child{border-bottom:0}
.nar em{font-style:normal;color:${T.em};font-weight:900}
.ck{padding:16px 0;font-size:40px;border-bottom:4px dotted #111}
.ck em{font-style:normal;color:${T.em}}
.pg{position:absolute;right:24px;top:20px;z-index:9;background:#111;color:#fff;font-weight:900;font-size:30px;padding:8px 22px;border-radius:999px}
.sig{position:absolute;left:0;right:0;bottom:24px;text-align:center;font-weight:900;font-size:26px;z-index:9;letter-spacing:.04em}
.linebtn{position:absolute;left:50px;right:50px;bottom:50px;z-index:3;background:#06C755;color:#fff;border:7px solid #111;border-radius:999px;padding:28px;text-align:center;font-weight:900;font-size:46px;box-shadow:8px 8px 0 #111}
</style></head><body>${body}${pg}${sig}</body></html>`;
}

(async () => {
  const [, , inFile, outDir, style = "chat", themeName = "free"] = process.argv;
  const T = THEMES[themeName] || THEMES.free;
  const { slides } = JSON.parse(fs.readFileSync(inFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const make = style === "magazine" ? magSlide : style === "comic" ? comicSlide : chatSlide;
  const seed = (slides[0] && slides[0].title) || inFile;
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  const out = [];
  for (let i = 0; i < slides.length; i++) {
    await p.setContent(make(slides[i], i, slides.length, seed, T), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    const f = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await p.screenshot({ path: f, type: "png" });
    out.push(f);
  }
  await b.close();
  console.log(JSON.stringify({ style, theme: themeName, files: out }));
})();

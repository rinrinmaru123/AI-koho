// Halulu carousel renderer: node render-halulu.js slides.json outDir
// slides.json = {"slides":[{"type":"cover","title":"…","lead":"…","say":"…","theme":"…"},{"type":"point","no":1,"heading":"…","body":"…","say":"…"},
//   {"type":"info","heading":"施術名","price":"税込の費用","count":"回数・時間","risk":"主なリスク","body":"(旧形式)"},{"type":"end","say":"…"}]}
// 記法：**ことば** → テーマ色で強調。タイトル・見出しでは {ことば} → 小さめ。
// デザイン：2026-10-23 本人の見本（水彩・花と若葉・大きいキャラ・吹き出し）。投稿の内容ごとに色テーマが変わる。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");
const CH = require("./chara");

/* ---------- 色テーマ（内容で自動選択。1枚目に "theme" を書けばそれを使う） ---------- */
const THEMES = {
  sakura:   { accent: "#D9708A", deep: "#C25C77", light: "#FBE3E8", line: "#F2BFCB", bg: "#FCF7F3", blob2: "#F9DDE3", leaf: "#9FCB9F", flower: "#FFFFFF", fcenter: "#F6C66B", petal: "#F6C9D2" },
  mint:     { accent: "#3E9C8F", deep: "#2F8277", light: "#DCF1EC", line: "#A9DCD2", bg: "#F6FBF9", blob2: "#E3F4EF", leaf: "#8CCB9B", flower: "#FFFFFF", fcenter: "#F3D36B", petal: "#BFE6DC" },
  lavender: { accent: "#9A72C9", deep: "#8259B5", light: "#EFE6F8", line: "#D6C3EC", bg: "#FAF7FC", blob2: "#F1E8F8", leaf: "#A9CDA6", flower: "#F4ECFB", fcenter: "#F2C66E", petal: "#E3D2F3" },
  peach:    { accent: "#E07B52", deep: "#C9653D", light: "#FDE7DA", line: "#F5C6AE", bg: "#FFF8F3", blob2: "#FCE3D3", leaf: "#A7CB95", flower: "#FFFFFF", fcenter: "#F4B860", petal: "#F9D2BD" },
  sky:      { accent: "#4E8FCB", deep: "#3A78B3", light: "#E1EEFA", line: "#B7D3EE", bg: "#F6FAFD", blob2: "#E5F0FA", leaf: "#9CCBA8", flower: "#FFFFFF", fcenter: "#F3CE6A", petal: "#C9DFF4" },
};
const RULES = [
  ["peach", /キャンペーン|特別価格|お知らせ|期間限定|月\d+日まで|総額/],
  ["lavender", /ホワイトニング|ボツリヌス|美容|エラ|小顔|ヒアルロン|うっとり|着色|黄ば/],
  ["sky", /口臭|におい|ニオイ|唾液|水分|お水|乾燥|ドライマウス|舌/],
  ["sakura", /出血|血が|歯ぐき|歯茎|痛|しみ|腫れ|不安/],
  ["mint", /歯ブラシ|フロス|歯間|セルフケア|みがき|磨き|清潔|交換|予防|MFT|トレーニング/],
];
function pickTheme(slides) {
  const want = slides[0] && slides[0].theme;
  if (want && THEMES[want]) return want;
  const head = [slides[0] && slides[0].title, slides[0] && slides[0].lead].join(" ");
  const all = slides.map(s => [s.title, s.heading, s.body, s.lead].join(" ")).join(" ");
  for (const txt of [head, all]) for (const [name, re] of RULES) if (re.test(txt)) return name;
  return "sakura";
}

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const title = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<em>$1</em>").replace(/\{(.+?)\}/g, "<small>$1</small>");
const rich = s => esc(s).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const plainLen = s => Math.max(...String(s || "").split("\n").map(l => l.replace(/\*\*|\{|\}/g, "").length), 1);
const fitSize = (text, maxW, maxPx, minPx) => Math.max(minPx, Math.min(maxPx, Math.floor(maxW / plainLen(text))));
const titleLines = s => String(s || "").split("\n").map(line => {
  const brush = /\*\*/.test(line) ? `<span class="brush"></span>` : "";
  return `<span class="line">${brush}${title(line)}</span>`;
}).join("<br>");

/* ---------- 飾り（SVG・テーマ色） ---------- */
function decoKit(T) {
  const LEAF = (w, rot) => `<svg width="${w}" height="${w}" viewBox="0 0 100 100" style="transform:rotate(${rot}deg)"><path d="M10 90 C20 40 55 12 92 8 C88 48 60 84 10 90 Z" fill="${T.leaf}" opacity=".9"/><path d="M14 86 C40 60 62 36 88 12" stroke="#7FAF82" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/></svg>`;
  const SPROUT = (s, c = "#8DBE99") => `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M50 94 C50 78 50 64 50 52" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M50 58 C32 58 18 46 14 28 C34 28 48 40 50 58 Z" fill="${c}"/><path d="M50 52 C54 32 70 20 88 18 C86 38 70 52 50 52 Z" fill="${c}" opacity=".85"/></svg>`;
  const FLOWER = (s, petal = T.flower) => {
    let p = "";
    for (let i = 0; i < 5; i++) p += `<ellipse cx="50" cy="27" rx="17" ry="24" fill="${petal}" stroke="${T.line}" stroke-width="1.5" transform="rotate(${i * 72} 50 50)"/>`;
    return `<svg width="${s}" height="${s}" viewBox="0 0 100 100">${p}<circle cx="50" cy="50" r="10" fill="${T.fcenter}"/></svg>`;
  };
  const PETAL = (s, rot) => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" style="transform:rotate(${rot}deg)"><path d="M50 8 C78 24 82 70 50 92 C18 70 22 24 50 8 Z" fill="${T.petal}" opacity=".85"/></svg>`;
  const HEART = (s, c = T.accent) => `<svg width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M50 86 C20 64 8 46 14 30 C20 14 42 12 50 30 C58 12 80 14 86 30 C92 46 80 64 50 86 Z" fill="${c}"/></svg>`;
  const SPARK = (s, rot) => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" style="transform:rotate(${rot}deg)"><path d="M30 10 L40 40 M60 4 L58 38 M84 18 L70 44" stroke="${T.accent}" stroke-width="8" stroke-linecap="round" opacity=".7"/></svg>`;
  const at = (x, y, svg) => `<div class="deco" style="left:${x}px;top:${y}px">${svg}</div>`;
  const BRANCH = light => [
    `<svg class="deco" style="right:-20px;top:-30px" width="380" height="300" viewBox="0 0 380 300"><path d="M380 40 C300 60 240 110 160 120" stroke="#A9C9A4" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M300 70 C290 120 300 160 330 200" stroke="#A9C9A4" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
    at(860, -10, LEAF(120, 200)), at(760, 70, LEAF(110, 160)), at(930, 120, LEAF(130, 250)),
    at(905, 20, FLOWER(120)), light ? "" : at(800, 150, FLOWER(80)), at(980, 210, FLOWER(70, T.light)),
    at(700, 30, PETAL(44, 30)), at(640, 120, LEAF(60, 140)),
  ].join("");
  const BG = `<div class="blob" style="width:820px;height:620px;right:-260px;top:-140px;background:radial-gradient(closest-side,${T.light},transparent)"></div>
<div class="blob" style="width:700px;height:560px;left:-260px;bottom:-200px;background:radial-gradient(closest-side,${T.blob2},transparent)"></div>
<div class="blob" style="width:520px;height:420px;left:-200px;top:520px;background:radial-gradient(closest-side,#EEF6EC,transparent)"></div>
<div class="blob" style="width:420px;height:340px;right:-120px;top:560px;background:radial-gradient(closest-side,${T.blob2},transparent)"></div>
<svg class="deco" style="left:0;top:0" width="1080" height="1350" viewBox="0 0 1080 1350"><path d="M-20 1180 C200 1120 380 1250 620 1190 C820 1140 960 1180 1100 1120" stroke="${T.line}" stroke-width="3" fill="none" opacity=".8"/><path d="M640 -10 C700 140 860 220 1100 230" stroke="${T.line}" stroke-width="3" fill="none" opacity=".7"/></svg>`;
  return { LEAF, SPROUT, FLOWER, PETAL, HEART, SPARK, at, BRANCH, BG };
}

/* 費用・リスクの表のアイコン */
const ICON = {
  tooth: c => `<svg width="56" height="56" viewBox="0 0 100 100"><path d="M30 18 C14 18 12 40 20 56 C26 68 26 86 34 88 C42 90 42 68 50 68 C58 68 58 90 66 88 C74 86 74 68 80 56 C88 40 86 18 70 18 C60 18 58 24 50 24 C42 24 40 18 30 18 Z" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round"/></svg>`,
  yen: c => `<svg width="56" height="56" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="${c}" stroke-width="6"/><path d="M34 28 L50 50 L66 28 M50 50 L50 76 M36 54 H64 M36 66 H64" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
  cal: c => `<svg width="56" height="56" viewBox="0 0 100 100"><rect x="14" y="22" width="72" height="64" rx="10" fill="none" stroke="${c}" stroke-width="6"/><path d="M14 40 H86 M34 12 V30 M66 12 V30" stroke="${c}" stroke-width="6" stroke-linecap="round"/><g fill="${c}"><circle cx="34" cy="56" r="5"/><circle cx="50" cy="56" r="5"/><circle cx="66" cy="56" r="5"/><circle cx="34" cy="72" r="5"/><circle cx="50" cy="72" r="5"/></g></svg>`,
  warn: c => `<svg width="56" height="56" viewBox="0 0 100 100"><path d="M50 12 L90 84 H10 Z" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round"/><path d="M50 40 V62" stroke="${c}" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="73" r="4.5" fill="${c}"/></svg>`,
  memo: c => `<svg width="56" height="56" viewBox="0 0 100 100"><rect x="20" y="12" width="60" height="76" rx="8" fill="none" stroke="${c}" stroke-width="6"/><path d="M34 34 H66 M34 50 H66 M34 66 H54" stroke="${c}" stroke-width="6" stroke-linecap="round"/></svg>`,
};

function css(T) {
  return `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:${T.bg};color:#4A3030;font-family:"Noto Sans CJK JP",sans-serif;position:relative;overflow:hidden}
.blob{position:absolute;border-radius:50%}
.deco{position:absolute;line-height:0}
.chara{position:absolute;z-index:4;filter:drop-shadow(0 18px 28px rgba(80,40,40,.14))}
.wrap{position:absolute;inset:0;padding:64px 70px 56px;display:flex;flex-direction:column;z-index:3}
.logo{position:relative;display:flex;align-items:center;gap:10px;font-family:"Noto Serif CJK JP",serif;font-size:44px;font-weight:600;color:#5A3D3D;letter-spacing:.04em;height:90px}
.logo .jp{font-size:40px;letter-spacing:.12em;margin-left:6px}
.logoline{position:absolute;left:60px;top:72px}
.lheart{position:absolute;left:72px;top:58px}
.foot{margin-top:auto;display:flex;align-items:center;gap:18px;font-size:28px;color:#7A6464;position:relative;z-index:5}
.foot .fline{flex:1;height:2px;background:${T.line}}
.foot .page{font-family:"Noto Serif CJK JP",serif;font-size:40px;color:#5A3D3D}
.foot .page small{font-size:28px}
em{font-style:normal;color:${T.accent}}
small{font-size:.66em}
b{color:${T.deep};font-weight:700}
.ttl{font-family:"Noto Serif CJK JP",serif;font-weight:900;line-height:1.28;color:#4A2A2A}
.ttl .line{position:relative;display:inline-block}
.brush{position:absolute;left:-16px;right:-36px;bottom:4%;height:30%;background:linear-gradient(90deg,${T.line}cc,${T.line}55 75%,transparent);border-radius:40px 10px 60px 14px;z-index:-1;transform:rotate(-1deg)}
.dbox{position:relative;border:3px dashed ${T.line};border-radius:46px;background:rgba(255,255,255,.6);padding:46px 40px 40px;color:#4A3838}
.dbox .sp{position:absolute;left:50%;top:-36px;transform:translateX(-50%);padding:0 10px;line-height:0}
.pill{display:inline-flex;align-items:center;gap:18px;align-self:flex-start;background:linear-gradient(180deg,${T.accent},${T.deep});color:#fff;font-size:42px;font-weight:600;padding:26px 54px 26px 40px;border-radius:999px;box-shadow:0 10px 24px ${T.accent}44,inset 0 2px 0 rgba(255,255,255,.35)}
.say{position:absolute;z-index:6;white-space:nowrap;background:#fff;border:4px solid ${T.line};border-radius:50%/46%;padding:30px 40px;font-size:40px;line-height:1.35;font-weight:700;color:${T.deep};text-align:center;transform:rotate(-7deg);box-shadow:0 8px 22px ${T.accent}22}
.say::after{content:"";position:absolute;left:58%;bottom:-30px;width:44px;height:44px;background:#fff;border-right:4px solid ${T.line};border-bottom:4px solid ${T.line};transform:rotate(30deg) skewX(-10deg)}
.hb{position:absolute;z-index:6;width:150px;height:120px;background:#fff;border:4px solid ${T.line};border-radius:60px;display:flex;align-items:center;justify-content:center}
.hb::after{content:"";position:absolute;left:24px;bottom:-22px;width:30px;height:30px;background:#fff;border-left:4px solid ${T.line};border-bottom:4px solid ${T.line};transform:rotate(-30deg)}
.badge{position:relative;width:250px;height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:"Noto Serif CJK JP",serif}
.badge .ink{position:absolute;inset:0;border-radius:46% 54% 50% 50%/55% 48% 52% 45%;background:radial-gradient(circle at 40% 40%,${T.accent}dd,${T.accent} 55%,${T.deep});transform:rotate(-6deg)}
.badge .p{position:relative;font-size:40px;font-weight:600;letter-spacing:.04em;line-height:1}
.badge .n{position:relative;font-size:104px;font-weight:700;line-height:1.05}
.table{border:3px dashed ${T.line};border-radius:46px;background:rgba(255,255,255,.7);padding:18px 40px}
.row{display:flex;align-items:center;gap:22px;padding:26px 0;border-bottom:2px dashed ${T.line}}
.row:last-child{border-bottom:0}
.row .ic{width:96px;height:96px;flex:0 0 96px;border-radius:50%;background:${T.light};display:flex;align-items:center;justify-content:center}
.row .lb{flex:0 0 200px;text-align:center;background:${T.light};border-radius:999px;padding:14px 10px;font-family:"Noto Serif CJK JP",serif;font-weight:700;font-size:34px;color:#5A3D3D;letter-spacing:.08em}
.row .vl{flex:1;border-left:3px solid ${T.line};padding-left:28px;min-width:0}
.row .vl.big{font-family:"Noto Serif CJK JP",serif;font-weight:900;font-size:52px;line-height:1.25;color:#3A2424}
.row .vl.price{font-family:"Noto Serif CJK JP",serif;font-weight:900;font-size:60px;color:${T.accent};line-height:1.15}
.row .vl.txt{font-size:32px;line-height:1.6}
.note{font-size:28px;line-height:1.6;color:#7A6464}
.dash{height:0;border-top:3px dashed ${T.line};flex:1}
`;
}

function slideHTML(s, i, n, seed, T) {
  const K = decoKit(T);
  const LOGO = `<div class="logo">${K.SPROUT(64)}<span>Halulu<span class="jp">渋谷歯科</span></span><svg class="logoline" width="460" height="40" viewBox="0 0 460 40"><path d="M4 20 C120 8 300 6 456 30" stroke="#D9B3A8" stroke-width="2.5" fill="none"/></svg><span class="lheart">${K.HEART(26)}</span></div>`;
  const FOOT = `<div class="foot"><span>@halulu.shibuya.dental</span><span class="fline"></span>${K.SPROUT(40)}<span class="fline"></span><span class="page">${i + 1}<small>/${n}</small></span></div>`;
  const type = s.type || "point";
  let deco = K.BG, inner = "", over = "";
  if (type === "cover") {
    const size = fitSize(s.title, 600, 150, 92);
    deco += K.BRANCH(false) + K.at(590, 290, K.SPARK(70, 10)) + K.at(560, 380, K.LEAF(100, 120)) + K.at(990, 470, K.LEAF(70, 210)) + K.at(10, 1000, K.FLOWER(90)) + K.at(70, 1090, K.LEAF(80, 300)) + K.at(910, 1190, K.FLOWER(60));
    over += `<img class="chara" style="right:-90px;bottom:96px;height:${s.lead ? 620 : 700}px" src="${CH.dataUri(CH.pick("cover", seed, 0, s.chara))}">`;
    over += s.say ? `<div class="say" style="right:30px;top:${s.lead ? 560 : 480}px;font-size:36px;padding:26px 34px">${esc(s.say).replace(/\n/g, "<br>")}</div>` : `<div class="hb" style="right:40px;top:${s.lead ? 600 : 520}px">${K.HEART(56)}</div>`;
    inner = `<div class="wrap">${LOGO}
      <div class="ttl" style="margin-top:56px;font-size:${size}px">${titleLines(s.title)}</div>
      ${s.lead ? `<div class="dbox" style="margin-top:50px;width:540px;font-size:31px;line-height:1.75"><span class="sp">${K.SPROUT(54)}</span>${rich(s.lead)}</div>` : ""}
      <div class="pill" style="margin-top:56px">${K.SPROUT(46, "#FFFFFF")}スワイプして読む →</div>
      ${FOOT}</div>`;
  } else if (type === "end") {
    deco += K.BRANCH(false) + K.at(470, 270, K.LEAF(130, 120)) + K.at(600, 230, K.SPARK(70, 20)) + K.at(10, 880, K.FLOWER(90)) + K.at(70, 960, K.LEAF(90, 300)) + K.at(560, 1000, K.PETAL(50, 40)) + K.at(980, 1220, K.LEAF(60, 200));
    over += `<img class="chara" style="right:-110px;bottom:330px;height:480px" src="${CH.dataUri(CH.pick("end", seed, 0, s.chara))}">`;
    over += `<div class="say" style="right:40px;top:380px;font-size:36px;padding:22px 36px">${esc(s.say || "まってるよ♡").replace(/\n/g, "<br>")}</div>`;
    const msg = s.message || "歯を、\n**育てよう。**";
    inner = `<div class="wrap">${LOGO}
      <div class="ttl" style="margin-top:70px;font-size:150px">${titleLines(msg)}</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:30px;width:560px">${K.SPROUT(44)}<span class="dash"></span>${K.HEART(28)}</div>
      <div style="margin-top:26px;font-size:40px;line-height:1.6;color:#4A3434;font-weight:500">抜く・削る前に、<b style="font-size:48px;font-family:'Noto Serif CJK JP',serif">育てる。</b><br><span style="font-size:36px">2度と笑顔を失わせないために。</span></div>
      <div class="pill" style="margin-top:auto;font-size:40px;padding:28px 56px 28px 40px">${K.SPROUT(48, "#FFFFFF")}ご予約はプロフィールから　→</div>
      <div style="margin-top:30px;padding-top:22px;border-top:2px solid ${T.line};font-family:'Noto Serif CJK JP',serif;font-size:31px;color:#4A3434;width:760px;white-space:nowrap">Halulu渋谷歯科 ｜ 渋谷駅近く・完全自費診療</div>
      <div style="height:40px"></div>${FOOT}</div>`;
  } else if (type === "info") {
    deco += K.BRANCH(true) + K.at(760, 230, K.LEAF(90, 130)) + K.at(10, 1120, K.FLOWER(80)) + K.at(80, 1180, K.LEAF(80, 300));
    over += `<img class="chara" style="right:-40px;bottom:30px;height:250px" src="${CH.dataUri(CH.pick("mini", seed, i, s.chara))}">`;
    over += `<div class="say" style="right:150px;bottom:250px;font-size:28px;padding:16px 24px">要チェック♡</div>`;
    const rows = [];
    rows.push(["tooth", "施術名", `<div class="vl big" style="font-size:${fitSize(s.heading, 420, 50, 28)}px">${esc(s.heading)}</div>`]);
    if (s.price || s.count || s.risk) {
      if (s.price) rows.push(["yen", "費用<small style='font-size:.7em'>（税込）</small>", `<div class="vl price" style="font-size:${fitSize(s.price, 520, 60, 34)}px">${rich(s.price)}</div>`]);
      if (s.count) rows.push(["cal", "回数", `<div class="vl big" style="font-size:${fitSize(s.count, 520, 46, 32)}px">${rich(s.count)}</div>`]);
      if (s.risk) rows.push(["warn", "主なリスク", `<div class="vl txt">${rich(s.risk)}</div>`]);
    } else {
      rows.push(["memo", "内容", `<div class="vl txt" style="font-size:30px">${rich(s.body)}</div>`]);
    }
    inner = `<div class="wrap">${LOGO}
      <div class="ttl" style="margin-top:30px;font-size:120px">${titleLines(s.title || "**費用**・リスク")}</div>
      <div class="table" style="margin-top:44px">${rows.map(([ic, lb, vl]) => `<div class="row"><div class="ic">${ICON[ic](T.accent)}</div><div class="lb">${lb}</div>${vl}</div>`).join("")}</div>
      ${FOOT}</div>`;
  } else {
    deco += K.BRANCH(true) + K.at(300, 230, K.SPARK(60, -10)) + K.at(980, 520, K.LEAF(70, 230)) + K.at(10, 1000, K.FLOWER(80)) + K.at(70, 1080, K.LEAF(90, 300)) + K.at(460, 1060, K.LEAF(70, 140)) + K.at(560, 1100, K.PETAL(50, 30));
    over += `<img class="chara" style="right:-70px;bottom:100px;height:500px" src="${CH.dataUri(CH.pick("mini", seed, i, s.chara))}">`;
    if (s.say) over += `<div class="say" style="right:30px;top:560px">${esc(s.say).replace(/\n/g, "<br>")}</div>`;
    const hsize = fitSize(s.heading, 650, 92, 60);
    inner = `<div class="wrap">${LOGO}
      <div style="display:flex;align-items:center;margin-top:24px"><div class="badge"><span class="ink"></span><span class="p">Point</span><span class="n">${String(s.no || i).padStart(2, "0")}</span></div><span style="margin-left:-10px">${K.SPROUT(70)}</span><svg width="360" height="60" viewBox="0 0 360 60" style="margin-left:10px"><path d="M4 40 C120 30 240 34 320 22" stroke="${T.line}" stroke-width="4" stroke-dasharray="10 10" fill="none"/></svg>${K.HEART(34)}</div>
      <div class="ttl" style="margin-top:26px;font-size:${hsize}px">${titleLines(s.heading)}</div>
      <div class="dbox" style="margin-top:58px;width:640px;font-size:32px;line-height:1.8"><span class="sp">${K.SPROUT(54)}</span>${rich(s.body)}</div>
      ${FOOT}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(T)}</style></head><body>${deco}${inner}${over}</body></html>`;
}

(async () => {
  const [, , inFile, outDir] = process.argv;
  const { slides } = JSON.parse(fs.readFileSync(inFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const themeName = pickTheme(slides);
  const T = THEMES[themeName];
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  const out = [];
  for (let i = 0; i < slides.length; i++) {
    await p.setContent(slideHTML(slides[i], i, slides.length, (slides[0] && slides[0].title) || inFile, T), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    const f = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await p.screenshot({ path: f, type: "png" });
    out.push(f);
  }
  await b.close();
  console.log(JSON.stringify({ theme: themeName, files: out }));
})();

// Haguruma carousel renderer: node render-haguruma.js slides.json outDir
// slides.json = {"slides":[{"type":"cover","title":"…","sub":"(任意)サブタイトル","lead":"…","say":"…","theme":"…"},
//   {"type":"point","no":1,"heading":"…","body":"…","say":"…"},{"type":"check","heading":"…","body":"1行1項目"},{"type":"end","say":"…"}]}
// 記法：**ことば** → 緑で強調。タイトル・見出しの行頭に ~ を付けるとその行に黄色マーカー。
// デザイン：2026-10-24 本人の見本（はぐるん大きく・雲の吹き出し・黄色マーカーと集中線・ミントの水彩・下にロゴとスワイプボタン）。
// 投稿の内容で色テーマが変わり、1枚ごとにレイアウト・ポーズ・飾りの位置も変わる。
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "playwright");

const ROOT = path.join(__dirname, "..");
const HG = path.join(ROOT, "assets", "haguru");
const FONT = path.join(ROOT, "assets", "fonts");
const fileUrl = p => "file://" + p.split(path.sep).map(encodeURIComponent).join("/");

/* ---------- 色テーマ（内容で自動選択。1枚目に "theme" を書けばそれを使う） ---------- */
// green系は共通。hl=マーカー、pop=集中線・矢印・キラキラ、em=強調文字、wash=水彩のにじみ
// bg=背景のグラデーション（3色）、band=表紙の帯の色
const THEMES = {
  free:     { hl: "#FFF07A", pop: "#FFD43B", em: "#22A05A", wash: "#BFEBD0", wash2: "#E9F7C8", ink: "#174A31", bg: ["#FFFFFF", "#F4FBF6", "#E3F5EA"], band: "#BDE8CC" },
  care:     { hl: "#FBE6C8", pop: "#F4B49A", em: "#2E9C78", wash: "#CDEFE4", wash2: "#F8EBDD", ink: "#1D4A3C", bg: ["#FFFFFF", "#FFF9F2", "#F8EBDD"], band: "#F6DCC4" },
  money:    { hl: "#FFF07A", pop: "#F2C230", em: "#1F5FA8", wash: "#C9E8D6", wash2: "#DCE7F7", ink: "#163A5C", bg: ["#FFFFFF", "#F4F8FD", "#DCE7F7"], band: "#C9DBF3" },
  skill:    { hl: "#FFE2B0", pop: "#FF9F43", em: "#E8792A", wash: "#C6ECD3", wash2: "#FFE9D2", ink: "#174A31", bg: ["#FFFFFF", "#FFF8EF", "#FFE6CC"], band: "#FFD9AE" },
  clinic:   { hl: "#E3EEF0", pop: "#9DB3BF", em: "#22A05A", wash: "#CFEAD9", wash2: "#E8EDF0", ink: "#1E3B33", bg: ["#FFFFFF", "#F5F8F9", "#E3EBEE"], band: "#D6E3E8" },
  sky:      { hl: "#D3ECFF", pop: "#5AA9E6", em: "#1F78C8", wash: "#CFE6FA", wash2: "#E2F4EC", ink: "#173A55", bg: ["#FFFFFF", "#F2F8FE", "#DBECFB"], band: "#C4E0F8" },
  pink:     { hl: "#FFDCE8", pop: "#F48FB1", em: "#D9467A", wash: "#FBD9E5", wash2: "#E6F6EA", ink: "#4A2333", bg: ["#FFFFFF", "#FFF6F9", "#FCE2EC"], band: "#F9CFDE" },
  lavender: { hl: "#E9DFFF", pop: "#A88BEB", em: "#7A55D3", wash: "#E3DAFA", wash2: "#E4F5EC", ink: "#2E2350", bg: ["#FFFFFF", "#F8F5FF", "#EAE2FB"], band: "#DCCFF8" },
};
// 色・表紙の配置・表紙のはぐるんは、投稿ごとに順番に変える（2026-10-26 本人希望）
const THEME_ORDER = ["free", "sky", "skill", "lavender", "care", "pink", "money"];
const COVER_POSES = ["ureshii", "iine", "ganbaru", "wink", "nikkori", "tere", "bikkuri"];
let COVER_LAYOUT = 0;
const RULES = [
  ["clinic", /医院の方|採用担当|医院向け|求人を出|募集を出|掲載|人手不足|欠員|長期採用|採用/],
  ["skill", /講座|スキル|資格|アートメイク|セミナー|勉強|学び|技術|キャリア/],
  ["care", /悩|不安|辞め|人間関係|つら|疲れ|ストレス|しんどい|心配|モヤモヤ|ブランク/],
  ["money", /時給|給料|年収|お金|手数料|料金|円|収入|税/],
  ["free", /単発|フリー|副業|働き方|自由|スキマ|週1|空いた日/],
];
function pickTheme(slides) {
  const want = slides[0] && slides[0].theme;
  if (want && THEMES[want]) return want;
  const head = [slides[0] && slides[0].title, slides[0] && slides[0].sub, slides[0] && slides[0].lead].join(" ");
  const all = slides.map(s => [s.title, s.heading, s.body, s.lead].join(" ")).join(" ");
  // 医院向けかどうかは表紙だけで判断（働く人向けの投稿にも「長期採用」などは出てくるため）
  for (const [name, re] of RULES) if (re.test(head)) return name;
  for (const [name, re] of RULES) if (name !== "clinic" && re.test(all)) return name;
  return "free";
}

/* ---------- 乱数（投稿ごと・1枚ごとに違う配置） ---------- */
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; return h >>> 0; };
const rng = seed => { let x = hash(seed) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; };

/* ---------- はぐるんのポーズ（1投稿の中で同じポーズを続けない） ---------- */
// ouen（ポンポン）は横に広くて文字にかぶるので使わない
const POSES = { cover: ["ureshii", "ganbaru", "iine", "wink"], point: ["iine", "nikkori", "ganbaru", "wink", "tere", "ureshii", "bikkuri", "tsujo"], check: ["iine", "nikkori"], end: ["ureshii", "iine", "wink", "ganbaru"] };
const WORRY = /不安|悩|困|つら|辛い|ミス|失敗|疲れ|辞め|トラブル|心配|怖|迷|ストレス|しんどい|モヤモヤ/;
function posePlan(slides, seed) {
  // 同じポーズが続かないように（隣の枚と同じにはしない。2026-10-24 本人指摘）
  const used = new Set(); const r = rng(seed + "pose"); let prev = null;
  return slides.map(s => { const p0 = pick1(s); prev = p0; return p0; });
  function pick1(s) {
    if (s.chara && fs.existsSync(path.join(HG, s.chara + ".png"))) { used.add(s.chara); return s.chara; }
    const t = s.type || "point";
    if (t === "point" && WORRY.test([s.heading, s.body].join("")) && !used.has("komari")) { used.add("komari"); return "komari"; }
    const pool = POSES[t] || POSES.point;
    let cand = pool.filter(p => !used.has(p));
    if (!cand.length) cand = [...POSES.point, ...pool].filter(p => !used.has(p));
    if (!cand.length) cand = pool.filter(p => p !== prev);
    const p = cand[Math.floor(r() * cand.length)];
    used.add(p); return p;
  }
}
const SAY = { cover: ["気になる！", "知りたい！", "チェック！", "見てみて！", "なるほど？"], point: ["なるほど！", "ここ大事！", "いいね！", "安心だね！", "うれしい！", "知ってた？"], check: ["要チェック！"], end: ["登録してね！", "待ってるよ！"] };

/* ---------- テキスト ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// 日本語の文節で改行する（BudouX）。文節の切れ目以外では折り返さない
let BX; try { BX = require("budoux").loadDefaultJapaneseParser(); } catch (e) { BX = null; }
const ph = t => BX ? BX.parse(String(t)).map(esc).join("<wbr>") : esc(t);
const inl = s => String(s == null ? "" : s).split(/(\*\*.+?\*\*|\{.+?\})/).filter(x => x !== "").map(seg =>
  seg.startsWith("**") ? `<em>${ph(seg.slice(2, -2))}</em>` : seg.startsWith("{") && seg.endsWith("}") ? `<small>${ph(seg.slice(1, -1))}</small>` : ph(seg)).join("<wbr>");
const plainLen = s => Math.max(...String(s || "").split("\n").map(l => l.replace(/\*\*|\{|\}|^~/g, "").length), 1);
const fitSize = (text, maxW, maxPx, minPx) => Math.max(minPx, Math.min(maxPx, Math.floor(maxW / plainLen(text))));
// 見出し：行ごと。~付きの行（無ければ1行目）に黄色マーカー、最後の行に黄色の下線
function bigLines(s) {
  const lines = String(s || "").split("\n");
  const anyMark = lines.some(l => l.startsWith("~"));
  return lines.map((l, k) => {
    const mark = anyMark ? l.startsWith("~") : k === 0;
    const txt = l.replace(/^~/, "");
    const under = k === lines.length - 1 && lines.length > 1 ? `<svg class="under" viewBox="0 0 400 30" preserveAspectRatio="none"><path d="M6 18 C120 8 260 10 394 16" stroke="var(--pop)" stroke-width="12" fill="none" stroke-linecap="round"/></svg>` : "";
    return `<span class="bl${mark ? " mk" : ""}">${inl(txt)}${under}</span>`;
  }).join("<br>");
}
// 本文：1行ずつ点線で区切る（「。」で改行も）
const rows = s => String(s || "").split(/\n/).flatMap(l => l.match(/[^。！？]+[。！？]?/g) || [l]).map(t => t.trim()).filter(Boolean);
const rowsHTML = (s, cls = "") => `<div class="rows ${cls}">${rows(s).map(t => `<div class="r">${inl(t)}</div>`).join("")}</div>`;

/* ---------- 飾り ---------- */
const burst = (x, y, s, rot, c = "var(--pop)") => `<svg class="d" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg)" width="${s}" height="${s}" viewBox="0 0 100 100"><g stroke="${c}" stroke-width="9" stroke-linecap="round"><path d="M20 70 L42 52"/><path d="M50 40 L52 8"/><path d="M62 50 L90 30"/></g></svg>`;
const star = (x, y, s, c = "var(--pop)") => `<svg class="d" style="left:${x}px;top:${y}px" width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M50 2 C54 38 62 46 98 50 C62 54 54 62 50 98 C46 62 38 54 2 50 C38 46 46 38 50 2 Z" fill="${c}"/></svg>`;
const dots = (x, y, w, h, op = .55) => `<svg class="d" style="left:${x}px;top:${y}px;opacity:${op}" width="${w}" height="${h}"><defs><pattern id="p${x}${y}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="3.4" fill="#8FD3AA"/></pattern><radialGradient id="g${x}${y}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="m${x}${y}"><rect width="${w}" height="${h}" fill="url(#g${x}${y})"/></mask></defs><rect width="${w}" height="${h}" fill="url(#p${x}${y})" mask="url(#m${x}${y})"/></svg>`;
const blob = (x, y, w, h, c, op, r) => { const k = Math.floor(r * 4); const shapes = ["M60 10 C120 -10 200 30 190 100 C182 170 110 200 60 180 C10 160 -10 40 60 10 Z", "M40 30 C100 -10 190 10 195 80 C200 150 130 200 70 185 C10 170 -5 70 40 30 Z", "M80 5 C150 0 205 60 185 120 C165 185 70 200 30 150 C-10 100 20 10 80 5 Z", "M30 60 C40 10 140 -5 180 40 C215 85 180 170 110 190 C40 205 20 110 30 60 Z"]; return `<svg class="d" style="left:${x}px;top:${y}px;opacity:${op}" width="${w}" height="${h}" viewBox="0 0 200 200" preserveAspectRatio="none"><path d="${shapes[k]}" fill="${c}"/></svg>`; };
const arrow = (x, y, w, rot) => `<svg class="d" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg)" width="${w}" height="${w * .7}" viewBox="0 0 300 210"><path d="M10 200 C90 190 190 150 250 50" stroke="var(--pop)" stroke-width="16" fill="none" stroke-linecap="round" opacity=".9"/><path d="M212 58 L258 30 L262 86" stroke="var(--pop)" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ground = r => `<svg class="d" style="left:0;bottom:0" width="1080" height="420" viewBox="0 0 1080 420" preserveAspectRatio="none"><path d="M0 ${150 + r * 80} C260 ${60 + r * 60} 520 ${230 - r * 60} 760 ${120 + r * 50} C900 ${70 + r * 40} 1000 ${110} 1080 ${60 + r * 40} V420 H0 Z" fill="var(--wash)" opacity=".75"/><path d="M0 ${250 + r * 40} C300 ${170 + r * 50} 600 ${300} 1080 ${180 - r * 40} V420 H0 Z" fill="#A7DDBB" opacity=".45"/><path d="M-10 ${300 + r * 30} C320 ${230} 640 ${330 - r * 40} 1090 ${240}" stroke="var(--pop)" stroke-width="10" fill="none" opacity=".55" stroke-linecap="round"/></svg>`;
// 雲の吹き出し（tail: 尻尾の向き）
function cloud(text, x, y, w, size, tail = "bl", rot = -4) {
  const lines = String(text).split("\n");
  const h = Math.round(size * 1.25 * lines.length + 110);
  const tl = { bl: `M${w * .28} ${h - 22} L${w * .2} ${h + 36} L${w * .42} ${h - 18}`, br: `M${w * .6} ${h - 20} L${w * .78} ${h + 36} L${w * .74} ${h - 24}`, l: `M30 ${h * .55} L-34 ${h * .7} L36 ${h * .72}` }[tail];
  const bumps = []; const n = Math.max(6, Math.round(w / 70));
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; bumps.push(`<ellipse cx="${w / 2 + Math.cos(a) * w * .42}" cy="${h / 2 + Math.sin(a) * h * .36}" rx="${w * .2}" ry="${h * .3}"/>`); }
  return `<div class="cloud" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg)">
<svg width="${w}" height="${h + 40}" viewBox="0 0 ${w} ${h + 40}" style="overflow:visible"><g fill="#fff" stroke="var(--g1)" stroke-width="12">${bumps.join("")}<path d="${tl}" stroke-linejoin="round"/></g><g fill="#fff">${bumps.join("")}<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * .42}" ry="${h * .36}"/></g></svg>
<div class="ct" style="font-size:${size}px">${inl(text).replace(/\n/g, "<br>")}</div></div>`;
}

function css(T) {
  return `
@font-face{font-family:R;font-weight:900;src:url(${fileUrl(path.join(FONT, "MPLUSRounded1c-Black.ttf"))})}
@font-face{font-family:R;font-weight:800;src:url(${fileUrl(path.join(FONT, "MPLUSRounded1c-ExtraBold.ttf"))})}
@font-face{font-family:R;font-weight:700;src:url(${fileUrl(path.join(FONT, "MPLUSRounded1c-Bold.ttf"))})}
@font-face{font-family:R;font-weight:500;src:url(${fileUrl(path.join(FONT, "MPLUSRounded1c-Medium.ttf"))})}
:root{--g1:#1E7A4A;--g2:#22A05A;--ink:${T.ink};--hl:${T.hl};--pop:${T.pop};--em:${T.em};--wash:${T.wash};--wash2:${T.wash2}}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:linear-gradient(165deg,${T.bg[0]} 0%,${T.bg[1]} 45%,${T.bg[2]} 100%);color:var(--ink);font-family:R,"Noto Sans CJK JP",sans-serif;position:relative;overflow:hidden}
.d{position:absolute;line-height:0;z-index:1}
.z{position:absolute;z-index:3}
.col{position:absolute;z-index:3;display:flex;flex-direction:column}
.chara{position:absolute;z-index:4;filter:drop-shadow(0 22px 26px rgba(20,80,50,.18))}
em{font-style:normal;color:var(--em)}
small{font-size:.62em}
.big{word-break:keep-all;overflow-wrap:anywhere;font-weight:900;line-height:1.16;letter-spacing:.01em;color:var(--ink)}
.bl{position:relative;display:inline-block;padding:0 .08em;text-shadow:0 0 0 #fff,4px 0 0 #fff,-4px 0 0 #fff,0 4px 0 #fff,0 -4px 0 #fff,3px 3px 0 #fff,-3px -3px 0 #fff,3px -3px 0 #fff,-3px 3px 0 #fff,0 8px 14px rgba(20,80,50,.18)}
.bl.mk::before{content:"";position:absolute;left:-.12em;right:-.12em;top:.36em;bottom:.02em;background:var(--hl);border-radius:.3em .5em .25em .45em;z-index:-1;transform:rotate(-1.2deg)}
.bl .under{position:absolute;left:4%;right:-2%;bottom:-.16em;width:98%;height:.28em;z-index:-1}
.big .bl{z-index:0}
.box{background:rgba(255,255,255,.88);border-radius:40px;box-shadow:0 10px 30px rgba(30,120,74,.10)}
.sub{font-weight:900;font-size:76px;line-height:1.22;padding:28px 38px;color:var(--g1)}
.rows .r{font-weight:700;font-size:40px;line-height:1.45;padding:16px 4px;border-bottom:4px dotted #A9D9BC;word-break:keep-all;overflow-wrap:anywhere}
.tag{display:inline-block;background:var(--g1);color:#fff;font-weight:900;font-size:46px;padding:14px 40px;border-radius:999px;box-shadow:0 8px 18px rgba(30,122,74,.25);transform:rotate(-3deg)}
.rows .r:last-child{border-bottom:0}
.rows.sm .r{font-size:35px;padding:12px 4px}
.rows em{color:var(--em)}
.page{position:absolute;right:40px;top:30px;z-index:6;background:var(--g1);color:#fff;font-weight:800;font-size:40px;padding:12px 30px;border-radius:999px;box-shadow:0 6px 14px rgba(30,122,74,.25)}
.logo{position:absolute;left:60px;bottom:50px;z-index:6;height:176px;filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 3px #fff) drop-shadow(0 0 8px rgba(255,255,255,.9))}
.swipe{position:absolute;right:46px;bottom:62px;z-index:6;background:linear-gradient(180deg,#26935A,var(--g1));color:#fff;font-weight:800;font-size:42px;padding:26px 50px;border-radius:999px;box-shadow:0 10px 22px rgba(30,122,74,.3),inset 0 2px 0 rgba(255,255,255,.3);white-space:nowrap}
.cloud{position:absolute;z-index:7}
.cloud svg{position:absolute;left:0;top:0}
.cloud .ct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;line-height:1.2;color:var(--ink)}
.badge{position:relative;width:250px;height:210px;flex:0 0 250px}
.badge svg{position:absolute;inset:0}
.badge .p{position:absolute;left:0;right:0;top:36px;text-align:center;color:#fff;font-weight:800;font-size:44px;transform:rotate(-8deg)}
.badge .n{position:absolute;left:0;right:0;top:70px;text-align:center;color:#fff;font-weight:900;font-size:108px;line-height:1;transform:rotate(-8deg);text-shadow:0 4px 0 rgba(0,0,0,.08)}
.check{display:flex;gap:22px;align-items:flex-start;font-weight:700;font-size:44px;line-height:1.4;padding:22px 6px;border-bottom:4px dotted #A9D9BC}
.check:last-child{border-bottom:0}
.check i{flex:0 0 58px;height:58px;border-radius:16px;background:var(--g2);display:flex;align-items:center;justify-content:center;margin-top:2px}
.line{position:absolute;left:70px;right:70px;bottom:90px;z-index:6;height:150px;border-radius:999px;background:linear-gradient(180deg,#26935A,var(--g1));display:flex;align-items:center;justify-content:center;gap:28px;color:#fff;font-weight:900;font-size:56px;box-shadow:0 12px 26px rgba(30,122,74,.32),inset 0 3px 0 rgba(255,255,255,.3)}
.line .lg{background:#fff;color:var(--g1);font-weight:900;font-size:30px;width:104px;height:84px;border-radius:50%/48%;display:flex;align-items:center;justify-content:center;letter-spacing:.02em}
`;
}

const BADGE = `<svg viewBox="0 0 250 210"><path d="M48 46 C60 6 120 0 148 22 C176 -2 236 14 236 66 C252 96 236 150 196 158 C176 194 112 196 92 172 C54 188 10 160 20 120 C-6 96 10 52 48 46 Z" fill="var(--g2)" stroke="#fff" stroke-width="8"/><path d="M70 160 L40 202 L104 170 Z" fill="var(--g2)" stroke="#fff" stroke-width="6" stroke-linejoin="round"/></svg>`;
const CHECK = `<svg width="38" height="38" viewBox="0 0 40 40"><path d="M8 21 L17 30 L33 11" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function slideHTML(s, i, n, seed, T, pose) {
  const r = rng(seed + ":" + i);
  const type = s.type || "point";
  const img = p => fileUrl(path.join(HG, p + ".png"));
  const say = s.say || (SAY[type] || SAY.point)[(hash(seed) + i) % (SAY[type] || SAY.point).length];
  // 背景（毎回少しずつ違う）
  let bg = blob(-200 + r() * 120, -160 + r() * 80, 620, 520, "var(--wash)", .55, r()) + blob(700 + r() * 120, -120 + r() * 80, 520, 460, "var(--wash2)", .7, r())
    + blob(-180, 520 + r() * 200, 420, 420, "var(--wash2)", .55, r()) + blob(820, 560 + r() * 180, 380, 420, "var(--wash)", .5, r())
    + dots(20 + r() * 60, 40 + r() * 100, 300, 260) + dots(760 + r() * 80, 420 + r() * 200, 300, 280, .45) + dots(40, 820 + r() * 120, 260, 240, .4)
    + ground(r());
  let body = "", over = "";
  const PAGE = `<div class="page">${i + 1}/${n}</div>`;
  // ロゴは本人支給の正式版（上にHaguruma、下に歯車。2026-10-24）。logo.png（横長・タグライン付き）は使わない
  const LOGO = `<img class="logo" src="${img("logo-v")}">`;
  const SWIPE = `<div class="swipe">スワイプしてね →</div>`;
  const chara = (side, off, bottom, h) => { over += `<img class="chara" style="${side}:${off}px;bottom:${bottom}px;height:${h}px" src="${img(pose)}">`; return 1350 - bottom - h; };
  if (type === "cover") {
    const size = fitSize(s.title, 900, 150, 96);
    const nl = String(s.title).split("\n").length;
    const L = COVER_LAYOUT;
    const leadHTML = (w, cls) => s.lead ? `<div class="box" style="width:${w}px;padding:6px 30px">${rowsHTML(s.lead, cls)}</div>` : "";
    if (L === 1) {
      // 左右反転：タイトル右寄せ、はぐるん左
      bg += burst(900, 40, 120, 20) + burst(60, 160 + r() * 30, 130, -20) + arrow(120, 880, 380, -40) + star(560, 1000 + r() * 40, 60) + star(40, 760, 46);
      body += `<div class="col" style="right:44px;top:120px;width:1000px;align-items:flex-end;text-align:right">
        <div class="big" style="font-size:${size}px">${bigLines(s.title)}</div>
        ${s.sub ? `<div class="box sub" style="margin-top:36px;${s.lead ? "font-size:62px;padding:20px 32px" : ""}">${bigLines("~" + s.sub)}</div>` : ""}
        ${s.lead ? `<div style="margin-top:18px;width:540px;text-align:left">${rowsHTML(s.lead, s.sub ? "sm" : "")}</div>` : ""}</div>`;
      const titleBottom = 120 + size * 1.18 * nl;
      const ch = Math.max(480, Math.min(s.sub ? 600 : 680, 1350 - 260 - (titleBottom + 150)));
      const top = chara("left", -20 + r() * 30, 250, ch);
      over += cloud(say, 40, Math.max(top - 150, titleBottom + 10), 270, 50, "br", 5);
    } else if (L === 2) {
      // 上に色の帯。タイトルは帯の中で中央
      const sz2 = Math.min(size, 118);
      const tb = 100 + sz2 * 1.18 * nl + 50;
      bg += `<svg class="d" style="left:0;top:0" width="1080" height="${tb + 60}" viewBox="0 0 1080 ${tb + 60}" preserveAspectRatio="none"><path d="M0 0 H1080 V${tb - 20} C800 ${tb + 50} 300 ${tb - 40} 0 ${tb + 30} Z" fill="${T.band}"/><path d="M0 ${tb + 30} C300 ${tb - 40} 800 ${tb + 50} 1080 ${tb - 20}" stroke="var(--pop)" stroke-width="10" fill="none" stroke-linecap="round"/></svg>` + star(70, 60, 60, "#fff") + star(980, tb - 120, 50, "#fff") + burst(880, tb + 40, 120, 20) + star(500, 1040, 50);
      body += `<div class="col" style="left:40px;top:100px;width:1000px;align-items:center;text-align:center"><div class="big" style="font-size:${sz2}px">${bigLines(s.title)}</div></div>`;
      body += `<div class="col" style="right:44px;top:${tb + 50}px;width:560px;align-items:flex-end">
        ${s.sub ? `<div class="box sub" style="font-size:58px;padding:18px 30px">${bigLines("~" + s.sub)}</div>` : ""}
        <div style="margin-top:18px">${leadHTML(540, "sm")}</div></div>`;
      const ch = Math.max(460, Math.min(640, 1350 - 200 - (tb + 140)));
      const top = chara("left", 10 + r() * 30, 200, ch);
      over += cloud(say, 40, Math.max(top - 140, tb + 10), 260, 48, "br", 5);
    } else if (L === 3) {
      // タグ＋中央タイトル、下に説明とはぐるん
      bg += burst(40, 180, 120, -20) + burst(900, 180, 130, 20) + arrow(560, 940, 360, -6) + star(480, 1010, 56) + star(1000, 820, 44);
      body += `<div class="col" style="left:40px;top:90px;width:1000px;align-items:center;text-align:center">
        ${s.sub ? `<div class="tag">${esc(String(s.sub).replace(/\n/g, ""))}</div>` : ""}
        <div class="big" style="font-size:${Math.min(size, 136)}px;margin-top:${s.sub ? 40 : 30}px">${bigLines(s.title)}</div></div>`;
      const titleBottom = 90 + (s.sub ? 120 : 30) + Math.min(size, 136) * 1.18 * nl;
      body += `<div class="col" style="left:44px;top:${titleBottom + 60}px;width:540px">${leadHTML(540, "sm")}</div>`;
      const ch = Math.max(460, Math.min(640, 1350 - 150 - (titleBottom + 140)));
      const top = chara("right", -20 + r() * 30, 150, ch);
      over += cloud(say, 800, Math.max(top - 140, titleBottom + 10), 250, 46, "bl", -5);
    } else {
      bg += burst(50, 50, 120, -20) + burst(880, 120 + r() * 30, 140, 20) + arrow(540, 860, 420, -6) + star(470, 990 + r() * 40, 60) + star(1010, 760, 46);
      body += `<div class="col" style="left:44px;top:120px;width:1000px">
        <div class="big" style="font-size:${size}px">${bigLines(s.title)}</div>
        ${s.sub ? `<div class="box sub" style="margin-top:36px;align-self:flex-start;${s.lead ? "font-size:62px;padding:20px 32px" : ""}">${bigLines("~" + s.sub)}</div>` : ""}
        ${s.lead ? `<div style="margin-top:${s.sub ? 18 : 40}px;width:${s.sub ? 540 : 520}px">${rowsHTML(s.lead, s.sub ? "sm" : "")}</div>` : ""}</div>`;
      // タイトルの下にキャラと吹き出しが収まるように大きさを決める
      const titleBottom = 120 + size * 1.18 * nl;
      const ch = Math.max(500, Math.min(s.sub ? 640 : 720, 1350 - 150 - (titleBottom + 150)));
      const top = chara("right", -10 + r() * 30, 150, ch);
      over += cloud(say, 790, Math.max(top - 150, titleBottom + 10), 270, 50, "bl", -5);
    }
    body += LOGO + SWIPE;
  } else if (type === "end") {
    const msg = s.message || "~歯科の仕事を、\nもっと**自由**に。";
    bg += burst(30, 40, 110, -25) + burst(890, 110, 140, 25) + star(600, 700, 66) + star(500, 840, 44) + burst(940, 860, 120, 40);
    const lead = s.lead || "新着案件は公式LINEでチェック！";
    body += `<div class="col" style="left:44px;top:120px;width:1000px">
      <div class="big" style="font-size:${fitSize(msg, 980, 132, 96)}px">${bigLines(msg)}</div>
      <div class="box" style="margin-top:40px;width:600px;padding:8px 32px">${rowsHTML(lead)}</div>
      <div style="margin-top:30px;width:620px;display:flex;align-items:center;gap:26px"><img style="height:200px;margin-left:16px" src="${img("logo-v")}"><div class="box" style="padding:18px 26px;font-weight:800;font-size:33px;line-height:1.5">${inl(s.tagline || "歯科で働く人も、\n医院も。").replace(/\n/g, "<br>")}<br>Hagurumaで<br>つながる。</div></div></div>`;
    const top = chara("right", -60, 290, 580);
    over += cloud(say, 760, Math.max(top - 130, 440), 290, 48, "bl", -6);
    body += `<div class="line"><span class="lg">LINE</span>公式LINEで新着をチェック →</div>`;
  } else if (type === "check") {
    const hs = fitSize(s.heading || s.title, 900, 120, 80);
    bg += burst(40, 50, 110, -20) + burst(880, 120, 130, 20) + star(960, 420, 50);
    body += `<div class="col" style="left:44px;top:130px;width:1000px">
      <div class="big" style="font-size:${hs}px">${bigLines(s.heading || s.title || "~チェック**リスト**")}</div>
      <div class="box" style="margin-top:50px;width:740px;padding:16px 38px">${rows(s.body).map(t => `<div class="check"><i>${CHECK}</i><span>${inl(t)}</span></div>`).join("")}</div></div>`;
    const top = chara("right", -60, 190, 440);
    over += cloud(say, 780, top - 120, 270, 44, "bl", -6);
    body += LOGO + SWIPE;
  } else {
    // ポイント：3つのレイアウトを順番に使う（同じ並びが続かないように）
    const L = (hash(seed) + i) % 3;
    const hs = fitSize(s.heading, L === 2 ? 960 : 720, 120, 76);
    const no = String(s.no || i).padStart(2, "0");
    const badge = sc => `<div class="badge" style="transform:scale(${sc});transform-origin:left top">${BADGE}<div class="p">Point</div><div class="n">${no}</div></div>`;
    const headBlock = L === 2
      ? `<div style="height:170px">${badge(.8)}</div><div class="big" style="font-size:${hs}px;margin-top:-10px">${bigLines(s.heading)}</div>`
      : `<div style="display:flex;gap:6px;align-items:flex-start">${badge(1)}<div class="big" style="font-size:${hs}px;margin-top:40px">${bigLines(s.heading)}</div></div>`;
    bg += burst(20 + r() * 40, 300 + r() * 80, 100, -30) + burst(880 + r() * 60, 110 + r() * 40, 130, 25) + star(480 + r() * 300, 900 + r() * 120, 56) + star(980, 560 + r() * 80, 44);
    if (L === 0) {
      body += `<div class="col" style="left:40px;top:70px;width:1010px">${headBlock}<div style="margin:44px 0 0 16px;width:590px">${rowsHTML(s.body)}</div></div>`;
      bg += arrow(540, 880, 380, -8);
      const top = chara("right", -60 + r() * 30, 150, 680);
      over += cloud(say, 770, Math.max(top - 140, 430), 280, 48, "bl", -5);
    } else if (L === 1) {
      body += `<div class="col" style="left:40px;top:70px;width:1010px">${headBlock}<div class="box" style="margin-top:50px;align-self:flex-end;width:590px;padding:10px 34px">${rowsHTML(s.body)}</div></div>`;
      bg += arrow(30, 930, 300, -20);
      const top = chara("left", -30 + r() * 30, 240, 580);
      over += cloud(say, 60, Math.max(top - 150, 470), 280, 48, "br", 5);
    } else {
      body += `<div class="col" style="left:40px;top:60px;width:1010px">${headBlock}<div class="box" style="margin-top:44px;width:680px;padding:10px 36px">${rowsHTML(s.body)}</div></div>`;
      bg += arrow(380, 980, 320, -4);
      const top = chara("right", -40, 160, 560);
      over += cloud(say, 790, Math.max(top - 130, 560), 260, 46, "bl", -6);
    }
    body += LOGO + SWIPE;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(T)}</style></head><body>${bg}${body}${PAGE}${over}</body></html>`;
}

(async () => {
  const [, , inFile, outDir] = process.argv;
  const { slides } = JSON.parse(fs.readFileSync(inFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  let themeName = pickTheme(slides);
  const seed = (slides[0] && slides[0].title) || inFile;
  // 出力先の日付（posts/YYYYMMDD-…）から順番に回す。Hagurumaは2日おきなので2日で1つ進める
  const m = String(outDir).match(/(20\d{6})/);
  const d = m ? Math.floor(Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8)) / 864e5 / 2) : hash(seed);
  if (m) themeName = THEME_ORDER[d % THEME_ORDER.length];
  COVER_LAYOUT = slides[0] && slides[0].layout != null ? +slides[0].layout : d % 4;
  if (slides[0] && !slides[0].chara) {
    const worry = WORRY.test([slides[0].title, slides[0].lead].join(""));
    slides[0] = { ...slides[0], chara: worry ? ["komari", "bikkuri"][d % 2] : COVER_POSES[d % COVER_POSES.length] };
  }
  if (slides[0] && !slides[0].say) slides[0] = { ...slides[0], say: SAY.cover[d % SAY.cover.length] };
  const T = THEMES[themeName];
  const poses = posePlan(slides, seed);
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  const tmp = path.join(path.resolve(outDir), ".render.html");
  const out = [];
  for (let i = 0; i < slides.length; i++) {
    fs.writeFileSync(tmp, slideHTML(slides[i], i, slides.length, seed, T, poses[i]));
    await p.goto(fileUrl(tmp), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    const f = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await p.screenshot({ path: f, type: "png" });
    out.push(f);
  }
  fs.unlinkSync(tmp);
  await b.close();
  console.log(JSON.stringify({ theme: themeName, files: out }));
})();

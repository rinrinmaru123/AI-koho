// Usage: node render-wallpaper.js tasks.json out.png [YYYY-MM-DD]
// tasks.json: array of {title, due, done}
const fs = require('fs');
const { chromium } = require('playwright');

const [, , inFile, outFile, dateArg] = process.argv;
const all = JSON.parse(fs.readFileSync(inFile, 'utf8')).filter(t => !t.done);

const now = new Date(Date.now() + 9 * 3600e3); // JST
const today = dateArg || now.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tomorrow = addDays(today, 1);
const wd = '日月火水木金土';
const fmt = d => { const x = new Date(d + 'T00:00:00Z'); return `${x.getUTCMonth() + 1}/${x.getUTCDate()}（${wd[x.getUTCDay()]}）`; };

const clean = s => String(s || '').replace(/^（後回しでOK）/, '').trim();
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const todayT = all.filter(t => t.due === today);
const tomT = all.filter(t => t.due === tomorrow);
const overdue = all.filter(t => t.due && t.due < today);
const noDue = all.filter(t => !t.due);

const MAX = 6;
let rows = [];
const push = (list, tag) => { for (const t of list) { if (rows.length >= MAX) break; rows.push({ title: clean(t.title), tag }); } };
push(todayT, 'today');
push(tomT, 'tom');
const hidden = todayT.length + tomT.length - rows.length;

const li = rows.map(r => `<li class="${r.tag}"><span class="b"></span><span class="t">${esc(r.title)}</span>${r.tag === 'tom' ? '<span class="tg">明日</span>' : ''}</li>`).join('');
const empty = rows.length ? '' : '<p class="empty">今日のタスクはありません</p>';
const more = [];
if (hidden > 0) more.push(`ほか${hidden}件`);
if (overdue.length) more.push(`<b>期限切れ ${overdue.length}件</b>`);
if (noDue.length) more.push(`期限なし ${noDue.length}件`);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1179px;height:2556px;font-family:"Noto Sans CJK JP","Noto Sans CJK TC",sans-serif;
 background:linear-gradient(170deg,#DCEFE7 0%,#F6F1EC 55%,#F3DDE1 100%);position:relative;overflow:hidden;color:#1E2826}
.c1{position:absolute;width:900px;height:900px;border-radius:50%;background:#C9E6DA;opacity:.55;left:-380px;top:-260px}
.c2{position:absolute;width:700px;height:700px;border-radius:50%;background:#F7D9DF;opacity:.6;right:-300px;bottom:-200px}
.card{position:absolute;left:80px;right:80px;top:1060px;background:rgba(255,255,255,.82);border-radius:56px;padding:64px 64px 56px;
 box-shadow:0 20px 60px rgba(30,60,50,.10)}
.hd{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:34px}
.hd h1{font-size:60px;font-weight:700;color:#1F5C4C;letter-spacing:.02em}
.hd span{font-size:34px;color:#5E6B67;font-weight:500}
ul{list-style:none;display:flex;flex-direction:column;gap:6px}
li{display:flex;align-items:flex-start;gap:26px;padding:22px 0;border-bottom:2px solid #E4EAE7}
li:last-child{border-bottom:0}
.b{flex:0 0 40px;height:40px;border:5px solid #1F5C4C;border-radius:12px;margin-top:8px}
li.tom .b{border-color:#9AB3AA}
.t{font-size:44px;line-height:1.45;font-weight:500;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
li.tom .t{color:#5E6B67}
.tg{flex:0 0 auto;font-size:28px;font-weight:700;color:#7C918A;border:3px solid #C3D2CC;border-radius:999px;padding:4px 18px;margin-top:10px}
.empty{font-size:44px;color:#5E6B67;padding:30px 0}
.ft{margin-top:30px;font-size:34px;color:#5E6B67}
.ft b{color:#B4651D}
</style></head><body><div class="c1"></div><div class="c2"></div>
<div class="card"><div class="hd"><h1>今日やること</h1><span>${fmt(today)}</span></div>
<ul>${li}</ul>${empty}
${more.length ? `<p class="ft">${more.join('　・　')}　→ AI社員デスク</p>` : ''}
</div></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1179, height: 2556 } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: outFile });
  await b.close();
})();

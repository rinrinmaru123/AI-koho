// Hagurumaのキャラクター「はぐるん」（assets/haguru/*.png）を選ぶ。名前を指定すればそれを使う。
// 表情: tsujo（通常）, nikkori（にっこり）, wink（ウインク）, bikkuri（びっくり）, komari（困り顔）,
//       ureshii（嬉しい）, ouen（応援・ポンポン）, ganbaru（がんばる）, tere（照れ）, iine（いいね）
//       front / side / hero（三面図・シートの立ち姿）
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "assets", "haguru");
const NAMES = fs.readdirSync(DIR).filter(f => f.endsWith(".png") && f !== "logo.png").map(f => f.replace(/\.png$/, ""));
const POOLS = {
  thumb: ["tsujo", "nikkori", "wink", "ureshii", "iine", "ganbaru"],
  section: ["ganbaru", "ouen", "nikkori", "wink", "tere", "bikkuri", "ureshii", "iine", "tsujo"],
};
// 悩み・不安がテーマのときは困り顔
const WORRY = /不安|悩|困|つら|辛い|ミス|失敗|疲れ|辞め|トラブル|心配|怖|こわい|迷|人手不足|足りない|うまくいかない|ストレス|しんどい/;
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; return h >>> 0; };

function pick(kind, seed = "", index = 0, wanted) {
  if (wanted && NAMES.includes(wanted)) return wanted;
  if (WORRY.test(String(seed)) && NAMES.includes("komari")) return "komari";
  const pool = (POOLS[kind] || POOLS.section).filter(n => NAMES.includes(n));
  if (!pool.length) return "front";
  return pool[(hash(seed) + index) % pool.length];
}
const cache = {};
function dataUri(name) {
  if (!cache[name]) cache[name] = "data:image/png;base64," + fs.readFileSync(path.join(DIR, name + ".png")).toString("base64");
  return cache[name];
}
module.exports = { pick, dataUri, NAMES, WORRY };

// Haluluのキャラクター画像（assets/chara/*.png）を選ぶ。
// slides の各枚に "chara":"名前" を書けばそれを使い、無ければ枚の種類に合う表情から自動で選ぶ。
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "assets", "chara");

const POOLS = {
  cover: ["bikkuri", "uttori", "nikkori", "wink", "suwari", "shonbori"], // 問いかけ・気づき
  end: ["genki", "jump", "waai", "wink-heart", "nikoniko"],            // 予約への呼びかけ
  mini: ["nikkori", "suwari", "wink", "uttori", "genki", "nikoniko", "oyasumi", "waai"],
  thumb: ["nikkori", "suwari", "uttori", "wink", "genki", "nikoniko", "waai", "wink-heart", "jump"],
};
const NAMES = fs.readdirSync(DIR).filter(f => f.endsWith(".png")).map(f => f.replace(/\.png$/, ""));
const hash = s => {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0;
};

function pick(kind, seed, offset = 0, wanted) {
  if (wanted && NAMES.includes(wanted)) return wanted;
  const pool = POOLS[kind].filter(n => NAMES.includes(n));
  return pool[(hash(seed) + offset) % pool.length];
}
const cache = {};
function dataUri(name) {
  if (!cache[name]) cache[name] = "data:image/png;base64," + fs.readFileSync(path.join(DIR, name + ".png")).toString("base64");
  return cache[name];
}
module.exports = { pick, dataUri, NAMES };

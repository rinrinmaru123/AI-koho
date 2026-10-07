// Haluluのキャラクター画像（assets/chara/*.png）を選ぶ。
// slides の各枚に "chara":"名前" を書けばそれを使い、無ければ枚の種類に合う表情から自動で選ぶ。
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "assets", "chara");

const POOLS = {
  cover: ["bikkuri", "uttori", "nikkori", "wink", "suwari"], // 問いかけ・気づき（悲しい顔は不安テーマ専用）
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

// 歯や顎の痛みなど、不安・悩みがテーマの回は表紙とサムネイルを悲しい表情にする
const WORRY = /痛|いた[いむみ]|しみ|しみる|だる|腫れ|はれ|出血|血が|口臭|におい|ニオイ|グラグラ|ぐらぐら|違和感|不安|悩|つら|辛い|心配|怖|こわい|知覚過敏|歯周病|むし歯|虫歯|食いしばり|歯ぎしり|顎関節/;
const SAD = "shonbori";

function pick(kind, seed, offset = 0, wanted) {
  if (wanted && NAMES.includes(wanted)) return wanted;
  if ((kind === "cover" || kind === "thumb") && WORRY.test(String(seed)) && NAMES.includes(SAD)) return SAD;
  const pool = POOLS[kind].filter(n => NAMES.includes(n));
  return pool[(hash(seed) + offset) % pool.length];
}
const cache = {};
function dataUri(name) {
  if (!cache[name]) cache[name] = "data:image/png;base64," + fs.readFileSync(path.join(DIR, name + ".png")).toString("base64");
  return cache[name];
}
module.exports = { pick, dataUri, NAMES };

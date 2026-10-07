// Hagurumaのキャラクター「はぐるん」（assets/haguru/*.png）を選ぶ。
// front（正面）・side（横向き）・hero（歩きながら歯車を持つ）。名前を指定すればそれを使う。
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "assets", "haguru");
const NAMES = fs.readdirSync(DIR).filter(f => f.endsWith(".png") && f !== "logo.png").map(f => f.replace(/\.png$/, ""));
const ORDER = ["side", "hero", "front"];
function pick(kind, index = 0, wanted) {
  if (wanted && NAMES.includes(wanted)) return wanted;
  if (kind === "thumb") return "front";
  const pool = ORDER.filter(n => NAMES.includes(n));
  return pool[index % pool.length];
}
const cache = {};
function dataUri(name) {
  if (!cache[name]) cache[name] = "data:image/png;base64," + fs.readFileSync(path.join(DIR, name + ".png")).toString("base64");
  return cache[name];
}
module.exports = { pick, dataUri, NAMES };

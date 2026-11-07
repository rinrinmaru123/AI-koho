// Halulu carousel renderer: node render-halulu.js slides.json outDir [note|pop|watercolor]
// 2026-11-07 本人決定：水彩の型をやめ、ノート風（note）とポップカード風（pop）の2種類にする。
// 型を指定しなければ、出力先の日付（posts/YYYYMMDD-…）から交互に選ぶ（Haluluは2日おきなので投稿ごとに入れ替わる）。
// 旧デザインは render-halulu-watercolor.js に残してある（watercolor を指定したときだけ使う）。
const path = require("path");
const { execFileSync } = require("child_process");
const [, , inFile, outDir, forced] = process.argv;
let style = forced;
if (!style) {
  const m = String(outDir).match(/(20\d{6})/);
  const n = m ? Math.floor(Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8)) / 864e5 / 2)
              : [...String(inFile)].reduce((a, c) => a + c.codePointAt(0), 0);
  style = ["note", "pop"][n % 2];
}
const script = style === "watercolor" ? "render-halulu-watercolor.js" : "render-halulu-v2.js";
const args = [path.join(__dirname, script), inFile, outDir].concat(style === "watercolor" ? [] : [style]);
process.stdout.write(execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));

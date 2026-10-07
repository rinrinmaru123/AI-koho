// 本文HTMLの {{IMG1}} などの目印を、アップロードした画像に置き換える（ブログの途中に入れる画像用）。
// images: [{ key:"IMG1", file:"<id>-img1.png", alt:"画像の説明" }]（file はキューのフォルダからの名前）
const fs = require("fs");
const path = require("path");
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const contentType = f => TYPES[path.extname(f).toLowerCase()] || "application/octet-stream";

// upload(filePath) → 画像のURL（文字列）。figure(url, alt) → 差し込むHTML。
async function inlineImages(html, images, dir, upload, figure) {
  const notes = [];
  const used = [];
  for (const im of images || []) {
    if (!im || !/^[A-Za-z0-9_-]+$/.test(im.key || "") || !im.file) continue;
    const file = path.join(dir, path.basename(im.file));
    used.push(file);
    const mark = new RegExp(`(<p>\\s*)?\\{\\{${im.key}\\}\\}(\\s*</p>)?`, "g");
    if (!mark.test(html)) { notes.push(`${im.key} の差し込み位置が本文にありません`); continue; }
    mark.lastIndex = 0;
    if (!fs.existsSync(file)) { html = html.replace(mark, ""); notes.push(`${im.key} の画像がありません`); continue; }
    try {
      const url = await upload(file);
      html = html.replace(mark, figure(url, esc(im.alt || "")));
    } catch (e) {
      html = html.replace(mark, "");
      notes.push(`${im.key} のアップロード失敗（${String(e.message || e).slice(0, 120)}）`);
    }
  }
  html = html.replace(/(<p>\s*)?\{\{IMG\w*\}\}(\s*<\/p>)?/g, "");
  return { html, notes, used };
}
module.exports = { inlineImages, contentType };

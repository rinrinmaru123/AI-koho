// blog-queue/<id>.json を microCMS に「下書き」で送り、結果を blog-results/<id>.json に残す。
// 送った（または失敗した）キューファイルは削除して、二重送信を防ぐ。
const fs = require("fs");
const path = require("path");

const key = process.env.MICROCMS_API_KEY;
const service = process.env.MICROCMS_SERVICE;
const endpoint = process.env.MICROCMS_ENDPOINT;
const queueDir = "blog-queue";
const resultDir = "blog-results";
const { inlineImages, contentType } = require("./inline-images");
// サムネイル：blog-queue/<id>.png があれば microCMS のメディアにアップロードして使う。
// アップロードできない時は、既存記事のサムネイルを仮で入れて下書きだけは作る（結果に注意書きを残す）。
async function uploadThumb(file) {
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(file)], { type: contentType(file) }), path.basename(file));
  const res = await fetch(`https://${service}.microcms-management.io/api/v1/media`, {
    method: "POST", headers: { "X-MICROCMS-API-KEY": key }, body: fd,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`media ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text).url;
}
async function fallbackThumb() {
  const res = await fetch(`https://${service}.microcms.io/api/v1/${endpoint}?limit=1&fields=thumbnail&orders=-publishedAt`, {
    headers: { "X-MICROCMS-API-KEY": key },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const t = data.contents && data.contents[0] && data.contents[0].thumbnail;
  return t ? t.url : null;
}

const ALLOWED = ["title", "category", "excerpt", "body", "seoDescription", "date", "thumbnail"];

(async () => {
  if (!key) { console.error("MICROCMS_API_KEY が設定されていません"); process.exit(1); }
  fs.mkdirSync(resultDir, { recursive: true });
  const files = fs.existsSync(queueDir) ? fs.readdirSync(queueDir).filter(f => f.endsWith(".json")) : [];
  if (!files.length) { console.log("送るものはありません"); return; }
  for (const f of files) {
    const id = path.basename(f, ".json");
    const src = path.join(queueDir, f);
    let result;
    let imgNote = null;
    try {
      const raw = JSON.parse(fs.readFileSync(src, "utf8"));
      const content = {};
      for (const k of ALLOWED) if (raw[k] !== undefined && raw[k] !== "") content[k] = raw[k];
      if (typeof content.category === "string") content.category = [content.category];
      // 本文の途中の画像（{{IMG1}} などの目印を画像に置き換える）
      const inl = await inlineImages(content.body || "", raw.images, queueDir, uploadThumb,
        (url, alt) => `<figure><img src="${url}" alt="${alt}"></figure>`);
      if (content.body) content.body = inl.html;
      imgNote = inl.notes.length ? inl.notes.join(" / ") : null;
      let thumbNote = null;
      if (!content.thumbnail) {
        const png = path.join(queueDir, `${id}.png`);
        if (fs.existsSync(png)) {
          try { content.thumbnail = await uploadThumb(png); }
          catch (e) { thumbNote = `サムネイルのアップロード失敗（${String(e.message).slice(0, 150)}）`; }
          fs.unlinkSync(png);
        } else thumbNote = "サムネイル画像がキューにありませんでした";
        if (!content.thumbnail) {
          const fb = await fallbackThumb();
          if (fb) { content.thumbnail = fb; thumbNote += "。既存記事のサムネイルを仮で入れています。公開前に差し替えてください"; }
        }
      }
      // コンテンツID（URLの最後）を英語のスラッグにする（2026-11-02 本人希望）。slug があれば PUT /blogs/<slug>
      const cid = typeof raw.slug === "string" && /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(raw.slug) ? raw.slug : null;
      // 置き換え：replaceId（前に作った下書きのID）があれば、新しい下書きができたあとに消す
      const res = await fetch(`https://${service}.microcms.io/api/v1/${endpoint}${cid ? "/" + cid : ""}?status=draft`, {
        method: cid ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "X-MICROCMS-API-KEY": key },
        body: JSON.stringify(content),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text);
        let delNote = null;
        if (raw.replaceId && raw.replaceId !== data.id) {
          const d = await fetch(`https://${service}.microcms.io/api/v1/${endpoint}/${raw.replaceId}`, { method: "DELETE", headers: { "X-MICROCMS-API-KEY": key } });
          delNote = d.ok ? `前の下書き（${raw.replaceId}）は削除しました` : `前の下書き（${raw.replaceId}）は消せませんでした（${d.status}）。microCMSで手で削除してください`;
        }
        if (delNote) thumbNote = [thumbNote, delNote].filter(Boolean).join("。");
        result = { ok: true, contentId: data.id, editUrl: `https://${service}.microcms.io/apis/${endpoint}/${data.id}`, thumbnail: content.thumbnail, thumbNote: [thumbNote, imgNote].filter(Boolean).join("。") || null, at: new Date().toISOString() };
      } else {
        result = { ok: false, status: res.status, error: text.slice(0, 500), thumbNote, at: new Date().toISOString() };
      }
    } catch (e) {
      result = { ok: false, error: String(e).slice(0, 500), at: new Date().toISOString() };
    }
    fs.writeFileSync(path.join(resultDir, `${id}.json`), JSON.stringify(result, null, 2));
    fs.unlinkSync(src);
    for (const x of fs.readdirSync(queueDir)) if (x.startsWith(id + "-img") || x === id + ".png") fs.unlinkSync(path.join(queueDir, x));
    console.log(id, result.ok ? "下書きを作成しました" : "失敗しました", result.ok ? result.contentId : result.error);
  }
})();

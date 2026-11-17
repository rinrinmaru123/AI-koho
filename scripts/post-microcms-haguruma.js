// 2026-11-17 Hagurumaのブログは新サイト haguruma-dental.jp（microCMS サービス haguruma / blogs）へ。WordPressへの投稿は終了。
// hg-queue/<id>.json を送り、結果を hg-results/<id>.json に残す。キーは GitHub Secrets の MICROCMS_WRITE_API_KEY。
// JSON: { slug, title, description, category, content, contentWithFaq, faq:[{question,answer}], images:[...], publish }
//   ・アイキャッチは hg-queue/<id>.png（1200x675）。本文の {{IMG1}} などは images の画像に置き換える。
//   ・faq 欄が無い・受け付けないときは、faq を外し、本文にQ&Aを含めた contentWithFaq で送り直す。
const fs = require("fs");
const path = require("path");
const { inlineImages, contentType } = require("./inline-images");
const key = process.env.MICROCMS_API_KEY;
const service = "haguruma", endpoint = "blogs", Q = "hg-queue", R = "hg-results";
async function upload(file) {
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(file)], { type: contentType(file) }), path.basename(file));
  const res = await fetch(`https://${service}.microcms-management.io/api/v1/media`, { method: "POST", headers: { "X-MICROCMS-API-KEY": key }, body: fd });
  const t = await res.text();
  if (!res.ok) throw new Error(`画像アップロード ${res.status} ${t.slice(0, 200)}`);
  return JSON.parse(t).url;
}
async function send(cid, body, publish, method = "PUT") {
  const res = await fetch(`https://${service}.microcms.io/api/v1/${endpoint}/${cid}${publish ? "" : "?status=draft"}`, {
    method, headers: { "Content-Type": "application/json", "X-MICROCMS-API-KEY": key }, body: JSON.stringify(body) });
  return { res, text: await res.text() };
}
(async () => {
  fs.mkdirSync(R, { recursive: true });
  const files = fs.existsSync(Q) ? fs.readdirSync(Q).filter(f => f.endsWith(".json")) : [];
  if (!files.length) { console.log("送るものはありません"); return; }
  for (const f of files) {
    const id = path.basename(f, ".json"); let result; const notes = [];
    try {
      if (!key) throw new Error("MICROCMS_WRITE_API_KEY がこのリポジトリのSecretsにありません");
      const raw = JSON.parse(fs.readFileSync(path.join(Q, f), "utf8"));
      const cid = raw.slug;
      if (!/^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$/.test(cid || "")) throw new Error("slug が正しくありません");
      const fig = (url, alt) => `<figure><img src="${url}" alt="${alt}"></figure>`;
      const urls0 = {}; const up0 = async file => (urls0[file] = urls0[file] || await upload(file));
      const a = await inlineImages(raw.content || "", raw.images, Q, up0, fig);
      // 画像URLを覚えておき、Q&A入りの本文にも同じURLを使う（二重アップロードしない）
      notes.push(...a.notes);
      const body = { title: raw.title, description: raw.description, content: a.html };
      if (raw.category) body.category = raw.category;
      const png = path.join(Q, `${id}.png`);
      if (fs.existsSync(png)) { try { body.eyecatch = await upload(png); } catch (e) { notes.push(`アイキャッチ：${String(e.message).slice(0, 150)}`); } }
      if (Array.isArray(raw.faq) && raw.faq.length) body.faq = raw.faq.map(x => ({ fieldId: "faq", question: x.question, answer: x.answer }));
      let r = await send(cid, body, raw.publish);
      if (!r.res.ok && body.faq && /faq|field|フィールド|invalid/i.test(r.text)) {
        notes.push("faq欄に入れられなかったので、本文にQ&Aを入れました");
        delete body.faq; body.content = (await inlineImages(raw.contentWithFaq || raw.content || "", raw.images, Q, up0, fig)).html; r = await send(cid, body, raw.publish);
      }
      if (!r.res.ok) { const r2 = await send(cid, body, raw.publish, "PATCH"); if (r2.res.ok) r = r2; }
      result = r.res.ok
        ? { ok: true, contentId: cid, link: `https://haguruma-dental.jp/blog/${cid}/`, editUrl: `https://${service}.microcms.io/apis/${endpoint}/${cid}`, published: !!raw.publish, notes: notes.join("。") || null, at: new Date().toISOString() }
        : { ok: false, status: r.res.status, error: r.text.slice(0, 500), notes: notes.join("。") || null, at: new Date().toISOString() };
    } catch (e) { result = { ok: false, error: String(e.message || e).slice(0, 500), at: new Date().toISOString() }; }
    fs.writeFileSync(path.join(R, `${id}.json`), JSON.stringify(result, null, 2));
    for (const x of fs.readdirSync(Q)) if (x === f || x.startsWith(id + "-img") || x === id + ".png") fs.unlinkSync(path.join(Q, x));
    console.log(id, result.ok ? "OK" : "失敗", result.ok ? result.link : result.error);
  }
})();

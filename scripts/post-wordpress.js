// wp-queue/<id>.json を Haguruma の WordPress（haisyanooisya.com）に投稿し、結果を wp-results/<id>.json に残す。
// wp-queue/<id>.png があればアイキャッチ画像としてアップロードする。送ったキューは削除して二重投稿を防ぐ。
// <id>.json: { title, content(HTML), slug, excerpt, metaDescription, category, status("publish"|"draft") }
const fs = require("fs");
const path = require("path");

const base = (process.env.WP_URL || "").replace(/\/$/, "");
const user = process.env.WP_USER;
const pass = (process.env.WP_APP_PASSWORD || "").replace(/\s+/g, "");
const defaultStatus = process.env.WP_DEFAULT_STATUS || "draft";
const queueDir = "wp-queue";
const resultDir = "wp-results";
const { inlineImages, contentType } = require("./inline-images");
const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

async function wp(pathname, opts = {}) {
  const res = await fetch(`${base}/wp-json/wp/v2/${pathname}`, {
    ...opts,
    headers: { Authorization: auth, ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) throw new Error(`${pathname} ${res.status} ${(data && data.message) || text.slice(0, 200)}`);
  return data;
}

async function categoryId(name) {
  if (!name) return null;
  const list = await wp(`categories?search=${encodeURIComponent(name)}&per_page=50`);
  const hit = list.find(c => c.name === name) || list[0];
  return hit ? hit.id : null;
}

async function uploadMedia(file, alt) {
  const media = await wp("media", {
    method: "POST",
    headers: { "Content-Type": contentType(file), "Content-Disposition": `attachment; filename="${path.basename(file)}"` },
    body: fs.readFileSync(file),
  });
  if (alt) { try { await wp(`media/${media.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alt_text: alt }) }); } catch {} }
  return media;
}
async function uploadImage(file, title) { return (await uploadMedia(file, title)).id; }

(async () => {
  if (!base || !user || !pass) { console.error("WP_URL / WP_USER / WP_APP_PASSWORD が設定されていません"); process.exit(1); }
  fs.mkdirSync(resultDir, { recursive: true });
  const files = fs.existsSync(queueDir) ? fs.readdirSync(queueDir).filter(f => f.endsWith(".json")) : [];
  if (!files.length) { console.log("送るものはありません"); return; }
  for (const f of files) {
    const id = path.basename(f, ".json");
    const src = path.join(queueDir, f);
    const png = path.join(queueDir, `${id}.png`);
    let result;
    let extra = [];
    try {
      const raw = JSON.parse(fs.readFileSync(src, "utf8"));
      const notes = [];
      // 本文の途中の画像（{{IMG1}} などの目印を画像に置き換える）
      const altOf = {}; (raw.images || []).forEach(im => { if (im && im.file) altOf[path.basename(im.file)] = im.alt || ""; });
      const inl = await inlineImages(raw.content || "", raw.images, queueDir,
        async file => (await uploadMedia(file, altOf[path.basename(file)])).source_url,
        (url, alt) => `<figure class="wp-block-image size-large"><img src="${url}" alt="${alt}"/></figure>`);
      notes.push(...inl.notes);
      extra = inl.used;
      const post = {
        title: raw.title,
        content: inl.html,
        status: raw.status === "publish" ? "publish" : (raw.status === "draft" ? "draft" : defaultStatus),
      };
      if (raw.slug) post.slug = raw.slug;
      if (raw.excerpt) post.excerpt = raw.excerpt;
      try {
        const cat = await categoryId(raw.category || "Haguruma");
        if (cat) post.categories = [cat]; else notes.push(`カテゴリ「${raw.category || "Haguruma"}」が見つかりません`);
      } catch (e) { notes.push("カテゴリ取得失敗: " + e.message); }
      if (fs.existsSync(png)) {
        try { post.featured_media = await uploadImage(png, raw.title); }
        catch (e) { notes.push("アイキャッチのアップロード失敗: " + e.message); }
      }
      if (raw.metaDescription) post.aioseo_meta_data = { description: raw.metaDescription };
      const created = await wp("posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(post) });
      result = {
        ok: true, postId: created.id, status: created.status, link: created.link,
        editUrl: `${base}/wp-admin/post.php?post=${created.id}&action=edit`,
        notes: notes.length ? notes.join(" / ") : null, at: new Date().toISOString(),
      };
    } catch (e) {
      result = { ok: false, error: String(e.message || e).slice(0, 500), at: new Date().toISOString() };
    }
    fs.writeFileSync(path.join(resultDir, `${id}.json`), JSON.stringify(result, null, 2));
    fs.unlinkSync(src);
    if (fs.existsSync(png)) fs.unlinkSync(png);
    for (const x of extra) if (fs.existsSync(x)) fs.unlinkSync(x);
    for (const x of fs.readdirSync(queueDir)) if (x.startsWith(id + "-img")) fs.unlinkSync(path.join(queueDir, x));
    console.log(id, result.ok ? `投稿しました (${result.status})` : "失敗しました", result.ok ? result.link : result.error);
  }
})();

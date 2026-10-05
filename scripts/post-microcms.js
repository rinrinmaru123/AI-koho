// blog-queue/<id>.json を microCMS に「下書き」で送り、結果を blog-results/<id>.json に残す。
// 送った（または失敗した）キューファイルは削除して、二重送信を防ぐ。
const fs = require("fs");
const path = require("path");

const key = process.env.MICROCMS_API_KEY;
const service = process.env.MICROCMS_SERVICE;
const endpoint = process.env.MICROCMS_ENDPOINT;
const queueDir = "blog-queue";
const resultDir = "blog-results";
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
    try {
      const raw = JSON.parse(fs.readFileSync(src, "utf8"));
      const content = {};
      for (const k of ALLOWED) if (raw[k] !== undefined && raw[k] !== "") content[k] = raw[k];
      if (typeof content.category === "string") content.category = [content.category];
      const res = await fetch(`https://${service}.microcms.io/api/v1/${endpoint}?status=draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-MICROCMS-API-KEY": key },
        body: JSON.stringify(content),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text);
        result = { ok: true, contentId: data.id, editUrl: `https://${service}.microcms.io/apis/${endpoint}/${data.id}`, at: new Date().toISOString() };
      } else {
        result = { ok: false, status: res.status, error: text.slice(0, 500), at: new Date().toISOString() };
      }
    } catch (e) {
      result = { ok: false, error: String(e).slice(0, 500), at: new Date().toISOString() };
    }
    fs.writeFileSync(path.join(resultDir, `${id}.json`), JSON.stringify(result, null, 2));
    fs.unlinkSync(src);
    console.log(id, result.ok ? "下書きを作成しました" : "失敗しました", result.ok ? result.contentId : result.error);
  }
})();

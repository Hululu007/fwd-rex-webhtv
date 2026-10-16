/**
 * 生成 WebHTV 点播配置：
 *   node build_config.mjs [--sub=URL] [--out-dir=.] [--api=./fwd_rex.js]
 * 产出：
 *   vod.json        25 个站点（每个 widget 一个站点，推荐）
 *   vod_all.json    单站点聚合（订阅清单里 25 个模块变成 25 个分类）
 *   site_table.md   站点一览表（写文档用）
 */
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const hit = argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.split("=").slice(1).join("=") : def;
};

const sub = opt("sub", "https://fwd.uou.qzz.io/widgets.rex");
const api = opt("api", "./fwd_rex.js");
const outDir = opt("out-dir", path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")));

const manifest = await (await fetch(sub)).json();
const widgets = manifest.widgets || [];
if (!widgets.length) throw new Error("订阅清单为空：" + sub);

function slugOf(w) {
  const id = String(w.id || "");
  const parts = id.split(".");
  let slug = parts.length > 2 ? parts[1] : parts[0];
  if (!slug) slug = String(w.title || "widget");
  return (
    "fwd_" +
    slug
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

const sites = widgets.map((w) => {
  const site = {
    key: slugOf(w),
    name: String(w.title || w.id || "模块"),
    type: 3,
    api: api,
    ext: { url: String(w.url) },
    searchable: 1,
    quickSearch: 1,
    changeable: 1,
    style: { type: "rect", ratio: 0.75 },
  };
  const icon = w.icon || w.logo;
  if (icon) site.logo = String(icon);
  return site;
});

// key 去重
const seen = {};
for (const s of sites) {
  let key = s.key;
  let n = 2;
  while (seen[key]) key = s.key + "_" + n++;
  seen[key] = 1;
  s.key = key;
}

const vod = {
  sites: sites,
  parses: [],
  flags: [],
  ads: [],
};

const vodAll = {
  sites: [
    {
      key: "fwd_all",
      name: String(manifest.title || "宝宝巴士乐园"),
      type: 3,
      api: api,
      ext: { sub: sub },
      searchable: 1,
      quickSearch: 1,
      changeable: 1,
    },
  ],
  parses: [],
};

fs.writeFileSync(path.join(outDir, "vod.json"), JSON.stringify(vod, null, 2));
fs.writeFileSync(path.join(outDir, "vod_all.json"), JSON.stringify(vodAll, null, 2));

const rows = widgets.map((w, i) => {
  const site = sites[i];
  return `| ${site.name} | \`${site.key}\` | ${w.version || "-"} | \`${w.url}\` |`;
});
const md = [
  `# ${manifest.title || "订阅"} · WebHTV 站点一览`,
  "",
  `订阅清单：\`${sub}\``,
  `生成时间：${new Date().toISOString()}`,
  `适配器：\`${api}\``,
  "",
  `| 站点名 | key | 模块版本 | 原始模块地址 |`,
  `| --- | --- | --- | --- |`,
  ...rows,
  "",
].join("\n");
fs.writeFileSync(path.join(outDir, "site_table.md"), md);

console.log(`已生成 ${sites.length} 个站点 → ${path.join(outDir, "vod.json")}`);
console.log(`聚合配置 → ${path.join(outDir, "vod_all.json")}`);
console.log(`站点表 → ${path.join(outDir, "site_table.md")}`);

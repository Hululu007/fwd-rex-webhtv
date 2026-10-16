/**
 * 全量巡检：把订阅清单里的每个 widget 都跑一遍 home → category → detail → play，输出通过/失败表。
 *
 *   node sweep.mjs [--limit=25] [--search=词] [--sub=URL] [--json=out.json] [--md=out.md]
 *
 * 产物：
 *   --json=xxx.json  结构化结果（build_lite.mjs 吃这个）
 *   --md=xxx.md      Markdown 表格（GitHub Action 写进 job summary 用）
 */
import fs from "node:fs";
import { spider } from "./shim.mjs";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const hit = argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.split("=").slice(1).join("=") : def;
};
const sub = opt("sub", "https://fwd.uou.qzz.io/widgets.rex");
const limit = parseInt(opt("limit", "0"), 10); // 0 = 清单里有多少就查多少
const searchKey = opt("search", "");
const outFile = opt("json", "");
const mdFile = opt("md", "");

const manifest = await (await fetch(sub)).json();
const all = manifest.widgets || [];
const widgets = limit > 0 ? all.slice(0, limit) : all;
const rows = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const w of widgets) {
  const row = { id: w.id, title: w.title, url: w.url, home: 0, cat: 0, detail: "", play: "", ms: 0, err: "" };
  const t0 = Date.now();
  try {
    spider.init({ url: w.url });
    const home = JSON.parse(await spider.home());
    row.home = (home.class || []).length;
    let cat = JSON.parse(await spider.category("0", "1", false, {}));
    if (!(cat.list || []).length) {
      // 网络抖动常见：空结果再给一次机会
      await sleep(1200);
      cat = JSON.parse(await spider.category("0", "1", false, {}));
      if ((cat.list || []).length) row.err = "首查为空，重试成功";
    }
    row.cat = (cat.list || []).length;
    const first = (cat.list || [])[0];
    if (first) {
      const detail = JSON.parse(await spider.detail(first.vod_id));
      const item = (detail.list || [])[0];
      if (item) {
        const groups = String(item.vod_play_url).split("$$$");
        row.detail = `${item.vod_play_from.split("$$$").length}线路/${groups[0].split("#").length}集`;
        const epId = groups[0].split("#")[0].split("$").slice(1).join("$");
        const play = JSON.parse(await spider.play("", epId, []));
        row.play = play.url ? (Array.isArray(play.url) ? String(play.url[1] || play.url[0]) : String(play.url)).slice(0, 80) : "空地址";
      } else {
        row.detail = "无详情条目";
        row.err = detail.msg || "";
      }
    } else {
      row.err = cat.msg || "分类为空";
    }
    if (searchKey) {
      const res = JSON.parse(await spider.search(searchKey, true, "1"));
      row.err = row.err || `search=${res.list.length}`;
    }
  } catch (e) {
    row.err = String((e && e.message) || e).split("\n")[0].slice(0, 160);
  }
  row.ms = Date.now() - t0;
  rows.push(row);
  console.log(
    `${row.title.padEnd(14)} home=${String(row.home).padStart(2)} cat=${String(row.cat).padStart(3)} detail=${(row.detail || "-").padEnd(12)} ${row.ms}ms  ${row.err}`
  );
}

const playable = rows.filter((r) => r.play && r.play !== "空地址");
console.log(
  `\n汇总：${playable.length}/${rows.length} 可播，` +
    rows.filter((r) => r.cat > 0).length +
    "/" +
    rows.length +
    " 分类可用"
);

const md = [
  `# 巡检结果 · ${manifest.title || sub}`,
  "",
  `- 时间：${new Date().toISOString()}`,
  `- 清单：\`${sub}\``,
  `- 结果：**${playable.length}/${rows.length} 可播**，${rows.filter((r) => r.cat > 0).length}/${rows.length} 分类可用`,
  "",
  "| 站点 | 可播 | 首页栏目 | 分类条目 | 详情 | 耗时 | 备注 |",
  "| --- | :---: | :---: | :---: | --- | ---: | --- |",
  ...rows.map(
    (r) =>
      `| ${r.title} | ${r.play && r.play !== "空地址" ? "✅" : "—"} | ${r.home} | ${r.cat} | ${r.detail || "—"} | ${(r.ms / 1000).toFixed(1)}s | ${(r.err || "").replace(/\|/g, "\\|")} |`
  ),
  "",
].join("\n");

if (outFile) {
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 2));
  console.log("结果已写入 " + outFile);
}
if (mdFile) {
  fs.writeFileSync(mdFile, md);
  console.log("Markdown 已写入 " + mdFile);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
  } catch (e) {}
}

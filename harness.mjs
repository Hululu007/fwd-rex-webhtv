/**
 * 单站点全链路验证：
 *   node harness.mjs <widgetUrl> [--search=词] [--cat=栏目] [--page=2] [--show=12] [--json]
 *   node harness.mjs --sub [--sub=URL]       # 聚合模式（只跑 home）
 */
import { spider } from "./shim.mjs";

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith("--"));
const opt = (name, def) => {
  const hit = argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.split("=").slice(1).join("=") : def;
};
const subMode = argv.includes("--sub") || !target;
const extra = opt("extra", null);
const ext = subMode
  ? { sub: opt("sub", "https://fwd.uou.qzz.io/widgets.rex") }
  : { url: target };
if (extra) ext.extra = JSON.parse(extra);
if (opt("name", null)) ext.name = opt("name", null);

const t0 = Date.now();
spider.init(ext);
log("init", JSON.stringify(ext), "mode=" + (subMode ? "sub" : "widget"));

const home = JSON.parse(await spider.home());
log("home.class", home.class.length, `${Date.now() - t0}ms`);
console.log(
  (home.class || [])
    .slice(0, Number(opt("show", "12")))
    .map((c) => `  ${c.type_id} = ${c.type_name}`)
    .join("\n")
);
if (Object.keys(home.filters || {}).length) console.log("  filters: " + JSON.stringify(home.filters).slice(0, 300));

if (subMode) process.exit(0);

const t1 = Date.now();
const homeVod = JSON.parse(await spider.homeVod());
log("homeVod.list", homeVod.list.length, `${Date.now() - t1}ms`);
printCards("首", homeVod.list);

const catTid = opt("cat", home.class[0] ? home.class[0].type_id : "0");
const page = opt("page", "1");
const t2 = Date.now();
const category = JSON.parse(await spider.category(catTid, page, false, {}));
log(`category(${catTid},${page}).list`, category.list.length, "pagecount=" + category.pagecount, `${Date.now() - t2}ms`);
if (category.msg) log("category.msg", category.msg);
printCards("类", category.list);

const first = category.list[0] || homeVod.list[0] || {};
if (first.vod_id) {
  const t3 = Date.now();
  const detail = JSON.parse(await spider.detail(first.vod_id));
  const item = (detail.list || [])[0];
  log("detail.list", (detail.list || []).length, `msg=${detail.msg || "-"}`, `${Date.now() - t3}ms`);
  if (item) {
    console.log("  vod_name: " + item.vod_name);
    console.log("  vod_pic : " + String(item.vod_pic).slice(0, 90));
    console.log("  from    : " + item.vod_play_from);
    const groups = String(item.vod_play_url).split("$$$");
    console.log("  组数/首组集数: " + groups.length + "/" + groups[0].split("#").length);
    const epId = groups[0].split("#")[0].split("$").slice(1).join("$");
    const play = JSON.parse(await spider.play("", epId, []));
    log("play", JSON.stringify(play).slice(0, 260));
  }
}

const kw = opt("search", null);
if (kw) {
  const t4 = Date.now();
  const res = JSON.parse(await spider.search(kw, true, "1"));
  log(`search(${kw}).list`, res.list.length, "pagecount=" + res.pagecount, `${Date.now() - t4}ms`);
  printCards("搜", res.list);
}
if (argv.includes("--json")) console.log(JSON.stringify({ home, homeVod, category }, null, 2));

function printCards(label, list) {
  (list || []).slice(0, 6).forEach((v, i) => {
    console.log(`  [${label}${i}] ${v.vod_name} | ${v.vod_remarks || "-"} | ${v.vod_pic ? String(v.vod_pic).slice(0, 64) : "无图"}`);
  });
}
function log(...args) {
  console.log("· " + args.join(" "));
}

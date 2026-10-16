/**
 * 单站详情/播放深挖：
 *   node probe_one.mjs <widgetUrl> [catTid] [page]
 */
import { spider } from "./shim.mjs";

const [url, catTid = "0", page = "1"] = process.argv.slice(2);
spider.init({ url });

const cat = JSON.parse(await spider.category(catTid, page, false, {}));
console.log("category:", cat.list.length, "items | msg=", cat.msg || "-");
const item = cat.list[0] || JSON.parse(await spider.homeVod()).list[0];
console.log("首条目:", item && item.vod_name, "|", item && item.vod_remarks);
if (!item) process.exit(0);

const detail = JSON.parse(await spider.detail(item.vod_id));
console.log("detail msg:", detail.msg || "-");
console.log("detail 摘要:", JSON.stringify(detail).slice(0, 900));
const grp = (detail.list || [])[0];
if (!grp) process.exit(0);
const tok = grp.vod_play_url.split("$$$")[0].split("#")[0].split("$").slice(1).join("$");
console.log("首集 token:", String(tok).slice(0, 40));
try {
  const decoded = Buffer.from(String(tok).slice(2).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  console.log("token 解出:", decoded.slice(0, 240));
} catch (e) {
  console.log("token 解码失败:", e.message);
}
const play = JSON.parse(await spider.play("", tok, []));
console.log("play:", JSON.stringify(play).slice(0, 300));

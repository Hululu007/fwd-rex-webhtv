/**
 * 生成精简点播配置：只保留巡检里「确实能播」的站点，首页更干净。
 *
 *   node build_lite.mjs                                   # 用 sweep_result.json（或 sweep_result_cn.json）
 *   node build_lite.mjs --sweep=sweep_result_cn.json
 *   node build_lite.mjs --union=sweep_result.json,sweep_result_cn.json,sweep_result3.json
 *                                                        # 取并集：任一次巡检能播就留下（推荐，抗网络抖动）
 *   node build_lite.mjs --only=fwd_hanju84,fwd_juwu       # 手动指定 key（覆盖巡检结果）
 *   node build_lite.mjs --out=vod_lite.json --config=vod.json
 *
 * 判定标准（与 sweep.mjs 一致）：detail 出得来、play() 拿到非空地址。
 * 注意：巡检结果受本机网络影响——被墙的站点会被判为不可播；带代理的机器上重跑 sweep 再生成即可。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const hit = argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.split("=").slice(1).join("=") : def;
};

const configFile = opt("config", path.join(here, "vod.json"));
const outFile = opt("out", path.join(here, "vod_lite.json"));
const only = opt("only", "");
const unionArg = opt("union", "");
const sweepArg = opt("sweep", "");

const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
const sites = config.sites || [];

const playable = (row) => row && row.play && row.play !== "空地址" && row.cat > 0;

function resolveSweepFiles() {
  if (unionArg) return unionArg.split(",").map((s) => path.resolve(here, s.trim())).filter(Boolean);
  if (sweepArg) return [path.resolve(here, sweepArg)];
  const candidates = ["sweep_result.json", "sweep_result_cn.json"].map((f) => path.join(here, f));
  const found = candidates.filter((p) => fs.existsSync(p));
  if (!found.length) throw new Error("找不到巡检结果（先跑 node sweep.mjs --json=sweep_result.json）");
  return found;
}

let keep;
if (only) {
  const keys = only.split(",").map((s) => s.trim()).filter(Boolean);
  keep = sites.filter((s) => keys.includes(s.key));
} else {
  const files = resolveSweepFiles().filter((p) => fs.existsSync(p));
  if (!files.length) throw new Error("巡检结果文件都不存在");
  const okUrls = new Set();
  for (const f of files) {
    const rows = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const r of rows) if (playable(r)) okUrls.add(String(r.url));
    console.log(`  ${path.basename(f)}: ${rows.filter(playable).length}/${rows.length} 可播`);
  }
  keep = sites.filter((s) => okUrls.has(String((s.ext || {}).url || "")));
  const dropped = sites.filter((s) => !keep.includes(s)).map((s) => s.name);
  console.log(`按巡检结果保留 ${keep.length}/${sites.length} 个站点（${files.length} 份结果取并集）`);
  if (dropped.length) console.log("未纳入：" + dropped.join("、"));
}

if (!keep.length) throw new Error("没有可保留的站点，检查巡检结果或 --only");

const lite = {
  ...config,
  sites: keep,
};
fs.writeFileSync(outFile, JSON.stringify(lite, null, 2));
console.log(`已生成 ${outFile}（${keep.length} 个站点）`);
console.log(keep.map((s) => `  - ${s.name} (${s.key})`).join("\n"));

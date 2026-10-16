/**
 * 调试单个 widget：
 *   node debug.mjs <url> --meta                      # 打印模块清单
 *   node debug.mjs <url> --call=search --params='{"keyword":"人","page":1}'
 *   node debug.mjs <url> --call=loadDetail --params='{"link":"xxx"}'   # link 用 --link= 也可
 *   node debug.mjs <url> --html --file=page.html     # 试一下 mini-DOM 的选择器
 */
import fs from "node:fs";
import { debugApi } from "./shim.mjs";

const argv = process.argv.slice(2);
const url = argv.find((a) => a.startsWith("http"));
const opt = (name, def) => {
  const hit = argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.split("=").slice(1).join("=") : def;
};

if (argv.includes("--meta")) {
  console.log(JSON.stringify(debugApi.load(url), null, 2));
}
if (argv.includes("--html")) {
  const html = fs.readFileSync(opt("file"), "utf8");
  const $ = debugApi.htmlLoad(html);
  console.log("title:", $("title").first().text().trim().slice(0, 80));
  console.log("links:", $("a[href]").length);
  console.log("imgs :", $("img").length);
}
const fnName = opt("call", null);
const modIdx = opt("mod", null);
if (modIdx !== null) {
  const meta = debugApi.load(url);
  const mod = (meta.modules || [])[parseInt(modIdx, 10)];
  console.log("· 模块:", JSON.stringify(mod));
  if (mod) {
    const params = {};
    for (const p of mod.params || []) if (p.value !== undefined) params[p.name] = p.value;
    params.page = parseInt(opt("page", "1"), 10);
    try {
      const out = await debugApi.call(url, mod.functionName, params);
      const json = JSON.stringify(out.raw);
      console.log("· type:", out.type, "len:", json ? json.length : 0);
      console.log("· head:", json ? json.slice(0, 600) : String(out.raw));
    } catch (e) {
      console.log("· ERROR:", (e && e.message) || e);
      if (e && e.stack) console.log("· STACK:", String(e.stack).split("\n").slice(0, 8).join("\n         "));
    }
  }
}
if (fnName) {
  let params = {};
  const raw = opt("params", null);
  if (raw) params = JSON.parse(raw);
  const link = opt("link", null);
  if (link) params = link;
  try {
    const out = await debugApi.call(url, fnName, params);
    console.log("· type:", out.type);
    const json = JSON.stringify(out.raw);
    console.log("· len :", json ? json.length : 0);
    console.log("· head:", json ? json.slice(0, 1200) : String(out.raw));
  } catch (e) {
    console.log("· ERROR:", e && e.message);
  }
}

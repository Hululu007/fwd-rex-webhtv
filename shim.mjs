/**
 * 本地 shim：用 curl 提供同步 req()，用内存对象提供 local，然后载入 fwd_rex.js。
 * 供 harness.mjs / debug.mjs / sweep.mjs / probe_one.mjs 复用。
 * 跨平台：Windows 用 curl.exe，Linux/macOS（含 GitHub Runner）用 curl。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CURL = process.platform === "win32" ? "curl.exe" : "curl";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fwdrc-"));
let seq = 0;

function headersToObject(raw) {
  const out = {};
  for (const line of String(raw).split(/\r?\n/)) {
    if (/^HTTP\//i.test(line)) continue;
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    if (out[k] === undefined) out[k] = line.slice(i + 1).trim();
  }
  return out;
}

globalThis.req = function req(url, options = {}) {
  const bodyFile = path.join(tmp, `body-${++seq}`);
  const hdrFile = path.join(tmp, `hdr-${seq}`);
  const args = [
    "-sS", "-L",
    "--max-time", String(Math.max(5, Math.ceil((options.timeout || 20000) / 1000))),
    "-o", bodyFile, "-D", hdrFile, "-w", "%{http_code}",
  ];
  const method = String(options.method || "get").toUpperCase();
  if (method === "HEAD" || method === "HEADER") args.push("-I");
  const headers = options.headers || {};
  let hasCT = false;
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === "content-type") hasCT = true;
    args.push("-H", `${k}: ${headers[k]}`);
  }
  let data;
  if (options.body !== undefined && options.body !== null) data = String(options.body);
  else if (options.data !== undefined && options.data !== null)
    data = typeof options.data === "string" ? options.data : JSON.stringify(options.data);
  if (data !== undefined) {
    if (!hasCT) args.push("-H", "Content-Type: application/json");
    args.push("--data-raw", data);
  } else if (method === "POST" || method === "PUT") {
    args.push("--data-raw", "");
  }
  args.push(url);

  let code = "0";
  try {
    code = execFileSync(CURL, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    code = "0";
  }
  let content = "";
  try {
    content = fs.readFileSync(bodyFile, "utf8");
  } catch (e) {}
  let hdrs = {};
  try {
    hdrs = headersToObject(fs.readFileSync(hdrFile, "utf8"));
  } catch (e) {}

  for (const f of [bodyFile, hdrFile]) {
    try {
      fs.unlinkSync(f);
    } catch (e) {}
  }
  return { code: parseInt(code, 10) || 0, headers: hdrs, content };
};

const store = {};
globalThis.local = {
  get: (rule, key) => (store[rule + "|" + key] === undefined ? "" : store[rule + "|" + key]),
  set: (rule, key, value) => {
    store[rule + "|" + key] = String(value);
  },
  delete: (rule, key) => {
    delete store[rule + "|" + key];
  },
};

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [path.join(here, "fwd_rex.js"), path.join(here, "..", "fwd_rex.js")];
const entry = candidates.find((p) => fs.existsSync(p));
if (!entry) throw new Error("找不到 fwd_rex.js，请与本 shim 放同一目录（或上级目录）");
const source = fs.readFileSync(entry, "utf8");
const mod = await import("data:text/javascript;base64," + Buffer.from(source, "utf8").toString("base64"));

export const spider = mod.default;
export const debugApi = mod.__debug;
export const adapterPath = entry;

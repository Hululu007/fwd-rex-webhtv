# fwd-rex-webhtv

把 **Forward / Rex 模块订阅**（`WidgetMetadata` 脚本，例如 `https://fwd.uou.qzz.io/widgets.rex`）
接进 **WebHTV（影视TV / WebHomeTV）** 的一个适配器，直接当普通点播源用。

> `fwd_rex.js` 负责"转接"：WebHTV 的 QuickJS 运行时加载它，它在内部拉取并执行 Forward 模块，
> 再把结果映射成影视TV的点播契约（`home / category / detail / search / play`）。

## 一键使用

WebHTV › **设置 › 点播 › 添加接口地址**，填：

```
https://raw.githubusercontent.com/caiwenjie17-a11y/fwd-rex-webhtv/main/vod_lite.json
```

国内直连不稳就用 jsDelivr 镜像（换文件名即可）：

```
https://cdn.jsdelivr.net/gh/caiwenjie17-a11y/fwd-rex-webhtv@main/vod_lite.json
```

| 配置 | 站点形态 | 适合 |
| --- | --- | --- |
| [`vod_lite.json`](vod_lite.json) | **15 个实测能播的站点**（本机 3 轮巡检并集） | 推荐：首页干净、点开基本都能出片 |
| [`vod.json`](vod.json) | 26 个站点，每模块一个 | 全量；带代理/VPN 的设备上优势最大 |
| [`vod_all.json`](vod_all.json) | 1 个站点「宝宝巴士乐园」，26 个分类 | 想集中在一个站点里；搜索会扫前 10 个模块 |

> `vod.json` 里 `api` 是相对路径 `./fwd_rex.js`，两个文件必须同目录 —— 本仓库已经放好了。

## 两地巡检对照

| 环境 | 可播 | 说明 |
| --- | --- | --- |
| 本机（国内，无代理） | **13/26**（3 轮并集 15/26） | 被墙域名直连返回 000，属网络侧 |
| GitHub Runner（海外） | **19/25**（下一次含新模块会变 26） | Pornhub / Xvideos / 麻豆 / 黄果 在那边是通的 |

Runner 上仍失败的是 **Cloudflare 403** 类（`123AV`、`Jable`、`SupJAV`）与站点自身反代不通（`黄豆短剧`、`花都影院`）。

### 被 Cloudflare 拦的站点怎么救

这些模块自带全局参数 `cookie` 与 `proxy`，用 `ext.extra` 直接喂给适配器即可（适配器会把 `ext.extra`
合并进每次模块调用）：

```json
{
  "key": "fwd_jable",
  "name": "Jable",
  "type": 3,
  "api": "./fwd_rex.js",
  "ext": {
    "url": "https://fwd.uou.qzz.io/widgets/Jable_TuT.js",
    "extra": {
      "cookie": "cf_clearance=xxxxx; language=zh_CN",
      "proxy": "https://你的反代域名/p"
    }
  }
}
```

`cf_clearance` 获取：浏览器开 `jable.tv`（或 `supjav.com`）过一次人机验证 → F12 → 任意请求 → 复制完整 Cookie。
`proxy` 是可选的反代前缀（留空则直连）。同一套参数对 `Javxx_TuT.js` / `SupJAV_TuT.js` 通用。

## 换订阅源 / 重新生成配置

任何返回 `{"widgets":[{"url":"....js"}]}` 的清单都能直接用：

```bash
node build_config.mjs --sub=https://你的地址/widgets.rex                     # 生成 vod.json / vod_all.json
node sweep.mjs --json=sweep_result_cn.json --md=sweep_summary_cn.md          # 本机全量巡检（清单里有几个查几个）
node build_lite.mjs --union=sweep_result_cn.json,sweep_result3.json          # 取并集生成 vod_lite.json
node build_lite.mjs --only=fwd_hanju84,fwd_juwu                              # 或手动挑站点
```

单站点聚合模式：把 `ext.sub` 改成你的订阅地址；单个模块：`"ext": { "url": "https://.../Xxx_TuT.js" }`。

## 自动巡检（GitHub Actions）

[`.github/workflows/sweep.yml`](.github/workflows/sweep.yml) 在 **push / 手动触发 / 每天 04:00(UTC+8)** 跑全量巡检：

- 结果表格进 **Job Summary**，并作为 artifact（`sweep-result`）留档；
- 有变化就把 `sweep_result.json` + `sweep_summary.md` 提交回仓库（带 `[skip ci]`）；
- `concurrency: group: sweep` 保证同一时间只有一个 run，push 前 `git pull --rebase` 并重试 3 次，避免抢 push 失败。

> 这两个文件由 Action 托管，别在本地覆盖：本机的巡检基线另存为 `sweep_result_cn.json` / `sweep_summary_cn.md`。
> `vod_lite.json` 刻意按**本机**结果生成（海外 Runner 结果不参与），避免两地网络差异互相带偏。

## 目录

| 文件 | 作用 |
| --- | --- |
| `fwd_rex.js` | 适配器本体（WebHTV 站点源，无外部依赖） |
| `vod.json` / `vod_lite.json` / `vod_all.json` | 点播配置（全量 26 / 精简 15 / 单站点聚合） |
| `使用说明.md` | 详细说明：用法、映射表、巡检结果、已知限制、排错 |
| `build_config.mjs` / `build_lite.mjs` | 从订阅清单生成配置 / 按巡检结果（可取并集）生成精简配置 |
| `shim.mjs` `harness.mjs` `sweep.mjs` `debug.mjs` `probe_one.mjs` | 本地验证台（Node + curl 提供同步 `req`，跨平台） |
| `push_to_github.ps1` | 本机 github.com 不通时，走 GitHub API 一键同步 |
| `site_table.md` | 26 个站点 key / 版本 / 模块地址一览 |
| `sweep_result_cn.json` `sweep_summary_cn.md` | 本机巡检基线与汇总 |

## 本地自测（Node）

```powershell
node sweep.mjs --json=sweep_result_cn.json --md=sweep_summary_cn.md     # 全量巡检
node harness.mjs "https://fwd.uou.qzz.io/widgets/Hanju84_TuT.js" --search=韩剧
node harness.mjs "https://fwd.uou.qzz.io/widgets/Jable_TuT.js" --extra='{"cookie":"cf_clearance=xxx"}'
node debug.mjs  "https://fwd.uou.qzz.io/widgets/Chengguo_TuT.js" --mod=0
```

## 实现要点

- **HTTP 走同步 `req()`**：运行时那个异步 `http()` 会把回调丢回爬虫所在的单线程执行器，`await` 会自锁。
- **自带极简 jQuery-like `$`**：模块用 `Widget.html.load(html)` 拿到 jQuery 风格对象（`attr/text/find/first/each/toArray`），运行时不提供 cheerio，故内置 HTML 解析 + 选择器引擎。
- **`type:"stream"` 模块 = 播放解析器**：选集时才调 `loadResource({link})`，多线路自动转成「线路名/地址」数组供播放器切换。
- **运行时缺口补齐**：`atob/btoa/URL/global/window/self` 全部 shim；`setTimeout` 换成不阻塞执行器的安全版；需要 `CryptoJS/JSEncrypt` 的模块（如瓜子影视）首次加载自动从 jsDelivr 注入。
- **`ext.extra` 通吃模块全局参数**：`cookie` / `proxy` / `imgProxy` 之类直接写进站点配置即可。

## 免责

本仓库只做格式适配，不内置、不托管、不提供任何影视资源；模块由第三方维护，可用性随其站点变化。
使用时请遵守所在地法律法规。

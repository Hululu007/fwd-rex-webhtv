# fwd-rex-webhtv

把 **Forward / Rex 模块订阅**（`WidgetMetadata` 脚本，例如 `https://fwd.uou.qzz.io/widgets.rex`）
接进 **WebHTV（影视TV / WebHomeTV）** 的一个适配器，直接当普通点播源用。

> `fwd_rex.js` 负责"转接"：WebHTV 的 QuickJS 运行时加载它，它在内部拉取并执行 Forward 模块，
> 再把结果映射成影视TV的点播契约（`home / category / detail / search / play`）。

## 一键使用

WebHTV › **设置 › 点播 › 添加接口地址**，填：

```
https://raw.githubusercontent.com/caiwenjie17-a11y/fwd-rex-webhtv/main/vod.json
```

国内直连不稳的话用 jsDelivr 镜像（同一份文件）：

```
https://cdn.jsdelivr.net/gh/caiwenjie17-a11y/fwd-rex-webhtv@main/vod.json
```

三种配置，按需选一个（地址只换文件名）：

| 配置 | 站点形态 | 适合 |
| --- | --- | --- |
| [`vod.json`](vod.json) | 25 个站点，每个模块一个 | 全量体验 |
| [`vod_lite.json`](vod_lite.json) | **13 个实测能播的站点** | 推荐：首页干净、点开基本都能出片 |
| [`vod_all.json`](vod_all.json) | 1 个站点「宝宝巴士乐园」，25 个分类 | 想集中在一个站点里；搜索会扫前 10 个模块 |

> `vod.json` 里 `api` 是相对路径 `./fwd_rex.js`，两个文件必须同目录 —— 本仓库已经放好了。

## 换订阅源 / 重新生成配置

任何返回 `{"widgets":[{"url":"....js"}]}` 的清单都能直接用：

```bash
node build_config.mjs --sub=https://你的地址/widgets.rex   # 重新生成 vod.json / vod_all.json
node sweep.mjs --json=sweep_result.json --md=sweep_summary.md   # 25 站巡检
node build_lite.mjs                                        # 按巡检结果生成 vod_lite.json
node build_lite.mjs --only=fwd_hanju84,fwd_juwu            # 或手动挑站点
```

单站点聚合模式：把 `ext.sub` 改成你的订阅地址；单个模块：`"ext": { "url": "https://.../Xxx_TuT.js" }`。

## 自动巡检（GitHub Actions）

[`.github/workflows/sweep.yml`](.github/workflows/sweep.yml) 会在 **push / 手动触发 / 每天定时** 跑一遍 25 站巡检：

- 结果表格写进 **Job Summary**，同时作为 artifact（`sweep-result`）留档；
- 变化时把 `sweep_result.json` + `sweep_summary.md` 提交回仓库（提交信息带 `[skip ci]`，不会自触发）。

> Runner 在海外，被墙站点（MissAV / Pornhub / Jable …）在那边往往反而是通的 —— 交叉参考两地结果即可。
> `vod_lite.json` 是按**本机无代理**那次巡检生成的，所以刻意没放进自动更新，避免被海外结果带偏。

## 目录

| 文件 | 作用 |
| --- | --- |
| `fwd_rex.js` | 适配器本体（WebHTV 站点源，无外部依赖） |
| `vod.json` / `vod_lite.json` / `vod_all.json` | 点播配置（全量 / 精简 / 单站点聚合） |
| `使用说明.md` | 详细说明：用法、映射表、巡检结果、已知限制、排错 |
| `build_config.mjs` / `build_lite.mjs` | 从订阅清单生成配置 / 按巡检结果生成精简配置 |
| `shim.mjs` `harness.mjs` `sweep.mjs` `debug.mjs` `probe_one.mjs` | 本地验证台（Node + curl 提供同步 `req`） |
| `push_to_github.ps1` | 本机 github.com 不通时，走 GitHub API 一键同步 |
| `site_table.md` `sweep_result.json` `sweep_summary.md` | 站点一览 / 巡检结构化结果 / 巡检 markdown 汇总 |

## 本地自测（Node）

```powershell
node sweep.mjs --json=sweep_result.json                                  # 25 站巡检
node harness.mjs "https://fwd.uou.qzz.io/widgets/Hanju84_TuT.js" --search=韩剧
node debug.mjs  "https://fwd.uou.qzz.io/widgets/Chengguo_TuT.js" --mod=0
```

## 实现要点

- **HTTP 走同步 `req()`**：运行时那个异步 `http()` 会把回调丢回爬虫所在的单线程执行器，`await` 会自锁。
- **自带极简 jQuery-like `$`**：模块用 `Widget.html.load(html)` 拿到 jQuery 风格对象（`attr/text/find/first/each/toArray`），运行时不提供 cheerio，故内置 HTML 解析 + 选择器引擎。
- **`type:"stream"` 模块 = 播放解析器**：选集时才调 `loadResource({link})`，多线路自动转成「线路名/地址」数组供播放器切换。
- **运行时缺口补齐**：`atob/btoa/URL/global/window/self` 全部 shim；`setTimeout` 换成不阻塞执行器的安全版；需要 `CryptoJS/JSEncrypt` 的模块（如瓜子影视）首次加载自动从 jsDelivr 注入。

## 免责

本仓库只做格式适配，不内置、不托管、不提供任何影视资源；模块由第三方维护，可用性随其站点变化。
使用时请遵守所在地法律法规。

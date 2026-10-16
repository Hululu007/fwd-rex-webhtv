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

两种配置：

| 配置 | 站点形态 | 适合 |
| --- | --- | --- |
| [`vod.json`](vod.json) | 25 个站点，每个模块一个 | 推荐：站点列表干净、可单独禁用、首页只加载 1 个 JS |
| [`vod_all.json`](vod_all.json) | 1 个站点「宝宝巴士乐园」，25 个分类 | 想集中在一个站点里；搜索会扫前 10 个模块 |

> `vod.json` 里 `api` 是相对路径 `./fwd_rex.js`，两个文件必须同目录 —— 本仓库已经放好了。

## 换订阅源

任何返回 `{"widgets":[{"url":"....js"}]}` 的清单都能直接用：

```powershell
node build_config.mjs --sub=https://你的地址/widgets.rex
```

或单站点聚合模式：把 `ext.sub` 改成你的订阅地址即可（见 `vod_all.json`）。
单个模块也行：`"ext": { "url": "https://.../Xxx_TuT.js" }`。

## 目录

| 文件 | 作用 |
| --- | --- |
| `fwd_rex.js` | 适配器本体（WebHTV 站点源，无外部依赖） |
| `vod.json` / `vod_all.json` | 点播配置（25 站点 / 单站点聚合） |
| `使用说明.md` | 详细说明：用法、映射表、巡检结果、已知限制、排错 |
| `build_config.mjs` | 从订阅清单重新生成配置 |
| `shim.mjs` `harness.mjs` `sweep.mjs` `debug.mjs` `probe_one.mjs` | 本地验证台（Node + curl 提供同步 `req`） |
| `site_table.md` `sweep_result3.json` | 站点一览 / 最近一次 25 站全量巡检结果 |

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

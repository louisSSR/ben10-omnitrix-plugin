# SillyTavern 宿主适配契约

本项目是一套前端和一个宿主 Adapter。已对照官方固定提交的实际源码，支持目标为 ST 1.18.x / 1.19.x；未安装到真实酒馆，未宣称真实宿主验收通过。检查日期：2026-10-09。

## 精确来源与共用实现

| 官方版本 | 固定提交 | 本次确认 |
| --- | --- | --- |
| 1.18.0 | `51ad27fb86d39a3daca3adaa970375c9670c12df` | `getContext()` 暴露 `extensionSettings`、`saveSettingsDebounced`、`eventSource`、`eventTypes` |
| 1.19.0 | `7e8663cd9c184a550b37238218bdd32c6efc68e9` | 上述四项相同，因此使用同一 Adapter，无版本字符串放宽或无根据分支 |

源码链接：[1.18 context](https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/public/scripts/st-context.js)、[1.19 context](https://github.com/SillyTavern/SillyTavern/blob/7e8663cd9c184a550b37238218bdd32c6efc68e9/public/scripts/st-context.js)。实际行号：1.18 的 131、137–138、200；1.19 的 132、138–139、201。`hostVersion` 协议字段目前为 `null`，不从未验证页面文字猜版本。

两版 `public/scripts/events.js` 第 5 行包含 APP_READY，文件 SHA256 同为 `2aa1c20f140fab8967e6f850bd6e253bd0aa6e7c6a2e0540778cb11dd0f3a6ea`。初始化时探测 `on` / `off` 是否同时存在，能够完整撤销监听才订阅；另有 DOMContentLoaded 和有时限的容器观察，不依赖 1.19 专属事件。

两版 `public/scripts/extensions.js` 第 385/403 行声明 activate、enable、disable、delete、clean；第 440/445 行从 entry ES module 调用导出的 hook，第 637 行调用 activate。1.18 SHA256：`42437984d17b8f41dbfeb2ac4e907c89050890193e870a61d4c72b3a5a5a335c`；1.19：`f5ee3fee55d52e8b7041ceafb260dba5a2b2dada53081f930045ab8b6447d30d`。

DOM 是明确隔离在 Adapter 内的版本相关依赖：

| 元素 | 1.18 `public/index.html` | 1.19 `public/index.html` | 能力不足行为 |
| --- | --- | --- | --- |
| `#extensions_settings` / `#extensions_settings2` | 5759 / 5777 | 5773 / 5791 | 不挂入口；不猜替代容器 |
| `textarea#send_textarea` | 8092 | 8106 | 禁用写入能力，返回可读失败原因 |

HTML SHA256：1.18 `1eccc894791ef961db5a80d01bb517256843d86f720664f2cf5ff8f55f100122`；1.19 `647c22a47feff92148c07a0f821bbd84feea7400e543085841a95a418679419f`。本次有界查找未定位运行中的 ST 或本地完整 1.18 安装目录；以上来自固定官方源码，不能当成本机运行探针。

## 偏好与消息协议

偏好保存在 `getContext().extensionSettings.ben10Omnitrix`，保留该命名空间未知字段。只允许 `watch`（original/recalibrated/ultimatrix/omniverse）、`mode`（projection/carousel/dial）、`reducedMotion`（boolean）、`selectedId`（受限短 ID）。0.2.0 移除记录墙，旧的 `archive` 偏好在 Core 和 Adapter 两侧均迁移为 `projection`。UI 还必须确认 ID 在当前 catalog 中。getContext/设置/保存能力不足时，降级同源 localStorage；localStorage 失败时仅本次内存，并把能力告诉 iframe。

消息统一为 `{namespace:'ben10-omnitrix',type,payload}`。宿主必须同时核对同源 origin、精确 iframe.contentWindow、namespace 和类型，再做字段白名单过滤。iframe 使用相同的来源与 parent 校验。只有当前相对路径 `preview.html` 可成为子页；没有任意 URL 输入。

| 方向 | type | payload |
| --- | --- | --- |
| UI → 宿主 | ready | 可省略；宿主回 init |
| 宿主 → UI | init | `{preferences, capabilities:{persistentPreferences,preferenceStorage,draftInput}, hostVersion:null}` |
| UI → 宿主 | prefs | `{preferences}` |
| 宿主 → UI | prefs | `{preferences,persistence,capabilities}`；UI 应用后不能回发形成循环 |
| UI → 宿主 | select | `{formId,name}`；不写草稿、不触发生成 |
| UI → 宿主 | draft | `{formId,name}`；必须匹配最新 select；700ms 防双击 |
| 宿主 → UI | draft-result | `{ok,reason?}` |

只有 UI 的“写入酒馆输入框”按钮点击处理器可以发 draft，UI 应检查事件 `isTrusted`。postMessage 本身不能证明人的意图；同源 iframe 为自带受信任产品代码，不是安全隔离沙盒。宿主追加名称，保留所有原有文本，必要时增加换行并派发标准 input 事件；不按 Enter、不点击发送、不调用生成/聊天API。不能通过选择、翻卡、偏好更新自动发送 draft。

## 生命周期与未测边界

activate 和 enable 幂等；重复模块初始化先撤销旧实例。disable / delete / clean 关闭 iframe、移除入口、监听、MutationObserver、等待定时器并恢复焦点。清理不删除用户偏好。原生 dialog 负责焦点限制和移动端弹窗，桌面 Escape / 移动关闭按钮都有出口。

本轮已执行：两份 JS 的 `node --check`；extension-dev manifest 验证器（0 error / 0 warning）；Adapter 隔离断言（偏好白名单、未知命名空间字段保留、草稿追加/input 事件、只读输入框拒绝、localStorage/内存降级）；原始 ES module 在 Node VM + 模拟 DOM 中的握手/来源拒绝/选择门控/防双击/重复激活/销毁/重新启停断言。VM 测试读取实际两个源码文件，未替换模块业务代码；它仍是模拟 DOM，不是浏览器或真实酒馆。

仍须在真实 ST 1.18 和 1.19 验收：管理器安装发现、开启/关闭/重新开启、APP_READY 时序、刷新后偏好持久化、输入框现有文本保留及 input 后续监听、手机视口/安全区、iframe ready 握手、焦点与关闭、无自动发言。固定源码对照、静态检查和模拟宿主均不能关闭这些真实运行验收项。

本轮主技能：sillytavern-extension-dev、sillytavern-api-reference；资料库路由 sillytavern-extension-dev，快照 2026-08-18，加载 A0 / D5 / E5。目标与写入授权沿用本轮独立插件任务；未安装、未调用模型、未修改真实 ST。

# 0.2.3 交付验证记录

新增 15 张素材，目录仍为 224 条记录，已有剪影从 106 增至 **121**，待补从 118 减至 **103**。本版扩充素材，没有重新改动表壳、选择动画或手机安装器。

## 新增素材与来源

| 范围 | 条目 |
|---|---|
| 身体状态与平行版本 | Swampfire Blossomed、NRG Unsuited、Mad NRG、Ghostfreak True Form AF |
| 作品版本 | Eatle OV、Ripjaws OV、Heatblast OV、Heatblast UA、Ultimate Spidermonkey OV、Ultimate Echo Echo OV、Chromastone OV2 |
| 重启与强化 | Reboot Goop、Omni-Enhanced Stinkfly、Omni-Enhanced Heatblast |
| 初代造型 | Buzzshock OS（Ken 源帧） |

原图、显示输入、来源网址、SHA-256、版本依据、生成提示词和限制集中保存在 `assets/extra-art.json`，原字节在 `assets/source-art/`。

十张输入为未改动的社区透明 PNG。五张 AI 参考编辑为 Ghostfreak True Form AF、Reboot Goop、Omni-Enhanced Stinkfly、Buzzshock OS 和 Chromastone OV2；生成输出含细线、阴影与局部轮廓变化，不是逐像素抠图或官方透明原图。这批未新增已核实官方原画首发来源。

Buzzshock 原场景中的使用者为 Ken，采用 OS 外观槽位并保留使用者归属；另一只手臂仍按源图自然遮挡。Chromastone 采用 A New Dawn / OV2 服装版，移除肩上 Skurd 后仅对该遮挡区域作局部修补，并保留两次生成的提示词和哈希。Omni-Enhanced Heatblast 右岩炮角尖紧贴源画布；根执行者及独立复核均未见主要部件缺失或宽平截断，但该微小尖端上游完整性未知，原字节直接使用，未补造边角。旧候选收据不改写为历史通过。

低分辨率 NRG 和终极回音等输入仍保留源图分辨率；重绘并不增加原始作品细节。其余来源与具体造型差异见逐项 registry。Arctiguana OS 与 Chromastone OV1 本次取得的图片缺失或遮挡下半身，继续缺图，没有推测补全。

## 自动与浏览器验证

`preview.html` 为 **23,247,776 字节**，SHA-256 `f459538278dd68a17f3e1bf3c3b36b6fafee6420b9e2580822fce566e7700312`。

`npm test`：**58 项通过，0 失败，0 跳过**。包括全部 121 张素材的逐像素菱形包络、来源哈希、可重复合并、离线构建、选择动画中断、宿主边界与 12 项安装器检查。

[本版浏览器记录](browser-qa-v023.json) 保存了 18 张截图：390×960 逐张实看 15 张新素材的初代表盘；同尺寸查看完成版手表的 Chromastone OV2 投影；320×920 查看五个火焰人设计的转盘并实际按方向键切换，前后卡片的缩放和层次随选择变化；1280×720 查看重校准表壳的强化 Stinkfly 投影。所有所查尺寸均无页面横向溢出，未取得控制台错误或警告。临时尺寸覆盖已恢复。

显示完整指插件未额外切断已提供的源图轮廓，不证明上游画布从未裁切。宽体形态在手机菱形中较小，优先保留全轮廓。

## 安装与边界

继续使用同一个[手机安装／覆盖修复／更新入口](mobile-install.md)，不要求删除旧目录。先下载固定提交的运行文件并校验，备份后覆盖五个运行文件，保留其他文件。真实 SillyDroid 手机安装、ST 1.18/1.19 加载及用户美术验收未完成。浏览器尺寸模拟和本地临时目录测试不替代真机。

`driverAccepted = false`，`allSilhouettesComplete = false`；剩余 **103** 条素材待补。

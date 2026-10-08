# 0.2.4 交付验证记录

新增 35 张素材，目录仍为 224 条记录，已有剪影从 121 增至 **156**，待补从 103 减至 **68**。本版同时修复透明调色板 PNG 的导入限制，并提高手机安装器的运行文件容量；表壳和选择动画沿用上一版。

## 新增范围

| 范围 | 条目 |
|---|---|
| 重启版 | Jetray、Surge、Way Big、未来 Ben 使用的 Spidermonkey 与 Buzzshock |
| Omni-Naut | Heatblast、Humungousaur、Jetray、Shock Rock |
| Omni-Enhanced | Cannonbolt、Diamondhead、Four Arms、Grey Matter、Wildvine |
| Omni-Kix | Cannonbolt、Diamondhead、Four Arms、Heatblast、Humungousaur、Jetray、Rath、Shock Rock、Slapback |
| Antitrix | Bashmouth、Dark Matter、Humungoraptor、Quad Smack、Rush、Thornblade |
| 融合及版本 | Humungoopsaur、OV 11 岁与 16 岁 Clockwork、4 岁 Heatblast、Mad Diamondhead、Mad Rath |

28 张输入保留社区转载 PNG 的原字节。7 张 AI 参考编辑为 Humungoopsaur、Reboot Spidermonkey、Reboot Buzzshock、Clockwork OV11、Heatblast age4、Mad Rath、Humungoraptor；编辑改变了细线、阴影或局部轮廓，不能称为逐像素抠图或官方透明原图。这批没有新增已核实的官方原画首发来源。原始图、显示图、网址、SHA-256、完整生成提示词和逐项限制保存在 `assets/extra-art.json` 和 `assets/source-art/`。

Weebly 页面实际章节与相邻标题用于核对重启版、强化、装甲和未来使用者的归属。Humungoopsaur 原转载标题错误地写成巨大化 Humungousaur，采用实际绿胶融合身体、斜肩带与悬浮投射器判别，未冒称艺术家首发稿。身体、作品版本和使用者记录不能直接计为不同物种。

部分原生画布紧贴尖端，未见主要部件宽平截断；上游完整画布仍未知。Rush 的小速度线保留。低分辨率原场景经参考编辑并不会增加原作细节；自然遮挡的肢体没有补画。Skunkmoth 翼截边及本轮仅取得半身画面的候选继续待补。

## 自动检查与浏览器

`preview.html` 为 **41,801,101 字节**，SHA-256 `c6cb00237fa0e9fff89549d1227b0de5016285c9409811e7c71d4c88b690e8bf`。

`npm test`：**62 项通过，0 失败、0 跳过**。覆盖全部 156 张素材的逐像素菱形包络、来源哈希、重复合并、离线构建、动画中断及手机安装器。Omni-Kix Heatblast 使用 8 位调色板加 tRNS 透明度，现可保留原 PNG 直接嵌入；新增回归确认透明度可正确计算且无透明度的调色板输入仍被拒绝。

[浏览器记录](browser-qa-v024.json) 包含 39 张截图：390×960 实看全部 35 张新剪影的初代表盘和一张完成版投影；320×920 实际按方向键切换装甲形态转盘，前后卡片的位置和比例随选择变化；1280×720 查看重校准表壳的强化 Wildvine 投影。所查尺寸均无页面横向溢出，控制台未取得错误或警告。临时尺寸覆盖已恢复。

透明 PNG 在原图查看器中显示的部分色块实际为 alpha 0；当前浏览器未显示这些背景矩形。完整显示指插件没有额外截断输入轮廓，不证明上游画布从未裁切。宽体和长姿态在窄菱形中会较小。

## 手机安装与待验收边界

继续使用同一个[手机安装／覆盖修复／更新入口](mobile-install.md)，无需手动删除旧目录。新预览超过旧 32 MiB 上限，运行文件上限调整为 **64 MiB**；提交信息 256 KiB、文件树 2 MiB 的上限未变。下载仍固定到同一提交并检查文件大小、Git blob 哈希及入口；通过后才备份并覆盖五个运行文件。

15 项安装专项包含合法 64 MiB 包、响应声明超限、无声明或错误声明时实际流超限、失败不写入、重复运行、残留修复和回滚。64 MiB 是单文件容量，不是安装进程内存峰值。真实 SillyDroid 手机安装、ST 1.18/1.19 加载和用户美术验收尚未完成。

`driverAccepted = false`，`allSilhouettesComplete = false`；剩余 **68** 条继续补图。

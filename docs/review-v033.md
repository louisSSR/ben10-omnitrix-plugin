# 0.3.3 界面更新验证记录

本版只修改 UI，没有新增 Ultimate Way Big 或其他素材。覆盖保持 **175/224 条已有剪影、49 条待补**；记录包含作品版本、融合和身体状态，不是独立物种数。179 张旧运行图片已逐文件比较 HEAD、当前运行清单和磁盘的 SHA-256，全部原字节保持不变。

搜索与筛选条件现在明确显示，并提供恢复全部 224 条记录的入口，避免上次搜索残留导致只看到 1/224。环形转盘以手表中心为原点，选中在 12 点；横半径与 CSS 共用 `min(220px, 容器宽度×0.34)`，纵半径为其 0.8 倍，极窄容器保留图标边界保护。图标保持正向，背面 0.70 倍、选中 1.25 倍。

菱形盘改为常驻两瓣：开口收腰成沙漏，两瓣覆盖整屏后交换剪影，再交叉旋转展开。动作 760ms，完全遮盖且停在同一角度的区间为 228–418ms，342ms 换影；全局采用线性时间，各段单独缓动，避免换影时提前露出。这些参数是交互设计推演。本轮根代理在[用户提供的视频](https://www.bilibili.com/video/BV1MRGwzqEJE/?t=33)约 33.476 秒实际看到黑色盘片中部的小绿色开口，仍未连续捕获完整英雄切换，不能宣称轨迹或时长已经原作验证。此前观察边界见 [表盘参考](dial-animation-reference.md)。

投影使用水平手表、升起圆形表芯、多层光面与视差，属于 **2.5D 展示**，不是完整 3D 模型。Ultimatrix 手机布局单独适应方位。四张表壳仍沿用已有 AI UI 美术，没有更换为已认证官方原画；参考图和网页重绘的边界见 [表型参考](watch-generation-reference.md)。

最终 `npm test` 为 **93/93 通过、0 跳过**。[构建记录](build-receipt.json)中的预览为 270,678 bytes，SHA-256：`bb69b301cbdaa36ff8bb985319d037a5d7b713d5a1beffbb99cd8d36e997e2a3`。

[本轮浏览器记录](browser-qa-v033.json)验证了目标宽 390 / 320 / 1280px 的 iframe，实际客户区宽为 375 / 305 / 1265px，均无横向溢出。手机宽度下，转盘与菱形盘的“下一形态”都从 Heatblast 切至 Wildmutt；四代表壳投影和 Ultimatrix 表盘截图经独立实际目检。搜索恢复通过 Enter 激活，实际从 1/224 恢复为 224/224，查询为空，并已保存对应截图。

生产预览 tab 未记录 error；QA harness 出现 3 条 `MutationObserver.observe` 非 Node 错误，来源未定，因此不宣称所有控制台均干净。

手机安装器本轮没有修改，首次安装、原目录覆盖修复和更新仍使用[同一公开命令](mobile-install.md)，无需删除旧目录。真实 SillyDroid 手机安装、真实 ST 1.18 / 1.19 加载与用户验收仍未完成：`realPhoneValidated = false`、`realSillyTavernValidated = false`、`driverAccepted = false`、`allSilhouettesComplete = false`。

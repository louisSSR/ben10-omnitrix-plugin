# 0.3.4 素材更新验证记录

本版新增四项：Ultimate Way Big、Gwen 10 OS — Heatblast、Gwen 10 OS — Diamondhead、Shock Blast。当前 **179/224 条已接入、45 条待补**；条目包含作品版本、融合和身体状态，不等于独立物种数量。旧 179 张运行图片逐文件 SHA-256 不变，新增 4 张，运行图片现为 183 张。

终极超巨人依据 [Cartoon Network Korea 动画](https://www.youtube.com/watch?v=zXas_T4N6cI) 118.502343 秒的迎面挥拳，只保留可见动作轮廓；没有补画自遮挡的腿脚。小玟火焰人依据 [CN Asia Part 1](https://www.youtube.com/watch?v=WZf44kZPXQY) 90 秒的举手站姿，钻石战神依据 [CN Asia Part 2](https://www.youtube.com/watch?v=p8Ufg8oe0_o) 101.978243 秒的跪姿。

Shock Blast 依据 [Somewhat Gaming Channel 游戏实录](https://www.youtube.com/watch?v=GQq3OK7ed90) 15.26213 秒的命名面板：右侧动作身体和左下重复人物的完整火焰头部联合提供参考。该上传者不是官方频道；输出为参考重绘，不是无损拼接或官方透明图。四项的细节均含 AI 重绘，具体来源、提示词、SHA 和差异保留于 assets/extra-art.json。

根代理实际查看四项来源和输出，并在本地浏览器检查黑色菱形盘与投影。小玟两形态和 Shock Blast 在目标宽 390 / 320px 的 iframe 核对，实际客户区宽 375 / 305px，无横向溢出；动作轮廓完整，没有可见的独立背景黑块。终极超巨人以桌面浏览器目检，不冒充真实手机核验。所有已接入形态均有逐项透明像素适配记录。

三种 UI 保留 0.3.3 的实现，详见 [界面验证](review-v033.md)：居中转盘、闭合后换影的交叉挡片、水平手表与升起表芯。投影仍为 2.5D，不是完整三维模型；参考视频尚未完整捕获的切换时序不因此变成已验证事实。

最终 npm test：**93/93 通过，0 跳过**。预览 SHA-256：`e7ba890462bed6cbabdb52ac563d57bd2c7c672e35c3fefa1aa80a7a85947c9a`，272826 bytes。运行包 188 文件（另有 runtime-manifest.json）。截图与尺寸见 [浏览器记录](browser-qa-v034.json)。生产预览 error 记录为空，手机测试壳出现 1 条未定位来源的 MutationObserver.observe 错误，因此不宣称全部控制台干净。

交付预览已清除搜索及只看已有剪影筛选，恢复 224/224 条档案。安装器未修改，手机继续使用 [同一个覆盖修复／更新入口](mobile-install.md)，无需删除旧目录。未实际在 SillyDroid 手机或 ST 1.18 / 1.19 安装验证，未宣称用户验收，也未宣称全部剪影完成。

附带修复已存在的来源校验问题：fit-dial 写入最终目录后，现在同步 provenance.catalogSha256；重复导入与静态资源测试均检查这个最终字节校验值。

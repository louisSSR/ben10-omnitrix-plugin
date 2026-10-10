# 0.6.2 九个头像增补

头像覆盖从 38 条增至 47 条，资源从 34 个增至 43 个。新增 Jetray、Snare-Oh、开花状态 Swampfire、Four Arms、XLR8、Cannonbolt、Echo Echo、Humungousaur、Armodrillo。236 条目录与 235 张全身剪影保持，不自动扩展到其他作品版本或佩戴者。

前三个头像来自用户提供的第三方 DNA Altering 3.5.0 原始 WebP，经逐项对照后保留原字节；不是三星官方资源。Snare-Oh 的包裹线条等属于应用图标的简化表达。开花 Swampfire 只绑定对应身体状态。

其余六张通过内置 imagegen 参照已核对的角色图制作，原生 1254×1254 RGBA 文件不做像素后处理。面部比例、灰阶、边缘细节含重绘变化。Cannonbolt 保留上部两侧甲片作为图标框架；Echo Echo 将侧视参考转为正面；Humungousaur 鼻孔、颊线有解释性重绘和边缘噪点；Armodrillo 的源图较小，部分脸部细节属于 AI 解释。它们不是官方透明原画。

| 头像输出 | 完整生成提示词 |
| --- | --- |
| [Four Arms](../assets/portraits/reference-four-arms.png) | [提示词](prompts/four-arms-head.txt) |
| [XLR8](../assets/portraits/reference-xlr8.png) | [提示词](prompts/xlr8-head.txt) |
| [Cannonbolt](../assets/portraits/reference-cannonbolt.png) | [提示词](prompts/cannonbolt-head.txt) |
| [Echo Echo](../assets/portraits/reference-echo-echo.png) | [提示词](prompts/echo-echo-head.txt) |
| [Humungousaur](../assets/portraits/reference-humungousaur.png) | [提示词](prompts/humungousaur-head.txt) |
| [Armodrillo](../assets/portraits/reference-armodrillo.png) | [提示词](prompts/armodrillo-head.txt) |

## 验证

- 完整自动测试 142/142 通过。打包器新增参考图路径、文件类型与哈希核验，拒绝符号链接和父目录 junction；独立运行 8 个打包正反例，8/8 通过，包括与旧 supplemental 共用原图时只打包一次。
- 在实际页面逐项点选全部 9 个新增绑定，确认选中头像与形态匹配。清除搜索后显示 236 条目录、235 个可切换形态；原有资源字节保持。
- 实看全部 6 张重绘头像的小尺寸转盘表现，完整头部可见；Humungousaur 的原生噪点在该显示尺寸不显著。桌面实看绿色和橙色，窄屏实看橙色和粉色。
- 桌面内容宽 1265px；375px/305px 固定嵌入框内的实际内容宽度为 360px/290px，无横向溢出。该证据只证明窄屏渲染，不证明物理手机触控或 SillyDroid 安装。
- 桌面和嵌入预览控制台均未记录 warn/error。截图和构建哈希见 [浏览器记录](browser-qa-v062.json)。

## 剩余范围

189 条已登记形态仍缺独立头像；Crabdozer 仍缺全身图。目录尚未穷尽全作品，原未来 Kevin 11,000 与 Ultimate Aggregor 仍是待核对的混合形态线索。没有把搜索线索或视频少量采样当作完整素材。

用户提供的 Omniverse 模型包已核对为第七组既有素材：单个 STL 内排布打印零件，含真实厚度，仍需拆件装配、材质与动画。没有把它计作第八款成品手表。实机手机、真实酒馆、用户视觉接受、三维角色投影均未完成；本轮不修改表壳与动画实现。

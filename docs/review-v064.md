# 0.6.4 UA 头像与 Ultimate Aggregor

新增 12 张头像、12 条指定形态绑定，以及 Ultimate Aggregor 的一条混合形态记录和全身素材。当前 237 条目录、236 张全身素材、66 个头像资源、72 条头像绑定、165 条头像待补。原有 236 条记录、235 个身体符号、54 张头像原始字节和 60 条绑定逐项保持。

## 素材与版本

新图使用内置 imagegen；原生 RGBA 文件直接复制，没有程序抠图、调色或其他像素后处理。绿色、橙色、粉色通过运行时色彩矩阵显示。源图、输出哈希、绑定理由与差异在 [头像登记表](../assets/portraits.json)。

| 头像 | 版本与说明 | 原生图片 | 完整提示词 |
| --- | --- | --- | --- |
| Frankenstrike | 经典；小参考图脸部有放大解释 | [PNG](../assets/portraits/reference-frankenstrike.png) | [提示词](prompts/frankenstrike-head.txt) |
| Eye Guy | 保留头部无眼设计，未把胸眼放在头上 | [PNG](../assets/portraits/reference-eye-guy.png) | [提示词](prompts/eye-guy-head.txt) |
| Murk Upchuck | 独立于 Perk；首版圆耳状突起经内置编辑修正为短角状突起 | [PNG](../assets/portraits/reference-upchuck-murk.png) | [提示词](prompts/upchuck-murk-head.txt) |
| Waterhazard | UA；壳缘正面化并有展开解释 | [PNG](../assets/portraits/reference-waterhazard.png) | [提示词](prompts/waterhazard-head.txt) |
| Ampfibian | UA；纹理合并为适合小尺寸的线条 | [PNG](../assets/portraits/reference-ampfibian.png) | [提示词](prompts/ampfibian-head.txt) |
| Fasttrack | UA；头角与面部完整保留 | [PNG](../assets/portraits/reference-fasttrack.png) | [提示词](prompts/fasttrack-head.txt) |
| Clockwork | UA 实心半圆钥匙，不用 OV 双孔钥匙 | [PNG](../assets/portraits/reference-clockwork.png) | [提示词](prompts/clockwork-head.txt) |
| Chamalien | UA；三眼保持分区，改为可换色灰阶 | [PNG](../assets/portraits/reference-chamalien.png) | [提示词](prompts/chamalien-head.txt) |
| Eatle | UA 长角造型，与 OV 版分开 | [PNG](../assets/portraits/reference-eatle.png) | [提示词](prompts/eatle-head.txt) |
| Juryrigg | UA 无帽造型 | [PNG](../assets/portraits/reference-juryrigg.png) | [提示词](prompts/juryrigg-head.txt) |
| Shocksquatch | Heroes United 白毛与侧面圆件，不混用 OV 黄色头型 | [PNG](../assets/portraits/reference-shocksquatch.png) | [提示词](prompts/shocksquatch-head.txt) |
| Ultimate Aggregor | 官方帧头部参考；四角、长发与黑眼周；角和毛束有对称化解释 | [PNG](../assets/portraits/reference-ultimate-aggregor-amalgam.png) | [提示词](prompts/ultimate-aggregor-amalgam-head.txt) |

Clockwork 和 Juryrigg 的眼口亮区很小，使用实际亮区的亮度中位数；Fasttrack 和 Waterhazard 使用 P98，其余使用 P90。统计只读取像素，不改变原图。

## 新混合形态

Ultimate Aggregor 归入 `fusion`。其 Ultimate 名称表示吸收五位外星人的混合状态，不是 Ultimatrix 进化或新增物种。身份依据 [官方录音剧本](https://dwaynemcduffie.com/wp-content/uploads/2024/07/WEBSITE-B10UA-ep110-Ultimate-Aggregor-SCRIPT-AS-RECORDED.pdf)；头角、脸、头发、领口、胸甲与部分上臂对照实际查看的 [官方动画 20:42 画面](https://www.youtube.com/watch?v=SHLCviTXw34&t=1242s)。

全身姿态、前臂、手爪、腰腿和脚部另参考 [SasakiToon 社区全身绘稿](https://www.deviantart.com/sasakitoon/art/Ben-10-Ultimate-Alien-Ultimate-Aggregor-993777495)，仍有 AI 解释，不能称为官方完整原画。社区原图含独立作者头像，来源图原字节保留；生成角色不含该独立头像。[原生全身 PNG](../assets/source-art/ultimate-aggregor-amalgam-reference-edit.png)、原始参考与身体完整提示词见 [extra-art 登记表](../assets/extra-art.json)。

图像查看工具曾显示 alpha 为 0 的隐藏彩色 RGB，误以为有光晕。已用棋盘和深绿背景的真实浏览器合成纠正判断；采用首版原字节，未使用后续非必要清理候选，也未阈值化 alpha。

## 验证

- 142 项自动测试通过，无失败或跳过；身体透明边界参与既有菱形适配计算。
- 12 张新头像均实际在转盘选中查看，并核对选中 ID 与头像绑定。
- 新身体在桌面与手机宽度的菱形盘、投影和头像转盘中实际检查；角、手、脚完整显示。
- 1265×900、375×900、305×900 视口下，实际文档宽 1250、360、290px，无横向溢出。三种配色实看，控制台无警告/错误。临时视口已恢复。
- 旧素材原字节与原绑定保留；打包脚本未改，复用通过相同脚本哈希验证的 8 项引用安全用例。运行文件与最终包另做实际清单和字节核对。

[机器验证记录及 7 张截图](browser-qa-v064.json)。浏览器视口检查不等于物理触控、SillyDroid 安装、真实 SillyTavern 或用户验收。

## 剩余范围

165 条已登记形态仍缺头像，Crabdozer 仍缺全身素材，目录仍不能称为跨媒体穷尽清单。Terraspin 头像生成被工具安全系统拒绝，无输出，未重试或改用其他路线；既有身体保留。此前 Crabdozer、Nanomech 与 AF Big Chill 的受阻生成仍停止。

最新 Omniverse ZIP 与已归档第七包字节完全相同；其网格连通组件不代表可动装配零件。该打印模型仍在独立查看库中，本版没有把它宣称为正式手表成品。

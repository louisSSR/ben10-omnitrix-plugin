# 0.6.3 经典版与 Alien Force 头像

新增 11 张头像，显式绑定 13 条形态。现为 54 个头像资源、60 条绑定；236 条目录及 235 张全身剪影保持。三个 Skurd 神力暴龙状态使用本轮根据 OV 动画头型重绘的同一头像，与旧 AF 宽低吻头像分开。

本批均由内置 imagegen 参照实际查看的角色原图制作，保留工具原生 1254×1254 RGBA 字节。没有进行程序抠图或像素后处理，也不称为官方透明原画。源图、哈希与绑定理由在 `assets/portraits.json`。

| 头像输出 | 完整生成提示词 |
| --- | --- |
| [Ripjaws](../assets/portraits/reference-ripjaws.png) | [提示词](prompts/ripjaws-head.txt) |
| [Ghostfreak](../assets/portraits/reference-ghostfreak.png) | [提示词](prompts/ghostfreak-head.txt) |
| [Wildvine](../assets/portraits/reference-wildvine.png) | [提示词](prompts/wildvine-head.txt) |
| [Buzzshock](../assets/portraits/reference-buzzshock.png) | [提示词](prompts/buzzshock-head.txt) |
| [Arctiguana](../assets/portraits/reference-arctiguana.png) | [提示词](prompts/arctiguana-head.txt) |
| [Perk Upchuck](../assets/portraits/reference-upchuck-perk.png) | [提示词](prompts/upchuck-perk-head.txt) |
| [Chromastone](../assets/portraits/reference-chromastone.png) | [提示词](prompts/chromastone-head.txt) |
| [Brainstorm](../assets/portraits/reference-brainstorm.png) | [提示词](prompts/brainstorm-head.txt) |
| [Spidermonkey](../assets/portraits/reference-spidermonkey.png) | [提示词](prompts/spidermonkey-head.txt) |
| [Lodestar](../assets/portraits/reference-lodestar.png) | [提示词](prompts/lodestar-head.txt) |
| [Humungousaur OV](../assets/portraits/reference-humungousaur-ov.png) | [提示词](prompts/humungousaur-ov-head.txt) |

## 视觉差异

- Wildvine 保留头周的两片捕蝇草叶框；Arctiguana 使用已登记社区绘稿作参考，触须、额角经过夸张，不作为官方精确解剖图。
- Ghostfreak 下巴更尖长；Ripjaws 眼睛、灯饵和牙齿放大；Buzzshock 参考 Ken 的经典版动画头型，只支持该版造型，不新增佩戴者身份断言。Perk 保留长椭圆头和侧疙瘩，没有替换成 Murk 头型。
- Chromastone、Brainstorm、Lodestar 的小尺寸原图被放大解释；Spidermonkey 毛缘更蓬松。OV Humungousaur 转为正面图标，额纹、嘴线和下巴有所简化。
- 原生渐变与低透明度边缘保留。Brainstorm 和 Lodestar 的亮眼区域不足 10%，浅色校准采用不透明像素亮度 P98，避免机械使用 P90 把底灰当成亮色；只改变显示参数，没有修改 PNG。

## 验证

- 自动测试 142/142 通过，未修改 Core、UI 逻辑、表壳实现或宿主适配。
- 在实际预览逐项点选全部 13 条新增绑定，并实看全部 11 张新头像的小尺寸转盘显示。全部头部主体完整，绿、橙、粉配色正常；无 warn/error。
- 通过浏览器视口功能测试桌面 1265×900、手机宽度 375×900 和 305×900；实际文档宽分别为 1250、360、290px，均无横向溢出。测试结束已恢复视口。该结果不代表物理触控、SillyDroid 安装或真实酒馆验收。
- 截图与构建哈希见 [浏览器记录](browser-qa-v063.json)。本轮打包器未变，引用前轮同哈希打包器的 8/8 正反例证据；当前实际包另行核对文件哈希与真实移动安装器的 `validateRuntime`。

## 剩余范围

176 条已登记形态仍缺头像，Crabdozer 仍缺全身素材。Nanomech 与 AF Big Chill 的本轮生成被工具安全系统拦截，未取得输出，未改词重试或换途径绕过；它们的既有全身素材保持。

Ultimate Aggregor 已核对官方完整动画的头部和胸甲特写及官方剧本，但未取得本轮可用的官方完整全身帧；社区绘稿只作为辅助参考。原未来 Kevin 11,000 仍待完整身体证据。两者均未作为本轮新目录项导入，236 条不是全作品穷尽清单。

再次上传的 Omniverse ZIP 与此前第七组素材逐字节一致，包含 288,908 个三角面，具有真实厚度，但仍是打印摊件，未装配、赋材质或绑定动画。它已在独立模型查看库中；公开插件仍使用程序生成的表身，没有把此 STL 宣称为已接入成品。狂班/小文独立表壳、角色三维投影、实机手机和用户视觉接受仍未完成。

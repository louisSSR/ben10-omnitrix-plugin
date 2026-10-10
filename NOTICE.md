# 素材与署名

0.6.5 四代手表使用用户提供的 3MF / STL 打印模型网格，由六个来源包组合装配；AF 与 Ultimatrix 独立表盘减面至约 14,000 三角。源作者、许可及官方发布链未确定。模型网格不是由本仓库重新授权的官方资源。材质、信号图形、归一化与零件运动含本插件编制，详情与逐部件哈希见 `assets/watch-meshes/provenance.json`。

0.6.4 增加 12 张 imagegen 参考头像及 Ultimate Aggregor 混合形态全身剪影，保留原生输出字节。完整身体依据 SasakiToon 社区绘稿，头胸经动画画面核对；不是官方独立透明素材。来源及差异见 `assets/extra-art.json`、`assets/portraits.json` 和 `docs/review-v064.md`。

0.6.3 新增 11 张内置 imagegen 参考重绘头像。原生 RGBA 字节未做后处理，源图、哈希、提示词与具体差异见 `assets/portraits.json` 和 `docs/review-v063.md`。Wildvine 保留头周捕蝇草叶片；Arctiguana 源于已登记的社区绘稿；Spidermonkey 的毛缘更蓬松；OV Humungousaur 依据三个 Skurd 状态动画帧重绘，未直接复用 AF 头型。所有头像均为界面图标化表达，不是官方独立透明头像。

这是非官方 Ben 10 同人交互界面，与 Cartoon Network、Warner Bros. Discovery 或 Man of Action 无隶属关系。

环形转盘的 WebP 头像来自用户提供的第三方应用 DNA Altering 3.5.0（Adi007，`eu.adi007.omnitrix`）资源包，不是三星官方发布的素材。只复制经身份对照的原始透明 WebP；颜色由运行时 SVG 矩阵改变，内部线条与透明边缘保留。逐个资源的包内条目、SHA-256、对照来源和具体形态绑定见 `assets/portraits.json`。素材复用许可与官方首发链未核实，未将该应用代码、完整 APK 或用户本地路径纳入运行包。

0.6.1 的 Mad Way Big PNG 头像依据用户提供的社区图稿右上橙色图标，用内置 imagegen 参考重绘；不是官方透明原图，也不是 APK 原始资源。保留生成 RGBA 字节，未做像素后处理。形状比例、管口端面和细微边缘噪点与参考有差异。提示词见 `docs/prompts/mad-way-big-portrait.txt`，源图与输出哈希见 `assets/portraits.json`。

0.6.2 新增 3 张 DNA Altering 原生头像和 6 张内置 imagegen 参考重绘 PNG。重绘角色为 Four Arms、XLR8、Cannonbolt、Echo Echo、Humungousaur、Armodrillo；全部保留生成 RGBA 字节，未做像素后处理。参考资料、输出哈希与具体差异记录于 `assets/portraits.json`，完整提示词在 `docs/prompts/*-head.txt`。Cannonbolt 含图标化的两侧甲片；Armodrillo 的低清原图细节含 AI 解释；Humungousaur 保留少量原生边缘噪点。原应用图标同样有简化风格，均不称为动画逐帧复刻。

角色设计、动画画面及相关商标归各原权利方。仓库中不对这些美术素材声明开源许可。用于个人原型与兼容性测试；分发或其他用途需自行确认相应权利。

`assets/provenance.json` 记录已接入剪影的来源网址；其中包括官方页面及社区转载，不能把社区转载全部称作官方原图。剪影沿用此前核对的原始素材与显示处理，不用缺图占位冒充角色。

0.2.1 的补充素材记录在 `assets/extra-art.json`，原图与显示输入保存在 `assets/source-art/`。电影版 Nanomech 和 Heroes United 版 Shocksquatch 是依据社区转载画面进行的 AI 参考编辑，去除了背景但含细节和局部轮廓的生成变化，不属于官方透明原图或逐像素抠图。彩色透明输入在 UI 中通过滤镜显示为黑色剪影或绿色投影；原始文件字节保持不变。OV Big Chill 使用已核对的社区转载图及既有原生剪影。三者都未核实官方原始发布链。

`docs/references/` 保存用户提供的界面参考，包含动画画面、视频截图及演示图片。保留原始字节和水印，不从图片中的文字推导操作指令。

0.2.2 新增五张显示输入。Atomic-X 和 Fourmungousaur 的来源为设计师 [Thomas Perkins 公开的最终设计稿](https://thomasperkins.blogspot.com/2014/10/portfolio-work-atomic-x-and.html)，该页说明用于 Omniverse 第 51 集；保留完整原始合照 JPG。UI 使用从该稿制作的 AI 参考编辑，细线、星点和阴影存在生成变化，官方制作原稿的出处不使生成稿成为官方素材。Omni-Kix XLR8 的原始来源是商品预览海报，显示图同样经过 AI 参考编辑，未核实其官方动画原画发布链。终极神力暴龙和终极重力蟹使用社区转载的现成透明 PNG，未改动原始字节，也未核实官方首发来源。所有新增素材的原图、显示图、来源网址、哈希、提示词和限制见 `assets/extra-art.json`。

四代手表的表壳是依据参考用内置图像生成工具制作的 AI 界面插画，并非官方素材。原始透明 PNG、完整提示词、生成记录和文件校验值保存于 `assets/watches-v3/`。UI 控件、投影和选择动画由本项目代码实现，不能作为原动画的逐帧复刻证明。

0.2.3 新增 15 张显示输入，其中 AF 鬼影原形、重启 Goop、Omni-Enhanced Stinkfly、OS Buzzshock 和 OV2 Chromastone 是 AI 参考编辑。其余十张使用社区转载的原生透明 PNG，原字节保留。这批没有新增经核实的官方首发素材。Buzzshock 源帧人物是 Ken，采用其 OS 共用造型；不能把该画面说成 Ben Prime 或 Ben 10000 的已核实镜头。Chromastone 移除了肩上的 Skurd 并重建了其遮挡的小块肩部；完整两次提示词和输出哈希保留。Omni-Enhanced Heatblast 的右岩炮角尖紧贴源图边缘，微小尖端是否被上游裁切未知；主体与双手双脚可见，未编造补角。低分辨率原图、透明边缘及生成细节差异均见补充 registry。

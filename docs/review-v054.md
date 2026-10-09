# 0.5.4 手表形体、Ripjaws 身份与 Skurd 晶臂

当前 **236 条记录、235 条已接入剪影、1 条已登记缺图**。本轮修正并补齐既有 reboot-ripjaws，另新增 Kickin Hawk 的 Skurd 钻石臂身体状态；记录不等于独立物种，完整作品范围仍未穷尽。

## 手表形体与本轮边界

- 四代腕带从等截面椭圆旋转体改成有独立横截面曲率、上肩扩展及中部冠高的实体放样；内腔和外沿随同一表面连续，保留真实厚度。
- 初代和 AF 的固定表座改为有斜肩与曲面过渡的闭合轮廓；初代四条护架加宽并缩短下垂段，末端向腕带落座，数量与物理侧向不变。
- UA 的平盒上罩改成有收圆端头和真实弯曲顶面的实体护臂；侧嵌板随腕带曲率贴合，两根独立管的 X/Y 路径保留、Z 深度随同一腕面改变，保留各自接头。
- OV 的盖、托台共用有折脊的坡面，绿盖与黑盖都有实体侧厚，尖端略收短，保持原左右盖分组及既有滑移行程；固定折面托座挖出真正的圆形芯井，避免收芯后实体遮住表盘。
- AF 与 OV 的最上唇边分别保留深蓝黑与黑色，以区别各代面圈。
- 实际前后图复核后，初代改为固定深灰宽外圈与四灯、较窄的中央独立升芯、竖向绿槽及窄银唇；表盘锚点同步到新的实体芯。
- 初代银爪增加暗色接合座。其它三代保持本轮放样候选，模型相机与事件驱动渲染生命周期未改；投影退化角度另有下述修复。
- 增强材质主光与金属反射层次，保留橡胶暗面；没有增加贴图、依赖、绘制批次或空闲动画循环。
- 修复圆/近圆表盘无唯一主轴时浮点误差导致英雄横转：根代理先在旧构建实看初代横躺，隔离计算亦复现 a=90°，采用相对容差后同条件 a=0°。其余模型几何、材质、相机和渲染循环保持，最终构建已实看桌面与两种窄屏：表盘英雄直立，切换和几何显示正常。
- 圆/近圆椭圆的相对特征值间距不超过 trace 的百万分之一时固定 a=0，避免浮点符号触发无意义的 90 度主轴。

- 截面曲率、冠高、护架准确宽度/落点、隐藏内腔/搭接和盖片侧厚属于建模解释。初代/AF 的主要可见设计有文档已核对官方片段依据，UA 仍为非官方托管参考，OV 为发布链未闭合的制作稿转载。
- 没有将 AI 图集中的固定四灯/较小初代中心升芯、额外槽纹、螺丝或未知隐藏机构直接提升为官方结构。
- OV 保持既有左右滑开规则，没有证明官方连续开盖机械路径；折面和真实芯井不能替代原作动作核验。
- 接触关系主要通过几何处理；本轮没有实现真实动态软阴影、屏幕空间 AO、折射或完整角色三维模型。
- 新增遮挡检查为闭合态、正上方的表盘内部 90% 半径内每代 49 个采样点，不等于所有三角面的相交检测或连续动作全遮挡证明。
- 初代较窄升芯、固定四灯、竖槽与接缝是按用户要求向既有插画靠拢的美术解释，未证明为原作机械路径或精确尺寸。
- 反射、暗面仍为局部灯光近似，没有真实动态投影或环境遮蔽；不能据此宣称已达到插画全部精细度。
- comparisons保留早期形体/材质比较，最终修复构建的22幅画面另见本版 browser-qa-v054.json；浏览器证据不等于真实手机或用户接受。

原始模型 f7cd07a3d42e5a7c00eeee7e5c19cdf2faa2448087991b644baf814a96cdc56f；实体候选 7ab76fa0691bbef93ee46d4b49fc5c0476140eb332ba2353ab60c059027026bd；实际验证模型 ef0f5fd6f46413e0f76cde88229309d7ba634ac9291d37e1073066dec5c6387b。原作可见结构与建模解释仍见 [来源约定](watch-model.md)，旧 AI 图集不升级为官方尺寸或机制证据。

## 身份修正与两份图片

Ripjaws 保持原有 ID 与 reboot 分组，使用者/剧集身份说明改为：Ben 10 (2016 reboot), Alien X-Tinction (2021). Alternate Gwen 10 uses this Ripjaws design; community footage transformation continuity observed. Distinct version representation, not a new species. 身份修正通过 extra-art 的 before/after 七字段契约进入重导入流程，不只修改生成目录。原始快照和旧版本记录保留；来源为社区上传的连续变身画面，不能改称官方上传。

### Ripjaws

[保留的画面来源](https://www.youtube.com/watch?v=19JIOioADxQ&t=28s)。登记未将该上传来源认证为官方发布。透明图是参考重绘，不是官方透明原图。

AI transparent reference redraw from the 28.609727-second running frame of a community-uploaded Alien X-Tinction comparison clip, supported by the same fish body at 28.100355 seconds. Root observed the human Gwen 10 to Ripjaws sequence at 27.039163, 27.760774 and 28.100355 seconds. The full existing running pose, two arms, two legs, head lure/fins, waist garment and two blue back-reservoir ends are retained. Fine face, claws, reservoir connections, fins and garment markings are interpretations of low-resolution animation screenshots. This is not official transparent artwork, an official uploader source, or exact pixel extraction.

- The source is community-posted footage displayed in an 816x459 JPEG video-region screenshot, not a native production frame or official upload. Main subject occupies only part of that picture.
- Face and tooth lines, lure tip, claw/foot divisions, small reservoir fittings and hose connections, fin geometry and waist/garment markings are AI interpretation. In particular the more explicit reservoir connector shapes are not independently resolved in the original low-resolution frame.
- The whole primary running silhouette is visible and preserved. The supporting frontal stride is detail support only; this does not claim a new aquatic body state or independent species.

### Kickin’ Hawk（Skurd 钻石臂与剑）

[保留的画面来源](https://www.youtube.com/watch?v=0sOeXKG2Lmw&t=55s)。登记已核对官方发布来源。透明图是参考重绘，不是官方透明原图。

AI transparent reference reconstruction of the actually inspected official Cartoon Network Dragon Charmcaster screenshot at 55.813333 seconds. The primary three-quarter upright upper body, swept crest, huge pale-blue crystal forearm, gripping crystal hand and separate vertical blue/violet sword are retained. The torso below the source crop, ordinary opposite hand, hips, long legs and birdlike feet are conservative AI continuation; a motion-blurred 66.149137-second jumping/back-side view of the same host guides only broad leg/foot proportions, not the exact generated stance. Fine face, fingers, badge, green coating, crystal facets and clothing/leg markings are interpreted. This is not official transparent artwork or an exact complete-body pixel extraction.

- The main source has no complete lower body. Ordinary opposite hand, torso continuation below the crop, hips, legs, foot spread and exact stance are conservative AI reconstruction. The support supplies coarse same-host proportions only.
- Face lines, finger joints, small badge, green coating patches, dark shorts and lower-leg green shapes, toes and crystal facets are AI interpretation; output cannot establish unseen canonical details.
- 长剑和前景大前臂仍占据主要构图，适配表盘时宿主身体相对较小；本轮已实看桌面、375 宽度三种模式与 305 宽度菱形表盘，保留此构图辨识边界。
- RGBA output is 1024x1536, alpha range 0–254, strong-alpha bbox [204,11,788,1525], outer edges alpha zero. Weak alpha-1–15 residue extends beyond the solid figure within the canvas. Original alpha is preserved without thresholding or cleanup.
- 根代理已独立实看来源画面与原始透明输出，并确认按原字节接入；本轮两项素材与四代手表合计 22 张当前构建截图已完成实看，工具曾出现的显示差异不再作为待确认事项。

## 验证

完整测试命令 135/135 通过，0 失败、0 跳过；一次测试过程的退出码、原始日志和输入哈希同时保留。其它 234 条旧目录、241 张旧运行图和旧素材登记不变；本阶段修改手表模型及身份合并脚本，其余五个既定 Core/UI/Host 文件冻结。后续头像环 UI 工作须另有基线和验收，不将此次冻结扩展成永久限制。

根代理实看 22 张当前构建截图：两项图各在 1265/375 宽度检查三种模式，在 305 宽度检查菱形表盘；四代手表各保留桌面/手机宽度投影画面。正常动画选择、镜头与升芯已按浏览器观察记录核验，error/warn 查询为空，无页面横向溢出。预览 SHA-256：d069f37db927d5e48605cbed2c4bba51d705fb1cfd67c5a5bba4da47f26e4fb3。

- 根代理在当前构建实际查看22幅画面；1265、375、305为浏览器页面可用宽度，未在真实手机测试。
- 已操作正常动态的形态切换、三种界面、四代手表、镜头和升芯开合；减少动态开启后下一项可切换，随后恢复正常动态。
- 手表为实体几何与近似材质；英雄全息仍为图片图层，不是角色三维模型。
- 环形界面当前仍为全身图；用户新提供XAPK的头像资料正在独立整理，本版不声称完成头像替换。
- 真实SillyTavern/SillyDroid、真实手机性能及用户视觉接受仍未验证。

逐张证据见 [浏览器记录](browser-qa-v054.json)。这是本地浏览器窄屏证据，真实手机、SillyDroid、真实 SillyTavern 与用户视觉接受未完成。新增要求的全目录头部图标及未来狂班/小文主题配色属于后续独立阶段，本轮没有实现或验收该功能。

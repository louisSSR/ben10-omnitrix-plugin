# 四代表型的动画与模型稿视觉查证

查证日期：2026-10-09。目标是复原官方平面动画的表体、表带、按钮、灯位和屏面关系。此前生成的四张 AI 表壳是生成式 UI 美术，不是官方造型证据，也不作为本次比例或结构的依据。

## 初代 Omnitrix

官方来源为 Cartoon Network UK 认证频道上传的 [Classic Ben 10 | Ben Discovers the Omnitrix | Cartoon Network](https://www.youtube.com/watch?v=JlqkvF5GudE)。检索返回上传日期 2009-10-21；本会话此前通过 CUA 浏览器实际观看，片长显示为 02:24。官方归属由上传频道及其认证信息确认，不由视频标题单独推定。

| 部件 | 实际帧证据 | 当前精度 |
| --- | --- | --- |
| 表体/表芯 | [约 01:12](https://www.youtube.com/watch?v=JlqkvF5GudE&t=72s) 看到 Ben 佩戴腕表；[约 01:17](https://www.youtube.com/watch?v=JlqkvF5GudE&t=77s) 看到中央圆形表芯升起，露出圆柱侧壁。 | 支持圆形中央模块与升起状态。不是严格正视的模型设定图，不能从这两帧给出正视轮廓的精确尺寸。 |
| 表带 | 01:12 的腕部佩戴状态可见表与手腕的关系。 | 本次没有保存足够清晰的全带正面或背面，宽度、孔位、扣具结构未量定。 |
| 按钮 | 新增官方 @Ben10 视频 [01:56.24 附近](https://www.youtube.com/watch?v=iLBivD9Pxks&t=116s) 的重校准前旧表近景，可见一个独立、较大的绿色侧面圆按钮。 | 与四个小指示点是不同构件，不能合并为一个点。斜视镜头不足以确定正视钟位。 |
| 灯位 | 上述旧表近景可见圆盘周围四个较小绿色指示点；旧 CN UK 01:17 帧还可见升起表芯侧壁的绿色竖向标记。 | 四个小点加一个大侧按钮，合计五个可见绿色圆点。不能把侧壁符号全部解释为独立灯。 |
| 屏面/外壳比例 | 可见圆形中央表芯，透视角度随动画镜头变化。 | 尚未量定。不能使用此前 AI 画布约 30% 的屏径目标作为官方比例。 |

此前用户提供的 Bilibili 社区剪辑在约 00:33 展示过两侧黑色区域与绿色沙漏状开口，但该片段原集尚未核定。本文件不把那一帧升级为官方上传证据。完整拨盘动作的观察边界另见 [dial-animation-reference.md](dial-animation-reference.md)。

## Alien Force 重校准 Omnitrix

**现已取得并实际查看官方腕表近景，AF 不再处于缺少近景的状态。** 来源为认证 [@Ben10](https://www.youtube.com/@Ben10) 上传的 [Swampfire Transformation Unlocked | Omnitrix Reconfigured | Episode 1 Ben 10 Alien Force](https://www.youtube.com/watch?v=iLBivD9Pxks)。根代理在浏览器中实际播放并保存了三个时间点，本代理随后独立用 `view_image` 查看这些截图；没有逐帧临摹或观看全部视频。

| 时间点 | 实际可见结构 | 本地截图与 SHA256 |
| --- | --- | --- |
| [01:56.24](https://www.youtube.com/watch?v=iLBivD9Pxks&t=116s) | 重校准前仍是初代旧表：圆面周围四个小绿点，另有大侧面绿按钮，深色厚表体和浅灰护件。该片段来自 AF，本文不将它标为 2005 版原集画面。 | `../.local/watch-reference/classic-official-116.png`；`7c9f368a5a0dec1c4a14aa016a46438dbecb392d1f9fd1f4541cb5842da3731a` |
| [01:59.99](https://www.youtube.com/watch?v=iLBivD9Pxks&t=120s) | 重校准后的闭合状态：绿色表带有黑色中线，深色圆形上壳，黑色盘面上的绿色沙漏标志；两侧有短的深色圆柱控制件，近侧端面明确可见绿色。下缘有银灰色弧形配件。 | `../.local/watch-reference/af-official-closed-119.png`；`bb75a033d5c3bc04a3a7e0693c3453568edb7fec16f743c38c7fe15795b4b1c4` |
| [02:03.99](https://www.youtube.com/watch?v=iLBivD9Pxks&t=124s) | 圆芯已经升起，侧壁为深色圆柱，周围有绿色符号；上表面发出白绿光，绿色 Swampfire 全息形象立于盘面上方。绿色带、黑中线和侧边控制件仍可见。 | `../.local/watch-reference/af-official-holo-123.png`；`174c9c74626bb5ff319e72bd35e01c633ee43f7f47172c417ffdbf48d6c032d1` |

三张截图均为 1265×712 的完整浏览器画面，分别为 128,197、124,726、132,304 bytes。闭合近景明确支持较紧凑的深色圆面、绿带黑中线和侧向圆柱控制件；四小环灯是旧表的结构，不能搬到 AF。盘面占上壳大部分，但这两张 AF 近景是透视画面，仍未量定严格俯视直径比例、全带展开长度或背面扣合结构。升起/全息截图证明这一状态的外观，不证明完整升起速度、面盖运动路径或动画时长。

此前另查到 [Primus 官方片段](https://www.youtube.com/watch?v=aaPfzdq7fCQ)、[Singlehanded 官方片段](https://www.youtube.com/watch?v=RkoLWOgtdWg) 和 CN UK [五代首集合集](https://www.youtube.com/watch?v=CsRAPSNq-Mg)。这些保留为辅助入口；本文件的 AF 结构结论绑定上表三张实看截图，而非这几页未显示腕表的缩略图。

## Omniverse：带制作字段的模型稿镜像

社区转载页为 [@Ben10protector 的 X 帖子](https://x.com/Ben10protector/status/1831392265149018138)，根代理从公开检索取得并普通 HTTP 下载了[实际 JPG 地址](https://pbs.twimg.com/media/GWppjocW8AAegif.jpg)。本代理已用 `view_image` 实际查看本地原图 `../.local/watch-reference/ov-model.jpg`，712×542、59,587 bytes，SHA256：`7f422f3d625a609bf426a8d78656e80f7083f7d7314aa2c6e84036f595cd110f`。

图内制作栏可读：Cartoon Network Studios 标头、《The More Things Change, Pt. 1》、集号 1010-001、模型名 TEENAGE BEN OMNITRIX、道具 ID P001S059A_053、场次 059a、页码 117a；另有 Day Colors、FINAL 和 2011 年版权行。这些是图内实际可见的制作标记，支持把它作为带明确制作标记的模型稿镜像候选。**X 上传者不是官方来源；本轮没有查到最初官方发布页或艺术家署名，不能声称转载链已经官方认证。**

实际结构：

- 上部主要是黑色的菱方轮廓，绿色沿边勾出转折；腕带是宽的浅灰环带，边缘为绿色。不能照此前 AI 图画成大面积白色金属护甲。
- 左图是面盖闭合状态，中央可见黑色沙漏状轮廓；中图露出带绿色沙漏标志的黑色圆盘；右图圆盘升起，露出黑色圆柱侧壁及绿色异形符号。
- 腕带侧面可见三个小绿色矩形块。静图不能证明这些块的控制用途，本文不把它们命名为按钮或独立指示灯。
- 三张均为斜视图。圆盘相对上壳的面积关系可直接参考图，但没有严格俯视尺寸，未写成精确直径百分比。

这是一张展示三个状态的设定图，**不是连续动画帧**。可以核对闭合、露盘、升起的外观，不能仅据排列推定面盖的铰链位置、运动路径或时长。

## Ultimatrix：可读平面图，发布来源未证

根代理从公开检索取得 [Pinclipart 上的 PNG 原图地址](https://www.pinclipart.com/picdir/big/394-3943027_cartoon-network-wiki-ben-10-ultimate-alien-omnitrix.png)。本代理已实际查看 `../.local/watch-reference/ua-promo.png`，785×618、182,962 bytes，SHA256：`11a1cc4c933350f1d20b1c626c7d1c371c48ff606b2947819cce212d26bee49d`。

实际图像为平面色块插图：主表体是亮绿色长护腕；较大圆盘位于护腕的一端，盘面黑绿沙漏，外圈呈灰色并用少量明暗色块表现侧面；另一端有深蓝灰矩形嵌块。侧面有深色长面板、两条浅绿色弯管以及灰色接头。没有看到可据以复原的细螺钉、雕刻纹理或金属导轨。

图内没有制作栏、版权行或作者署名，Pinclipart 也不是官方发布站。本轮未核得独立原页的上传说明、最初官方发布链或艺术家，**“官方宣传图”身份尚未确认**；文件名里的 Cartoon Network / Wiki 不能替代出处证据。可报告这张图的结构，不能把它当作已认证官方设定稿。镜头为斜视，圆盘直径、护腕展开长度及背面扣合结构未量定。

## 找到的艺术家原始作品集：不套用到 OS / AF

[Jeff Wong 的 Ben 10 作品页](https://www.jeffwongdesignportfolio.com/ben10) 直接列出 [Omnitrix Orthographic copy.jpg](https://images.squarespace-cdn.com/content/v1/5df842f22144da3774fc9df5/1580193187816-ECW0TFIG85BN6W29I8NT/Omnitrix%2BOrthographic%2Bcopy.jpg)。本代理从这个字面原图 URL 普通 HTTP 200 下载并实际查看，保存为 `../.local/watch-reference/jeff-wong-omnitrix-orthographic-original.jpg`，1300×1005、286,970 bytes，SHA256：`cf266fccfbd838666482485f9f4a17b7e1a65addc015e8d86d2edfc27492dd1d`。

这是带 Jeff Wong 签名的多视角正交线稿，展示圆形中心、宽护腕和四条弯曲外部结构。作品页没有在本轮可读文字中给出该张图的代际、年份、集号或官方委托信息。因此能够追到作者自发作品页，但**尚不能归为 2005 初代或 AF 重校准表**。本次不拿它填补 OS / AF 的缺失结构，也不据它重新设计四代共用表壳。

## 绘制与证据边界

画风按用户要求采用平面动画的大色块、清楚轮廓和有限阴影。不要从此前生成图补入金属倒角、螺钉、导轨、橡胶纹理或额外发光线路。该要求是本次产品方向；动画画面没有给出的结构应保持待核定，不能声称已查证。

本代理没有操作根代理的预览页或改变视口，也没有下载视频。新的三张官方截图由根代理实际浏览器播放取得，本代理独立查看本地文件；本文明确区分截图取得者、实看检查者与原视频官方上传者。

Wiki 本轮能够公开读到 Ultimatrix 画廊的 Official Artwork / Models and Poses 栏目；另两张画廊及模型文件页未能用本代理 web 工具读取。一次普通公开 HTTP 请求 AF 模型文件页得到真实 403，未选择年龄、未换 UA、未尝试代理或传输规避。UA 画廊的一张缩小 Box Image 图请求返回 402，也未重试。Wiki 栏目分类本身不是作者或上游官方发布链的认证。本轮未取得 Wiki 所列 AF 模型原字节；这一缺口不再等同于没有 AF 官方近景，上表官方视频截图已经提供独立结构证据。

这份文档目前可用初代与 AF 官方近景、初代升起表芯及带制作字段的 OV 镜像约束结构；UA 平面图的原始发布链未证，四代完整正交尺寸也未量定。官方帧观察不等于逐帧复刻，按这些参考重绘的网页素材仍须标为重绘。原始研究图只作参考，保留在 `.local/watch-reference`，不打包为插件美术。资料核查不等于用户接受；不将本次结果写成造型验收通过。

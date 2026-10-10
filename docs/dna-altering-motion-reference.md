# DNA Altering 3.5.0：普通开表、切换、确认的静态实现依据

本记录用于下一轮交互改造，不是已实现或运行验收。只读取用户提供 APK 的 DEX、布局和资源，没有安装、运行 APK，也没有修改插件。

用户提供的源 APK：`eu.adi007.omnitrix.apk`，XAPK版本3.5.0。SHA-256：`0b0b6ba36090432db710649f0e567518f22fdeb49f7909c52628207d3f1fe0fd`。

## 动作对象与版本边界

1. `n()` 的 ±90° / 500ms 是 `id/bezel` 外圈转动。布局将其绑定为 `rotateframee.webp`；已实际看图，确为四绿点圆圈。绿色菱形 `element2.webp` 不是这个旋转层。静态查到的普通经典切换直接替换英雄图，没有每次将菱形交叉闭合再打开的调用。用户要求的交叉反馈可以另做，但应标作项目改编。
2. `v0==1` 是重校准投影路径，配置键 `OMNITRIX_RECALIBRATED`，英雄资源前缀 `recalibrated_`。该路径使用 `ultimate_*` 音效。没有找到独立 Ultimatrix 手表开表分支。AF 动作有直接证据；UA 若共用它，是本项目适配决定，不可声明为 APK 独有 UA 实测。
3. OV 切换构造默认值是 `I=6`，所以转动为 **550ms**。350ms 是 `I=8` 或无法匹配设置时的备用值，不是构造默认值。用户持久化设置可覆盖它。

## 推荐实现状态与 APK 状态对应

这里的语义名称是前端实现建议；右列数字和门闩来自 APK。只覆盖正常开表/选择/变身，不把随机模式、损坏、究极进化、扫描和限时故障分支混入。

| 语义状态 | 经典与 AF | OV |
| --- | --- | --- |
| idle | `V0=0` | `V0=0` |
| opening | 正常 `e1()` 设 `V0=1` | `y()` 设 `V0=41` |
| selecting | `V0=2` | `V0=20` |
| switching | `V0` 不变；`p4` 外圈锁、投影另有 `q4` 锁 | `V0=21`，转动和焦点放大完成后回 20 |
| armed | 普通经典/AF 已在选择态准备确认 | `v(0)` 设 `V0=22`，选择器退出后开盖并循环提示音 |
| transforming | `F()` 设 `V0=3` | `P()` 设 `V0=23` |
| transformed | `K1()` 的淡出回调设 `V0=4` | 完成回调设 `V0=24` |

不可在 busy 阶段让多个切换同时写同一个英雄槽。APK 经典 `t()` 检查 `p4/q4`，OV 检查状态。网页关闭、模式切换时取消计时器、动画和循环音频属于网页生命周期适配要求，不能把 APK 的 Android Handler 当网页 API。

## 经典正常开表：e1 → r1 → tb.p → x

普通动画入口等价于 `e1(1,0,0,28,activity)` 的默认参数分支；表内只描述无特殊扫描/损坏/预选的路径。

| 相对时间 | 动作 |
| --- | --- |
| 0ms | `e1()` 从 idle 设 state1；播 `herolist_open`；准备可选英雄序列。 |
| 0–1000ms | `r1(1,1,0,0,0)`：underBorder1/2 到 `-0.07W/+0.07W`，border1/2 到 `+0.48W/-0.48W`。是两组遮片，不是把整张手表压扁。 |
| 70–1070ms | `tb.p case0`：omnitrixScreen 的 scaleX/Y 到1、alpha到1。普通 `f5<=0`；其他预选路径可能用90ms。 |
| 90–1090ms | `tb.p case2`：omnitrixScreenGlow 的 scaleX/Y 和alpha到1。其 scaleX 的完成回调进入 `x(1,0)`。 |
| 1090ms | `x()` 调 `t(2,1)` 载入当前英雄，不递增编号，不旋转外圈。 |
| 1090–1240ms | heroImage alpha到1，150ms；完成回调将 state1变为state2。正常选择态循环提示音另由 `S(-1,o1)` 启动。 |

W 是 APK 的 `M0` 屏幕宽度。上述坐标是二维屏幕单位。3D 中可以复用时序及遮片语义，实体表芯位移量须使用自己的模型坐标，不能直接套 W。

普通动作 helper `t.a.d/p` 只是 `ObjectAnimator.ofFloat → setDuration → start`，没有设置自定义插值器。这里不伪造测得的缓动曲线。

## 经典切换：t → q → n

`t(0,1)` 前一个，`t(1,1)` 后一个；`t(2,1)` 只刷新当前。会跳过不可选英雄并循环索引。

- `q()` 从六个 `rotary_1…6` 音效随机选择一个，调用 `n()`。
- `n()` 将 bezel 当前旋转角加/减90°，500ms，设置 `p4=1`。`tb.r0 case3` 归一化接近±360°的角并清 `p4`。
- 在这次调用内直接将 heroImage 换成 `hero_<Q0>`；融合模式为 `fusion_hero_<Q0>`。没有找到在这条普通路径中让菱形收合或让新旧英雄做3D翻面的步骤。
- heroImage 初始布局比例0.7、中心为视口中心。网页仍应按每张透明图实际外边界进行菱形内适配，不能靠同一比例保证所有形态不越界。

## AF 重校准投影正常开表

同样从 `e1()` state1 开始，播放 `ultimate_herolist_open`。`r1()` 在 `v0==1` 普通分支不移动经典遮片。

| 相对时间 | 动作 |
| --- | --- |
| 0ms | 播开表音、进入opening。 |
| 70ms | `tb.p case0` 跳过经典屏幕缩放，安排20ms后进入case1。 |
| 90–440ms | `ultimateSelectionBg` alpha 0→1，350ms。 |
| 440ms | `x(1,0)` 设 state2，设置 heroImage 和投影辅助层的 pivot 为 `(W/2,H)`，即从底部发射。 |
| 440–840ms | 两层 holoGrow alpha0→0.7，用400ms；六个 `af_glowprojector_1…6` 备好，另启动其持续效果。 |
| 590ms | 150ms回调 `t(2,1)→q(2,1)→m(2)`；旧形态收缩和等待为0，换当前投影。 |
| 590–972ms（默认） | `tb.t0` 将新投影 scaleX/Y和alpha到1，`floor(450*f)=382ms`；回调清q4。 |

投影速度 `f = 1 - 0.15*(M-L)`。构造器 `J=1,K=5,L=1,M=2`，所以默认f=.85；实际可被持久化设置覆盖。APK在440ms已设state2，590ms才给首次投影加载设置q4；网页可以把opening锁保留到投影出现结束，这是适配改进，不应误称为APK原锁时序。

## AF 投影切换：先闪烁，再回收再生长

| 相对时间 | 动作 |
| --- | --- |
| 0ms | `q()` 设置q4=1、停止当前视频/效果、hero alpha=0，并行执行外圈±90°/500ms。 |
| 40ms | `tb.s case0` alpha=1。 |
| 110ms | `tb.s case1` alpha=0。 |
| 150ms | `tb.s case5` alpha=1，然后 `m(direction)` 开始旧投影回收。 |
| 150–617ms（默认） | scaleX/Y到0，`floor(550*f)=467ms`；alpha在该阶段的约65%时长内到0。 |
| 617ms | `tb.u0` 换 `recalibrated_<Q0>`；若已进化则 `recalibrated_<Q0>_r`。 |
| 617–702ms | 等待 `floor(100*f)=85ms`。 |
| 702–1084ms | `tb.t0` 新图 scaleX/Y和alpha到1，382ms，结束后清q4。 |

音效在q入口选择 `K1[clamp(M)-1]`，对应 `ultimate_rotary_1_s1…s5`，缺项才用 `ultimate_rotary_1`。音频长度和视觉时长不相等，不能拿音频时长替换动画参数。

## 经典 / AF 确认变身

正常 `F()` 要求 `V0=2,p4=0,q4=0`。

1. 同时将 `omnitrixTransformGlow` alpha到1（400ms），scaleX/Y到10（500ms）。
2. 经典播 `transform`；AF路径播 `ultimate_transform`，故障分支另有broken音。设state3。
3. 1600ms后 `tb.t case13 → K1(1,0)`：重置边框、隐藏选择屏/英雄/投影层，切换变身后表面。
4. glow alpha到0，600ms。`tb.k1` 结束将glow缩放归0并设state4。普通动画约2200ms进入transformed。

UA 外观模型可以采用同一投影选择动作，但这不是本 APK 已证实的独立UA路径。究极进化与特殊英雄分支需要另立测试，不应塞进普通确认流程。

## OV 环形状态机

| 转移 | 实际动作与结束条件 |
| --- | --- |
| idle → opening | `y(0)` 准备英雄排列，设state41，指针放中间，播放 `omniverse_selection`，`W(2,...)`绑定7头像，`N(1)`进入。 |
| opening → selecting | E==0环形：上下环和7头像 alpha0→1、scale0.6→1，380ms；随后 `tb.r0 case12 → a1(150,true)` 进行150ms中心放大，再由case11回state20，正常共530ms。 |
| selecting → switching | 指针在左右外侧四分之一区域时 `L()` 设state21，播放 `omniverse_rotary`；头像环每步±38°，默认550ms。 `a1(0.3*d,false)` 在起步取消旧焦点，缩到1并清位移。 |
| switching → selecting | 旋转结束 `tb.y0` 把离开屏区的槽移到另一端±114°，`W()`替换/轮换英雄内容；最近中心头像 `a1(0.3*d,true)` 放大到1.13，向下平移 `H*0.044444` 并变色；165ms后 `tb.r0 case8` 回state20。持续侧压会再调用L；指针=-1会调用v(0)。默认一次完整焦点换位715ms。 |
| selecting → armed | `v(0)`，E4!=1正常分支：隐藏英雄名，设置发光盖下图，播clapet、`N(0)`收环并设state22。环/头像300ms内alpha到0和scale到0.6，315ms隐藏。180ms后左右屏/黑底边一起向上移M0、450ms。开盖回调后300ms触发盖下图scale到1（200ms），420ms开始循环bippulse（若仍state22）。 |
| armed → transforming | `P(0)`设state23、glow scale归0；盖下图缩到0.7（200ms）；50ms后glow alpha到1/350ms、scale到10/400ms，播 `omniverse_transform`，变身英雄图alpha到1/500ms。 |
| transforming → transformed | 确认回调1000ms后 `tb.v case13`重置表面并让glow淡出350ms、英雄图淡出300ms；`tb.r0 case15`设state24。自P入口约1400ms。 |
| transformed → opening | `y()`允许state24重开，但设置E4=1；再次选择会走直接变身分支，不重复同一次开盖。此分支应单独验证。 |

普通开盖是 APK 三个二维图层一起向上滑出，**不是** `l()` 随机模式的左右分离/scaleY1.3/1000ms。用户提供实体模型的开盖几何可保留体积，复用上述时序和反馈。

## 可复用资源及身份边界

图像来源是 `config.mdpi.apk` 内的 `res/drawable-mdpi-v4/`；音频位于基础 APK 的 `res/raw/`。只读25条声音的元信息，没有播放。此文档不携带 APK 媒体资源。对应哈希、字节和方法见 [结构化参考](dna-altering-motion-reference.json)。

| 控制层 | 资源与绑定证据 |
| --- | --- |
| 经典外圈 | `rotateframee.webp` → layout `bezel` → `k0.h`，n()旋转。已实看。 |
| 经典菱形屏 | `element2.webp` → `omnitrixScreen` → F()。已实看。 |
| 菱形遮片 | `element1/element1_2` → underBorder1/2；`element3/element3_2` → border1/2。r1()平移。 |
| 菱形光 | `element2_glowover.webp` → omnitrixScreenGlow → G()。 |
| 经典英雄 | `hero_<id>.webp`，融合可用 `fusion_hero_<id>`；不据编号推断角色身份。 |
| AF投影英雄 | `recalibrated_<id>.webp`；进化版 `_r`。 |
| AF投影底与光 | `ultimate_selection_screen` → ultimateSelectionBg；`ultimate_hologramgrow` → holoGrow/holoGrow2；`af_glowprojector_1…6`。 |
| OV环上层 | `w1()` 在E==0设置 `omvselectorcircularsus` 给M()/omniverseSelection；E!=0为条状selection。 |
| OV环下层 | layout `omvselectorcircularjos` → N()/omniverseSelectionJos。 |
| OV头像 | `omniverse__<id>_` 系列已有资源，7个ImageView槽。应按已有目录映射身份；本次未以编号重新猜角色。 |
| OV盖下光 | `omniverse_underclapetlight` → O()/omniverseUnderClapet。 |

APK 的 `tb.p1.b()` 提供按 owner style 的 ColorMatrix / SRC_IN 着色路径：有多个配色而非固定绿。网页头像使用可着色独立图层是合理映射，但本轮没有重做任何头像或更改其来源声明。

## 证据与待验证项

结构化参考逐项保留 APK/Split/DEX 哈希、布局 id、资源 entry、动作方法、状态和时长。资源名来自基础APK与mdpi split联合表，不能只凭数值资源编号猜名字。对旋转外圈和绿色菱形已查看实际资源像素，其余图层的核对范围在JSON中逐项声明。

静态方法证据包括 MainActivity.e1/r1/x/t/q/n/m/F/K/K1/y/N/L/a1/v/P，以及对应 tb.p/s/t/t0/u0/v/v0/r0/y0/k1/b1 回调。文档只总结行为，没有发布反编译方法源码或用户本机路径。伪源码中的浮点位模式和回调成员关系已用DEX指令交叉核对；这仍然不是运行证据。

未验证：APK实际运行画面、帧调度、手机震动、音量/混音、全部特殊英雄、全部异常取消、独立Ultimatrix开表。APK音频的元数据时长不等于视觉动画时长。来源由用户提供，尚未核定原发布者与再分发许可；没有官方来源或官方动画声明。

工程引用使用 TavernWeave 媒体路线，A0/E3/E4（知识快照2026-08-18），无已采纳的设计候选。当前只完成静态参考；后续行为落地、手机/PC浏览器测试、真实酒馆验证和用户验收分别记录。

# 0.4.8 两种 Kevin 融合体与透明参考重绘

新增 Ultimate Kevin（UA 融合体）与 Kevin（Omniverse 闪回融合体），当前目录为 **226/228 条已有剪影、2 条已登记缺图**。两项有不同作品阶段与身体轮廓，不是普通人类 Kevin，也不作为新的独立物种统计。全部作品范围仍未穷尽，见 [范围说明](catalog-scope.md)。

## 来源与实际使用

- Ultimate Kevin：由 [社区 Kevin 资料页](https://ben10hero.com/ben-tennyson-and-his-team/origins-kevin-ethan-levin/)的动画画面及 [The Forge of Creation 剧集资料](https://tv.apple.com/us/episode/the-forge-of-creation/umc.cmc.1ryx54imr0i23maa4w530g3sv?showId=umc.cmc.1tx3oatiqpah2carccx4ncqq2)核对形态。使用的夜间画面为 403×307 不透明图，其精确集数、时间戳和上游发布链未确认。AI 输出沿用蹲姿、蓝色兜帽和披风、不对称双臂、躯干、尾部与双足；脸、指爪、脚趾、尾节、披风褶皱和接合细节含重绘。第一次生成遇到宿主 stdout 中断，确认没有存活句柄或输出后重新执行；共两次尝试，保留一次成功输出。
- Omniverse 闪回融合体：参考同一社区页的 403×331 不透明动画图，作品身份由 [Weapon XI Part 2 剧集资料](https://tv.apple.com/gb/episode/weapon-xi-part-2/umc.cmc.613nxkky874rqdci3u27vzwhx?showId=umc.cmc.3lfb2l0fbgvea7ktuah4zpr3c)及实际画面核对。根代理另实际查看 [Cartoon Network 官方频道视频](https://www.youtube.com/watch?v=sRkFTXxNkIs)约 57.933333 秒的暂停画面，readyState 为 4，描述标注 Weapon XI Part 2；可见相同闪回上半身。该观察不能认证生成图所有细节。一次生成保留低蹲身体、交叉绷带和高飘带环、后背圆壳、肩眼、浅色长臂、绿色手部、尾部与条纹脚端，脸、手、飘带厚度与末梢、表面接缝含 AI 解释；目录不写未经原片核实的年龄。

两项实际接入模式均为 reference-guided-edit-alpha：社区不透明动画参考 → AI 透明参考重绘，**不是原生透明原图，也不是像素完全不变的抠图**。四个公开 PNG 保留各自原始字节，原图与生成蒙版分开记录 SHA-256；未进行程序化像素处理。原制作图片链、个人作者与复用许可未知。完整生成提示词、实际源图和细节限制保留在素材登记中。

UA 输出的弱 alpha 像素抵达底边，强 alpha 轮廓仍有边距；未擅自清理。闪回输出要求的 8% 留白未达到：强 alpha 四边约为 2.10%、2.11%、0.94%、3.87%，均为正值，仍保留 30432 个 alpha 1–127 像素。上述限制不会因本地界面检查而消失。

## 数据与自动验证

新增两项通过既有 newForms 身份登记接入，并与独立素材记录绑定。此前 226 行按完整逻辑字段比较不变，232 张旧运行图片逐项比较字节大小及 SHA-256 不变。没有把本轮新增项计成对旧目录的简单改名。

完整 npm test：111/111 通过，0 失败、0 跳过。最终 preview SHA-256：52ab8166fb29d318a9ddde8e0ac7e8d2105ba399f53ba42b584d32b19566e349。

测试只证明覆盖到的数据、构建与代码行为，不证明全作品目录穷尽、官方造型完全一致、真实安装或用户接受。

## 浏览器与剩余边界

根代理实际查看两项 × 三种界面的 6 张桌面截图，以及对应的 6 张双手机宽度截图。桌面实际 clientWidth 为 1265；手机 iframe 设定宽度 390/320，本轮实际记录的 clientWidth 为 375 / 305。每张均核对选中名称、data-mode 和 scrollWidth 等于 clientWidth；截图归档与运行日志见 [本轮浏览器证据](browser-qa-v048.json)。这证明被记录的本地预览状态，不代表其他尺寸、帧率和全部交互路径均已验证。

一次连续目录选择后点击模式未切换，检查实际状态后单独点击成功，已替换临时错误命名截图。没有据此证明根因；另外在实际 app.js 的内存回归中确认横滑后的全局点击抑制会阻挡舞台外按钮，发布前单独修复并补验证。

控制台结论来自本轮实际查询：Desktop log query returned no errors. The mobile composite recorded one MutationObserver.observe parameter-not-Node error without a source URL; attribution unresolved. One rapid desktop catalog-select then mode click left projection active; after observing state, a separate semantic mode click succeeded and the mislabeled provisional capture was replaced. This event is not established to be caused by the separately reproduced stage-swipe suppression defect. All 12 retained captures have verified selection, mode and no horizontal overflow.

四代手表仍沿用 32 张独立视角／收起或弹出图片；本轮没有新增手表重绘或三维网格。当前独立检查仍指出固定视角之间存在表壳和身体结构漂移，切换只是约 180ms 淡入，尚不能等同于连贯的机械转动或任意角度的三维体积。素材数量增加不表示这些视觉问题已解决。

本轮没有真实 SillyTavern、SillyDroid 或物理手机安装／运行证据，也没有用户验收；本地双 iframe 预览不可替代它们。下一步继续全作品形态审计、两条已登记缺图补全与手表结构／运动改进，不将 228 条登记数作为完成整个目标的依据。

## 横滑后的控制修正与最终构建

发现舞台横滑后的 350ms 防误触会全局拦截模式、表代和目录按钮，已将范围限定为舞台内的指针余点击。表盘本身保留防误确认；detail=0 的键盘激活放行，真正确认动作仍保留原有节流。新增三项回归覆盖舞台外即时切换、表盘指针余点击与键盘操作。

前述 12 张素材布局截图对应修正前构建 b7622ff9a3bbbb1d5b245c8c7d8c8ea29e9cba456a5bf6dc99377099579a74ce。修正仅改变点击处理，图片、适配和布局未改变。最终构建补充桌面实际拖动（Ultimate Kevin → 闪回 Kevin）及切菱形模式，并重新加载两种手机宽度检查，保留两张额外截图。浏览器操作未测定是否在 350ms 内；这一时序由实际应用代码的自动回归验证。

最终桌面错误查询为空；手机容器初次加载与再次加载各有一条无来源 URL 的 MutationObserver.observe 错误，归因未定，不声称无运行错误。

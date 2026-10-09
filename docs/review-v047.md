# 0.4.7 目录与原生透明素材更新

新增 Kevin 11（初代融合体）和 Techno-Bubble 强化的 Clockwork；当前目录为 **224/226 条已有剪影、2 条已登记缺图**。这次是审计后新增目录行，不是把其他形态改名。全部作品的范围仍未穷尽，见 [范围说明](catalog-scope.md)。

## 来源与实际使用

- Kevin 11：作品身份由 [Framed 剧集资料](https://tv.apple.com/us/episode/framed/umc.cmc.5dni3y327ebiq59haej5584vd?showId=umc.cmc.1vgxcrs7n1wt84y56xv4xn818)与 [社区动画参考页](https://ben10hero.com/ben-tennyson-and-his-team/origins-kevin-ethan-levin/)核对。采用已下载并实际查看的社区全身透明插画，包含四臂、双翼及条纹尾部。动画辅助图有裁切，不能据此认证插画中所有腿部与翅缘细节。Pinterest 源页面返回 403，未读取页面或确认作者；此前已获得的原图字节保留，不把页面标题或 URL 文案当设定证据。
- Techno-Bubble 强化的 Clockwork：使用 [Clockwork 社区资料页](https://ben10hero.com/additional-aliens/new-aliens-from-alien-force/clockwork/)中的原生透明图，与两张同站动画画面逐项核对。另实际查看 [社区视频](https://www.youtube.com/watch?v=P9_-KHmRv88)约 464.71 秒的背面，支持三叉头冠与黑／青电路线的身份；没有把该片段说成完整融合过程，精确剧情 part 仍未确认。

两项 source-alpha 文件均直接复用下载原字节，主图与蒙版一致；本轮没有生成调用、补画、裁切或像素处理。三张动画辅助源图也保留原字节。社区作者、上游来源与复用许可未确认，均不称为官方透明原图。来源阶段限制原文保留，uiReview 仅更新本地界面检查状态。

## 目录维护修正

素材登记增加 newForms 身份列表，只允许 id、name、en、group、appearance、aliases、sourceUrls 七个字段。重新导入时先创建缺图行，经过独立素材登记后才赋予图像；同 ID 身份冲突拒绝，重复导入保持一致。测试包含重新导入、重复执行、冲突和伪造运行字段。此前 224 行全部逻辑字段不变；230 张旧运行图片按 SHA-256 与字节大小逐项核对不变。

## 验证

完整 `npm test`：**108/108 通过，0 失败、0 跳过**。覆盖目录重复导入、身份冲突、原生 alpha 校验、打包与安装器回归、表盘挡片时序、快速切换及目录搜索不缩小手表选择池。构建输出的 preview SHA-256 为 `53f200fc5cd99f384efca616b65760cd81402ba34b6d63d9fe12208cbc4469af`。

两项 × 三种界面，共 6 张桌面截图及 6 张双手机宽度截图，由主代理实际查看。桌面 clientWidth 为 1265；手机 iframe 设定 390/320，实际 clientWidth 为 375/305，Kevin 投影截图左框读数为 390。所有记录均为 scrollWidth 等于 clientWidth。菱形内全身可见，投影保留手足、翼尾和头冠，转盘选中形态正确。长名称在转盘标签省略显示，完整名称在下方选择信息中保留。

连续跨 iframe 切模式时，右框两次未立即切换；读取实际状态后分别操作并重拍，根因未定位，不称为没有交互异常。桌面错误日志为空，手机并排容器记录一条 MutationObserver.observe 参数不是 Node 的错误，无来源 URL，归因未定。保留在 [浏览器证据](browser-qa-v047.json) 中。

本轮沿用四代手表的 32 帧多视角结构，未新增手表重绘或任意旋转的三维网格。独立浏览器截图不能证明真实 SillyTavern、SillyDroid 或物理手机成功安装和运行；也不等于用户验收。下一步继续检查全作品目录范围与两条已登记缺图。

# 0.2.5 交付验证记录

本版新增 9 张剪影：224 条记录中 **165 条已有剪影，59 条待补**。四代手表、三种召唤方式与原有选择动画继续共用同一套界面。

## 新增素材

- Rocks：舞台演出主办方 [2009 年宣传页](https://corporate.teroasia.com/archived/press_release/ben10_news-051009_eng.php)的角色图，原图 300×300；参考编辑去除圆形背景，细线有重绘。
- Mucilator：[Art Bully 游戏制作作品集](https://www.artbully.co/ben-10-characters)的模型参考，保留主视角可见身体；**游戏模型不等于动画原画**，界面说明已标注。
- 漫画版 Diamondhead：[出版社第 3 期封面 C](https://2001.dynamite.com/htmlfiles/viewProduct.html?PRO=C72513036343503011)，Dustin Nguyen 绘；去除封面与背景，二次编辑保留透明边距。
- Ripjaws 鱼尾状态：社区页面完整鱼尾参考，原图仅 153×479；保留无腿的身体状态，没有另补双腿。
- Bad Gravattack、Bad Buzzshock、Grey Arms、重启版 Bloxx：逐张核对的社区参考图，经内置 imagegen 去背景。Bad Buzzshock 保留电气飞行动作，没有改成站姿；Bloxx 自然重叠的腿部保留。
- Mad Perk Upchuck：原生透明 PNG 原字节直接接入，没有图像编辑。

共 1 张原生透明图、8 张 AI 参考编辑。输入、显示图、SHA-256、来源、完整提示词和局限均见 `assets/extra-art.json` 与 `assets/source-art/`；所有编辑均使用内置 imagegen，未使用 CLI。AI 图会改变线条、阴影、手指、晶体切面或其他细节，不是逐像素抠图，也不是官方透明原画。低清源图不能证明生成出的细节属于原作。

源图与输出均已实际查看。独立复核发现 Nega Gutrot 原图右侧管端裁切，生成稿补成圆端，因此本版不纳入；Gwen Cannonbolt 的 548×479 原图仍仅上半身，继续待补。Squidstrictor、多个重启版卡面和其他残缺候选未用猜画轮廓补齐。

## 验证

- `npm test`：**62 通过，0 失败、0 跳过**；包括全部 165 张素材的透明像素菱形包络、来源校验、动画中断和手机覆盖安装器。
- 构建预览：**51,893,206 字节**，SHA-256 `c4f4681c186e828d53300a3182c3beab3a5f3b89b8557ad0ced5992b77c906e4`。小于安装器现有 64 MiB 单文件上限。
- [浏览器记录](browser-qa-v025.json)：14 张截图，390×960 实看全部 9 张新剪影及完成版投影；320×920 按右方向键将 Bad Gravattack 从后排 0.65 缩放移动到前排 1.16；1280×720、1280×960 查看重校准表壳投影。所查尺寸无横向溢出，未取得控制台错误或警告，临时尺寸已恢复。
- 部分 AI 图含极微弱的离散 alpha 像素。适配仍包含全部正 alpha 像素，因此主体会留更多边距；没有删除这些像素或声称背景每一像素全为零。长鱼尾、宽体和大拳头会显示得较小。完整显示仅指界面没有额外裁掉所接入轮廓，不证明上游从未裁切。

## 手机与剩余边界

继续使用同一个[安装／覆盖修复／更新入口](mobile-install.md)。已有目录直接按工具流程备份、校验后覆盖五个运行文件，重复执行相同版本不会再产生备份；不需要手动删除目录。

真实 SillyDroid 手机安装、真实 ST 1.18/1.19 加载及用户美术验收仍未完成。`driverAccepted = false`，`allSilhouettesComplete = false`。剩余 59 条保留缺图标记，不计为完成。

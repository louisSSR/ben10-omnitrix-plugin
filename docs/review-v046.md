# 0.4.6 素材更新

新增 Portaler、Rath Arms、AntiVilgax。现为 **222/224 条已接入剪影、2 条待补**；目录包含版本、融合与身体状态，不等于独立物种数。

## 来源与解释性重绘

本轮素材为 AI 参考重绘，依据实际查看的游戏介绍／游戏画面、玩具商品照片和动画视频截图整理。Portaler 的腿足参考低清游戏小人；Rath Arms 是实物玩具的可替换外星人头组合复原，游戏版身体差异未确认；AntiVilgax 的脚和局部指尖在源镜头外，按可见结构解释性补齐。未见部位与细节复原逐项披露。这些素材均不称为官方透明原图或逐像素复刻。所有保留源图与输出均核对格式及 SHA-256。来源阶段的限制原文保留；其中候选阶段的“UI 待验”措辞，仅由本轮 uiReview 更新本地预览状态，真实宿主、物理手机和用户验收仍未完成。

### Portaler

AI reference-guided reconstruction of the original Fuel Run game version from two 2013 community-blog game-frame reposts. Detailed introductory head/torso/arms are combined with same-game small full-body proportions; the dialogue-obscured lower body and limb-end lines are interpretatively restored.

来源：[查看来源](https://gameben10online.blogspot.com/2013/05/)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- The game origin is supported by visible game dialogue/UI and a contemporaneous 2013 community blog caption, not by newly played official publisher footage. The blog includes informal/inaccurate plot discussion, which is not adopted as canon evidence.
- The primary frame hides the lower belly/legs behind a dialogue box and truncates some far-arm context. The same-game full-body sprite is only about 54px high. Completed leg/foot segmentation, exact blunt-arm ends, full belly circles, shell continuation and refined facial lines are interpretative, not recovered original pixels.
- Requested 8-percent breathing room was not fully achieved: strong-alpha bounds leave 38px left, 68px top, 29px right and 60px bottom. No strong-alpha pixels touch the canvas edge. Weak positive-alpha edge pixels remain and await real dark-mask UI inspection.
- The Fuel Run original is deliberately distinct from the later Omniverse commissioned redesign, 5YL adaptations, Minecraft models and the unrelated HUD portrait. None was used as generation input.
- Current watch UI, physical phone, real SillyTavern and human acceptance remain unverified.

### Rath Arms

Toy reference reconstruction: Maqio photographs of the Ben-Four Arms-Rath Omni-Glitch interchangeable product provide the body and packaged Four Arms red spare alien head. One built-in AI edit replaces only the human Ben head with that photographed spare and preserves the four-arm, single-orange-arm/single-orange-leg arrangement. The reconstructed toy configuration is not a game screenshot; differences from the Ben 10 Heroes model are unconfirmed. Not an official transparent original.

来源：[查看来源](https://www.maqio.com/products/ben-10-action-figure-four-arms-omni-glitch)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Toy-reference reconstruction of the Ben-Four Arms-Rath Omni-Glitch product: its supplied Four Arms red alien spare head is assembled onto the photographed body in place of the human Ben head. This exact alien-head assembly is an interpretive reconstruction, not a photographed assembled product.
- The catalog includes the Ben 10 Heroes and toy-line fusion. This asset uses the toy configuration only; exact differences from the mobile-game body remain unconfirmed. It must not be described as an official game screenshot or exact mobile-game model.
- Keep the photographed arrangement: exactly one orange furry upper arm on image-left and one orange furry leg on image-right, with three red arms and the dark/red opposite leg. No second orange arm or full Rath-striped body was invented.
- The red spare head is small in the packaging photo. Eye/teeth details, head scale, neck connector, fur, fingers and surface highlights are AI interpretations, not pixel-exact original details.
- The sources are PNG bytes served from literal URLs ending .jpg and have opaque/near-opaque white backgrounds (source1 alpha173..255, source2 alpha162..255). They are not native transparent body originals; source PNG bytes were preserved unchanged.
- Generated alpha>=128 has bbox [113,15,1138,1230] inside 1254x1254 and only one substantial connected body component. Faint alpha1..15 residue exists, including top/left edge maxima1; RGB preview specks must be evaluated with their actual alpha in UI.
- Reuse licence unknown. No browser/current UI, real phone, real SillyTavern or driver acceptance was performed by this agent.

### AntiVilgax

AI reference reconstruction from actually viewed ToonRecapz community animation screenshot at3858.475396s. Four-armed Anti-Vilgax design retained; cropped feet/lower legs and raised crystal fingertips interpretively completed. Not official transparent art or exact canonical anatomy.

来源：[查看来源](https://www.youtube.com/watch?v=xkrfNOzgZKM&t=3858s)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Original pixels are a browser screenshot of ToonRecapz community recap footage, not an independently authenticated official transparent model sheet. The underlying animation/publication rights remain with their owners; uploader title and AI summary alone do not authenticate a frame.
- The source cuts off lower shins/feet and portions of the raised upper-right crystalline fingertips. Both completed feet, lower-leg proportions, toe count/shape, inner green leg panels and completed finger tips are explicitly AI interpretation, not witnessed official pixels. No ordinary Vilgax or Alien V anatomy image was supplied as a reference.
- Only the primary 3858.475396-second screenshot was passed to imagegen. Root samples at about3853.475,3863.475,3868.475 showed an earlier two-arm form, an obscuring black-purple mass, and spacesuited Ben, respectively; none was used as same-form foot evidence. The later Alien V footage was excluded.
- The output redraws linework, shading, claw edges, face/tentacle proportions, flame contours and surface connections. It is recognizable reference reconstruction, not a pixel-exact extraction or new canonical detail evidence.
- Original generated alpha retained without programmatic pixel cleanup. Alpha1..15 residue:26806pixels; alpha16..127:5932pixels. Thin blue/red translucent edge fringes remain. Alpha>=128 bbox[63,18,1452,1045] is inside the1472x1069canvas with no strong-alpha edge pixels; weak residue reaches the left edge.
- Current black watch UI, real phone, real SillyTavern and human acceptance are pending root; candidate source/output review is distinct from runtime acceptance.

## 验证与交付边界

最终构建后单独执行 npm test，**104/104 通过、0 失败、0 跳过、0 取消**。本轮条目逐项检查桌面与手机模拟可用宽度 **375/305px** 下的菱形表盘、投影和环形转盘；截图共 **18 张**。原有 **227 张运行图片** SHA-256 原样保留，新登记源图与输出也没有在收尾脚本中改写像素。

截图采集构建 HTML SHA-256：`2e5ec12e82ed1c441418f4a6544be55b4a26f2492b53c676abb6ebc14e6f62cc`；采集阶段复核记录时间：2026-10-09T13:18:59.593661+00:00。以上 18 张截图均在阶段 1 前拍摄，保留原字节，没有在升版后重拍。

最终重载构建 HTML SHA-256：`2e5ec12e82ed1c441418f4a6544be55b4a26f2492b53c676abb6ebc14e6f62cc`；最终重载记录时间：2026-10-09T13:21:15.104000+00:00。即使这两个哈希相同，也分别保留采集与重载记录。本次已逐字节确认视觉代码、目录与布局数据以及全部 230 张运行图片未变，因此保留采集构建的轮廓证据；最终重载的筛选和控制台观察、以及新执行测试则绑定最终构建。根代理已确认最终预览筛选清空。截图哈希、视觉依赖摘要、逐项来源限制及实际控制台记录见 [浏览器证据](browser-qa-v046.json)。

主预览控制台：本轮实测未记录到错误。

响应式测试容器记录：

- Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.

没有据此宣称物理手机、真实酒馆或用户视觉验收通过。四代手表的既有多视角素材和过渡继续保留；本轮没有把它们称为可连续旋转的三维网格。下一步是在用户实际宿主查看和验收。

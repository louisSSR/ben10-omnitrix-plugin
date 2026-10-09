# 0.4.5 素材更新

新增 Big Chuck、Stinkfly、XLR8、Eon、Omnitrix Glitch Combination、Alien V、Amalgam Ben、Ampfibian、Monster Kevin (Tales from the Omnitrix)、XLRArmBlastDiamondHeat。现为 **219/224 条已接入剪影、5 条待补**；目录包含版本、融合与身体状态，不等于独立物种数。

## 来源与解释性重绘

本轮素材为 AI 参考重绘，依据实际查看的动画画面、社区画稿或辅助参考整理。部分参考没有完整身体；未见的躯体、四肢、末端及细节复原逐项披露，物种解剖支持不等于该版本官方定型证据。这些素材均不称为官方透明原图或逐像素复刻。原始 GIF 辅助证据保留原字节，并逐项核对 GIF 签名字节与 SHA-256；不将 GIF 用作主图或蒙版。来源阶段的限制原文保留；其中候选阶段的“UI 待验”措辞，仅由本轮 uiReview 更新本地预览状态，真实宿主、物理手机和用户验收仍未完成。

### Big Chuck

AI reference-guided redraw of the final animated Big Chuck design using two actually inspected community-video animation captures. The broad low reclining pose is retained; attackers and background are removed, with hidden contact areas, fingers and tucked rear limbs interpretatively reconstructed.

来源：[查看来源](https://www.youtube.com/watch?v=QuVkcAJsyXk)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- The source is a normal-browser capture of a community explainer, not a newly authenticated official video. Root observed playback; this subagent independently inspected the saved pixels. Only the stated sample times are claimed.
- Small attackers obscure substantial limb junctions and parts of the rear body. Their completed outlines, rear-foot configuration, finger count/shape, and refined stripe and facial details are source-guided reconstruction rather than recovered original pixels. The source pose is low and wide, not a neutral upright model sheet.
- The output retains narrow breathing room above the highest fin: strong-alpha bounds are 52px from left, 8px from top, 35px from right and 15px from bottom. No strong-alpha pixel touches a canvas edge. Weak positive-alpha edge pixels remain; actual dark watch rendering is pending root inspection.
- Perkins early v1/v2 concept variants and the ordinary Upchuck frame around 395 seconds were excluded from image generation; neither is passed off as this final animated design.
- Current watch UI, physical phone, real SillyTavern and human acceptance remain unverified.

### Stinkfly

AI reference-guided extraction of Robert Carey's Dynamite Ben 10 issue 2 third-print Stinkfly cover, retained from the Midtown Comics product listing. Licensed-cover edition identity is attributed to the retailer; no official transparent original or exact pixel extraction is asserted.

来源：[查看来源](https://www.midtowncomics.com/p/2583267-ben-10-vol-2-2-cover-w-3rd-ptg-a-robert-carey-cover/)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- The original is a retailer-hosted licensed cover attributed to Robert Carey, SKU 0626DE8101. The source is not an official publisher upload, and the delivered drawing is an AI interpretation.
- The cover provides the whole principal body contour; small linework, limb connections and translucent wing treatment are interpreted. No missing full-body anatomy is claimed to have been recovered.
- The initial Duncan Rouleau issue 4 cover candidate was not adopted because its design differs substantially. This entry uses only the later Carey source and output; no hybrid of cover designs is introduced.
- Thin yellow edge traces and weak-alpha fringe remain around parts of the wings. The generated margins are smaller than requested but strong body pixels do not touch the canvas; current watch fit is checked separately.
- Current watch UI, physical phone, real SillyTavern and human acceptance are pending.

### XLR8

Published Dynamite Ben 10 #3 second-print Robert Carey cover, obtained as the literal matching Midtown Comics SKU 0626DE8104 bitmap. One built-in transparent reference edit retains the complete comic action silhouette and interprets small internal ink details. Not an official transparent original.

来源：[查看来源](https://www.midtowncomics.com/p/2583270-ben-10-vol-2-3-cover-t-2nd-ptg-a-robert-carey-cover/)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Official publisher announcement and matching retailer SKU/title support the published Robert Carey second-print cover identity; the bitmap was acquired from Midtown Comics, not directly from a publisher original-art archive.
- Built-in AI transparent reference edit, not an official transparent original and not a pixel-exact background removal. Fine inkwork, shading, visor reflections, emblem detail and finger edges are interpreted.
- The source already shows the complete action outline, including both hands, both foot ends and one curved tail. No substantial missing limb reconstruction was requested; overlaps remain as in the cover.
- This is the Dynamite comic visual model. Rounded visor helmet, claw-like hands/feet and dark teal-accented body are retained; no ordinary television XLR8 tall head spike or wheel feet were substituted.
- Transparent padding is tight: alpha>=128 bbox is [4,14,976,1540] in a 1018x1545 bitmap. Low-alpha pixels reach left/bottom canvas edges with maxima 4/3; faint residual antialiasing may influence envelope scaling.
- Licensing/redistribution permission remains unknown; public sale and official publication do not confer a reuse license.
- Actual UI, real SillyTavern, real phone and human driver acceptance have not been performed by this agent.

### Eon

AI reference-guided reconstruction of Ben transformed into helmeted Eon in the 2007 live-action film, based on an actually viewed community-reposted scene. Lower coat, hands, legs and boots are interpreted, not recovered official pixels.

来源：[查看来源](https://www.youtube.com/watch?v=GdYYUt78Ikw)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Only head and upper torso are visible in the 65.08-second source; all hands, coat hem, leg/boot construction and standing pose are interpretative extensions. Neither the screenshot nor the reconstruction is an official full-body model sheet.
- The source is an actual browser capture of MaxTrailerClips, a community uploader; official upload authenticity is not asserted. Dark chest ribs, armor seams and purple forearm insets in the output are interpretation of dim imagery.
- The generated RGB preview has a large purple haze, but exterior sampled alpha is zero. Low-alpha residue is retained unchanged; actual watch silhouette must be inspected. Native output maximum alpha is 254 rather than 255.
- Current watch UI, physical phone, real SillyTavern and human acceptance are pending.

### Omnitrix Glitch Combination

Previously acquired community-game-portal original comic atlas used for one built-in transparent reference redraw of its final red/pink fused body, with disclosed cropped foot/finger reconstruction. Not an official transparent original.

来源：[查看来源](https://plays.org/game/ben-10-omnitrix-glitch/debugging/assets/atlases/x1/atlas_comic.png)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Specific final red/pink comic-panel fusion only; not every mix-and-match outcome, and the descriptive seven-alien-looking label is not an independently verified official character/species-composition name.
- Original atlas was previously acquired from the public community game portal plays.org; original game/publisher ownership is not authenticated solely from portal hosting. Source original pixels and raw bytes retained.
- Final panel cuts the blue/black leg ends and feet and small lower finger ends. The generated lower limbs/feet and those ends are openly interpretive reconstruction from visible direction/comic anatomy, not official hidden pixels. Earlier orange-panel feet are not asserted to be a verified same-version complete-body reference.
- Small source comic character was enlarged and redrawn. Eye/finger/face linework, surface shading, limb proportions and some connecting curves are AI interpretation; do not use generated fine detail as canon evidence.
- Raw alpha/bytes unchanged; low-alpha residue remains (18955 pixels alpha1..15 and 5803 pixels alpha16..127). Nonzero alpha bbox [0,23,1223,1275] reaches left/bottom through low residue; alpha>=128 bbox [122,27,1183,1245] has no body pixels on any canvas edge.
- No ordinary human Ben, neighboring comic/combat sprite or menu icon included. Giant rounded black/yellow arm and the visible raised fire-coloured/lower cyan arm groups follow the final panel; no invisible extra arm claimed.
- Redistribution license unknown; game/character copyright retained and AI redraw disclosed.
- Current UI, real phone, real SillyTavern, browser and driver acceptance are pending root; this reviewer did not use shared CUA.

### Alien V

ai-explanatory-reference-reconstruction-from-community-animation

来源：[查看来源](https://tenor.com/view/vilgax-alien-v-celestialsapien-lightning-rain-gif-17437876104556182587)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- The Alien V frames show only head and shoulders. Entire torso/pelvis/arms/hands/legs/feet and upright slightly crouched body pose are AI anatomical reconstruction, loosely guided by ordinary Reboot Gax; they are not directly verified Alien V movie contours.
- Gax is a different wearer/transform design: green skin, yellow discs, spiked pads, uniform and badge were excluded. Using it as anatomy support is not same-variant identity proof.
- AI redraw changes beard strands, facial edge geometry and body proportions; red speckles below the head are interpretive. This draft must not be called exact official reconstruction.
- Generated alpha remains original 0..254: alpha>=128 bbox [27,9,1013,1515] on 1024x1536. Low-alpha residue extends to top/left edges. Red preview glow samples are alpha=0, but final black UI remains unreviewed.

### Amalgam Ben

AI redraw of an independently acquired community-blog animation repost of reboot Amalgam Ben. Human Ben head, original-ten spherical fusion body and mixed limbs are retained; occluded left hands and clipped wing tips are explicitly reconstructed.

来源：[查看来源](https://ben10omniverse2013.blogspot.com/2017/11/amalgam-ben.html)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- The Blogger-hosted page is a community repost, not an independently authenticated official upload. Episode and informal fusion name are associated by that page and body comparison, not a claim of newly played official footage.
- The source machine obscures part of the large left black hand and small purple hand, and the top edge clips wing tips. Their completed contours, finger layout, wing ends and refined facial details are interpretative reconstruction.
- The output broadens and regularizes the original frontal posture and wing shape. Canvas breathing room is narrower than requested: strong-alpha bounds are 15px from left, 13px from top, 12px from right and 19px from bottom. No strong-alpha pixel touches an edge.
- The round178 file named amalgam-ben-official-60456.png was actually Grey Arms and was explicitly excluded; no Grey Arms pixels were supplied.
- Current watch UI, physical phone, real SillyTavern and human acceptance are unverified for this candidate.

### Ampfibian

ai-reference-edit-from-community-animation-clip

来源：[查看来源](https://www.youtube.com/watch?v=wv0kuN5OkfQ)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Input is a full-page browser JPEG screenshot, not a native decoded video frame; only the top-left video panel guided the character. Community uploader title identifies Alien X-Tinction; original animation upstream attribution has not been independently established.
- AI redrew outlines, proportions, white lightning patterns, eye/badge geometry and limb curvature; this is not pixel-exact extraction or an official model.
- Generated alpha is preserved unchanged: alpha 0..254; alpha>=128 bbox [35,75,1502,968] on 1536x1024. Some faint alpha<16 residue extends towards the canvas edge; most grey preview glow is hidden RGB at alpha=0. Final black UI still needs root inspection.

### Monster Kevin (Tales from the Omnitrix)

AI interpretative reconstruction of the FIRST Tales from the Omnitrix Monster Kevin fusion from a community-reposted animation head/chest crop. Unseen arms/lower body use explicitly labeled ordinary Rush and Quad Smack component-anatomy references.

来源：[查看来源](https://www.youtube.com/watch?v=4NGo3R9ZTkk)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- The primary JPEG is an 807x455 browser screenshot at 16.99998 seconds in a community-uploaded video. Flame top, arm ends and the entire lower body lie outside the source.
- The unseen arms, torso continuation, legs, feet and tail are reconstructed from ordinary component anatomy; these supports do not establish exact fused anatomy. Broad limb stance, finger/arm proportions, flame outline and tiny face/chest details are interpretative.
- First attempt incorrectly expanded the tail end into a leaf/claw-like terminal. A second built-in edit replaced it with a gradually tapered tip; this is still an interpretative component-guided tail, not observed complete fused-model evidence.
- Which Watch winged six-arm snake-body and Tales second red-chested form are explicitly excluded.
- Current watch UI, physical phone, real SillyTavern and human acceptance are unverified.

### XLRArmBlastDiamondHeat

AI reference-guided redraw of an actually captured verified Cartoon Network reboot animation frame, preserving the four-arm stance, wheel-feet and tail with small-line interpretation.

来源：[查看来源](https://www.youtube.com/watch?v=94zwEZdSrbA)。本项为 AI 参考重绘；源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Actual source is a 980x551 JPEG browser video screenshot retained from round178, whose earlier private filename ended .png. This copy uses the correct .jpg extension with unchanged SHA. Official channel verification/playback at 155.383566 seconds was recorded by root in round178, not newly replayed by this subagent.
- The original pose and body perimeter are available; narrow overlap near the tail terminal and tiny face/fist/crystal details are reference-guided interpretation. No new full-body pose was invented.
- Highest strong-alpha spike has a 32px top margin; the requested 12% margin was not fully achieved. All strong-alpha limbs/tips stay inside the canvas. Weak positive-alpha edge residue remains and is quantified; root must check actual black-mask presentation.
- Current watch UI, physical phone, real SillyTavern and human acceptance are unverified for this candidate.

## 验证与交付边界

最终构建后单独执行 npm test，**104/104 通过、0 失败、0 跳过、0 取消**。本轮条目逐项检查桌面与手机模拟可用宽度 **375/305px** 下的菱形表盘、投影和环形转盘；截图共 **60 张**。原有 **217 张运行图片** SHA-256 原样保留，新登记源图与输出也没有在收尾脚本中改写像素。

截图采集构建 HTML SHA-256：`d1ae9071736c5cc2ac6729bf1ac3dca1fc2838eed4ee3ffd870a07f688275f04`；采集阶段复核记录时间：2026-10-09T12:33:18.979Z。以上 60 张截图均在阶段 1 前拍摄，保留原字节，没有在升版后重拍。

最终重载构建 HTML SHA-256：`d1ae9071736c5cc2ac6729bf1ac3dca1fc2838eed4ee3ffd870a07f688275f04`；最终重载记录时间：2026-10-09T12:35:20.444Z。即使这两个哈希相同，也分别保留采集与重载记录。本次已逐字节确认视觉代码、目录与布局数据以及全部 227 张运行图片未变，因此保留采集构建的轮廓证据；最终重载的筛选和控制台观察、以及新执行测试则绑定最终构建。根代理已确认最终预览筛选清空。截图哈希、视觉依赖摘要、逐项来源限制及实际控制台记录见 [浏览器证据](browser-qa-v045.json)。

主预览控制台：本轮实测未记录到错误。

响应式测试容器记录：

- 2026-10-09T12:24:08.365Z Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.
- 2026-10-09T12:24:35.168Z Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.
- 2026-10-09T12:24:39.379Z Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.
- 2026-10-09T12:24:51.164Z Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.
- 2026-10-09T12:27:23.985Z Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.

没有据此宣称物理手机、真实酒馆或用户视觉验收通过。四代手表的既有多视角素材和过渡继续保留；本轮没有把它们称为可连续旋转的三维网格。下一步是在用户实际宿主查看和验收。

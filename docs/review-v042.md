# 0.4.2 素材更新

新增 Humungousaur (Grown)、Hypnotick、Antigravitesla、Chromastone。现为 **191/224 条已接入剪影、33 条待补**；目录包含版本、融合与身体状态，不等于独立物种数。

## 来源与解释性重绘

依据实际查看的同版本画面或多张辅助参考整理。不是每张参考都包含完整全身；末端、接合处与小图细节的解释性补绘按下列记录披露，不能称为官方透明原图或逐像素复刻。来源阶段的限制原文保留；其中候选阶段的“UI 待验”措辞，仅由本轮 uiReview 更新本地预览状态，真实宿主、物理手机和用户验收仍未完成。

### Humungousaur (Grown)

AI reference reconstruction from three community-hosted Alien Force animation screenshots of grown Humungousaur. Not an official transparent original or pixel-exact animation cutout.

来源：[查看来源](https://ben10hero.com/wp-content/uploads/2016/10/af_humungousaur_003.png)。源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Primary pose is a 576x432 community mirror of animation content. Official upload chain and exact episode timestamp are unverified.
- Primary source cuts portions of the outer image-left fist/forearm, toes and tail end. These ends were reconstructed with same-form foot and head/armor references; exact outline is interpretative, not recovered production pixels.
- Supporting foot/head images show the same grown design at other poses, not the exact same frame or camera. Reference combination does not prove exact joint positioning.
- Generation emphasizes crown/armor and curls the reconstructed tail tip upward; individual spikes, digit shapes and proportions differ from the low-resolution original.
- TheHawkDown maximum-size redraw was examined but excluded because shorts, pointed club tail and extra plates differ from the requested AF grown appearance; none of its pixels were used.
- Output bytes retained without raster cleanup. Local watch UI review is pending; no physical-phone or user acceptance claimed.

### Hypnotick

Community animation GIF frames used for an AI multi-reference transparent redraw and one targeted wing correction. Not an official transparent original.

来源：[查看来源](https://tenor.com/view/ben10-oliver10-hypnotick-big-chill-hypnosis-gif-27590765)。源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Community Tenor animation mirror tagged Hypnotick/Big Chill/hypnosis, uploader blackvenomsymbiote. Its original official upload and exact episode timestamp have not been independently established; do not call this an official transparent PNG or an official decoded original episode frame.
- Three actual native GIF frames support the same Omniverse insect body. The high-resolution transparent output is an AI reference redraw, not a pixel-exact cutout; fine segments, claws/tusks, face/collar lines and small antenna endpoints are interpretative.
- The source wings are broad translucent moving green arcs. Their exact static outer contour, translucency and membrane extent are not uniquely resolved by the low-resolution motion frames. The adopted v2 uses smooth wide green arcs; this remains an explicit AI interpretation. Do not claim all wing pixels are official anatomy.
- v1 was held for unsupported deep feather/leaf-like wing notches and coarse leaf veins. One targeted correction removed those features while retaining the airborne body and large sideways wing span; both prompts and original output bytes are retained privately.
- Low-alpha residue remains: alpha1-15=23877 pixels, alpha16-127=4821 pixels; nonzero bbox[0,0,1656,931]. Strong-alpha bbox>=128 is[68,7,1618,927], all four strong-alpha edge counts0. Do not claim residue-free background or infer clipped limbs from faint edge pixels.
- The catalog A Fistful of Brains Panuncian-copy occurrence was not directly verified in this GIF. This reference supports the regular Omniverse Hypnotick body design, not proof of the exact wearer/episode or a separate species.
- Copyright and redistribution license are unknown. Current UI, real phone/SillyTavern and driver acceptance are not established by source/material review.

### Antigravitesla

AI reference redraw of original Ultimate Access advertisement content viewed in a community YouTube repost; not an official transparent asset.

来源：[查看来源](https://www.youtube.com/watch?v=2TZpEBYbuFo)。源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- The main character occupies only approximately 200x370 pixels in the retained browser screenshot. Facial features, moustache/hair shape, collar/seam details, hand joins, boots and limb-oval geometry in the enlarged result are AI interpretation, not recovered production-model detail.
- This is one reference-guided redraw using the original existing stance. It is not pixel-identical extraction or an official transparent PNG. The output sharpens and regularizes the source and makes pale forearm details more explicit.
- Original advertisement identity is supported by the actual animation content and the public community video title; the upload is sidroid1000B/@ChivatoMon, not an authenticated Cartoon Network publication. No independent official-upload chain is established.
- No later crew-commission or Omniverse redesign reference was used. The retained full-body commercial pose is the only image input; no hidden major anatomy was reconstructed from a different version.
- Alpha range is 0-254. 31,224 pixels have alpha1-15 and 5,233 have alpha16-127; the nonzero-alpha bounds touch left/bottom canvas. No pixel cleanup or re-encoding was applied. Do not call the asset completely residue-free or treat zero-alpha colored RGB as visible background.
- Current watch UI, real SillyTavern, physical phone and human acceptance are pending for this candidate.

### Chromastone

AI interpretative reference reconstruction of a community-hosted reboot-labelled action image; UAF auxiliary detail reference. Not official transparent artwork.

来源：[查看来源](https://spinwheelmaker.com/wheel/3465)。源图与输出哈希、完整提示词及辅助参考保存在 `assets/extra-art.json`。

- Primary is a small 257x255 community-hosted image labelled Ben 10 Reboot Aliens. Original animation publication/artist and explicit production edition attribution are unverified; use as reboot-design reference based on the observed chunky body, crystal/costume configuration and recorded community label, not as official transparent art.
- AI reference reconstruction, not pixel-faithful extraction. Frame-clipped hand/finger ends and the bottom foot continuation were inferred; the resulting near lower foot is broader/longer than the original visible fragment. Exact missing tip geometry is not established.
- UAF artwork supplies auxiliary crystalline hand/crystal construction only, not reboot pose or proportional authority. Its different edition is explicitly disclosed. No claim that the two editions have identical silhouettes or should be merged.
- AI changed internal facet lines, finger construction, contour polish, shading and some colors (eye appears lime rather than the primary yellow-green). Chest/head details are interpretations of a low-resolution source.
- Visible action is preserved, not a standing model-sheet pose. Low-alpha boundary pixels reach the canvas edges although alpha>=128 contour stays within [11,25,1250,1234]. Final pure-black current UI remains unviewed.
- Source artwork and underlying Ben 10 remain copyrighted; redistribution permission and open licensing are unverified.

## 验证与交付边界

最终构建后单独执行 npm test，**104/104 通过、0 失败、0 跳过、0 取消**。本轮条目逐项检查桌面与手机模拟可用宽度 **375/305px** 下的菱形表盘、投影和环形转盘；截图共 **24 张**。原有 **195 张运行图片** SHA-256 原样保留，新登记源图与输出也没有在收尾脚本中改写像素。

最终 HTML SHA-256：`79f4a78a4970d5fd5eee94aafa1f1458693da2b7235e119b1bb1a2e7ffbb8b3a`。根代理已确认最终预览筛选清空。截图哈希、逐项来源限制及实际控制台记录见 [浏览器证据](browser-qa-v042.json)。

主预览控制台：本轮实测未记录到错误。

响应式测试容器记录：

- Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.

没有据此宣称物理手机、真实酒馆或用户视觉验收通过。四代手表的既有多视角素材和过渡继续保留；本轮没有把它们称为可连续旋转的三维网格。下一步是在用户实际宿主查看和验收。

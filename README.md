# Omnitrix · 变身档案

SillyTavern 外星人选择插件，同时提供可双击打开的独立 `preview.html`。

## 可用界面

- 四款可切换表壳：初代 Omnitrix、Alien Force 重校准版、Ultimatrix、Omniverse 完成版。0.2.0 换用透明背景的细节重绘，图像生成记录见 `assets/watches-v3/`。
- 三种召唤界面：分层全息投影、带远近缩放的环形转盘、带交叉挡片的菱形表盘。每种都有选择与锁定动画；宇宙记录墙已移除，旧偏好自动回到投影。
- 菱形表盘按每个剪影的实际透明像素单独计算比例，让翅膀、手臂等轮廓完整落在菱形内。168 个已接入素材均有适配记录。
- 电脑与手机共用一套页面；支持点击、左右滑动、方向键和 Enter。遵循系统减少动态设置。
- 一份共享档案：224 条记录，168 条已接入剪影，56 条素材待补。0.2.6 新增漫画版小奇兵（保留原封面铅笔道具）、游戏参考 Slamworm 和终极 Panuncian。3 张均为 AI 参考编辑，非官方透明原图；来源、原始字节、完整提示词和差异见 `assets/extra-art.json`。记录含作品版本、融合和身体状态，不等于独立物种数量。
- 可搜索中文/英文名称和筛选作品。缺图会明确显示“素材待补”。

## 预览

直接打开仓库根目录的 **preview.html**。文件内嵌了样式、脚本和素材，不需要联网。

也可以用 Node.js 运行：

```sh
npm run dev
```

打开终端打印的本地地址。预览模式只保存界面偏好；锁定形态之后可复制名称。

## 安装到 SillyTavern

当前是 0.2.6 测试版。公开仓库位于 [louisSSR/ben10-omnitrix-plugin](https://github.com/louisSSR/ben10-omnitrix-plugin)，Git 安装地址为 `https://github.com/louisSSR/ben10-omnitrix-plugin.git`，无需 GitHub 登录。

1. 在扩展管理器中使用上述 Git 地址安装；也可将发布包的 `ben10-omnitrix-0.2.6` 文件夹放入 SillyTavern 的第三方扩展目录（目录内直接包含 `manifest.json`）。
2. 重载酒馆，在扩展设置里打开 **Omnitrix**。
3. 选择手表和召唤界面，选择外星人并点击“锁定形态”。
4. 需要使用时点击“写入酒馆输入框”。原有草稿保留，插件不会自动发送或调用模型。

不同安装方式/多用户配置可能使用不同的扩展目录，请以当前酒馆扩展管理器为准。

### 安装提示 Directory already exists

这表示目标目录已存在，安装器没有进入本次克隆；不能据此断定插件已装完整或代码有运行错误。

**SillyDroid 手机用户直接使用[手机安装／覆盖修复／更新入口](docs/mobile-install.md)。** 在 SillyDroid 原生设置的“终端”执行文档中的一条命令，首次安装、修复残留和以后更新都用它。工具会先完整下载、校验、备份，再覆盖同名目录的五个运行文件，保留其他内容；不需要找目录或删除旧插件。

这个入口不依赖插件已经出现在管理列表里。默认运行只预检，文档中的 `--apply` 表示执行覆盖。没有原生“终端”的旧版 SillyDroid 尚未验证这条路径。

仓库已公开，匿名 Git 和安装清单读取通过。公开状态解决下载权限；覆盖工具解决同名目录残留，两者分别处理。非 SillyDroid 的诊断依据见[安装报错说明](docs/install-troubleshooting.md)。

目前未在用户手机的真实酒馆中核验安装和启用，独立预览成功不等于安装成功。

## 开发

```sh
npm run build
npm test
npm run package
```

零运行时第三方依赖。维护 `core.js`、`app.js`、`styles.css` 和 `preview.shell.html`，构建生成单文件页面。`host-adapter.js` 隔离 SillyTavern 能力；同一 Core/UI 用于独立预览和宿主 iframe。

ST 1.18 / 1.19 的目标 API 已按固定版本源码比对，采用能力检测共用实现。源码与模拟测试不代表真实酒馆验收；详见 [宿主契约](docs/host-contract.md) 和 [0.2.6 验证记录](docs/review-v026.md)。

所有截图参考、动画角色及剪影的权利归各原权利人。请阅读 [NOTICE.md](NOTICE.md)。

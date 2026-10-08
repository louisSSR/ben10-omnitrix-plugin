# 手机安装、覆盖修复与更新

`Directory already exists` 是酒馆新装入口拒绝使用已有目录。把仓库改成公开能够解决匿名下载权限，不能让这个入口自动覆盖旧目录。这里提供专用于本仓库的覆盖工具，首次安装、修复残留目录和以后更新都用同一套命令。

## 在 SillyDroid 手机里使用

打开 **SillyDroid 原生设置 → 终端**，粘贴下面完整命令并执行。运行成功后回酒馆刷新页面，在扩展设置中打开 `Ben 10 · Omnitrix`。

```sh
omni_boot="${HOST_TMP_DIR:?请在 SillyDroid 原生设置的终端运行}/omnitrix-update.sh" && "${TERMUX_CURL_BIN:?缺少宿主 curl}" --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 90 'https://raw.githubusercontent.com/louisSSR/ben10-omnitrix-plugin/main/scripts/mobile-install.sh' --output "$omni_boot" && "${TERMUX_SH_BIN:?缺少宿主 shell}" "$omni_boot" --apply
```

以后更新仍使用这一条。首次安装只放五个运行文件，不创建 `.git`，因此后续也使用本入口更新。无需查找 Android 私有目录，也无需删除旧扩展或重装酒馆。它安装当前公开仓库 `main` 中已经发布的版本；本地尚未推送的开发内容不会被下载。

希望先查看计划时，去掉最后的 `--apply`。默认只把运行文件下载到内存并检查，不写入插件、备份或设置（启动脚本自身会暂存到宿主临时目录）。第二次带 `--apply` 才会覆盖。脚本只接受固定仓库，不接受其他仓库 URL。

这是 **SillyDroid 自己的终端**，不是酒馆聊天输入框、浏览器地址栏、电脑 PowerShell 或另一个 Termux App。Android 会隔离不同 App 的私有数据，外部 Termux 无法直接修复此目录。官方当前源码提供该终端；没有这个标签的旧版 SillyDroid 不能据此声称已兼容，可使用宿主已有的扩展重装功能或升级到提供终端的版本。

## 具体行为

工具使用宿主导出的 `APP_DATA_ROOT`，目标为其下 `data/default-user/extensions/ben10-omnitrix-plugin`。用户这次报错对应的绝对路径为：

```text
/data/user/0/com.jm.sillydroid/files/android-tavern/data/server/data/default-user/extensions/ben10-omnitrix-plugin
```

每次先解析 `main` 的完整提交 SHA，然后从**同一提交**下载五个文件，并核对 GitHub 文件树中的大小和 Git blob 哈希。manifest 身份、两个 JS 模块语法及预览是否已完整构建也会检查。

每个运行文件最多 64 MiB（67,108,864 字节），用于容纳内嵌素材的预览。响应头声明超限或实际下载累计超限都会停止，缺少或不准确的大小声明也不能绕过限制。提交信息仍限 256 KiB，文件树仍限 2 MiB；这些限制不会跳过上述内容校验。预检和安装都先把文件下载到内存，因此 64 MiB 不是整个安装进程的内存上限。

全部检查成功后，才进入写入阶段：

- 只覆盖 `extension.js`、`host-adapter.js`、`extension.css`、`preview.html` 和最后的 `manifest.json`。
- 保留 `.git`、目录内其他文件，以及所有角色卡、聊天和酒馆设置。整个旧目录不会被删除。
- 已有文件先备份到 `APP_DATA_ROOT/.ben10-omnitrix-backups/时间戳-随机编号/before/`，该位置位于扩展扫描目录之外。
- 覆盖中发生可捕获的写入错误，会尝试恢复已替换文件并移除本次新建文件；测试中的写入失败已验证恢复成功。若磁盘或权限问题使恢复本身也失败，会明确报错并保留备份，不会递归删除目标目录。
- 如果五个文件已相同，直接报告无需覆盖，不产生新备份。下载失败、哈希不匹配或本地文件在下载期间发生变化时停止，不覆盖。
- 拒绝数据根下的符号链接、路径逃逸和错误文件类型。Android 在数据根以上的系统路径别名会先规范化。

回执 `receipt.json` 留有提交号、变更清单及前后文件 SHA-256，可定位备份。备份不自动删除。五个文件逐个替换，整个目录**不是断电原子事务**。进程在写入中途被结束时，可能留下新旧文件混合状态。一次性目录测试中，真实子进程替换前两个文件后退出；随后重新运行能够补齐完整版本、清除该退出进程的有效安装锁，并保留第一次的旧文件备份。这项测试不代表所有中断时刻、手机强杀或突然断电均已验证。突然断电涉及磁盘落盘，不能保证自动回滚。锁记录损坏或权限异常时脚本会停止，不删除原数据。若需要恢复旧版，依据对应回执把 `before` 内文件恢复原位；其中原本不存在的文件由回执 `before: null` 标明。回滚本身失败时，终端会明确报告备份路径。

**首次安装只放五个运行文件，不创建 `.git` 仓库；以后请继续用这条命令更新。** 已有 `.git` 时工具保留它，但酒馆的 Git 更新按钮可能将覆盖文件视为本地改动，未保证与它混用。`manifest.homePage` 即使填写仓库地址也不会生成 `.git`。工具不修改 SillyTavern 的 `/api/extensions/install`，也不声称插件能在安装前更改宿主的 409 行为。

## 官方来源与验证边界

2026-10-09 检查了 SillyDroid 上游 `master` 的以下文件：

- [原生终端启动脚本](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/app/src/main/assets/bootstrap/scripts/start-console-shell.sh)：导出 `APP_DATA_ROOT`、`HOST_TMP_DIR`、Node/curl/shell 路径，进入与酒馆服务一致的运行环境。
- [原生终端启动规格](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/data/runtime/src/main/kotlin/com/jm/sillydroid/data/runtime/DefaultConsoleRuntimeRepository.kt)：设置页终端使用宿主运行环境。
- [扩展路径提供器](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/data/runtime/src/main/kotlin/com/jm/sillydroid/data/runtime/HostExtensionDirectoriesProvider.kt)：用户扩展目录位于服务数据根下 `data/default-user/extensions`。
- [设置页文案](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/feature/settings/src/main/res/values/strings.xml)：终端标签为“终端”。
- [宿主扩展维护实现](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/data/extensions/src/main/kotlin/com/jm/sillydroid/data/extensions/ExtensionCommandExecutor.kt)：宿主另有 `reinstall` 流程。本文工具采用五文件覆盖并保留无关内容，不假定用户当前进入了这个宿主重装入口。

自动验证命令：`node --test tests/mobile-install.test.mjs`。测试只使用一次性目录，覆盖重复安装、半成品修复、无关文件保留、下载失败、哈希失败、写入回滚、路径类型、符号链接、下载期间本地变更及真实子进程中途退出后的再次修复。没有访问或控制用户手机，没有完成手机真机安装验收。

脚本入口按真实文件路径识别，避免 Android 数据路径别名导致静默退出；额外使用真实 Windows 目录 junction 验证了物理路径和别名路径均能启动 CLI。安装专项现为 15 项测试，包含合法 64 MiB 预览、下载超限后不覆盖旧文件和元数据上限检查；这些测试仍不代替手机实装。

2026-10-09 另对公开仓库做过真实网络预检：解析到提交 `124196bae4f018ea2e053875374741b46e6689b2`、版本 `0.1.0`，五个文件下载及 Git blob 哈希、入口语法、预览检查均成功，临时目标目录仍为空。此记录仅证明该提交的下载与预检，不代表后续提交或手机实装已验证。

2026-10-09 发布后复核：远端为 `33de082e92a1246731df7f840b2713be95ed0145`，安装脚本与测试已公开，远端 manifest 仍为 `0.1.0`。对应 11 项安装测试通过；这次复核没有再次安装运行文件，也没有访问手机。

# 手机安装、覆盖修复与更新

`Directory already exists` 是酒馆新装入口拒绝使用已有目录。下面的工具直接在原目录覆盖本插件的运行文件；首次安装、修复残留目录和以后更新都使用同一条命令，无需删除旧目录或重装酒馆。

## 在 SillyDroid 手机里使用

打开 **SillyDroid 原生设置 → 终端**，粘贴下面完整命令并执行。成功后回酒馆刷新页面，在扩展设置中打开 `Ben 10 · Omnitrix`。

```sh
omni_boot="${HOST_TMP_DIR:?请在 SillyDroid 原生设置的终端运行}/omnitrix-update.sh" && "${TERMUX_CURL_BIN:?缺少宿主 curl}" --fail --silent --show-error --proto '=https' --tlsv1.2 --max-time 90 'https://raw.githubusercontent.com/louisSSR/ben10-omnitrix-plugin/main/scripts/mobile-install.sh' --output "$omni_boot" && "${TERMUX_SH_BIN:?缺少宿主 shell}" "$omni_boot" --apply
```

以后更新仍使用这一条。工具安装当前公开仓库 `main` 的已发布版本，本地尚未推送的开发内容不会被下载。首次安装不创建 `.git`，所以后续也使用本入口更新；已有 `.git` 会保留，但不保证与酒馆 Git 更新按钮混用。

希望先检查时，去掉最后的 `--apply`。默认预检会使用并清理 **系统临时目录**，不写入扩展、备份或设置；启动脚本自身仍会留在宿主临时目录。它不再将整包图片保存在内存中。执行带 `--apply` 的命令才会覆盖。

这是 **SillyDroid 自己的终端**，不是聊天输入框、浏览器地址栏、电脑 PowerShell 或另一个 Termux App。Android 会隔离不同 App 的私有数据。没有终端标签的旧版 SillyDroid 未验证兼容，可使用宿主已有的扩展重装功能或升级到提供终端的版本。

## 离线目录包

页面与图片分开保存，使用同一套 Core / UI。离线使用时打开 `preview.html`，必须保留同目录的 `assets/runtime/`，不要只拷贝一个 HTML。手机工具会自动下载这些素材。运行时不依赖远程图片；图片沿用原始 PNG / AVIF 字节，不重新压缩或修改像素。当前自动浏览器只支持 HTTP/HTTPS，本版实际验证使用本地服务；直接双击的 `file://` 路径尚未在该浏览器验收。

工具只接受固定仓库 `louisSSR/ben10-omnitrix-plugin`，不接受其他仓库 URL。每次解析 `main` 的完整提交 SHA，读取同一提交的递归 Git 文件树，然后核验 `runtime-manifest.json` 自身的大小和 Git blob 哈希。清单必须包含五个固定入口：

- `extension.js`、`host-adapter.js`、`extension.css`、`preview.html`、`manifest.json`。
- 其他条目只能是 `assets/runtime/<64 位小写 SHA-256>.png` 或 `.avif`；文件名必须匹配内容哈希。

清单格式是 `schemaVersion: 1`、`files: [{path, bytes, sha256}]`。清单本身不自列，但会安装到扩展目录并计入总包大小。每项都核对 Git 文件树大小、Git blob 哈希和清单 SHA-256；本地已有文件只有通过同样校验后才会复用。缺少清单不会静默回退到旧版五文件包。已装旧版的目录仍可直接升级到具有清单的新发布版本。

限制保持明确：**单文件最多 64 MiB，整包含清单最多 256 MiB，清单最多 512 个条目**。提交信息限 256 KiB，递归文件树和运行清单分别限 2 MiB。响应头超限或实际读取超限都会停止；虚假或缺失的长度声明不能绕过校验。资源逐个写入临时文件并计算哈希，旧文件也通过流式读取校验。入口 HTML / JS 的内容检查仍会读取单个文件，因此这些限制不是整个进程的精确内存上限。临时目录和备份需要可用磁盘空间。

## 覆盖与恢复范围

工具使用宿主导出的 `APP_DATA_ROOT`，目标固定为其下 `data/default-user/extensions/ben10-omnitrix-plugin`。本次报错对应：

```text
/data/user/0/com.jm.sillydroid/files/android-tavern/data/server/data/default-user/extensions/ben10-omnitrix-plugin
```

完整下载和检查成功后才开始覆盖：

- 素材先写入，入口随后写入，`manifest.json` 最后替换。
- 保留 `.git`、所有非本次运行包的文件、角色卡、聊天及酒馆设置。旧资源也不自动删除，整个扩展目录不会被清空。
- 被替换的文件先备份到 `APP_DATA_ROOT/.ben10-omnitrix-backups/时间戳-随机编号/before/`，并记录前后 SHA-256、提交号和变更清单。
- 可捕获的写入错误会尝试恢复已替换文件，移除本次新建文件及已空的新建目录。恢复本身失败会明确报错并保留备份。
- 全部文件相同时无需覆盖，不产生新备份。下载失败、哈希不符、文件树不完整，或下载后发现本地文件被其他进程修改时停止。
- 拒绝数据根下的符号链接、路径逃逸和错误类型，包含素材的嵌套目录。Android 数据根以上的系统别名及脚本入口别名会规范化。

文件逐个替换，**整个目录不是断电原子事务**。进程强制结束可能留下新旧文件混合状态和未清理的系统临时下载。测试中的真实子进程在替换入口或素材后退出，再次运行能够补齐版本、清除已退出进程的有效安装锁，并保留第一次的旧文件备份；未自动删除其他进程遗留的临时目录。突然断电、所有强杀时刻及磁盘落盘情况没有真机验证。锁记录损坏或权限异常时停止。

备份不自动删除。需要恢复旧版时，根据对应 `receipt.json` 将 `before/` 文件恢复原位；`before: null` 表示当时该文件不存在。脚本不修改 SillyTavern 的 `/api/extensions/install`，也不能在安装前改变宿主的“目录已存在”拒绝行为。

## 官方来源与验证边界

2026-10-09 核对过 SillyDroid 上游 `master`：

- [原生终端启动脚本](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/app/src/main/assets/bootstrap/scripts/start-console-shell.sh)：导出数据根、临时目录及 Node / curl / shell 路径。
- [原生终端启动规格](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/data/runtime/src/main/kotlin/com/jm/sillydroid/data/runtime/DefaultConsoleRuntimeRepository.kt)：设置页终端使用宿主运行环境。
- [扩展路径提供器](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/data/runtime/src/main/kotlin/com/jm/sillydroid/data/runtime/HostExtensionDirectoriesProvider.kt)：用户扩展目录的位置。
- [终端标签文案](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/feature/settings/src/main/res/values/strings.xml)及[宿主扩展维护实现](https://github.com/jialmaster/SillyDroid/blob/master/android-tavern/data/extensions/src/main/kotlin/com/jm/sillydroid/data/extensions/ExtensionCommandExecutor.kt)。

安装专项命令：`node --test tests/mobile-install.test.mjs`。测试只使用一次性目录，覆盖重复覆盖、局部旧包修复、嵌套素材与无关文件保留、磁盘暂存清理、素材 / 清单 / Git blob 篡改、缺素材、非法路径、数量与容量边界、写入回滚、安装期间本地变更、真实进程中断后重跑及 Windows 目录别名。

64 MiB 单文件接受与超限停止做了实际数据测试；256 MiB 整包边界使用清单 / 文件树元数据测试，验证超限在下载正文前停止，没有实际下载 256 MiB。此前旧五文件包的公开网络预检只证明当时提交，不代替本目录包的新发布预检。没有访问用户手机，也没有完成手机真机安装验收。

# 手机安装遇到同名目录

报错 `Directory already exists at public/scripts/extensions/third-party/ben10-omnitrix-plugin` 目前只能确认：运行酒馆的设备上，这个安装目标路径已经存在。它不能证明插件安装成功，也不能证明插件能够打开。目录可能来自先前未完成的安装、其他安装尝试或手工放入的文件；本轮没有读取手机上的目录和第一次安装日志，具体来源未知。

## 官方源码里的执行顺序

已只读核对官方固定版本 [ST 1.18.0 安装端点](https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/src/endpoints/extensions.js#L85) 和 [ST 1.19.0 安装端点](https://github.com/SillyTavern/SillyTavern/blob/7e8663cd9c184a550b37238218bdd32c6efc68e9/src/endpoints/extensions.js#L85)。两版在这里的顺序相同：

| 行号 | 实际检查 | 对当前报错的含义 |
| --- | --- | --- |
| [119](https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/src/endpoints/extensions.js#L119) | 目标路径存在时直接返回 HTTP 409 | 本次请求在这里结束 |
| [125](https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/src/endpoints/extensions.js#L125) | 克隆仓库到该路径 | 当前 409 请求尚未执行克隆 |
| [128](https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/src/endpoints/extensions.js#L128) | 读取 `manifest.json` | 当前 409 请求尚未检查 manifest |
| [139](https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/src/endpoints/extensions.js#L139) | 记录 `Importing extension failed` 异常，随后返回 500 | 第一次失败的具体原因要看服务器日志 |

截图所示路径对应固定源码中的[全局第三方扩展目录](https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/src/constants.js#L5)。安装端点只在 manifest 读取失败的分支执行目录清理；外层克隆异常分支没有统一清理逻辑。这个事实允许“不完整目录仍存在”的可能性，不能据此断言第一次就是认证失败或一定留下了目录。

## SillyDroid 手机直接覆盖修复

用户最新报错位于 SillyDroid 的 `data/default-user/extensions/ben10-omnitrix-plugin`。请优先使用[手机安装／修复／更新工具](mobile-install.md)：在宿主自己的终端重复执行固定入口，完整下载并校验后备份、覆盖本插件的五个运行文件。无需在 Android 文件管理器里查找私有路径，也无需删除旧目录。首次安装不创建 `.git`，以后继续用同一入口更新。此工具尚未在用户手机上实装验收。

## 供其他宿主维护者核查的目录信息

在实际运行酒馆的设备上，定位报错对应的 `<酒馆根目录>/public/scripts/extensions/third-party/ben10-omnitrix-plugin`，只核对这一目录：

1. 是否有可解析的 `manifest.json`，以及其声明的 `extension.js`、`extension.css`。
2. 是否有入口依赖的 `host-adapter.js` 和完整的 `preview.html`。
3. 如果走的是 Git 安装，仓库是否完整；单独存在 `.git` 不能证明克隆成功。离线包安装可以没有 `.git`，但此时不能把它当成可正常 Git 更新的仓库。
4. 查看第一次安装时的服务器日志，保留具体错误类型和缺失文件名即可。当前 409 与第一次失败应分别记录。

本地插件的 manifest 和 `extension.js` 已只读检查：入口是 ES module，导入相邻 Adapter，自动调用幂等 `activate()`。它们不参与安装目标目录的创建或服务端 409 检查。当前没有证据将这条目录报错归因于插件初始化。源码通过检查也不能证明手机上的文件完整或插件已运行。

## 恢复路径

本项目的 SillyDroid 路径使用上述覆盖工具作为首选方案。其他宿主若无法使用覆盖工具，应由该宿主维护者先备份目标目录再恢复完整运行文件；整目录迁出重装仅是可选维护方式，不是手机用户必须执行的步骤。不要改名堆重复安装，也不要删除整个扩展目录。

2026-10-09，本轮根任务已按用户明确授权，将 [louisSSR/ben10-omnitrix-plugin](https://github.com/louisSSR/ben10-omnitrix-plugin) 改为公开仓库，并核对匿名 REST、原始 manifest 访问和无凭据 Git 远端读取。首次核验时远端 HEAD 为 `124196b`。覆盖修复入口发布后的复核提交为 `33de082e92a1246731df7f840b2713be95ed0145`，当时远端 manifest 仍为 `0.1.0`。仓库读取权限这一项已解决；公开仓库不会自动清除手机上的同名路径，也不会自动发布本地尚未推送的代码。

仓库此前私有，第一次失败是否由私库认证造成仍属未知历史。浏览器登录 GitHub 与酒馆[服务端 Git 客户端](https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/src/git/client.js#L65) 是不同的读取路径，因此当时不能只凭浏览器登录就认定克隆有权限。当前恢复应围绕占用目录及实际服务器日志进行；若重新克隆仍报错，记录手机端实际网络或 Git 错误，不再把私库状态作为当前阻断。完整离线包仍须满足上面的文件检查。

手机浏览器里的 `localhost` / `127.0.0.1` 指向手机自身。电脑访问同样地址会访问电脑自身，因此本轮无法通过电脑的本地地址检查手机目录、日志或执行恢复。若酒馆实际运行在远程服务器，目录检查和备份也应在那台服务器进行。

修复后的验证顺序是：目标文件完整、安装或包放置成功、酒馆刷新后发现并加载插件、入口能够打开、手机交互与关闭正常。每一步都需要实际证据。当前已有官方源码核查、公开仓库读取预检和 11 项一次性目录安装测试；测试包括捕获写入失败后的恢复，以及子进程替换两个文件后退出再运行的修复。覆盖工具不是断电原子事务，这些测试不代表手机强杀或断电验收。尚未安装、更新、移动或删除用户手机/服务器目录，手机加载和交互仍需真机证据。

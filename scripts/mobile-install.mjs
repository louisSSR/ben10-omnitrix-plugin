#!/usr/bin/env node
// Fixed-repository repair tool. No host API changes, shell execution, or extra dependencies.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const REPOSITORY = 'louisSSR/ben10-omnitrix-plugin';
export const RUNTIME_FILES = Object.freeze(['extension.js', 'host-adapter.js', 'extension.css', 'preview.html', 'manifest.json']);
const DEFAULT_ROOT = '/data/user/0/com.jm.sillydroid/files/android-tavern/data/server';
const BACKUPS = '.ben10-omnitrix-backups';
const FILE_LIMIT = 32 * 1024 * 1024;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const gitBlob = value => createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex');

async function statOrNull(file) {
    try { return await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function safePath(root, relative, { directory = false } = {}) {
    const pieces = relative.split('/');
    if (pieces.some(piece => !piece || piece === '.' || piece === '..' || piece.includes('\\'))) throw new Error('Unsafe relative path');
    let current = root;
    for (const [index, piece] of pieces.entries()) {
        current = path.join(current, piece);
        const stat = await statOrNull(current);
        if (!stat) continue;
        if (stat.isSymbolicLink()) throw new Error(`拒绝符号链接：${current}`);
        if ((index < pieces.length - 1 || directory) ? !stat.isDirectory() : !stat.isFile()) throw new Error(`路径类型不正确：${current}`);
    }
    const relation = path.relative(root, current);
    if (relation.startsWith('..') || path.isAbsolute(relation)) throw new Error('Path escapes data root');
    return current;
}

async function readRemote(url, fetchImpl, limit = FILE_LIMIT) {
    const response = await fetchImpl(url, {
        redirect: 'error', signal: AbortSignal.timeout(60000),
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ben10-omnitrix-mobile-installer' },
    });
    if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）：${new URL(url).pathname}`);
    if (Number(response.headers.get('content-length')) > limit) throw new Error('下载文件超过大小限制');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit) throw new Error('下载文件超过大小限制');
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export async function downloadRuntime(fetchImpl = fetch) {
    const api = `https://api.github.com/repos/${REPOSITORY}`;
    const ref = JSON.parse(await readRemote(`${api}/git/ref/heads/main`, fetchImpl, 256 * 1024));
    const commit = ref.object?.sha;
    if (!/^[a-f0-9]{40}$/.test(commit || '') || ref.object?.type !== 'commit') throw new Error('GitHub 未返回有效的 main 提交');
    const tree = JSON.parse(await readRemote(`${api}/git/trees/${commit}`, fetchImpl, 2 * 1024 * 1024));
    if (!Array.isArray(tree.tree) || tree.truncated) throw new Error('GitHub 文件树不完整');
    const files = {};
    for (const name of RUNTIME_FILES) {
        const entry = tree.tree.find(item => item.path === name);
        if (!entry || entry.type !== 'blob' || entry.mode !== '100644' || !/^[a-f0-9]{40}$/.test(entry.sha)) throw new Error(`仓库运行文件缺失或类型错误：${name}`);
        const bytes = await readRemote(`https://raw.githubusercontent.com/${REPOSITORY}/${commit}/${name}`, fetchImpl);
        if (entry.size !== bytes.length || gitBlob(bytes) !== entry.sha) throw new Error(`文件校验失败：${name}`);
        files[name] = bytes;
    }
    validateRuntime(files);
    return { commit, files };
}

export function validateRuntime(files) {
    const manifest = JSON.parse(files['manifest.json'].toString('utf8'));
    if (manifest.display_name !== 'Ben 10 · Omnitrix' || manifest.js !== 'extension.js' || manifest.css !== 'extension.css' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(manifest.version || '')) throw new Error('下载的 manifest 不符合本插件身份或入口约定');
    for (const name of ['extension.js', 'host-adapter.js']) {
        const checked = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: files[name], encoding: 'utf8' });
        if (checked.error || checked.status !== 0) throw new Error(`JavaScript 语法检查失败：${name}`);
    }
    const html = files['preview.html'].toString('utf8');
    if (!/<!doctype html>/i.test(html) || !/id=["']omni-app["']/.test(html) || /APP_STYLES|CATALOG_DATA|ART_SYMBOLS|APP_CODE/.test(html)) throw new Error('preview.html 尚未构建或不是 Omnitrix 页面');
    if (/<(?:script|img)\b[^>]*\bsrc=["'](?!data:)[^"']+/i.test(html) || /<link\b[^>]*\bhref=["'](?!data:)[^"']+/i.test(html)) throw new Error('preview.html 不是完整内嵌资源包');
    if (!files['extension.css'].length || /<!doctype|<html/i.test(files['extension.css'].toString('utf8'))) throw new Error('样式文件无效');
    return manifest;
}

/** fetchImpl / beforeReplace are test seams; the CLI accepts no alternate repository or URL. */
export async function install({ dataRoot = process.env.APP_DATA_ROOT || DEFAULT_ROOT, apply = false, fetchImpl = fetch, beforeReplace = async () => {}, log = console.log } = {}) {
    if (!path.isAbsolute(dataRoot) || dataRoot.split(/[\\/]/).includes('..')) throw new Error('数据根目录必须是无 .. 的绝对路径');
    const rootStat = await fs.lstat(dataRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('数据根目录不存在、不是目录或是符号链接');
    // Android may alias /data/data and /data/user/0 above this trusted root.
    const root = await fs.realpath(dataRoot);
    const relativeTarget = 'data/default-user/extensions/ben10-omnitrix-plugin';
    const target = await safePath(root, relativeTarget, { directory: true });
    const backupRoot = await safePath(root, BACKUPS, { directory: true });
    const existing = {};
    for (const name of RUNTIME_FILES) {
        const destination = await safePath(root, `${relativeTarget}/${name}`);
        const stat = await statOrNull(destination);
        existing[name] = stat ? { bytes: await fs.readFile(destination), mode: stat.mode & 0o777 } : null;
    }
    log('正在获取公开仓库 main 的同一提交；完整下载、校验后才会写入。');
    const { commit, files } = await downloadRuntime(fetchImpl);
    const manifest = validateRuntime(files);
    const changes = RUNTIME_FILES.filter(name => !existing[name]?.bytes.equals(files[name]));
    const result = { mode: apply ? 'apply' : 'dry-run', repository: REPOSITORY, commit, version: manifest.version, target, changed: changes, backup: null };
    log(JSON.stringify(result, null, 2));
    if (!apply) { log('预检完成，未写入任何文件。加 --apply 才执行覆盖。'); return result; }
    if (!changes.length) { log('五个运行文件已与该提交一致，无需覆盖。'); return result; }
    await fs.mkdir(backupRoot, { recursive: true });
    await safePath(root, BACKUPS, { directory: true });
    const lockPath = await safePath(root, `${BACKUPS}/install.lock`);
    if (await statOrNull(lockPath)) {
        const owner = JSON.parse(await fs.readFile(lockPath, 'utf8'));
        if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) throw new Error(`安装锁记录不完整，已停止：${lockPath}`);
        try { process.kill(owner.pid, 0); }
        catch (error) { if (error.code === 'ESRCH') await fs.unlink(lockPath); else throw error; }
    }
    let lock;
    try { lock = await fs.open(lockPath, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('另一个安装进程仍在运行，请等待它结束后重试。'); throw error; }
    const backup = path.join(backupRoot, `${Date.now()}-${randomUUID()}`);
    const applied = [];
    const madeDirectories = [];
    try {
        await lock.writeFile(JSON.stringify({ pid: process.pid, commit }));
        // Recheck after the network wait: do not overwrite another process's changes.
        for (const name of RUNTIME_FILES) {
            const destination = await safePath(root, `${relativeTarget}/${name}`);
            const now = await statOrNull(destination);
            if (Boolean(now) !== Boolean(existing[name]) || (now && !(await fs.readFile(destination)).equals(existing[name].bytes))) throw new Error(`下载期间本地文件发生变化，已停止：${name}`);
        }
        await fs.mkdir(backup, { mode: 0o700 });
        await fs.mkdir(path.join(backup, 'before'));
        await fs.mkdir(path.join(backup, 'next'));
        for (const name of changes) {
            if (existing[name]) await fs.writeFile(path.join(backup, 'before', name), existing[name].bytes, { flag: 'wx', mode: existing[name].mode });
            await fs.writeFile(path.join(backup, 'next', name), files[name], { flag: 'wx', mode: existing[name]?.mode ?? 0o644 });
        }
        const receipt = { ...result, backup, state: 'prepared', files: changes.map(name => ({ name, before: existing[name] ? sha256(existing[name].bytes) : null, after: sha256(files[name]) })) };
        await fs.writeFile(path.join(backup, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
        for (const relative of ['data', 'data/default-user', 'data/default-user/extensions', relativeTarget]) {
            const dir = await safePath(root, relative, { directory: true });
            if (!(await statOrNull(dir))) { await fs.mkdir(dir); madeDirectories.push(dir); }
        }
        for (const [index, name] of changes.entries()) {
            await beforeReplace({ index, name, target });
            await safePath(root, `${relativeTarget}/${name}`);
            await fs.rename(path.join(backup, 'next', name), path.join(target, name));
            applied.push(name);
        }
        for (const name of changes) if (!(await fs.readFile(path.join(target, name))).equals(files[name])) throw new Error(`写入后校验失败：${name}`);
        receipt.state = 'applied';
        await fs.writeFile(path.join(backup, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
        result.backup = backup;
        log(`安装 / 修复完成：${manifest.version}。旧文件备份：${backup}。回酒馆刷新页面。以后更新可重复运行同一命令。`);
        return result;
    } catch (error) {
        const rollbackErrors = [];
        for (const name of applied.reverse()) {
            try {
                await safePath(root, `${relativeTarget}/${name}`);
                if (existing[name]) {
                    const restore = path.join(backup, 'next', name);
                    await fs.copyFile(path.join(backup, 'before', name), restore);
                    await fs.chmod(restore, existing[name].mode);
                    await fs.rename(restore, path.join(target, name));
                } else { await fs.unlink(path.join(target, name)); }
            } catch (rollbackError) { rollbackErrors.push(`${name}: ${rollbackError.message}`); }
        }
        for (const directory of madeDirectories.reverse()) {
            try { await fs.rmdir(directory); } catch (cleanupError) { if (cleanupError.code !== 'ENOTEMPTY' && cleanupError.code !== 'ENOENT') rollbackErrors.push(cleanupError.message); }
        }
        if (rollbackErrors.length) throw new Error(`覆盖失败；部分回滚未完成。保留备份于 ${backup}。${rollbackErrors.join('; ')}`, { cause: error });
        throw new Error(`覆盖已停止，已写入的运行文件已恢复；原目录和其他文件保留。原因：${error.message}`, { cause: error });
    } finally {
        await lock.close();
        await fs.unlink(lockPath);
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
        console.log('Omnitrix 手机安装 / 修复 / 更新\nnode mobile-install.mjs [--apply] [--data-root 绝对路径]\n默认只预检。仅从 louisSSR/ben10-omnitrix-plugin 的 main 安装五个运行文件。\n在 SillyDroid 原生设置的终端中运行；不需要访问或删除旧扩展目录。');
        return;
    }
    const options = {};
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--apply') options.apply = true;
        else if (args[index] === '--data-root' && args[index + 1]) options.dataRoot = args[++index];
        else throw new Error(`未知参数：${args[index]}`);
    }
    await install(options);
}

// Android can expose the same script through /data/user/0 and /data/data aliases.
// Compare canonical paths on both sides, including --preserve-symlinks-main launches.
const entryPath = process.argv[1] ? await fs.realpath(path.resolve(process.argv[1])).catch(() => null) : null;
if (entryPath && entryPath === await fs.realpath(fileURLToPath(import.meta.url))) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

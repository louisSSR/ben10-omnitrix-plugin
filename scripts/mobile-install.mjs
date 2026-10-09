#!/usr/bin/env node
// Fixed-repository repair tool. No host API changes, shell execution, or extra dependencies.
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const REPOSITORY = 'louisSSR/ben10-omnitrix-plugin';
export const RUNTIME_FILES = Object.freeze(['extension.js', 'host-adapter.js', 'extension.css', 'preview.html', 'manifest.json']);
const BUNDLE_MANIFEST = 'runtime-manifest.json';
const DEFAULT_ROOT = '/data/user/0/com.jm.sillydroid/files/android-tavern/data/server';
const BACKUPS = '.ben10-omnitrix-backups';
const FILE_LIMIT = 64 * 1024 * 1024;
const PACKAGE_LIMIT = 256 * 1024 * 1024;
const RESOURCE_LIMIT = 512;
const METADATA_LIMIT = 2 * 1024 * 1024;
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

async function responseFor(url, fetchImpl, limit) {
    const response = await fetchImpl(url, {
        redirect: 'error', signal: AbortSignal.timeout(60000),
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ben10-omnitrix-mobile-installer' },
    });
    if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）：${new URL(url).pathname}`);
    if (Number(response.headers.get('content-length')) > limit) throw new Error('下载文件超过大小限制');
    return response;
}

// Only small commit/tree/manifest metadata is collected in memory.
async function readRemote(url, fetchImpl, limit) {
    const response = await responseFor(url, fetchImpl, limit);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit) throw new Error('下载文件超过大小限制');
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function fileState(file) {
    const stat = await statOrNull(file);
    if (!stat) return null;
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`路径类型不正确：${file}`);
    const hash = createHash('sha256'), git = createHash('sha1').update(`blob ${stat.size}\0`);
    let bytes = 0;
    for await (const chunk of createReadStream(file)) { bytes += chunk.length; hash.update(chunk); git.update(chunk); }
    return { bytes, sha256: hash.digest('hex'), gitSha: git.digest('hex'), mode: stat.mode & 0o777 };
}
const sameState = (left, right) => (!left && !right) || Boolean(left && right && left.bytes === right.bytes && left.sha256 === right.sha256 && left.mode === right.mode);

function treeEntry(tree, name) {
    const matches = tree.filter(item => item.path === name);
    const entry = matches[0];
    if (matches.length !== 1 || entry.type !== 'blob' || entry.mode !== '100644' || !/^[a-f0-9]{40}$/.test(entry.sha || '') || !Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error(`仓库运行文件缺失或类型错误：${name}`);
    return entry;
}

async function runtimePlan(fetchImpl) {
    const api = `https://api.github.com/repos/${REPOSITORY}`;
    const ref = JSON.parse(await readRemote(`${api}/git/ref/heads/main`, fetchImpl, 256 * 1024));
    const commit = ref.object?.sha;
    if (!/^[a-f0-9]{40}$/.test(commit || '') || ref.object?.type !== 'commit') throw new Error('GitHub 未返回有效的 main 提交');
    const tree = JSON.parse(await readRemote(`${api}/git/trees/${commit}?recursive=1`, fetchImpl, METADATA_LIMIT));
    if (!Array.isArray(tree.tree) || tree.truncated) throw new Error('GitHub 文件树不完整');
    // Missing manifests are errors, never a silent fallback to an incomplete old bundle.
    const manifestEntry = treeEntry(tree.tree, BUNDLE_MANIFEST);
    const indexBytes = await readRemote(`https://raw.githubusercontent.com/${REPOSITORY}/${commit}/${BUNDLE_MANIFEST}`, fetchImpl, METADATA_LIMIT);
    if (manifestEntry.size !== indexBytes.length || gitBlob(indexBytes) !== manifestEntry.sha) throw new Error(`文件校验失败：${BUNDLE_MANIFEST}`);
    const index = JSON.parse(indexBytes);
    if (index.schemaVersion !== 1 || !Array.isArray(index.files) || index.files.length > RESOURCE_LIMIT || index.files.length < RUNTIME_FILES.length) throw new Error('运行资源清单格式或数量不符合约定');
    const names = new Set();
    let totalBytes = indexBytes.length;
    for (const item of index.files) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('运行资源清单条目无效');
        const image = typeof item.path === 'string' && item.path.match(/^assets\/runtime\/([a-f0-9]{64})\.(png|avif|webp)$/);
        if ((!RUNTIME_FILES.includes(item.path) && !image) || names.has(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256 || '') || (image && image[1] !== item.sha256)) throw new Error('运行资源清单包含非法路径、重复项或哈希');
        if (!Number.isSafeInteger(item.bytes) || item.bytes <= 0 || item.bytes > FILE_LIMIT) throw new Error('下载文件超过大小限制或清单大小无效');
        names.add(item.path); totalBytes += item.bytes;
        if (totalBytes > PACKAGE_LIMIT) throw new Error('运行包超过 256 MiB 总大小限制');
        const entry = treeEntry(tree.tree, item.path);
        if (entry.size !== item.bytes) throw new Error(`文件校验失败：${item.path}`);
        item.gitSha = entry.sha;
    }
    if (RUNTIME_FILES.some(name => !names.has(name))) throw new Error('运行资源清单缺少固定入口文件');
    return { commit, totalBytes, indexBytes, entries: index.files };
}

async function downloadFile(url, fetchImpl, entry, destination) {
    const response = await responseFor(url, fetchImpl, FILE_LIMIT);
    const git = createHash('sha1').update(`blob ${entry.bytes}\0`), content = createHash('sha256');
    const file = await fs.open(destination, 'wx', 0o600);
    let size = 0;
    try {
        for await (const chunk of response.body) {
            size += chunk.length;
            if (size > FILE_LIMIT) throw new Error('下载文件超过大小限制');
            if (size > entry.bytes) throw new Error(`文件校验失败：${entry.path}`);
            git.update(chunk); content.update(chunk);
            // FileHandle.writeFile appends at the current position and handles partial writes.
            await file.writeFile(chunk);
        }
    } finally { await file.close(); }
    if (size !== entry.bytes || git.digest('hex') !== entry.gitSha || content.digest('hex') !== entry.sha256) throw new Error(`文件校验失败：${entry.path}`);
}

/** The caller owns dispose() after success; errors always clean this invocation's temporary files. */
export async function downloadRuntime(fetchImpl = fetch, { inspectExisting = async () => null, existingFile = () => null } = {}) {
    const plan = await runtimePlan(fetchImpl);
    const descriptors = [...plan.entries.filter(item => !RUNTIME_FILES.includes(item.path)), ...RUNTIME_FILES.filter(name => name !== 'manifest.json').map(name => plan.entries.find(item => item.path === name)),
        { path: BUNDLE_MANIFEST, bytes: plan.indexBytes.length, sha256: sha256(plan.indexBytes) }, plan.entries.find(item => item.path === 'manifest.json')];
    const existing = {};
    // Snapshot every destination before downloading any runtime file.
    for (const entry of descriptors) existing[entry.path] = await inspectExisting(entry.path);
    const tempBase = await fs.realpath(os.tmpdir());
    const temporary = await fs.mkdtemp(path.join(tempBase, 'ben10-runtime-'));
    const files = {}, directories = new Set();
    const dispose = async () => {
        if (path.dirname(temporary) !== tempBase || !path.basename(temporary).startsWith('ben10-runtime-') || (await fs.realpath(temporary)) !== temporary) throw new Error('拒绝清理非本次临时目录');
        // Never recursively delete an old extension or an unrecognized temporary entry.
        for (const name of Object.keys(files)) {
            const file = await safePath(temporary, name);
            if (await statOrNull(file)) await fs.unlink(file);
        }
        for (const dir of [...directories].sort((a, b) => b.length - a.length)) await fs.rmdir(await safePath(temporary, dir, { directory: true }));
        await fs.rmdir(temporary);
    };
    try {
        for (const entry of descriptors) {
            const name = entry.path, destination = path.join(temporary, name);
            const pieces = name.split('/').slice(0, -1);
            for (let i = 1; i <= pieces.length; i++) {
                const relative = pieces.slice(0, i).join('/');
                if (!directories.has(relative)) { await fs.mkdir(path.join(temporary, relative)); directories.add(relative); }
            }
            files[name] = destination;
            if (name === BUNDLE_MANIFEST) await fs.writeFile(destination, plan.indexBytes, { flag: 'wx', mode: 0o600 });
            else if (existing[name]?.sha256 === entry.sha256 && existing[name].bytes === entry.bytes && existing[name].gitSha === entry.gitSha) {
                await fs.copyFile(existingFile(name), destination);
                const copied = await fileState(destination);
                if (copied.sha256 !== entry.sha256 || copied.bytes !== entry.bytes || copied.gitSha !== entry.gitSha) throw new Error(`下载期间本地文件发生变化，已停止：${name}`);
            } else await downloadFile(`https://raw.githubusercontent.com/${REPOSITORY}/${plan.commit}/${name}`, fetchImpl, entry, destination);
        }
        const manifest = await validateRuntime(files, new Set(plan.entries.map(entry => entry.path)));
        return { commit: plan.commit, totalBytes: plan.totalBytes, descriptors, files, existing, manifest, temporary, dispose };
    } catch (error) { await dispose(); throw error; }
}

export async function validateRuntime(files, listedPaths = new Set()) {
    const read = async name => Buffer.isBuffer(files[name]) ? files[name] : fs.readFile(files[name]);
    const manifest = JSON.parse((await read('manifest.json')).toString('utf8'));
    if (manifest.display_name !== 'Ben 10 · Omnitrix' || manifest.js !== 'extension.js' || manifest.css !== 'extension.css' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(manifest.version || '')) throw new Error('下载的 manifest 不符合本插件身份或入口约定');
    for (const name of ['extension.js', 'host-adapter.js']) {
        const checked = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: await read(name), encoding: 'utf8' });
        if (checked.error || checked.status !== 0) throw new Error(`JavaScript 语法检查失败：${name}`);
    }
    const html = (await read('preview.html')).toString('utf8');
    if (!/<!doctype html>/i.test(html) || !/id=["']omni-app["']/.test(html) || /APP_STYLES|CATALOG_DATA|ART_SYMBOLS|APP_CODE/.test(html)) throw new Error('preview.html 尚未构建或不是 Omnitrix 页面');
    const allowedReference = value => /^#[a-zA-Z0-9_-]+$/.test(value) || /^data:image\/(png|avif|webp);base64,[a-zA-Z0-9+/=]+$/.test(value) || (/^(?:\.\/)?assets\/runtime\/[a-f0-9]{64}\.(png|avif|webp)$/.test(value) && listedPaths.has(value.replace(/^\.\//, '')));
    for (const match of html.matchAll(/<(?:script|img|link|iframe|video|audio|source|image|use)\b([^>]*)>/gi)) {
        for (const attribute of match[1].matchAll(/\b(?:src|href|xlink:href|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
            const value = attribute[1] ?? attribute[2] ?? attribute[3];
            if (!allowedReference(value)) throw new Error('preview.html 引用了清单以外的运行资源');
        }
    }
    for (const match of html.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) if (!allowedReference(match[1])) throw new Error('preview.html 引用了清单以外的运行资源');
    if (/@import\b/i.test(html)) throw new Error('preview.html 引用了外部样式');
    const css = await read('extension.css');
    if (!css.length || /<!doctype|<html/i.test(css.toString('utf8'))) throw new Error('样式文件无效');
    return manifest;
}

/** fetchImpl / beforeReplace are test seams; the CLI accepts no alternate repository or URL. */
export async function install({ dataRoot = process.env.APP_DATA_ROOT || DEFAULT_ROOT, apply = false, fetchImpl = fetch, beforeReplace = async () => {}, log = console.log } = {}) {
    if (!path.isAbsolute(dataRoot) || dataRoot.split(/[\\/]/).includes('..')) throw new Error('数据根目录必须是无 .. 的绝对路径');
    const rootStat = await fs.lstat(dataRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('数据根目录不存在、不是目录或是符号链接');
    const root = await fs.realpath(dataRoot);
    const relativeTarget = 'data/default-user/extensions/ben10-omnitrix-plugin';
    const target = await safePath(root, relativeTarget, { directory: true });
    const backupRoot = await safePath(root, BACKUPS, { directory: true });
    const destinationFor = name => safePath(root, `${relativeTarget}/${name}`);
    // Catch unsafe existing entry points before contacting GitHub.
    for (const name of [...RUNTIME_FILES, BUNDLE_MANIFEST]) await destinationFor(name);
    log('正在获取公开仓库 main 的同一提交；下载到临时目录，完整校验后才覆盖。');
    const download = await downloadRuntime(fetchImpl, { inspectExisting: async name => fileState(await destinationFor(name)), existingFile: name => path.join(target, name) });
    try {
        const { commit, files, descriptors, existing, manifest } = download;
        const verifyLocalState = async () => {
            for (const entry of descriptors) if (!sameState(await fileState(await destinationFor(entry.path)), existing[entry.path])) throw new Error(`下载期间本地文件发生变化，已停止：${entry.path}`);
        };
        const changes = descriptors.filter(entry => existing[entry.path]?.sha256 !== entry.sha256 || existing[entry.path]?.bytes !== entry.bytes).map(entry => entry.path);
        const result = { mode: apply ? 'apply' : 'dry-run', repository: REPOSITORY, commit, version: manifest.version, target, totalBytes: download.totalBytes, changed: changes, backup: null };
        log(JSON.stringify(result, null, 2));
        if (!apply) { log('预检完成，未写入扩展、备份或设置；本次临时下载将清理。加 --apply 才执行覆盖。'); return result; }
        // A cached staging copy can be valid while another process edits its source.
        if (!changes.length) { await verifyLocalState(); log('入口和运行素材已与该提交一致，无需覆盖。'); return result; }
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
        const applied = [], madeDirectories = [];
        try {
            await lock.writeFile(JSON.stringify({ pid: process.pid, commit }));
            await verifyLocalState();
            await fs.mkdir(backup, { mode: 0o700 });
            await fs.mkdir(path.join(backup, 'before')); await fs.mkdir(path.join(backup, 'next'));
            for (const name of changes) {
                for (const side of ['before', 'next']) await fs.mkdir(path.dirname(path.join(backup, side, name)), { recursive: true });
                if (existing[name]) {
                    await fs.copyFile(await destinationFor(name), path.join(backup, 'before', name));
                    const saved = await fileState(path.join(backup, 'before', name));
                    if (saved.sha256 !== existing[name].sha256 || saved.bytes !== existing[name].bytes) throw new Error(`下载期间本地文件发生变化，已停止：${name}`);
                    await fs.chmod(path.join(backup, 'before', name), existing[name].mode);
                }
                await fs.copyFile(files[name], path.join(backup, 'next', name));
                await fs.chmod(path.join(backup, 'next', name), existing[name]?.mode ?? 0o644);
            }
            const receipt = { ...result, backup, state: 'prepared', files: changes.map(name => ({ name, before: existing[name]?.sha256 ?? null, after: descriptors.find(entry => entry.path === name).sha256 })) };
            await fs.writeFile(path.join(backup, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
            for (const name of changes) {
                const parts = `${relativeTarget}/${name}`.split('/').slice(0, -1);
                for (let i = 1; i <= parts.length; i++) {
                    const dir = await safePath(root, parts.slice(0, i).join('/'), { directory: true });
                    if (!(await statOrNull(dir))) { await fs.mkdir(dir); madeDirectories.push(dir); }
                }
            }
            for (const [index, name] of changes.entries()) {
                await beforeReplace({ index, name, target });
                if (!sameState(await fileState(await destinationFor(name)), existing[name])) throw new Error(`覆盖前本地文件发生变化，已停止：${name}`);
                await fs.rename(path.join(backup, 'next', name), path.join(target, name));
                applied.push(name);
            }
            for (const name of changes) {
                const actual = await fileState(await destinationFor(name)), expected = descriptors.find(entry => entry.path === name);
                if (actual?.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) throw new Error(`写入后校验失败：${name}`);
            }
            receipt.state = 'applied';
            await fs.writeFile(path.join(backup, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
            result.backup = backup;
            log(`安装 / 修复完成：${manifest.version}。旧文件备份：${backup}。回酒馆刷新页面。以后更新可重复运行同一命令。`);
            return result;
        } catch (error) {
            const rollbackErrors = [];
            for (const name of applied.reverse()) {
                try {
                    await destinationFor(name);
                    if (existing[name]) {
                        const restore = path.join(backup, 'next', name);
                        await fs.copyFile(path.join(backup, 'before', name), restore);
                        await fs.chmod(restore, existing[name].mode);
                        await fs.rename(restore, path.join(target, name));
                    } else await fs.unlink(path.join(target, name));
                } catch (rollbackError) { rollbackErrors.push(`${name}: ${rollbackError.message}`); }
            }
            for (const directory of madeDirectories.reverse()) {
                try { await fs.rmdir(directory); } catch (cleanupError) { if (cleanupError.code !== 'ENOTEMPTY' && cleanupError.code !== 'ENOENT') rollbackErrors.push(cleanupError.message); }
            }
            if (rollbackErrors.length) throw new Error(`覆盖失败；部分回滚未完成。保留备份于 ${backup}。${rollbackErrors.join('; ')}`, { cause: error });
            throw new Error(`覆盖已停止，已写入的运行文件已恢复；原目录和其他文件保留。原因：${error.message}`, { cause: error });
        } finally { await lock.close(); await fs.unlink(lockPath); }
    } finally { await download.dispose(); }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
        console.log('Omnitrix 手机安装 / 修复 / 更新\nnode mobile-install.mjs [--apply] [--data-root 绝对路径]\n默认只预检。仅从 louisSSR/ben10-omnitrix-plugin 的 main 安装已校验的离线目录包。\n在 SillyDroid 原生设置的终端中运行；不需要访问或删除旧扩展目录。');
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
const entryPath = process.argv[1] ? await fs.realpath(path.resolve(process.argv[1])).catch(() => null) : null;
if (entryPath && entryPath === await fs.realpath(fileURLToPath(import.meta.url))) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

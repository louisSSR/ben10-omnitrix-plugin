import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { install, downloadRuntime, validateRuntime, RUNTIME_FILES } from '../scripts/mobile-install.mjs';

const commit = 'a'.repeat(40);
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const runtime = Object.fromEntries(Object.entries({
    'manifest.json': JSON.stringify({ display_name: 'Ben 10 · Omnitrix', js: 'extension.js', css: 'extension.css', version: '0.2.0' }),
    'extension.js': 'export function activate() {}',
    'host-adapter.js': 'export const namespace = "ben10-omnitrix";',
    'extension.css': '.ben10 { color: green; }',
    'preview.html': '<!doctype html><html><body><main id="omni-app"></main></body></html>',
}).map(([name, value]) => [name, Buffer.from(value)]));

function remote({ fail, corrupt, requests = [], onRead = async () => {}, files = runtime, indexTransform = value => value, treeTransform = value => value } = {}) {
    const digest = value => createHash('sha256').update(value).digest('hex');
    const index = indexTransform({ schemaVersion: 1, files: Object.entries(files).map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: digest(bytes) })) });
    const indexBytes = Buffer.from(JSON.stringify(index));
    const all = { ...files, 'runtime-manifest.json': indexBytes };
    const tree = treeTransform(Object.entries(all).map(([name, bytes]) => ({ path: name, type: 'blob', mode: '100644', size: bytes.length, sha: blob(bytes) })));
    return async url => {
        requests.push(url);
        await onRead(url);
        if (url.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: commit, type: 'commit' } });
        if (url.endsWith(`/git/trees/${commit}?recursive=1`)) return Response.json({ tree });
        const prefix = `https://raw.githubusercontent.com/louisSSR/ben10-omnitrix-plugin/${commit}/`;
        assert.ok(url.startsWith(prefix));
        const name = url.slice(prefix.length);
        if (name === fail) return new Response('failed', { status: 503 });
        assert.ok(Object.hasOwn(all, name), `unexpected download ${name}`);
        return new Response(name === corrupt ? 'broken' : all[name]);
    };
}

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'omnitrix-install-test-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    return { root, target: path.join(root, 'data/default-user/extensions/ben10-omnitrix-plugin'), run: options => install({ dataRoot: root, fetchImpl: remote(), log() {}, ...options }) };
}

test('mobile install defaults to a no-write preflight with commit-pinned downloads', async t => {
    const f = await fixture(t);
    const requests = [];
    const result = await f.run({ fetchImpl: remote({ requests }) });
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.commit, commit);
    assert.deepEqual(await fs.readdir(f.root), []);
    assert.equal(requests.length, 8);
    assert.ok(requests.slice(2).every(url => url.includes(`/${commit}/`)));
});

test('mobile preflight accepts a complete 64 MiB preview with matching Git metadata without writing', async t => {
    const f = await fixture(t);
    const preview = Buffer.alloc(64 * 1024 * 1024, 32);
    runtime['preview.html'].copy(preview);
    const files = { ...runtime, 'preview.html': preview };
    const result = await f.run({ fetchImpl: remote({ files }) });
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.commit, commit);
    assert.ok(result.changed.includes('preview.html'));
    assert.deepEqual(await fs.readdir(f.root), []);
});

test('mobile apply rejects preview downloads above 64 MiB before writes, including absent or false lengths', async t => {
    const f = await fixture(t);
    await fs.mkdir(f.target, { recursive: true });
    await fs.writeFile(path.join(f.target, 'manifest.json'), 'previous manifest');
    const limit = 64 * 1024 * 1024;
    const chunk = Buffer.alloc(1024 * 1024);
    for (const declaredLength of [limit + 1, null, 1]) {
        let provided = 0;
        const base = remote({ indexTransform(index) { index.files.find(item => item.path === 'preview.html').bytes = limit; return index; }, treeTransform(tree) { tree.find(item => item.path === 'preview.html').size = limit; return tree; } });
        const fetchImpl = url => url.endsWith('/preview.html') ? {
            ok: true,
            headers: new Headers(declaredLength === null ? {} : { 'content-length': String(declaredLength) }),
            body: {
                async *[Symbol.asyncIterator]() {
                    for (let index = 0; index < 64; index++) { provided += chunk.length; yield chunk; }
                    provided++; yield Buffer.alloc(1);
                    provided += chunk.length; yield chunk;
                },
            },
        } : base(url);
        await assert.rejects(f.run({ apply: true, fetchImpl }), /下载文件超过大小限制/);
        assert.equal(provided, declaredLength === limit + 1 ? 0 : limit + 1, 'stop at the header or first excess byte');
        assert.deepEqual(await fs.readdir(f.target), ['manifest.json']);
        assert.equal(await fs.readFile(path.join(f.target, 'manifest.json'), 'utf8'), 'previous manifest');
        await assert.rejects(fs.stat(path.join(f.root, '.ben10-omnitrix-backups')), { code: 'ENOENT' });
    }
});

test('mobile runtime capacity does not widen the commit and tree metadata limits', async () => {
    for (const [suffix, limit] of [['/git/ref/heads/main', 256 * 1024], [`/git/trees/${commit}?recursive=1`, 2 * 1024 * 1024]]) {
        const base = remote();
        let bodyRead = false;
        const fetchImpl = url => url.endsWith(suffix) ? {
            ok: true,
            headers: new Headers({ 'content-length': String(limit + 1) }),
            body: { async *[Symbol.asyncIterator]() { bodyRead = true; yield Buffer.from('{}'); } },
        } : base(url);
        await assert.rejects(downloadRuntime(fetchImpl), /下载文件超过大小限制/);
        assert.equal(bodyRead, false);
    }
});

test('mobile install creates missing directory and repeating apply is a no-op', async t => {
    const f = await fixture(t);
    const first = await f.run({ apply: true });
    assert.equal(first.changed.length, 6);
    for (const name of RUNTIME_FILES) assert.deepEqual(await fs.readFile(path.join(f.target, name)), runtime[name]);
    const second = await f.run({ apply: true });
    assert.deepEqual(second.changed, []);
    assert.equal(second.backup, null);
    assert.equal((await fs.readdir(path.join(f.root, '.ben10-omnitrix-backups'))).length, 1);
});

test('mobile no-op rejects a concurrent local edit after cached runtime staging', async t => {
    const f = await fixture(t);
    await f.run({ apply: true });
    const backupRoot = path.join(f.root, '.ben10-omnitrix-backups');
    const backupsBefore = (await fs.readdir(backupRoot)).sort();
    const requests = [], messages = [];
    let edited = false, replacements = 0;
    await assert.rejects(f.run({
        apply: true,
        fetchImpl: remote({ requests }),
        beforeReplace() { replacements++; },
        log(message) {
            messages.push(message);
            if (!message.startsWith('{')) return;
            assert.deepEqual(JSON.parse(message).changed, []);
            // A separate process edits the destination after every cached file has
            // been staged and validated, just before the no-op decision.
            const edit = spawnSync(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[1], process.argv[2])', path.join(f.target, 'extension.js'), 'external change'], { encoding: 'utf8' });
            assert.equal(edit.status, 0, edit.stderr);
            edited = true;
        },
    }), /本地文件发生变化/);
    assert.equal(edited, true);
    assert.equal(requests.length, 3, 'all runtime files were reused from the existing directory');
    assert.equal(replacements, 0);
    assert.equal(await fs.readFile(path.join(f.target, 'extension.js'), 'utf8'), 'external change');
    for (const name of RUNTIME_FILES.filter(name => name !== 'extension.js')) assert.deepEqual(await fs.readFile(path.join(f.target, name)), runtime[name]);
    assert.deepEqual((await fs.readdir(backupRoot)).sort(), backupsBefore);
    assert.equal(messages.some(message => message.includes('无需覆盖')), false);
});

test('mobile repair overwrites partial files and preserves .git, settings and unrelated files', async t => {
    const f = await fixture(t);
    await fs.mkdir(path.join(f.target, '.git'), { recursive: true });
    await fs.writeFile(path.join(f.target, '.git', 'config'), 'do-not-touch');
    await fs.writeFile(path.join(f.target, 'manifest.json'), '{partial');
    await fs.writeFile(path.join(f.target, 'settings.json'), '{"keep":true}');
    const result = await f.run({ apply: true });
    assert.equal(await fs.readFile(path.join(f.target, '.git', 'config'), 'utf8'), 'do-not-touch');
    assert.equal(await fs.readFile(path.join(f.target, 'settings.json'), 'utf8'), '{"keep":true}');
    assert.equal(await fs.readFile(path.join(result.backup, 'before', 'manifest.json'), 'utf8'), '{partial');
    assert.ok(!result.backup.startsWith(path.dirname(f.target)));
});

test('mobile install failed download and corrupt blob leave existing directory byte-identical', async t => {
    const f = await fixture(t);
    await fs.mkdir(f.target, { recursive: true });
    await fs.writeFile(path.join(f.target, 'manifest.json'), 'old');
    for (const option of [{ fail: 'preview.html' }, { corrupt: 'extension.js' }]) {
        await assert.rejects(f.run({ apply: true, fetchImpl: remote(option) }), /下载失败|校验失败/);
        assert.deepEqual(await fs.readdir(f.target), ['manifest.json']);
        assert.equal(await fs.readFile(path.join(f.target, 'manifest.json'), 'utf8'), 'old');
        await assert.rejects(fs.stat(path.join(f.root, '.ben10-omnitrix-backups')), { code: 'ENOENT' });
    }
});

test('mobile install rolls back replaced and newly-created files on apply failure', async t => {
    const f = await fixture(t);
    await fs.mkdir(f.target, { recursive: true });
    await fs.writeFile(path.join(f.target, 'extension.js'), 'original bytes');
    await fs.writeFile(path.join(f.target, 'keep.txt'), 'original sidecar');
    await assert.rejects(f.run({ apply: true, beforeReplace({ index }) { if (index === 3) throw new Error('disk failure fixture'); } }), /已恢复/);
    assert.deepEqual((await fs.readdir(f.target)).sort(), ['extension.js', 'keep.txt']);
    assert.equal(await fs.readFile(path.join(f.target, 'extension.js'), 'utf8'), 'original bytes');
    const backups = await fs.readdir(path.join(f.root, '.ben10-omnitrix-backups'));
    assert.equal(backups.length, 1);
    assert.equal(await fs.readFile(path.join(f.root, '.ben10-omnitrix-backups', backups[0], 'before', 'extension.js'), 'utf8'), 'original bytes');
});

test('mobile install removes only its newly-created empty directories after failure', async t => {
    const f = await fixture(t);
    await assert.rejects(f.run({ apply: true, beforeReplace({ index }) { if (index === 1) throw new Error('write failed'); } }), /已恢复/);
    await assert.rejects(fs.stat(path.join(f.root, 'data')), { code: 'ENOENT' });
});

test('mobile install rejects directory symlink and path traversal', async t => {
    const f = await fixture(t);
    await fs.mkdir(path.join(f.root, 'other'));
    await fs.symlink(path.join(f.root, 'other'), path.join(f.root, 'data'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(f.run({ apply: true }), /符号链接/);
    await assert.rejects(f.run({ dataRoot: `${f.root}/../escape` }), /无 \.\./);
    assert.deepEqual(await fs.readdir(path.join(f.root, 'other')), []);
});

test('mobile install rejects unsafe target file type before downloads', async t => {
    const f = await fixture(t);
    await fs.mkdir(path.join(f.target, 'manifest.json'), { recursive: true });
    let fetched = false;
    await assert.rejects(f.run({ apply: true, fetchImpl() { fetched = true; } }), /路径类型/);
    assert.equal(fetched, false);
});

test('mobile install refuses a local runtime change during download', async t => {
    const f = await fixture(t);
    await fs.mkdir(f.target, { recursive: true });
    await fs.writeFile(path.join(f.target, 'manifest.json'), 'old');
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ async onRead(url) { if (url.endsWith('/preview.html')) await fs.writeFile(path.join(f.target, 'manifest.json'), 'external change'); } }) }), /本地文件发生变化/);
    assert.equal(await fs.readFile(path.join(f.target, 'manifest.json'), 'utf8'), 'external change');
});

test('mobile runtime validation rejects syntax errors even when blob hash matches', async () => {
    const old = runtime['extension.js'];
    runtime['extension.js'] = Buffer.from('export function broken(');
    try { await assert.rejects(downloadRuntime(remote()), /语法检查/); } finally { runtime['extension.js'] = old; }
});

test('mobile installer can repair files after its previous process exits mid-apply', async t => {
    const f = await fixture(t);
    await fs.mkdir(f.target, { recursive: true });
    await fs.writeFile(path.join(f.target, 'extension.js'), 'before process exit');
    const childCode = `
        import { install, RUNTIME_FILES } from ${JSON.stringify(new URL('../scripts/mobile-install.mjs', import.meta.url).href)};
        import { createHash } from 'node:crypto';
        import assert from 'node:assert/strict';
        const commit = ${JSON.stringify(commit)};
        const runtime = Object.fromEntries(Object.entries(${JSON.stringify(Object.fromEntries(Object.entries(runtime).map(([k,v]) => [k,v.toString('base64')])))}).map(([k,v]) => [k,Buffer.from(v,'base64')]));
        const blob = ${blob.toString()};
        const remote = ${remote.toString()};
        await install({ dataRoot: ${JSON.stringify(f.root)}, apply: true, fetchImpl: remote(), log() {}, beforeReplace({index}) { if(index===2) process.exit(71); } });
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode], { encoding: 'utf8', env: { ...process.env, TEMP: f.root, TMP: f.root, TMPDIR: f.root } });
    assert.equal(child.status, 71, child.stderr);
    const backupRoot = path.join(f.root, '.ben10-omnitrix-backups');
    const firstBackup = (await fs.readdir(backupRoot)).find(name => name !== 'install.lock');
    assert.equal(await fs.readFile(path.join(backupRoot, firstBackup, 'before', 'extension.js'), 'utf8'), 'before process exit');
    assert.deepEqual(await fs.readFile(path.join(f.target, 'extension.js')), runtime['extension.js']);
    await f.run({ apply: true });
    for (const name of RUNTIME_FILES) assert.deepEqual(await fs.readFile(path.join(f.target, name)), runtime[name]);
    await assert.rejects(fs.stat(path.join(backupRoot, 'install.lock')), { code: 'ENOENT' });
    assert.equal(await fs.readFile(path.join(backupRoot, firstBackup, 'before', 'extension.js'), 'utf8'), 'before process exit');
});

test('mobile installer CLI starts through a real directory alias as well as its physical path', async t => {
    const f = await fixture(t);
    const physical = path.join(f.root, 'physical'), alias = path.join(f.root, 'alias');
    await fs.mkdir(physical);
    await fs.copyFile(new URL('../scripts/mobile-install.mjs', import.meta.url), path.join(physical, 'mobile-install.mjs'));
    // Windows junctions do not need Developer Mode; failure to create one is a test failure, not a skip.
    await fs.symlink(physical, alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(await fs.realpath(alias), await fs.realpath(physical));
    const run = folder => spawnSync(process.execPath, [path.join(folder, 'mobile-install.mjs'), '--help'], { encoding: 'utf8' });
    const direct = run(physical), linked = run(alias);
    assert.equal(direct.status, 0, direct.stderr);
    assert.match(direct.stdout, /Omnitrix 手机安装 \/ 修复 \/ 更新/);
    assert.equal(linked.status, 0, linked.stderr);
    assert.equal(linked.stdout, direct.stdout, 'a path alias must execute the CLI instead of silently exiting');
    assert.deepEqual((await fs.readdir(f.root)).sort(), ['alias', 'physical'], '--help does not install runtime files');
});
function directoryBundle(count = 2, format = 'png') {
    const files = { ...runtime }, assets = [];
    for (let index = 0; index < count; index++) {
        const bytes = Buffer.from(`fixture image bytes ${index}`);
        const name = `assets/runtime/${createHash('sha256').update(bytes).digest('hex')}.${format}`;
        assets.push(name); files[name] = bytes;
    }
    files['preview.html'] = Buffer.from(`<!doctype html><main id="omni-app"><svg>${assets.map((name, index) => `<image href="${index ? "./" : ""}${name}"/>`).join('')}</svg></main>`);
    return { files, assets };
}

test('directory bundle installs exact asset bytes before entry points and reuses verified local assets', async t => {
    const f = await fixture(t), { files, assets } = directoryBundle(), applied = [];
    await fs.mkdir(path.join(f.target, 'assets/runtime'), { recursive: true });
    await fs.writeFile(path.join(f.target, 'assets/runtime/unrelated.txt'), 'keep this');
    const first = await f.run({ apply: true, fetchImpl: remote({ files }), beforeReplace({ name }) { applied.push(name); } });
    assert.deepEqual(applied.slice(0, 2), assets);
    assert.equal(applied.at(-1), 'manifest.json');
    assert.ok(first.changed.includes('runtime-manifest.json'));
    for (const [name, bytes] of Object.entries(files)) assert.deepEqual(await fs.readFile(path.join(f.target, name)), bytes);
    assert.equal(await fs.readFile(path.join(f.target, 'assets/runtime/unrelated.txt'), 'utf8'), 'keep this');
    const requests = [];
    const again = await f.run({ apply: true, fetchImpl: remote({ files, requests }) });
    assert.deepEqual(again.changed, []);
    assert.equal(again.backup, null);
    assert.equal(requests.length, 3, 'only ref, tree and manifest; verified runtime files use disk copies');
});

test('WebP head bundles repair an existing mobile installation and stay idempotent', async t => {
    const f = await fixture(t), { files, assets } = directoryBundle(2, 'webp');
    await fs.mkdir(f.target, { recursive: true });
    await fs.writeFile(path.join(f.target, 'preview.html'), 'old partial installation');
    const first = await f.run({ apply: true, fetchImpl: remote({ files }) });
    assert.ok(first.changed.includes('preview.html'));
    for (const name of assets) assert.deepEqual(await fs.readFile(path.join(f.target, name)), files[name]);
    assert.deepEqual((await f.run({ apply: true, fetchImpl: remote({ files }) })).changed, []);
});

test('the actual built head-selector page passes the same mobile resource-reference gate', async () => {
    const root = new URL('../', import.meta.url);
    const index = JSON.parse(await fs.readFile(new URL('runtime-manifest.json', root)));
    const files = Object.fromEntries(await Promise.all(index.files.filter(entry => !entry.path.startsWith('assets/')).map(async entry => [entry.path, await fs.readFile(new URL(entry.path, root))])));
    const result = await validateRuntime(files, new Set(index.files.map(entry => entry.path)));
    assert.equal(result.display_name, 'Ben 10 · Omnitrix');
});

test('runtime download returns disk paths and removes only its temporary staging on dispose or error', async t => {
    const { files } = directoryBundle();
    const download = await downloadRuntime(remote({ files }));
    const temp = download.temporary;
    assert.ok(Object.values(download.files).every(file => typeof file === 'string'), 'no package-sized Buffer map');
    for (const [name, bytes] of Object.entries(files)) assert.deepEqual(await fs.readFile(download.files[name]), bytes);
    await download.dispose();
    await assert.rejects(fs.stat(temp), { code: 'ENOENT' });
    const before = new Set((await fs.readdir(os.tmpdir())).filter(name => name.startsWith('ben10-runtime-')));
    await assert.rejects(downloadRuntime(remote({ files, fail: 'preview.html' })), /下载失败/);
    const after = (await fs.readdir(os.tmpdir())).filter(name => name.startsWith('ben10-runtime-'));
    assert.deepEqual(new Set(after), before, 'failed staging is cleaned');
});

test('directory bundle rejects corrupt bytes, missing tree assets and undeclared references without target writes', async t => {
    const f = await fixture(t), { files, assets } = directoryBundle();
    await fs.mkdir(f.target, { recursive: true });
    await fs.writeFile(path.join(f.target, 'preview.html'), 'old page');
    const badRemote = [
        remote({ files, corrupt: assets[0] }),
        remote({ files, corrupt: 'runtime-manifest.json' }),
        remote({ files, treeTransform: tree => tree.filter(entry => entry.path !== assets[0]) }),
        remote({ files, indexTransform: index => ({ ...index, files: index.files.filter(entry => entry.path !== assets[0]) }) }),
        remote({ files, treeTransform: tree => tree.filter(entry => entry.path !== 'runtime-manifest.json') }),
    ];
    for (const fetchImpl of badRemote) {
        await assert.rejects(f.run({ apply: true, fetchImpl }), /校验失败|缺失|清单以外/);
        assert.deepEqual(await fs.readdir(f.target), ['preview.html']);
        assert.equal(await fs.readFile(path.join(f.target, 'preview.html'), 'utf8'), 'old page');
        await assert.rejects(fs.stat(path.join(f.root, '.ben10-omnitrix-backups')), { code: 'ENOENT' });
    }
});

test('runtime manifest rejects escaping paths, duplicates, omitted entry points and mismatched hash names', async t => {
    const f = await fixture(t), { files } = directoryBundle(1);
    const invalidPaths = ['../outside.png', '/assets/runtime/a.png', 'assets\\runtime\\a.png', 'assets/runtime/%2e%2e/a.png', 'https://example.com/a.png', `assets/runtime/${'0'.repeat(64)}.png`];
    for (const badPath of invalidPaths) {
        await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files, indexTransform(index) { index.files.at(-1).path = badPath; return index; } }) }), /非法路径/);
    }
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files, indexTransform(index) { index.files.push(index.files[0]); return index; } }) }), /重复项/);
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files, indexTransform(index) { index.files = index.files.filter(entry => entry.path !== 'manifest.json'); return index; } }) }), /缺少固定入口/);
    assert.deepEqual(await fs.readdir(f.root), []);
});

test('directory bundle rejects remote or unlisted HTML image and CSS resources', async t => {
    const f = await fixture(t), { files } = directoryBundle(1);
    for (const resource of ['<image href="https://example.com/a.png"/>', '<img src="./assets/source-art/private.png">', '<script src="./extension.js"></script>', '<style>.x{background:url(//example.com/a.png)}</style>']) {
        const badFiles = { ...files, 'preview.html': Buffer.from(`<!doctype html><main id="omni-app">${resource}</main>`) };
        await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files: badFiles }) }), /清单以外/);
    }
    assert.deepEqual(await fs.readdir(f.root), []);
});

test('aggregate 256 MiB metadata limit rejects excess before runtime downloads and permits the exact boundary', async t => {
    const f = await fixture(t), limit = 256 * 1024 * 1024, declared = new Map();
    const adjust = over => index => {
        for (const item of index.files.slice(0, 4)) item.bytes = 64 * 1024 * 1024;
        const adjustable = index.files[3];
        // Include the UTF-8 index itself; converge after decimal field length changes.
        for (let n = 0; n < 5; n++) adjustable.bytes += limit + over - (Buffer.byteLength(JSON.stringify(index)) + index.files.reduce((sum, item) => sum + item.bytes, 0));
        for (const item of index.files) declared.set(item.path, item.bytes);
        return index;
    };
    const treeTransform = tree => tree.map(entry => declared.has(entry.path) ? { ...entry, size: declared.get(entry.path) } : entry);
    let requests = [];
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ requests, indexTransform: adjust(1), treeTransform }) }), /256 MiB/);
    assert.equal(requests.length, 3, 'excess is rejected before downloading any runtime file');
    requests = [];
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ requests, fail: 'extension.js', indexTransform: adjust(0), treeTransform }) }), /下载失败/);
    assert.equal(requests.length, 4, 'exact limit passes metadata validation and reaches first runtime download');
    assert.deepEqual(await fs.readdir(f.root), []);
});

test('manifest resource count is bounded at 512 and rejects truncated recursive Git trees', async t => {
    const f = await fixture(t);
    for (const count of [507, 508]) {
        const { files } = directoryBundle(count), requests = [];
        await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files, requests, fail: Object.keys(files).find(name => name.startsWith('assets/')) }) }), count === 507 ? /下载失败/ : /数量/);
        assert.equal(requests.length, count === 507 ? 4 : 3);
    }
    const base = remote();
    await assert.rejects(f.run({ fetchImpl: url => url.includes('/git/trees/') ? Response.json({ tree: [], truncated: true }) : base(url) }), /文件树不完整/);
    assert.deepEqual(await fs.readdir(f.root), []);
});

test('nested asset directory symlinks are rejected before writing or following them', async t => {
    const f = await fixture(t), { files } = directoryBundle(1);
    const outside = path.join(f.root, 'outside');
    await fs.mkdir(outside); await fs.mkdir(f.target, { recursive: true });
    await fs.symlink(outside, path.join(f.target, 'assets'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files }) }), /符号链接/);
    assert.deepEqual(await fs.readdir(outside), []);
    await assert.rejects(fs.stat(path.join(f.root, '.ben10-omnitrix-backups')), { code: 'ENOENT' });
});

test('asset apply failure restores replaced image bytes and removes only newly-created asset files', async t => {
    const f = await fixture(t), { files, assets } = directoryBundle(2);
    await fs.mkdir(path.join(f.target, 'assets/runtime'), { recursive: true });
    await fs.writeFile(path.join(f.target, assets[0]), 'previous corrupt image');
    await fs.writeFile(path.join(f.target, 'assets/runtime/keep.txt'), 'keep');
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files }), beforeReplace({ name }) { if (name === 'host-adapter.js') throw new Error('fixture write error'); } }), /已恢复/);
    assert.equal(await fs.readFile(path.join(f.target, assets[0]), 'utf8'), 'previous corrupt image');
    await assert.rejects(fs.stat(path.join(f.target, assets[1])), { code: 'ENOENT' });
    await assert.rejects(fs.stat(path.join(f.target, 'extension.js')), { code: 'ENOENT' });
    assert.equal(await fs.readFile(path.join(f.target, 'assets/runtime/keep.txt'), 'utf8'), 'keep');
});

test('cached asset changes during later downloads are detected without reverting the external edit', async t => {
    const f = await fixture(t), { files, assets } = directoryBundle(1);
    await fs.mkdir(path.join(f.target, 'assets/runtime'), { recursive: true });
    await fs.writeFile(path.join(f.target, assets[0]), files[assets[0]]);
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files, async onRead(url) { if (url.endsWith('/preview.html')) await fs.writeFile(path.join(f.target, assets[0]), 'external edit'); } }) }), /本地文件发生变化/);
    assert.equal(await fs.readFile(path.join(f.target, assets[0]), 'utf8'), 'external edit');
    await assert.rejects(fs.stat(path.join(f.target, 'manifest.json')), { code: 'ENOENT' });
});

test('a real process exit after asset replacement can be repaired without deleting the old directory', async t => {
    const f = await fixture(t), { files, assets } = directoryBundle(2);
    await fs.mkdir(path.join(f.target, 'assets/runtime'), { recursive: true });
    await fs.writeFile(path.join(f.target, assets[0]), 'before interrupted update');
    const childCode = `
        import { install } from ${JSON.stringify(new URL('../scripts/mobile-install.mjs', import.meta.url).href)};
        import { createHash } from 'node:crypto';
        import assert from 'node:assert/strict';
        const commit = ${JSON.stringify(commit)};
        const runtime = Object.fromEntries(Object.entries(${JSON.stringify(Object.fromEntries(Object.entries(files).map(([k,v]) => [k,v.toString('base64')])))}).map(([k,v]) => [k,Buffer.from(v,'base64')]));
        const blob = ${blob.toString()};
        const remote = ${remote.toString()};
        await install({ dataRoot: ${JSON.stringify(f.root)}, apply: true, fetchImpl: remote(), log() {}, beforeReplace({index}) { if(index===1) process.exit(72); } });
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode], { encoding: 'utf8', env: { ...process.env, TEMP: f.root, TMP: f.root, TMPDIR: f.root } });
    assert.equal(child.status, 72, child.stderr);
    assert.deepEqual(await fs.readFile(path.join(f.target, assets[0])), files[assets[0]]);
    const backupRoot = path.join(f.root, '.ben10-omnitrix-backups');
    const first = (await fs.readdir(backupRoot)).find(name => name !== 'install.lock');
    assert.equal(await fs.readFile(path.join(backupRoot, first, 'before', assets[0]), 'utf8'), 'before interrupted update');
    await f.run({ apply: true, fetchImpl: remote({ files }) });
    for (const [name, bytes] of Object.entries(files)) assert.deepEqual(await fs.readFile(path.join(f.target, name)), bytes);
    await assert.rejects(fs.stat(path.join(backupRoot, 'install.lock')), { code: 'ENOENT' });
    assert.equal(await fs.readFile(path.join(backupRoot, first, 'before', assets[0]), 'utf8'), 'before interrupted update');
});


test('cached files still require the pinned Git blob hash, not only the manifest SHA-256', async t => {
    const f = await fixture(t), { files, assets } = directoryBundle(1);
    await f.run({ apply: true, fetchImpl: remote({ files }) });
    const before = await fs.readFile(path.join(f.target, assets[0]));
    await assert.rejects(f.run({ apply: true, fetchImpl: remote({ files, treeTransform: tree => tree.map(entry => entry.path === assets[0] ? { ...entry, sha: 'b'.repeat(40) } : entry) }) }), /校验失败/);
    assert.deepEqual(await fs.readFile(path.join(f.target, assets[0])), before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { install, downloadRuntime, RUNTIME_FILES } from '../scripts/mobile-install.mjs';

const commit = 'a'.repeat(40);
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const runtime = Object.fromEntries(Object.entries({
    'manifest.json': JSON.stringify({ display_name: 'Ben 10 · Omnitrix', js: 'extension.js', css: 'extension.css', version: '0.2.0' }),
    'extension.js': 'export function activate() {}',
    'host-adapter.js': 'export const namespace = "ben10-omnitrix";',
    'extension.css': '.ben10 { color: green; }',
    'preview.html': '<!doctype html><html><body><main id="omni-app"></main></body></html>',
}).map(([name, value]) => [name, Buffer.from(value)]));

function remote({ fail, corrupt, requests = [], onRead = async () => {} } = {}) {
    return async url => {
        requests.push(url);
        await onRead(url);
        if (url.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: commit, type: 'commit' } });
        if (url.endsWith(`/git/trees/${commit}`)) return Response.json({ tree: RUNTIME_FILES.map(name => ({ path: name, type: 'blob', mode: '100644', size: runtime[name].length, sha: blob(runtime[name]) })) });
        const name = url.split('/').at(-1);
        if (name === fail) return new Response('failed', { status: 503 });
        assert.equal(url, `https://raw.githubusercontent.com/louisSSR/ben10-omnitrix-plugin/${commit}/${name}`);
        return new Response(name === corrupt ? 'broken' : runtime[name]);
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
    assert.equal(requests.length, 7);
    assert.ok(requests.slice(2).every(url => url.includes(`/${commit}/`)));
});

test('mobile install creates missing directory and repeating apply is a no-op', async t => {
    const f = await fixture(t);
    const first = await f.run({ apply: true });
    assert.equal(first.changed.length, 5);
    for (const name of RUNTIME_FILES) assert.deepEqual(await fs.readFile(path.join(f.target, name)), runtime[name]);
    const second = await f.run({ apply: true });
    assert.deepEqual(second.changed, []);
    assert.equal(second.backup, null);
    assert.equal((await fs.readdir(path.join(f.root, '.ben10-omnitrix-backups'))).length, 1);
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
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode], { encoding: 'utf8' });
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

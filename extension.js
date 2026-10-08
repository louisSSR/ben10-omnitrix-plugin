import { createHostAdapter, MESSAGE_NAMESPACE, sanitizePreferences, sanitizeSelection } from './host-adapter.js';

const OWNER = Symbol.for('ben10-omnitrix.extension');
const SETTINGS_ID = 'ben10-omnitrix-settings';
let ownedRuntime = null;

export function activate() {
    if (ownedRuntime) return;
    window[OWNER]?.destroy?.();
    const adapter = createHostAdapter(window);
    const cleanups = [];
    let settings = null;
    let dialog = null;
    let frame = null;
    let selected = null;
    let lastDraft = -Infinity;
    let destroyed = false;
    let opener = null;
    let observer = null;
    let mountTimeout = null;
    const listen = (target, event, callback) => {
        target.addEventListener(event, callback);
        cleanups.push(() => target.removeEventListener(event, callback));
    };
    function post(type, payload) {
        frame?.contentWindow?.postMessage({ namespace: MESSAGE_NAMESPACE, type, payload }, location.origin);
    }
    function close() {
        if (!dialog) return;
        dialog.remove();
        dialog = null;
        frame = null;
        selected = null;
        if (opener?.isConnected) opener.focus();
        opener = null;
    }
    function open() {
        if (destroyed) return;
        if (dialog) { dialog.focus(); return; }
        opener = document.activeElement;
        selected = null;
        dialog = document.createElement('dialog');
        dialog.id = 'ben10-omnitrix-dialog';
        dialog.setAttribute('aria-label', 'Omnitrix 外星人变身选择器');
        const toolbar = document.createElement('div');
        toolbar.className = 'ben10-omnitrix-toolbar';
        const title = document.createElement('strong');
        title.textContent = 'OMNITRIX';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '关闭';
        closeButton.className = 'menu_button';
        closeButton.addEventListener('click', close);
        toolbar.append(title, closeButton);
        frame = document.createElement('iframe');
        frame.title = 'Omnitrix 形态库';
        frame.src = new URL('./preview.html', import.meta.url).href;
        frame.setAttribute('referrerpolicy', 'same-origin');
        dialog.append(toolbar, frame);
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        dialog.addEventListener('close', close);
        document.body.append(dialog);
        dialog.showModal();
        closeButton.focus();
    }
    function stopMountWatch() {
        observer?.disconnect();
        observer = null;
        if (mountTimeout !== null) window.clearTimeout(mountTimeout);
        mountTimeout = null;
    }
    function mount() {
        if (destroyed || settings?.isConnected) return;
        const container = adapter.settingsContainer();
        if (!container) return;
        stopMountWatch();
        document.getElementById(SETTINGS_ID)?.remove();
        settings = document.createElement('section');
        settings.id = SETTINGS_ID;
        const heading = document.createElement('h4');
        heading.textContent = 'Ben 10 · Omnitrix';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu_button';
        button.textContent = '打开 Omnitrix';
        button.addEventListener('click', open);
        const hint = document.createElement('small');
        hint.textContent = '选择形态，按需写入输入框。';
        settings.append(heading, button, hint);
        container.append(settings);
    }
    listen(window, 'message', event => {
        if (!frame || event.origin !== location.origin || event.source !== frame.contentWindow) return;
        const message = event.data;
        if (!message || typeof message !== 'object' || Array.isArray(message) || message.namespace !== MESSAGE_NAMESPACE) return;
        switch (message.type) {
            case 'ready':
                post('init', { preferences: adapter.loadPreferences(), capabilities: adapter.capabilities(), hostVersion: adapter.hostVersion });
                break;
            case 'prefs': {
                const preferences = sanitizePreferences(message.payload?.preferences);
                if (!Object.keys(preferences).length) return;
                const result = adapter.savePreferences(preferences);
                post('prefs', { ...result, capabilities: adapter.capabilities() });
                break;
            }
            case 'select':
                selected = sanitizeSelection(message.payload);
                break;
            case 'draft': {
                const requested = sanitizeSelection(message.payload);
                if (!selected || !requested || requested.formId !== selected.formId || requested.name !== selected.name) {
                    post('draft-result', { ok: false, reason: '请先选择形态。' });
                    return;
                }
                const now = performance.now();
                if (now - lastDraft < 700) return;
                lastDraft = now;
                post('draft-result', adapter.appendDraft(requested));
                break;
            }
        }
    });
    listen(window, 'keydown', event => {
        if (event.key === 'Escape' && dialog) { event.preventDefault(); close(); }
    });
    cleanups.push(adapter.onReady(mount));
    mount();
    if (!settings) {
        if (document.body) {
            observer = new MutationObserver(mount);
            observer.observe(document.body, { childList: true, subtree: true });
            mountTimeout = window.setTimeout(stopMountWatch, 20000);
        }
        if (document.readyState === 'loading') listen(document, 'DOMContentLoaded', mount);
    }
    const runtime = {
        open,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            stopMountWatch();
            close();
            settings?.remove();
            cleanups.splice(0).forEach(cleanup => cleanup());
            if (window[OWNER] === runtime) delete window[OWNER];
            if (ownedRuntime === runtime) ownedRuntime = null;
        },
    };
    window[OWNER] = runtime;
    ownedRuntime = runtime;
}

export function destroy() { ownedRuntime?.destroy(); }
export function disable() { destroy(); }
export function clean() { destroy(); }
export function enable() { activate(); }

activate();

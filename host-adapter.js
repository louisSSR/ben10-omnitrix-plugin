export const SETTINGS_NAMESPACE = 'ben10Omnitrix';
export const MESSAGE_NAMESPACE = 'ben10-omnitrix';
const LOCAL_KEY = 'ben10-omnitrix:preferences:v1';
const WATCHES = new Set(['original', 'recalibrated', 'ultimatrix', 'omniverse']);
const MODES = new Set(['projection', 'carousel', 'dial']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function sanitizePreferences(value) {
    if (!isRecord(value)) return {};
    const result = {};
    if (WATCHES.has(value.watch)) result.watch = value.watch;
    if (MODES.has(value.mode)) result.mode = value.mode;
    else if (value.mode === 'archive') result.mode = 'projection';
    if (typeof value.reducedMotion === 'boolean') result.reducedMotion = value.reducedMotion;
    if (['energy', 'amber', 'rose'].includes(value.palette)) result.palette = value.palette;
    if (typeof value.selectedId === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/.test(value.selectedId)) {
        result.selectedId = value.selectedId;
    }
    return result;
}

export function sanitizeSelection(value) {
    if (!isRecord(value) || typeof value.formId !== 'string' || typeof value.name !== 'string') return null;
    if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(value.formId)) return null;
    const name = value.name.trim();
    if (!name || name.length > 160 || /[\u0000-\u001f\u007f]/u.test(name)) return null;
    return { formId: value.formId, name };
}

export function createHostAdapter(hostWindow = window) {
    const doc = hostWindow.document;
    const context = () => {
        try { return hostWindow.SillyTavern?.getContext?.() ?? null; } catch { return null; }
    };
    const settingsContext = () => {
        const ctx = context();
        const settings = ctx?.extensionSettings;
        return isRecord(settings) && typeof ctx.saveSettingsDebounced === 'function'
            && (settings[SETTINGS_NAMESPACE] === undefined || isRecord(settings[SETTINGS_NAMESPACE])) ? ctx : null;
    };
    let localAvailable = true;
    const localPreferences = () => {
        try { return sanitizePreferences(JSON.parse(hostWindow.localStorage.getItem(LOCAL_KEY) || '{}')); }
        catch { localAvailable = false; return {}; }
    };
    let memoryPreferences = localPreferences();
    let persistence = settingsContext() ? 'host' : localAvailable ? 'local' : 'memory';
    function loadPreferences() {
        const ctx = settingsContext();
        return { ...memoryPreferences, ...sanitizePreferences(ctx?.extensionSettings[SETTINGS_NAMESPACE]) };
    }
    function savePreferences(patch) {
        const next = { ...loadPreferences(), ...sanitizePreferences(patch) };
        memoryPreferences = next;
        const ctx = settingsContext();
        if (ctx) {
            const previous = ctx.extensionSettings[SETTINGS_NAMESPACE];
            try {
                ctx.extensionSettings[SETTINGS_NAMESPACE] = { ...(previous || {}), ...next };
                ctx.saveSettingsDebounced();
                persistence = 'host';
                return { preferences: next, persistence };
            } catch {
                if (previous === undefined) delete ctx.extensionSettings[SETTINGS_NAMESPACE];
                else ctx.extensionSettings[SETTINGS_NAMESPACE] = previous;
            }
        }
        try {
            hostWindow.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
            persistence = 'local';
        } catch { persistence = 'memory'; }
        return { preferences: next, persistence };
    }
    function inputElement() {
        const input = doc.getElementById('send_textarea');
        return input?.tagName === 'TEXTAREA' && !input.disabled && !input.readOnly ? input : null;
    }
    function appendDraft(selection) {
        const valid = sanitizeSelection(selection);
        const input = inputElement();
        if (!valid || !input) return { ok: false, reason: '酒馆输入框当前不可用。' };
        const previous = input.value;
        input.value = `${previous}${previous && !/\s$/u.test(previous) ? '\n' : ''}${valid.name}`;
        input.dispatchEvent(new hostWindow.Event('input', { bubbles: true }));
        return { ok: true };
    }
    function onReady(callback) {
        const ctx = context();
        const source = ctx?.eventSource;
        const ready = ctx?.eventTypes?.APP_READY;
        if (!ready || typeof source?.on !== 'function' || typeof source?.off !== 'function') return () => {};
        source.on(ready, callback);
        return () => source.off(ready, callback);
    }
    return {
        loadPreferences, savePreferences, appendDraft, onReady,
        settingsContainer: () => doc.getElementById('extensions_settings2') || doc.getElementById('extensions_settings'),
        capabilities: () => ({ persistentPreferences: persistence !== 'memory', preferenceStorage: persistence, draftInput: Boolean(inputElement()) }),
        hostVersion: null,
    };
}

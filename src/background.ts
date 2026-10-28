import { DEFAULTS, STORAGE_DEFAULTS, type FillOptions, type RunMode } from './shared/types';

const MENU_FILL = 'prx-qa-fill';
const MENU_INSPECT = 'prx-qa-inspect';

function normalizeSettings(stored: Record<string, unknown>): FillOptions {
    return {
        seed: Number(stored.seed) || DEFAULTS.seed,
        repeatable: stored.repeatable === true,
        scope: stored.scope === 'all' ? 'all' : 'required',
        dropdown:
            stored.dropdown === 'random' || stored.dropdown === 'profile'
                ? stored.dropdown
                : 'first',
        profile:
            stored.profile && typeof stored.profile === 'object' && !Array.isArray(stored.profile)
                ? (stored.profile as Record<string, string>)
                : {},
    };
}

function randomNonce(): number {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        return crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return Math.floor(Math.random() * 0xffffffff);
}

function createMenu(options: chrome.contextMenus.CreateProperties): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.contextMenus.create(options, () => {
            const error = chrome.runtime.lastError;
            if (error) reject(new Error(error.message));
            else resolve();
        });
    });
}

async function createContextMenus(): Promise<void> {
    await chrome.contextMenus.removeAll();

    await createMenu({
        id: MENU_FILL,
        title: 'PRAXXYS Autofill: Fill form',
        contexts: ['page', 'editable'],
    });

    await createMenu({
        id: MENU_INSPECT,
        title: 'PRAXXYS Autofill: Inspect fields',
        contexts: ['page', 'editable'],
    });
}

let menuSetup: Promise<void> | null = null;

function setupMenus(): Promise<void> {
    menuSetup ??= createContextMenus().catch((error) => {
        menuSetup = null;
        console.error('PRAXXYS Autofill: could not create context menus', error);
    });
    return menuSetup;
}

async function ensureInjected(tabId: number): Promise<void> {
    let alive = false;

    try {
        const pong = (await chrome.tabs.sendMessage(tabId, { type: 'ping' })) as
            | { ok?: boolean }
            | undefined;
        alive = Boolean(pong?.ok);
    } catch {
        alive = false;
    }

    if (!alive) {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    }

    await chrome.scripting.executeScript({
        target: { tabId },
        files: ['main-world.js'],
        world: 'MAIN',
    });
}

async function runOnTab(
    tabId: number | undefined,
    mode: RunMode,
    options: FillOptions,
): Promise<unknown> {
    if (!tabId) return { ok: false, error: 'No active tab.' };

    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab?.url || !/^https?:/i.test(tab.url)) {
        return { ok: false, error: 'Open a web page first.' };
    }

    try {
        await ensureInjected(tabId);
        return await chrome.tabs.sendMessage(tabId, {
            type: 'run',
            mode,
            // A fresh salt per fill makes names, phones, PhilSys, dropdowns and
            // file formats vary. Repeatable pins the nonce to 0.
            options: { ...options, nonce: options.repeatable ? 0 : randomNonce() },
        });
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function runOnActiveTab(mode: RunMode, options: FillOptions): Promise<unknown> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return runOnTab(tab?.id, mode, options);
}

chrome.runtime.onInstalled.addListener(() => {
    void setupMenus();
});

chrome.runtime.onStartup.addListener(() => {
    void setupMenus();
});

// Keep the menu available after an unpacked-extension reload.
void setupMenus();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_FILL && info.menuItemId !== MENU_INSPECT) return;

    const stored = await chrome.storage.local.get(STORAGE_DEFAULTS);
    const mode: RunMode = info.menuItemId === MENU_INSPECT ? 'inspect' : 'fill';
    await runOnTab(tab?.id, mode, normalizeSettings(stored));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RUN_SHORTCUT') {
        (async () => {
            const stored = await chrome.storage.local.get(STORAGE_DEFAULTS);
            return runOnTab(_sender.tab?.id, 'fill', normalizeSettings(stored));
        })()
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, error: String(error) }));
        return true;
    }

    if (message?.type !== 'RUN') return;

    const mode: RunMode = message.mode === 'inspect' ? 'inspect' : 'fill';
    const options = normalizeSettings((message.options ?? {}) as Record<string, unknown>);

    runOnActiveTab(mode, options)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
});

chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'fill-form') return;

    const stored = await chrome.storage.local.get(STORAGE_DEFAULTS);
    await runOnActiveTab('fill', normalizeSettings(stored));
});

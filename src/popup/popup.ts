import { DEFAULTS, STORAGE_DEFAULTS, type FillOptions, type FillReport } from '../shared/types';

const seedEl = document.getElementById('seed') as HTMLInputElement;
const repeatableEl = document.getElementById('repeatable') as HTMLInputElement;
const scopeEl = document.getElementById('scope') as HTMLSelectElement;
const dropdownEl = document.getElementById('dropdown') as HTMLSelectElement;
const profileEl = document.getElementById('profile') as HTMLTextAreaElement;
const fillEl = document.getElementById('fill') as HTMLButtonElement;
const inspectEl = document.getElementById('inspect') as HTMLButtonElement;
const enableEl = document.getElementById('enable') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const shortcutEl = document.getElementById('shortcut') as HTMLParagraphElement;
const shortcutButton = document.getElementById('shortcutButton') as HTMLButtonElement;
const originEl = document.getElementById('origin') as HTMLParagraphElement;
const dotEl = document.getElementById('dot') as HTMLSpanElement;

let originPattern = '';
let isWebPage = false;

function setStatus(message: string): void {
    statusEl.textContent = message;
}

function readProfile(): Record<string, string> | null {
    const raw = profileEl.value.trim();
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Profile must be a JSON object');
        }
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
        );
    } catch (error) {
        setStatus(`Profile JSON: ${error instanceof Error ? error.message : 'invalid'}`);
        return null;
    }
}

function readOptions(): FillOptions | null {
    const profile = readProfile();
    if (!profile) return null;

    return {
        seed: Number(seedEl.value) || DEFAULTS.seed,
        repeatable: repeatableEl.checked,
        scope: scopeEl.value === 'all' ? 'all' : 'required',
        dropdown:
            dropdownEl.value === 'random' || dropdownEl.value === 'profile'
                ? dropdownEl.value
                : 'first',
        profile,
    };
}

async function save(options: FillOptions): Promise<void> {
    await chrome.storage.local.set(options);
}

async function resolveOrigin(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';

    if (!/^https?:/i.test(url)) {
        originEl.textContent = 'Not a web page';
        dotEl.classList.add('off');
        fillEl.disabled = true;
        inspectEl.disabled = true;
        return;
    }

    const parsed = new URL(url);
    originPattern = `${parsed.protocol}//${parsed.hostname}/*`;
    originEl.textContent = parsed.host;
    isWebPage = true;

    const local = /^(localhost|127\.0\.0\.1)$/.test(parsed.hostname);
    const granted = local || (await chrome.permissions.contains({ origins: [originPattern] }));

    enableEl.hidden = granted;
    dotEl.classList.toggle('off', !granted);
}

async function load(): Promise<void> {
    const stored = await chrome.storage.local.get(STORAGE_DEFAULTS);

    seedEl.value = String(stored.seed ?? DEFAULTS.seed);
    repeatableEl.checked = stored.repeatable === true;
    scopeEl.value = stored.scope === 'all' ? 'all' : 'required';
    dropdownEl.value =
        stored.dropdown === 'random' || stored.dropdown === 'profile' ? stored.dropdown : 'first';

    const profile = stored.profile;
    if (profile && typeof profile === 'object' && Object.keys(profile).length > 0) {
        profileEl.value = JSON.stringify(profile, null, 2);
    }

    await resolveOrigin();
    await showShortcut();
}

async function showShortcut(): Promise<void> {
    try {
        const commands = await chrome.commands.getAll();
        const command = commands.find((item) => item.name === 'fill-form');
        shortcutEl.textContent = command?.shortcut
            ? `Shortcut: ${command.shortcut}`
            : 'Shortcut: not set';
    } catch {
        shortcutEl.textContent = 'Shortcut: not set';
    }
}

shortcutButton.addEventListener('click', async () => {
    await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    window.close();
});

async function run(mode: 'fill' | 'inspect'): Promise<void> {
    if (!isWebPage) return;

    const options = readOptions();
    if (!options) return;

    await save(options);
    setStatus(mode === 'fill' ? 'Filling…' : 'Scanning…');

    try {
        const response = (await chrome.runtime.sendMessage({
            type: 'RUN',
            mode,
            options,
        })) as { ok?: boolean; error?: string; report?: FillReport };

        if (!response?.ok || !response.report) {
            setStatus(response?.error ?? 'No response from the page.');
            return;
        }

        const report = response.report;
        setStatus(
            mode === 'inspect'
                ? `${report.detected} fields detected — nothing changed`
                : `${report.filled} filled · ${report.skipped} skipped · ${report.failed} failed`,
        );
    } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
    }
}

fillEl.addEventListener('click', () => run('fill'));
inspectEl.addEventListener('click', () => run('inspect'));

enableEl.addEventListener('click', async () => {
    if (!originPattern) return;

    try {
        const granted = await chrome.permissions.request({ origins: [originPattern] });
        enableEl.hidden = granted;
        dotEl.classList.toggle('off', !granted);
        setStatus(granted ? 'Origin enabled. Fill away.' : 'Permission was not granted.');
    } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
    }
});

for (const el of [seedEl, repeatableEl, scopeEl, dropdownEl, profileEl]) {
    el.addEventListener('change', () => {
        const options = readOptions();
        if (options) void save(options);
    });
}

void load();

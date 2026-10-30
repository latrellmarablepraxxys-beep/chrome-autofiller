import type { ControlKind, DetectedControl } from '../shared/types';
import { cleanLabel, fieldKey, isDisabled, isVisible, normalizeText, readLabel } from '../shared/dom';
import { insideDatePickerMenu } from '../shared/picker';
import { flavorFor, isOwnedByWidget, widgetFor, widgetProbes } from '../adapters/registry';

const CANDIDATE_SELECTOR = [
    ...widgetProbes(),
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
].join(',');

const SKIP_ANCESTORS = [
    '.ck-toolbar',
    '.tiptap-toolbar',
    '.dp__menu',
    '.dp__calendar',
    '[role="listbox"]',
    '[role="menu"]',
    '[data-prx-skip]',
].join(',');

function insideSkipped(el: Element): boolean {
    if (insideDatePickerMenu(el)) return true;
    return Boolean(el.closest(SKIP_ANCESTORS));
}

function kindFor(el: HTMLElement): ControlKind | null {
    const widget = widgetFor(el);
    if (widget) return widget.kind;

    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
        if (el.closest('.ck-editor')) return 'ckeditor';
        if (
            el.classList.contains('tiptap') ||
            el.classList.contains('ProseMirror') ||
            el.closest('.tiptap-editor')
        ) {
            return 'tiptap';
        }
        return null;
    }

    if (el.matches('[role="combobox"]')) return null;

    if (el instanceof HTMLSelectElement) return 'native-select';
    if (el instanceof HTMLTextAreaElement) return 'textarea';
    if (el instanceof HTMLInputElement) return inputKind(el);

    return null;
}

/**
 * Native input types the engine understands. Types without a reliable fill
 * strategy stay undetected instead of failing mid-run.
 */
function inputKind(el: HTMLInputElement): ControlKind | null {
    switch (el.type) {
        case 'file':
            return 'file';
        case 'checkbox':
            return 'checkbox';
        case 'radio':
            return 'radio';
        case 'email':
            return 'email';
        case 'tel':
            return 'tel';
        case 'url':
            return 'url';
        case 'number':
        case 'range':
            return 'number';
        case 'date':
        case 'month':
        case 'datetime-local':
            return 'date';
        case 'time':
            return 'time';
        case 'color':
            return 'color';
        case 'password':
            return 'password';
        case 'hidden':
        case 'submit':
        case 'button':
        case 'reset':
        case 'image':
        case 'search':
        case 'week':
            return null;
        default:
            return textLikeKind(el);
    }
}

function textLikeKind(el: HTMLInputElement): ControlKind {
    const inputmode = (el.getAttribute('inputmode') ?? '').toLowerCase();
    if (inputmode === 'numeric' || inputmode === 'decimal') return 'number';

    const pattern = el.getAttribute('pattern') ?? '';
    if (pattern.includes('0-9') || pattern.includes('\\d')) return 'number';

    return 'text';
}

/**
 * Editors and composite widgets contain inputs that belong to the parent
 * control; only the root is reported.
 */
function isInsideOtherControl(el: HTMLElement): boolean {
    if (isOwnedByWidget(el)) return true;

    const editor = el.closest('.ck-toolbar, .tiptap-toolbar');
    return editor !== null && editor !== el;
}

function radioGroupLabel(el: HTMLElement): string {
    if (!el.matches('[role="radio"]')) return '';

    const group = el.closest('[role="radiogroup"]');
    const parent = group?.parentElement;
    if (!parent) return '';

    for (const child of Array.from(parent.children)) {
        if (child === group) continue;
        if (child.tagName === 'LABEL') return normalizeText(child.textContent);
    }

    return '';
}

interface CheckboxContext {    group: HTMLElement;
    groupLabel: string;
    optionLabel: string;
}

function checkboxContext(el: HTMLElement): CheckboxContext | null {
    if (!el.matches('[role="checkbox"], input[type="checkbox"]')) return null;

    let group = el.parentElement;
    while (group && group !== document.body) {
        const count = group.querySelectorAll('[role="checkbox"], input[type="checkbox"]').length;
        if (count >= 2) break;
        group = group.parentElement;
    }

    if (!group || group === document.body) return null;

    const directLabel =
        Array.from(group.children).find((child) => child.tagName === 'LABEL')?.textContent ?? '';
    const groupLabel = normalizeText(directLabel);

    // Unrelated checkboxes often share a <form>; only treat a container as a
    // group when it has its own group label (e.g. "Type of Disability *").
    if (!groupLabel) return null;

    let node: HTMLElement | null = el.parentElement;
    let optionLabel = '';

    while (node && node !== group) {
        const text = normalizeText(node.textContent);
        if (text && text !== groupLabel && text.length <= 80) {
            optionLabel = text;
            break;
        }
        node = node.parentElement;
    }

    return { group, groupLabel, optionLabel };
}

function toggleGroupLabel(group: HTMLElement): string {
    const parent = group.parentElement;
    if (!parent) return '';

    for (const child of Array.from(parent.children)) {
        if (child === group) continue;
        if (child.tagName === 'LABEL' || child.tagName === 'P') return normalizeText(child.textContent);
    }

    const label = parent.querySelector('label');
    if (label && !label.contains(group)) return normalizeText(label.textContent);

    return '';
}

function toControl(el: HTMLElement, index: number): DetectedControl | null {
    if (insideSkipped(el)) return null;
    if (isInsideOtherControl(el)) return null;

    const kind = kindFor(el);
    if (!kind) return null;

    if (kind === 'file') {
        const hiddenAncestor = el.parentElement?.closest('[hidden], [aria-hidden="true"]');
        if (hiddenAncestor) return null;
    } else if (!isVisible(el)) {
        return null;
    }

    const inner = el.querySelector<HTMLInputElement>('input');
    const labelText = readLabel(el);
    const checkbox = kind === 'checkbox' ? checkboxContext(el) : null;
    const radioGroup = el.closest<HTMLElement>('[role="radiogroup"]');
    const toggleGroup =
        kind === 'toggle-group'
            ? el.closest<HTMLElement>('[data-slot="toggle-group"], [role="group"]')
            : null;
    const groupLabel =
        radioGroupLabel(el) ||
        checkbox?.groupLabel ||
        (toggleGroup ? toggleGroupLabel(toggleGroup) : '') ||
        '';
    const required = Boolean(
        (el as HTMLInputElement).required ||
            el.getAttribute('aria-required') === 'true' ||
            /\*\s*$/.test(labelText) ||
            /\*\s*$/.test(groupLabel),
    );

    const optionLabel =
        kind === 'toggle-group'
            ? normalizeText(el.textContent)
            : checkbox?.optionLabel || cleanLabel(labelText);
    const label = groupLabel
        ? kind === 'toggle-group'
            ? cleanLabel(groupLabel)
            : `${cleanLabel(groupLabel)}: ${optionLabel}`
        : optionLabel;

    const numeric =
        kind === 'number' ||
        ['numeric', 'decimal'].includes((el.getAttribute('inputmode') ?? '').toLowerCase());
    const name = el.getAttribute('name') ?? inner?.getAttribute('name') ?? '';
    const id = el.id || inner?.id || '';
    const placeholder = normalizeText(
        el.getAttribute('placeholder') ?? inner?.getAttribute('placeholder') ?? '',
    );

    return {
        el,
        kind,
        flavor: flavorFor(el, kind),
        label,
        name,
        id,
        placeholder,
        required,
        key: fieldKey(el, label, index),
        accept: (el as HTMLInputElement).accept ?? inner?.accept ?? '',
        multiple: Boolean((el as HTMLInputElement).multiple ?? inner?.multiple),
        numeric,
        optionLabel,
        groupEl: checkbox?.group ?? radioGroup ?? toggleGroup ?? undefined,
        groupLabel: groupLabel || undefined,
        groupRequired: /\*\s*$/.test(groupLabel),
        index,
    };
}

function activeDialog(): HTMLElement | null {
    const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'),
    );

    return dialogs.reverse().find((dialog) => isVisible(dialog)) ?? null;
}

export function scanControls(): DetectedControl[] {
    const dialog = activeDialog();
    const root: ParentNode = dialog ?? document;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR));
    const controls: DetectedControl[] = [];
    const usedKeys = new Map<string, number>();
    let index = 0;

    for (const node of nodes) {
        const control = toControl(node, index);
        if (!control) continue;

        const base = control.key;
        const seen = usedKeys.get(base) ?? 0;
        usedKeys.set(base, seen + 1);
        control.key = seen === 0 ? base : `${base}-${seen + 1}`;
        control.index = index;
        index += 1;
        controls.push(control);
    }

    // Button-only choice groups (e.g. the address "Label as" buttons) are not
    // native controls. Detect the safe, label-scoped groups only.
    for (const button of Array.from(root.querySelectorAll<HTMLElement>('form button'))) {
        if (isDisabled(button)) continue;

        const container = button.parentElement;
        if (!container) continue;

        const siblings = Array.from(container.querySelectorAll<HTMLElement>(':scope > button')).filter(
            (item) => !isDisabled(item),
        );
        if (siblings.length < 2 || siblings[0] !== button) continue;

        const groupText = normalizeText(container.parentElement?.textContent ?? '');
        if (!/label as|address type/i.test(groupText)) continue;

        const groupLabel = /label as/i.test(groupText) ? 'Label as' : 'Address type';
        const key = fieldKey(button, groupLabel, index);
        const seen = usedKeys.get(key) ?? 0;
        usedKeys.set(key, seen + 1);

        controls.push({
            el: button,
            kind: 'button-choice',
            flavor: 'native',
            label: groupLabel,
            name: '',
            id: '',
            placeholder: '',
            required: /\*/.test(groupText),
            key: seen === 0 ? key : `${key}-${seen + 1}`,
            accept: '',
            multiple: false,
            numeric: false,
            optionLabel: normalizeText(button.textContent),
            groupEl: container,
            groupLabel,
            groupRequired: /\*/.test(groupText),
            index,
        });
        index += 1;
    }

    return controls;
}

export function annotateControl(el: HTMLElement, label: string): void {
    ensureInspectStyle();
    if (!el.hasAttribute('data-prx-title')) {
        el.setAttribute('data-prx-title', el.getAttribute('title') ?? '');
    }
    el.setAttribute('data-prx-inspect', 'true');
    el.setAttribute('title', `PRAXXYS autofill: ${label}`);
}

export function clearInspection(): void {
    document.querySelectorAll('[data-prx-inspect]').forEach((el) => {
        const previous = el.getAttribute('data-prx-title') ?? '';
        el.removeAttribute('data-prx-inspect');
        el.removeAttribute('data-prx-title');
        if (previous) el.setAttribute('title', previous);
        else el.removeAttribute('title');
    });
}

function ensureInspectStyle(): void {
    if (document.getElementById('prx-qa-inspect-style')) return;

    const style = document.createElement('style');
    style.id = 'prx-qa-inspect-style';
    style.textContent =
        '[data-prx-inspect]{outline:2px dashed #7c3aed !important;outline-offset:2px}';
    document.head.appendChild(style);
}

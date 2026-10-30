export type FillScope = 'required' | 'all';
export type DropdownPolicy = 'first' | 'random' | 'profile';
export type RunMode = 'fill' | 'inspect';
export type FieldStatus = 'filled' | 'skipped' | 'failed' | 'detected';

export type WidgetFlavor =
    | 'native'
    | 'shadcn'
    | 'reka'
    | 'prx-vue-kit'
    | 'vue-select'
    | 'vue-multiselect'
    | 'vue-datepicker';

export type ControlKind =
    | 'text'
    | 'textarea'
    | 'number'
    | 'email'
    | 'tel'
    | 'url'
    | 'date'
    | 'time'
    | 'password'
    | 'native-select'
    | 'reka-combobox'
    | 'prx-select'
    | 'prx-searchable-select'
    | 'vue-multiselect'
    | 'vue-select'
    | 'color'
    | 'ckeditor'
    | 'tiptap'
    | 'file'
    | 'checkbox'
    | 'radio'
    | 'switch'
    | 'button-choice'
    | 'toggle-group';

export interface FillOptions {
    seed: number;
    nonce?: number;
    repeatable?: boolean;
    scope: FillScope;
    dropdown: DropdownPolicy;
    profile: Record<string, string>;
}

export interface DetectedControl {
    el: HTMLElement;
    kind: ControlKind;
    flavor?: WidgetFlavor;
    label: string;
    name: string;
    id: string;
    placeholder: string;
    required: boolean;
    key: string;
    accept: string;
    multiple: boolean;
    numeric: boolean;
    optionLabel?: string;
    groupEl?: HTMLElement;
    groupLabel?: string;
    groupRequired?: boolean;
    index: number;
}

export interface FieldResult {
    key: string;
    label: string;
    kind: ControlKind;
    flavor?: WidgetFlavor;
    semantic: string;
    status: FieldStatus;
    reason?: string;
    strategy?: string;
    preview?: string;
    retryable?: boolean;
}

export interface FillReport {
    url: string;
    mode: RunMode;
    startedAt: string;
    durationMs: number;
    filled: number;
    skipped: number;
    failed: number;
    detected: number;
    fields: FieldResult[];
}

export interface RunRequest {
    type: 'run';
    requestId: string;
    mode: RunMode;
    options: FillOptions;
}

export interface RunResult {
    type: 'result';
    requestId: string;
    report?: FillReport;
    error?: string;
}

export const DEFAULTS: FillOptions = {
    seed: 20260101,
    repeatable: false,
    scope: 'required',
    dropdown: 'first',
    profile: {},
};

/** chrome.storage rejects FillOptions directly: it needs an index signature. */
export const STORAGE_DEFAULTS: Record<string, unknown> = {
    seed: DEFAULTS.seed,
    repeatable: false,
    scope: DEFAULTS.scope,
    dropdown: DEFAULTS.dropdown,
    profile: DEFAULTS.profile,
};

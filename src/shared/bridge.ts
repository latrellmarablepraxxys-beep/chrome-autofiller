export interface QaEditorBridge {
    id: string;
    kind: 'ckeditor' | 'tiptap';
    el?: HTMLElement;
    get: () => string;
    set: (html: string) => void;
}

declare global {
    interface Window {
        __PRX_QA__?: {
            editors: Map<string, QaEditorBridge>;
        };
        __PRX_QA_AUTOFILL__?: unknown;
        __PRX_QA_CONTENT__?: boolean;
        __PRX_QA_EXECUTOR__?: boolean;
    }
}

export {};

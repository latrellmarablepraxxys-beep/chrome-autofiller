import type { ControlKind, DetectedControl } from '../shared/types';
import type { ModuleContext } from './module';
import { normalizeForMatch, RULES, type Semantic } from './lexicon';
import { DROPDOWN_KINDS } from '../adapters/registry';

const BARE_NAME = /^(name|title|display name|record name)$/;
const ENTITY_NAME_PATTERNS = RULES.find(([semantic]) => semantic === 'entity_name')?.[1] ?? [];

export function isDropdownKind(kind: ControlKind): boolean {
    return DROPDOWN_KINDS.includes(kind);
}

export function classify(control: DetectedControl, module?: ModuleContext): Semantic {
    if (control.kind === 'ckeditor' || control.kind === 'tiptap') return 'rich_text';
    if (control.kind === 'file') return 'file';

    const labelOnly = normalizeForMatch(control.label.replace(/\*/g, ''));
    const haystack = normalizeForMatch(
        [control.label, control.name, control.id, control.placeholder].join(' '),
    );

    // A bare "Name"/"Title" means the entity being edited, not a person.
    if (BARE_NAME.test(labelOnly)) {
        if (module && module.kind !== 'person') return 'entity_name';
        if (labelOnly === 'name') return 'full_name';
    }

    // Entity nouns are matched against the label only ("Category", "Page Title").
    if (ENTITY_NAME_PATTERNS.some((pattern) => pattern.test(labelOnly))) {
        return 'entity_name';
    }

    // A plain "Video" text field is a video URL; don't steal the title or
    // description fields next to it.
    if (
        ['text', 'url', 'textarea'].includes(control.kind) &&
        /\bvideo\b/.test(labelOnly) &&
        !/title|description|thumbnail|poster|caption|alt|featured/.test(labelOnly)
    ) {
        return 'video_url';
    }

    for (const [semantic, patterns] of RULES) {
        if (semantic === 'entity_name') continue;

        if (patterns.some((pattern) => pattern.test(haystack))) {
            return semantic;
        }
    }

    if (isDropdownKind(control.kind)) return 'option';
    if (control.kind === 'url') {
        const haystack = normalizeForMatch(
            [control.label, control.name, control.id, control.placeholder].join(' '),
        );
        if (/youtube|vimeo|video/.test(haystack)) return 'video_url';
        if (/map|location|direction|coordinate/.test(haystack)) return 'map_url';
        if (/facebook|instagram|linkedin|tiktok|twitter|x com/.test(haystack)) return 'social_url';
        return 'url';
    }
    if (control.kind === 'password') return 'password';
    if (control.kind === 'date') return 'date';
    if (control.kind === 'time') return 'time';
    if (control.kind === 'email') return 'email';
    if (control.kind === 'tel') return 'phone';
    if (control.kind === 'number') return 'number';

    return 'generic_text';
}

export function isAddressSemantic(semantic: Semantic): boolean {
    return ['region', 'province', 'city', 'barangay', 'address', 'address_line_2'].includes(semantic);
}

export function profileValueFor(
    control: DetectedControl,
    semantic: Semantic,
    profile: Record<string, string> | undefined,
): string | undefined {
    if (!profile) return undefined;

    const candidates = [
        control.key,
        control.label,
        control.name,
        control.id,
        semantic,
        control.key.replace(/-/g, ' '),
    ]
        .filter(Boolean)
        .map((candidate) => String(candidate).toLowerCase());

    for (const [key, value] of Object.entries(profile)) {
        if (candidates.includes(key.toLowerCase())) return value;
    }

    return undefined;
}

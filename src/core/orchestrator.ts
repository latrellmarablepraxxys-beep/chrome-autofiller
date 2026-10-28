import type {
    DetectedControl,
    FieldResult,
    FillOptions,
    FillReport,
    RunMode,
} from '../shared/types';
import { hashString, Rng } from '../shared/random';
import { cleanLabel, isDisabled, isVisible, sleep } from '../shared/dom';
import { classify, isDropdownKind, profileValueFor } from './classifier';
import { generateValue, type GenerationContext } from './faker';
import { detectModule } from './module';
import { ADDRESS_SEMANTICS, type Semantic } from './lexicon';
import { annotateControl, clearInspection, scanControls } from './scanner';
import { fillText } from '../adapters/text';
import { fillCheckbox, fillNativeSelect, fillRadio, fillToggle } from '../adapters/choice';
import { fillReka } from '../adapters/reka';
import { fillVueMultiselect } from '../adapters/vue-multiselect';
import { fillVueSelect } from '../adapters/vue-select';
import { fillEditor } from '../adapters/editors';
import { fillFile } from '../adapters/file';
import { fail, skip, skipRetry, type DropdownIntent, type FieldOutcome } from '../adapters/types';
import { buildReport } from './report';

interface Handled {
    outcome: FieldOutcome;
    semantic: Semantic;
}

function inScope(
    control: DetectedControl,
    options: FillOptions,
    module: ReturnType<typeof detectModule>,
): boolean {
    if (options.scope === 'all') return true;
    if (control.required) return true;
    if (control.kind === 'ckeditor' || control.kind === 'tiptap') return true;

    // Business-required fields that the UI does not always mark with `*`.
    const semantic = classify(control, module);
    if (semantic === 'philsys' || semantic === 'id_number') return true;

    // Links are content: fill them even when the field is optional (e.g. a
    // product's Video Link, which is only required when Video Featured is on).
    if (
        semantic === 'video_url' ||
        semantic === 'map_url' ||
        semantic === 'social_url' ||
        semantic === 'url'
    ) {
        return true;
    }

    // An unselected radio group with no default is almost always a required
    // choice (e.g. "Use my current address"). Fill one option.
    if (control.kind === 'radio' && control.groupEl) {
        const checked = control.groupEl.querySelector(
            '[role="radio"][aria-checked="true"], input[type="radio"]:checked',
        );
        if (!checked) return true;
    }

    return false;
}

function dropdownIntent(
    control: DetectedControl,
    options: FillOptions,
    rng: Rng,
    profile: string | undefined,
): DropdownIntent {
    const labels = profile
        ? profile
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
        : [];

    const count =
        control.kind === 'vue-multiselect' || control.kind === 'vue-select'
            ? control.multiple
                ? 2
                : 1
            : 1;

    return {
        labels,
        policy: options.dropdown,
        seed: rng.int(1, 2 ** 31 - 1),
        count,
    };
}

async function fillControl(
    control: DetectedControl,
    options: FillOptions,
    passwordCache: Map<string, string>,
    radioGroups: Set<string>,
    checkboxGroups: Set<string>,
    generation: GenerationContext,
): Promise<Handled> {
    const semantic = classify(control, generation.module);
    const rng = new Rng(hashString(`${options.seed}:${options.nonce ?? 0}:${control.key}`));
    const profile = profileValueFor(control, semantic, options.profile);

    if (!isVisible(control.el) && control.kind !== 'file') {
        return { outcome: skip('not visible'), semantic };
    }
    if (isDisabled(control.el)) return { outcome: skipRetry('disabled'), semantic };

    if (semantic === 'confirm_password') {
        const value = profile ?? passwordCache.get('password');
        if (!value) return { outcome: skip('no password to confirm'), semantic };
        return { outcome: fillText(control, value), semantic };
    }

    if (semantic === 'password') {
        if (!profile) return { outcome: skip('password: no profile value'), semantic };
        passwordCache.set('password', profile);
        return { outcome: fillText(control, profile), semantic };
    }

    try {
        switch (control.kind) {
            case 'ckeditor':
            case 'tiptap': {
                const html = profile ?? generateValue('rich_text', control, rng, generation);
                return { outcome: await fillEditor(control, html), semantic };
            }

            case 'file':
                return { outcome: await fillFile(control, rng), semantic };

            case 'native-select':
                return {
                    outcome: fillNativeSelect(control, dropdownIntent(control, options, rng, profile).labels),
                    semantic,
                };

            case 'reka-combobox':
                return {
                    outcome: await fillReka(control, dropdownIntent(control, options, rng, profile)),
                    semantic,
                };

            case 'vue-multiselect':
                return {
                    outcome: await fillVueMultiselect(
                        control,
                        dropdownIntent(control, options, rng, profile),
                    ),
                    semantic,
                };

            case 'vue-select':
                return {
                    outcome: await fillVueSelect(control, dropdownIntent(control, options, rng, profile)),
                    semantic,
                };

            case 'checkbox':
                return {
                    outcome: await fillCheckbox(
                        control,
                        checkboxGroups,
                        rng,
                        options.scope === 'all',
                    ),
                    semantic,
                };

            case 'radio':
                return { outcome: await fillRadio(control, radioGroups), semantic };

            case 'switch':
                return { outcome: fillToggle(control, true), semantic };

            default: {
                if (profile) return { outcome: fillText(control, profile), semantic };
                if (isDropdownKind(control.kind)) {
                    return { outcome: skip('unsupported dropdown'), semantic };
                }
                if (ADDRESS_SEMANTICS.includes(semantic) && control.kind === 'text') {
                    return {
                        outcome: fillText(
                            control,
                            generateValue('address', control, rng, generation),
                        ),
                        semantic,
                    };
                }
                const value = generateValue(semantic, control, rng, generation);
                return { outcome: fillText(control, value), semantic };
            }
        }
    } catch (error) {
        return {
            outcome: fail(`error: ${error instanceof Error ? error.message : String(error)}`),
            semantic,
        };
    }
}

function toFieldResult(control: DetectedControl, handled: Handled): FieldResult {
    const preview =
        handled.semantic === 'password' || handled.semantic === 'confirm_password'
            ? '••••••••'
            : handled.outcome.preview;

    return {
        key: control.key,
        label: control.label || control.name || control.id || control.key,
        kind: control.kind,
        semantic: handled.semantic,
        status: handled.outcome.status,
        reason: handled.outcome.reason,
        strategy: handled.outcome.strategy,
        preview,
    };
}

/**
 * Radio/checkbox options are one user-facing field. Collapse their results into
 * a single row (e.g. "Gender — Female") instead of listing every unselected
 * option as "skipped".
 */
function groupFieldResults(
    allControls: DetectedControl[],
    handled: Map<string, Handled>,
): FieldResult[] {
    const rows: FieldResult[] = [];
    const seenGroups = new Set<Element>();
    const ordered = allControls
        .filter((control) => handled.has(control.key))
        .sort((left, right) => left.index - right.index);

    for (const control of ordered) {
        const handledItem = handled.get(control.key)!;
        const group = control.groupEl;

        if (group && (control.kind === 'radio' || control.kind === 'checkbox')) {
            if (seenGroups.has(group)) continue;
            seenGroups.add(group);

            const members = ordered.filter(
                (item) => item.groupEl === group && handled.has(item.key),
            );
            const filled = members.find(
                (item) => handled.get(item.key)!.outcome.status === 'filled',
            );
            const representative = filled ?? members[0] ?? control;
            const outcome = handled.get(representative.key)!.outcome;
            const label = cleanLabel(control.groupLabel ?? '') || representative.label.split(':')[0];

            rows.push({
                key: `group-${rows.length + 1}`,
                label: label || representative.label,
                kind: representative.kind,
                semantic: handled.get(representative.key)!.semantic,
                status: outcome.status,
                reason: outcome.reason,
                strategy: outcome.strategy ?? 'group',
                preview: outcome.preview ?? representative.optionLabel,
            });
            continue;
        }

        rows.push(toFieldResult(control, handledItem));
    }

    return rows;
}

export async function execute(mode: RunMode, options: FillOptions): Promise<FillReport> {
    const started = Date.now();
    clearInspection();

    if (mode === 'inspect') {
        const inspectControls = scanControls();
        const inspectModule = detectModule(inspectControls);
        const fields = inspectControls.map((control) => {
            const semantic = classify(control, inspectModule);
            annotateControl(control.el, `${semantic} · ${control.kind}`);
            return {
                key: control.key,
                label: control.label || control.name || control.id || control.key,
                kind: control.kind,
                semantic,
                status: 'detected' as const,
            };
        });
        return buildReport(mode, started, fields);
    }

    const controls = scanControls();
    const module = detectModule(controls);
    const generation: GenerationContext = { coordinates: new Map(), module };
    const allControls = [...controls];
    const known = new Set(controls.map((control) => control.key));
    const pending = controls.filter((control) => inScope(control, options, module));
    const handled = new Map<string, Handled>();
    const passwordCache = new Map<string, string>();
    const radioGroups = new Set<string>();
    const checkboxGroups = new Set<string>();

    let queue = pending;
    for (let pass = 0; pass < 6; pass += 1) {
        const retry: DetectedControl[] = [];

        for (const control of queue) {
            if (handled.has(control.key)) continue;

            const result = await fillControl(
                control,
                options,
                passwordCache,
                radioGroups,
                checkboxGroups,
                generation,
            );
            if (result.outcome.retryable && pass < 5) {
                retry.push(control);
                continue;
            }

            handled.set(control.key, result);

            if (
                result.outcome.status === 'filled' &&
                ['reka-combobox', 'vue-select', 'vue-multiselect', 'native-select'].includes(
                    control.kind,
                )
            ) {
                // Dependent option lists are fetched by the app after a selection.
                await sleep(350);
            }
        }

        if (!retry.length) break;

        await sleep(900);
        const fresh = scanControls();
        queue = retry.map((control) => fresh.find((item) => item.key === control.key) ?? control);
    }

    // Conditional fields can appear (or become required) after a checkbox,
    // toggle, or dependent select is filled. Re-evaluate scope and fill them.
    for (let extra = 0; extra < 2; extra += 1) {
        await sleep(350);
        const fresh = scanControls();
        const candidates = fresh.filter(
            (control) => !handled.has(control.key) && inScope(control, options, module),
        );

        if (!candidates.length) break;

        for (const control of candidates) {
            if (handled.has(control.key)) continue;

            const result = await fillControl(
                control,
                options,
                passwordCache,
                radioGroups,
                checkboxGroups,
                generation,
            );
            handled.set(control.key, result);

            if (!known.has(control.key)) {
                known.add(control.key);
                allControls.push(control);
            }

            if (
                result.outcome.status === 'filled' &&
                ['reka-combobox', 'vue-select', 'vue-multiselect', 'native-select'].includes(
                    control.kind,
                )
            ) {
                await sleep(250);
            }
        }
    }

    const fields = groupFieldResults(allControls, handled);

    return buildReport(mode, started, fields);
}

import type {
    ControlKind,
    DetectedControl,
    FieldResult,
    FillOptions,
    FillReport,
    RunMode,
} from '../shared/types';
import { hashString, Rng } from '../shared/random';
import { cleanLabel, closeOpenDropdowns, isDisabled, sleep, visibilityReason } from '../shared/dom';
import { classify, isDropdownKind, profileValueFor } from './classifier';
import { generateValue, type GenerationContext } from './faker';
import { detectModule } from './module';
import { ADDRESS_SEMANTICS, type Semantic } from './lexicon';
import { annotateControl, clearInspection, scanControls } from './scanner';
import { fillText } from '../adapters/text';
import { fillDatePicker } from '../adapters/datepicker';
import {
    fillButtonChoice,
    fillCheckbox,
    fillNativeSelect,
    fillRadio,
    fillToggle,
    fillToggleGroup,
} from '../adapters/choice';
import { fillReka } from '../adapters/reka';
import { fillPrxSearchableSelect, fillPrxSelect } from '../adapters/prx';
import { fillVueMultiselect } from '../adapters/vue-multiselect';
import { fillVueSelect } from '../adapters/vue-select';
import { fillEditor } from '../adapters/editors';
import { fillFile } from '../adapters/file';
import { DROPDOWN_KINDS } from '../adapters/registry';
import { fail, skip, skipRetry, type DropdownIntent, type FieldOutcome } from '../adapters/types';
import { buildReport } from './report';

interface Handled {
    outcome: FieldOutcome;
    semantic: Semantic;
}

export function inScope(
    control: DetectedControl,
    options: FillOptions,
    module: ReturnType<typeof detectModule>,
): boolean {
    if (options.scope === 'all') return true;
    if (control.required) return true;
    if (control.kind === 'ckeditor' || control.kind === 'tiptap') return true;

    // Dates are cheap and always expected in QA data; pickers rarely expose
    // the `required` attribute, so scope them in explicitly.
    if (control.kind === 'date') return true;

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

    const count = control.multiple ? 2 : 1;

    return {
        labels,
        policy: options.dropdown,
        seed: rng.int(1, 2 ** 31 - 1),
        count,
    };
}

/**
 * Native month and datetime-local inputs accept their own value shapes, so the
 * calendar adapter only runs for date inputs and date-picker widgets.
 */
function fillNativeDate(control: DetectedControl, iso: string): FieldOutcome {
    const el = control.el as HTMLInputElement;
    const value =
        el.type === 'month'
            ? iso.slice(0, 7)
            : el.type === 'datetime-local'
              ? `${iso}T09:00`
              : iso;

    return fillText(control, value);
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

    const hiddenReason = visibilityReason(control.el);
    if (hiddenReason && control.kind !== 'file') {
        return { outcome: skipRetry(`not visible (${hiddenReason})`), semantic };
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

            case 'date': {
                const value = profile ?? generateValue('date', control, rng, generation);
                const outcome =
                    control.el instanceof HTMLInputElement && control.el.type !== 'date'
                        ? fillNativeDate(control, value)
                        : await fillDatePicker(control, value, rng);
                return { outcome, semantic };
            }

            case 'native-select':
                return {
                    outcome: fillNativeSelect(
                        control,
                        dropdownIntent(control, options, rng, profile),
                    ),
                    semantic,
                };

            case 'reka-combobox':
                return {
                    outcome: await fillReka(control, dropdownIntent(control, options, rng, profile)),
                    semantic,
                };

            case 'prx-select':
            case 'prx-searchable-select': {
                const intent = dropdownIntent(control, options, rng, profile);
                const outcome =
                    control.kind === 'prx-select'
                        ? await fillPrxSelect(control, intent)
                        : await fillPrxSearchableSelect(control, intent);
                return { outcome, semantic };
            }

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
                return { outcome: await fillToggle(control, true), semantic };

            case 'button-choice':
                return { outcome: fillButtonChoice(control, rng), semantic };

            case 'toggle-group':
                return { outcome: await fillToggleGroup(control, rng), semantic };

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
        flavor: control.flavor,
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
                flavor: representative.flavor,
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

function resolveFresh(control: DetectedControl): DetectedControl {
    if (control.el.isConnected) return control;

    return scanControls().find((item) => item.key === control.key) ?? control;
}

async function stableScan(): Promise<DetectedControl[]> {
    let previous = scanControls();

    // Wait out the modal's enter/transition and any async option render before
    // filling, so the captured elements are the live ones.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        await sleep(160);
        const next = scanControls();
        const same =
            next.length === previous.length &&
            next.every((control, index) => control.key === previous[index].key);

        if (same) return next;
        previous = next;
    }

    return previous;
}

export async function execute(mode: RunMode, options: FillOptions): Promise<FillReport> {
    const started = Date.now();
    clearInspection();

    if (mode === 'inspect') {
        const inspectControls = await stableScan();
        const inspectModule = detectModule(inspectControls);
        const fields = inspectControls.map((control) => {
            const semantic = classify(control, inspectModule);
            const kind = control.flavor ? `${control.kind} · ${control.flavor}` : control.kind;
            annotateControl(control.el, `${semantic} · ${kind}`);
            return {
                key: control.key,
                label: control.label || control.name || control.id || control.key,
                kind: control.kind,
                flavor: control.flavor,
                semantic,
                status: 'detected' as const,
            };
        });
        return buildReport(mode, started, fields);
    }

    const controls = await stableScan();
    const module = detectModule(controls);
    const generation: GenerationContext = { coordinates: new Map(), module };
    const allControls = [...controls];
    const known = new Set(controls.map((control) => control.key));
    const pending = controls.filter((control) => inScope(control, options, module));
    const handled = new Map<string, Handled>();
    const passwordCache = new Map<string, string>();
    const radioGroups = new Set<string>();
    const checkboxGroups = new Set<string>();

    // A control that cannot be filled yet (disabled until another field is set,
    // options still loading) gets one second chance. More than that just makes
    // the form visibly flicker and makes "All fields" runs time out.
    const MAX_ATTEMPTS = 2;
    const MAX_PASSES = 3;
    const attempts = new Map<string, number>();
    const lastResult = new Map<string, Handled>();

    const settleDropdown = async (control: DetectedControl, handledItem: Handled): Promise<void> => {
        if (
            handledItem.outcome.status !== 'filled' ||
            !DROPDOWN_KINDS.includes(control.kind)
        ) {
            return;
        }

        // Dependent option lists are fetched by the app after a selection.
        await sleep(700);
        // Never leave a listbox open: it hides the rest of the form.
        closeOpenDropdowns(control.el);
        await sleep(40);
    };

    let queue = pending;
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
        const retry: DetectedControl[] = [];

        for (const control of queue) {
            if (handled.has(control.key)) continue;

            const result = await fillControl(
                resolveFresh(control),
                options,
                passwordCache,
                radioGroups,
                checkboxGroups,
                generation,
            );

            const tries = (attempts.get(control.key) ?? 0) + 1;
            attempts.set(control.key, tries);
            lastResult.set(control.key, result);

            if (result.outcome.retryable && tries < MAX_ATTEMPTS) {
                retry.push(control);
                continue;
            }

            handled.set(control.key, result);
            await settleDropdown(control, result);
        }

        if (!retry.length) break;

        await sleep(600);
        const fresh = scanControls();
        queue = retry.map((control) => fresh.find((item) => item.key === control.key) ?? control);
    }

    // A field that was still waiting on its last attempt must still appear in
    // the report; otherwise "All fields" silently drops it.
    for (const [key, result] of lastResult) {
        if (!handled.has(key)) handled.set(key, result);
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
                resolveFresh(control),
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

            await settleDropdown(control, result);
        }
    }

    const fields = groupFieldResults(allControls, handled);

    return buildReport(mode, started, fields);
}

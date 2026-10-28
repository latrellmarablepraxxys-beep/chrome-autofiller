import type { DetectedControl } from '../shared/types';
import { isDisabled, setNativeValue } from '../shared/dom';
import { formatDateForControl } from '../core/faker';
import { fail, ok, skip, type FieldOutcome } from './types';

export function fillText(control: DetectedControl, value: string): FieldOutcome {
    const el = control.el as HTMLInputElement | HTMLTextAreaElement;

    if (isDisabled(el)) return skip('disabled');
    if (el.readOnly) return skip('read-only');
    if (!value) return skip('no value generated');

    let next = value;

    if (control.kind === 'number') {
        const elInput = el instanceof HTMLInputElement ? el : null;
        const min = elInput?.min ? Number(elInput.min) : undefined;
        const max = elInput?.max ? Number(elInput.max) : undefined;

        // Only coerce when bounds exist. Identifier fields (PhilSys, PWD ID)
        // may have leading zeros and more digits than Number can hold safely.
        if (min !== undefined || max !== undefined) {
            const numeric = Number(next);
            if (!Number.isFinite(numeric)) return fail('value is not numeric');

            let bounded = numeric;
            if (typeof min === 'number' && bounded < min) bounded = min;
            if (typeof max === 'number' && bounded > max) bounded = max;
            next = String(bounded);
        }
    }

    if (control.kind === 'date') {
        next = formatDateForControl(value, control);
    }

    const maxlength = el.getAttribute('maxlength');
    if (maxlength && Number(maxlength) > 0) {
        next = next.slice(0, Number(maxlength));
    }

    if (el.classList.contains('dp__input')) {
        el.focus();
        setNativeValue(el, next);
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        el.blur();
    } else {
        el.focus();
        setNativeValue(el, next);
        el.blur();
    }

    if (!el.value) return fail('value did not apply');

    return ok(el.classList.contains('dp__input') ? 'date-picker' : 'native-input', next);
}

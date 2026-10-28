import { beforeEach, describe, expect, it } from 'vitest';
import { scanControls } from '../src/core/scanner';

describe('scanner', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="space-y-1">
                <label for="title">Title <span class="text-destructive">*</span></label>
                <input id="title" name="title" required />
            </div>
            <div class="space-y-1">
                <label for="status">Status</label>
                <select id="status" name="status">
                    <option value="">Select</option>
                    <option value="active">Active</option>
                </select>
            </div>
            <div class="space-y-1">
                <div><label>Tags</label></div>
                <div class="multiselect">
                    <div class="multiselect__tags"><input class="multiselect__input" name="tags" /></div>
                    <div class="multiselect__content-wrapper" hidden></div>
                </div>
            </div>
            <div class="space-y-1">
                <div class="ck-editor">
                    <div class="ck-editor__editable" contenteditable="true"></div>
                </div>
            </div>
            <div class="space-y-1">
                <label>Cover image</label>
                <div class="border-dashed">
                    <input type="file" accept="image/png" style="display: none" />
                </div>
            </div>
            <div class="space-y-1">
                <button type="button" role="switch" aria-checked="false" aria-label="Published"></button>
            </div>
            <input type="hidden" name="csrf" value="token" />
        `;
    });

    it('detects the supported control shapes in DOM order', () => {
        const kinds = scanControls().map((control) => control.kind);
        expect(kinds).toEqual([
            'text',
            'native-select',
            'vue-multiselect',
            'ckeditor',
            'file',
            'switch',
        ]);
    });

    it('reads the label and required marker', () => {
        const title = scanControls().find((control) => control.key === 'title');
        expect(title).toBeDefined();
        expect(title?.label).toBe('Title');
        expect(title?.required).toBe(true);
    });

    it('keeps hidden file inputs but skips hidden text inputs and csrf', () => {
        const keys = scanControls().map((control) => control.key);
        expect(keys).toContain('title');
        expect(keys).not.toContain('csrf');
        expect(keys.some((key) => key.includes('cover'))).toBe(true);
    });

    it('does not double-report the inner input of a custom dropdown', () => {
        const controls = scanControls();
        expect(controls.filter((control) => control.name === 'tags')).toHaveLength(1);
    });

    it('detects reka radios and marks the group as required', () => {
        document.body.innerHTML = `
            <div class="flex flex-col gap-2.5">
                <label>Gender <span class="text-content-negative">*</span></label>
                <div role="radiogroup">
                    <button type="button" role="radio" id="radio_male" aria-checked="false"></button>
                    <label for="radio_male">Male</label>
                    <button type="button" role="radio" id="radio_female" aria-checked="false"></button>
                    <label for="radio_female">Female</label>
                </div>
            </div>
        `;

        const radios = scanControls().filter((control) => control.kind === 'radio');
        expect(radios).toHaveLength(2);
        expect(radios[0].required).toBe(true);
        expect(radios[0].label).toBe('Gender: Male');
    });

    it('treats inputmode numeric as a number field', () => {
        document.body.innerHTML = `
            <div class="flex flex-col gap-2.5">
                <label for="age">Age <span class="text-content-negative">*</span></label>
                <input id="age" name="age" inputmode="numeric" />
            </div>
        `;

        const age = scanControls().find((control) => control.key === 'age');
        expect(age?.kind).toBe('number');
        expect(age?.numeric).toBe(true);
    });
});

import { describe, expect, it } from 'vitest';
import type { ControlKind, DetectedControl } from '../src/shared/types';
import { classify, isAddressSemantic } from '../src/core/classifier';

function control(partial: Partial<DetectedControl> = {}): DetectedControl {
    return {
        el: document.createElement('div'),
        kind: 'text' as ControlKind,
        label: '',
        name: '',
        id: '',
        placeholder: '',
        required: false,
        key: 'field',
        accept: '',
        multiple: false,
        numeric: false,
        index: 0,
        ...partial,
    };
}

describe('classifier', () => {
    it('classifies by label, name and semantic order', () => {
        expect(classify(control({ label: 'First Name' }))).toBe('first_name');
        expect(classify(control({ label: 'Middle Name' }))).toBe('middle_name');
        expect(classify(control({ label: 'Surname' }))).toBe('last_name');
        expect(classify(control({ label: 'Contact Person', kind: 'text' }))).toBe('full_name');
    });

    it('prefers confirm-password over password', () => {
        expect(classify(control({ label: 'Confirm Password', kind: 'password' }))).toBe(
            'confirm_password',
        );
        expect(classify(control({ label: 'Password', kind: 'password' }))).toBe('password');
    });

    it('classifies contact details', () => {
        expect(classify(control({ name: 'email_address', kind: 'email' }))).toBe('email');
        expect(classify(control({ label: 'Mobile Number', kind: 'tel' }))).toBe('phone');
        expect(classify(control({ label: 'TIN' }))).toBe('tin');
        expect(classify(control({ label: 'PhilSys Number' }))).toBe('philsys');
    });

    it('classifies address parts', () => {
        expect(classify(control({ label: 'Region' }))).toBe('region');
        expect(classify(control({ label: 'Province' }))).toBe('province');
        expect(classify(control({ label: 'City / Municipality' }))).toBe('city');
        expect(classify(control({ label: 'Barangay' }))).toBe('barangay');
        expect(isAddressSemantic('city')).toBe(true);
        expect(isAddressSemantic('email')).toBe(false);
    });

    it('classifies content fields', () => {
        expect(classify(control({ kind: 'ckeditor' }))).toBe('rich_text');
        expect(classify(control({ kind: 'tiptap' }))).toBe('rich_text');
        expect(classify(control({ label: 'Meta Title' }))).toBe('seo_title');
        expect(classify(control({ label: 'Slug' }))).toBe('slug');
        expect(classify(control({ label: 'Price', kind: 'number' }))).toBe('price');
    });

    it('classifies platform-shaped URLs', () => {
        expect(classify(control({ label: 'Video Link', kind: 'url' }))).toBe('video_url');
        expect(classify(control({ label: 'YouTube URL', kind: 'url' }))).toBe('video_url');
        expect(classify(control({ label: 'Vimeo Link', kind: 'url' }))).toBe('video_url');
        expect(classify(control({ label: 'Google Maps Link', kind: 'url' }))).toBe('map_url');
        expect(classify(control({ label: 'Facebook Page', kind: 'url' }))).toBe('social_url');
        expect(classify(control({ label: 'Website', kind: 'url' }))).toBe('url');
    });

    it('treats a plain Video field as a video URL', () => {
        expect(classify(control({ label: 'Video', kind: 'text' }))).toBe('video_url');
        expect(classify(control({ label: 'Video Link', kind: 'text' }))).toBe('video_url');
        expect(classify(control({ label: 'Video Title', kind: 'text' }))).toBe('title');
        expect(classify(control({ label: 'Video Description', kind: 'text' }))).toBe('description');
    });

    it('classifies latitude, longitude and coordinates', () => {
        expect(classify(control({ label: 'Latitude' }))).toBe('latitude');
        expect(classify(control({ label: 'Longitude' }))).toBe('longitude');
        expect(classify(control({ label: 'Lat' }))).toBe('latitude');
        expect(classify(control({ label: 'Long' }))).toBe('longitude');
        expect(classify(control({ label: 'Lng' }))).toBe('longitude');
        expect(classify(control({ label: 'Coordinates' }))).toBe('coordinates');
    });

    it('makes a bare Name module-aware', () => {
        const product = { kind: 'product' as const, label: 'product', source: 'path' as const };
        const person = { kind: 'person' as const, label: 'person', source: 'path' as const };
        const content = { kind: 'content' as const, label: 'content', source: 'path' as const };

        expect(classify(control({ label: 'Name' }), product)).toBe('entity_name');
        expect(classify(control({ label: 'Name' }), person)).toBe('full_name');
        expect(classify(control({ label: 'Title' }), content)).toBe('entity_name');
        expect(classify(control({ label: 'Category' }), product)).toBe('entity_name');
        expect(classify(control({ label: 'Product Name' }), product)).toBe('entity_name');
        expect(classify(control({ label: 'Name' }))).toBe('full_name');
    });

    it('falls back by control kind', () => {
        expect(classify(control({ kind: 'native-select', label: 'Choose' }))).toBe('option');
        expect(classify(control({ label: 'Untitled' }))).toBe('generic_text');
    });
});

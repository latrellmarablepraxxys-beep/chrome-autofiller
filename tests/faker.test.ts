import { describe, expect, it } from 'vitest';
import type { DetectedControl } from '../src/shared/types';
import { Rng } from '../src/shared/random';
import { generateValue } from '../src/core/faker';

function control(partial: Partial<DetectedControl> = {}): DetectedControl {
    return {
        el: document.createElement('input'),
        kind: 'text',
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

describe('faker', () => {
    it('is deterministic for a seed', () => {
        const first = generateValue('email', control(), new Rng(7));
        const second = generateValue('email', control(), new Rng(7));
        expect(first).toBe(second);
        expect(first).toContain('@praxxys.test');
    });

    it('produces business-shaped values', () => {
        expect(generateValue('price', control(), new Rng(1))).toMatch(/^\d+\.\d{2}$/);
        expect(generateValue('percent', control(), new Rng(1))).toMatch(/^\d+$/);
        expect(generateValue('tin', control(), new Rng(1))).toMatch(/^\d{3}-\d{3}-\d{3}-\d{3}$/);
        expect(generateValue('phone', control(), new Rng(1))).toMatch(/^(\+63 9|09)/);
    });

    it('builds rich html with a marker, link and image', () => {
        const html = generateValue('rich_text', control({ kind: 'ckeditor' }), new Rng(3));
        expect(html).toContain('PRAXXYS QA sample content');
        expect(html).toContain('<h2>');
        expect(html).toContain('<a href=');
        expect(html).toContain('<img');
    });

    it('keeps birthdates in the past', () => {
        const birth = generateValue(
            'date',
            control({ kind: 'date', label: 'Birthdate' }),
            new Rng(5),
        );
        expect(new Date(birth).getTime()).toBeLessThan(Date.now());
    });

    it('generates 16 digits for a numeric PhilSys field', () => {
        const value = generateValue(
            'philsys',
            control({ label: 'PhilSys Card Number', numeric: true }),
            new Rng(5),
        );
        expect(value).toMatch(/^\d{16}$/);
    });

    it('generates platform-correct URLs', () => {
        expect(
            generateValue('video_url', control({ label: 'YouTube Link' }), new Rng(1)),
        ).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
        expect(
            generateValue('video_url', control({ label: 'Video Embed' }), new Rng(1)),
        ).toMatch(/^https:\/\/www\.youtube\.com\/embed\//);
        expect(
            generateValue('video_url', control({ label: 'Vimeo URL' }), new Rng(1)),
        ).toMatch(/^https:\/\/vimeo\.com\//);
        expect(
            generateValue('map_url', control({ label: 'Google Maps Link' }), new Rng(1)),
        ).toMatch(/^https:\/\/www\.google\.com\/maps\?q=/);
        expect(
            generateValue('social_url', control({ label: 'Facebook Page' }), new Rng(1)),
        ).toMatch(/^https:\/\/www\.facebook\.com\//);
    });

    it('pairs latitude, longitude and the map URL', () => {
        const context = { coordinates: new Map() };
        const latitude = generateValue(
            'latitude',
            control({ label: 'Latitude' }),
            new Rng(7),
            context,
        );
        const longitude = generateValue(
            'longitude',
            control({ label: 'Longitude' }),
            new Rng(7),
            context,
        );

        expect(Number(latitude)).toBeGreaterThanOrEqual(-90);
        expect(Number(latitude)).toBeLessThanOrEqual(90);
        expect(Number(longitude)).toBeGreaterThanOrEqual(-180);
        expect(Number(longitude)).toBeLessThanOrEqual(180);

        const map = generateValue(
            'map_url',
            control({ label: 'Map Link' }),
            new Rng(9),
            context,
        );
        expect(map).toContain(`${Number(latitude).toFixed(5)},${Number(longitude).toFixed(5)}`);
    });

    it('uses the module for entity names and person names', () => {
        const product = {
            coordinates: new Map(),
            module: { kind: 'product' as const, label: 'product', source: 'path' as const },
        };
        const person = {
            coordinates: new Map(),
            module: { kind: 'person' as const, label: 'person', source: 'path' as const },
        };
        const content = {
            coordinates: new Map(),
            module: { kind: 'content' as const, label: 'content', source: 'path' as const },
        };

        expect(
            generateValue('entity_name', control({ label: 'Name' }), new Rng(3), product),
        ).toMatch(/Organic|Handcrafted|Premium|Classic|Artisan|Fresh|Roasted|Natural|Signature/);
        expect(
            generateValue('title', control({ label: 'Title' }), new Rng(4), content),
        ).toMatch(/About Us|Privacy Policy|Summer Promo|How to Register|Frequently Asked|Terms and Conditions|Contact Us|Our Story/);
        expect(
            generateValue('full_name', control({ label: 'Name' }), new Rng(5), person).split(' ')
                .length,
        ).toBeGreaterThanOrEqual(2);

        const first = generateValue('full_name', control({ label: 'Name' }), new Rng(1), person);
        const second = generateValue('full_name', control({ label: 'Name' }), new Rng(2), person);
        expect(first).not.toBe(second);
    });
});

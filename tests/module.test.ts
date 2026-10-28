import { describe, expect, it } from 'vitest';
import type { DetectedControl } from '../src/shared/types';
import { moduleFromHeading, moduleFromPath, moduleFromSignals } from '../src/core/module';

function control(label: string, name = ''): DetectedControl {
    return {
        el: document.createElement('input'),
        kind: 'text',
        label,
        name,
        id: '',
        placeholder: '',
        required: false,
        key: label,
        accept: '',
        multiple: false,
        numeric: false,
        index: 0,
    };
}

describe('module detection', () => {
    it('reads the entity from the URL path', () => {
        expect(moduleFromPath('/admin/contents/products/create')?.kind).toBe('product');
        expect(moduleFromPath('/admin/contents/pages/1/edit')?.kind).toBe('content');
        expect(moduleFromPath('/admin/customers/12/edit')?.kind).toBe('person');
        expect(moduleFromPath('/admin/services')?.kind).toBe('service');
        expect(moduleFromPath('/admin/categories/3')?.kind).toBe('category');
        expect(moduleFromPath('/admin/offices/3')?.kind).toBe('office');
        expect(moduleFromPath('/admin/settings')?.kind).toBeUndefined();
    });

    it('infers the entity from the visible form signals', () => {
        expect(
            moduleFromSignals([control('Product Name'), control('Price'), control('SKU')])?.kind,
        ).toBe('product');
        expect(
            moduleFromSignals([control('First Name'), control('Last Name'), control('Email')])?.kind,
        ).toBe('person');
        expect(
            moduleFromSignals([control('Slug'), control('Body'), control('Meta Title')])?.kind,
        ).toBe('content');
        expect(moduleFromSignals([control('Untitled field')])).toBeNull();
    });

    it('infers the entity from the page heading', () => {
        document.title = 'Create Product';
        document.body.innerHTML = '<h1>Create Product</h1>';
        expect(moduleFromHeading()?.kind).toBe('product');

        document.title = 'Edit Customer';
        document.body.innerHTML = '<h1>Edit Customer</h1>';
        expect(moduleFromHeading()?.kind).toBe('person');
    });
});

import { describe, expect, it } from 'vitest';
import { matchesAccept, parseAccept, pickFormat } from '../src/shared/accept';

describe('accept parser', () => {
    it('defaults to images when accept is empty', () => {
        const info = parseAccept('');
        expect(info.tokens).toEqual([]);
        expect(info.allowsImages).toBe(true);
        expect(info.formats).toEqual(['png', 'jpeg', 'webp']);
        expect(pickFormat(info)).toBe('png');
    });

    it('respects a jpeg-only restriction', () => {
        const info = parseAccept('image/jpeg');
        expect(pickFormat(info)).toBe('jpeg');
        expect(matchesAccept('sample.jpg', 'image/jpeg', info)).toBe(true);
        expect(matchesAccept('sample.png', 'image/png', info)).toBe(false);
    });

    it('handles wildcards and extensions', () => {
        const info = parseAccept('image/*,.pdf,text/csv');
        expect(info.allowsImages).toBe(true);
        expect(info.allowsPdf).toBe(true);
        expect(info.allowsCsv).toBe(true);
        expect(pickFormat(info)).toBe('png');
        expect(matchesAccept('sample.pdf', 'application/pdf', info)).toBe(true);
        expect(matchesAccept('sample.csv', 'text/csv', info)).toBe(true);
    });

    it('prefers pdf when images are not allowed', () => {
        const info = parseAccept('.pdf');
        expect(info.allowsImages).toBe(false);
        expect(pickFormat(info)).toBe('pdf');
    });

    it('reports office formats instead of rejecting them', () => {
        const info = parseAccept('.xlsx');
        expect(info.allowsOffice).toBe(true);
        expect(info.formats).toEqual(['xlsx']);
        expect(pickFormat(info)).toBe('xlsx');
    });

    it('lists every accepted format for random selection', () => {
        const info = parseAccept('image/*,.pdf,text/csv,video/*');
        expect(info.formats).toEqual(['png', 'jpeg', 'webp', 'pdf', 'csv', 'webm', 'mp4']);
    });
});

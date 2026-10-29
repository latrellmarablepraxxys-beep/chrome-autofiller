import { describe, expect, it } from 'vitest';
import {
    dateLooksApplied,
    formatDateTokens,
    isoFromDate,
    parseFormatHint,
    toIsoDate,
} from '../src/shared/dateformat';

describe('date formatting', () => {
    const date = new Date(2026, 9, 29, 14, 5);

    it('formats the vue-datepicker default and other common patterns', () => {
        expect(formatDateTokens(date, 'MM/dd/yyyy')).toBe('10/29/2026');
        expect(formatDateTokens(date, 'MMM dd, yyyy')).toBe('Oct 29, 2026');
        expect(formatDateTokens(date, 'dd MMM yyyy')).toBe('29 Oct 2026');
        expect(formatDateTokens(date, 'yyyy-MM-dd')).toBe('2026-10-29');
        expect(formatDateTokens(date, 'dd/MM/yyyy HH:mm')).toBe('29/10/2026 14:05');
    });

    it('round-trips an ISO date', () => {
        expect(isoFromDate(date)).toBe('2026-10-29');
    });

    it('reads the format out of a placeholder', () => {
        expect(parseFormatHint('MM/DD/YYYY')).toBe('MM/dd/yyyy');
        expect(parseFormatHint('dd-mm-yyyy')).toBe('dd-MM-yyyy');
        expect(parseFormatHint('YYYY-MM-DD')).toBe('yyyy-MM-dd');
        expect(parseFormatHint('DD MMM YYYY')).toBe('dd MMM yyyy');
        expect(parseFormatHint('MMM dd, yyyy')).toBe('MMM dd, yyyy');
    });

    it('ignores placeholders that are not date patterns', () => {
        expect(parseFormatHint('Select date')).toBeNull();
        expect(parseFormatHint('')).toBeNull();
        expect(parseFormatHint('MM/YYYY')).toBeNull();
    });

    it('normalizes profile values to ISO', () => {
        expect(toIsoDate('2026-10-29')).toBe('2026-10-29');
        expect(toIsoDate('10/29/2026')).toBe('2026-10-29');
        expect(toIsoDate('29/10/2026')).toBe('2026-10-29');
        expect(toIsoDate('Oct 29, 2026')).toBe('2026-10-29');
        expect(toIsoDate('nonsense')).toBeNull();
    });

    it('treats a picker value as applied only when the date matches', () => {
        expect(dateLooksApplied('10/29/2026', '2026-10-29')).toBe(true);
        expect(dateLooksApplied('10/29/2026 14:00', '2026-10-29')).toBe(true);
        expect(dateLooksApplied('Oct 29, 2026', '2026-10-29')).toBe(true);
        expect(dateLooksApplied('12/25/2026', '2026-10-29')).toBe(false);
        expect(dateLooksApplied('', '2026-10-29')).toBe(false);
        expect(dateLooksApplied('10/29/2025', '2026-10-29')).toBe(false);
    });
});

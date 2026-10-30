import { describe, expect, it } from 'vitest';
import { addMinutes, parseTime, timeLooksApplied } from '../src/shared/time';

describe('time parsing', () => {
    it('parses 12h values with a meridiem', () => {
        expect(parseTime('10:30 AM')).toEqual({ hours: 10, minutes: 30 });
        expect(parseTime('10:30 PM')).toEqual({ hours: 22, minutes: 30 });
        expect(parseTime('12:00 AM')).toEqual({ hours: 0, minutes: 0 });
        expect(parseTime('12:30 PM')).toEqual({ hours: 12, minutes: 30 });
        expect(parseTime('1:05pm')).toEqual({ hours: 13, minutes: 5 });
    });

    it('parses 24h values', () => {
        expect(parseTime('09:30')).toEqual({ hours: 9, minutes: 30 });
        expect(parseTime('23:45')).toEqual({ hours: 23, minutes: 45 });
        expect(parseTime('0:00')).toEqual({ hours: 0, minutes: 0 });
    });

    it('rejects nonsense', () => {
        expect(parseTime('')).toBeNull();
        expect(parseTime('10')).toBeNull();
        expect(parseTime('10:75')).toBeNull();
        expect(parseTime('25:00')).toBeNull();
        expect(parseTime('13:00 AM')).toBeNull();
        expect(parseTime('2026-10-29')).toBeNull();
    });

    it('extracts the time from a datetime string', () => {
        expect(parseTime('2026-10-15 10:30 AM')).toEqual({ hours: 10, minutes: 30 });
        expect(parseTime('2026-10-15T10:30:00')).toEqual({ hours: 10, minutes: 30 });
    });
});

describe('time verification', () => {
    it('accepts 12h displays that match the 24h target', () => {
        expect(timeLooksApplied('10:30 AM', 10, 30)).toBe(true);
        expect(timeLooksApplied('10:30 PM', 22, 30)).toBe(true);
        expect(timeLooksApplied('12:05 AM', 0, 5)).toBe(true);
    });

    it('rejects a mismatched meridiem, minute, or empty value', () => {
        expect(timeLooksApplied('10:30 PM', 10, 30)).toBe(false);
        expect(timeLooksApplied('10:45 AM', 10, 30)).toBe(false);
        expect(timeLooksApplied('', 10, 30)).toBe(false);
    });

    it('adds minutes and wraps around midnight', () => {
        expect(addMinutes({ hours: 9, minutes: 30 }, 60)).toEqual({ hours: 10, minutes: 30 });
        expect(addMinutes({ hours: 23, minutes: 30 }, 60)).toEqual({ hours: 0, minutes: 30 });
    });
});

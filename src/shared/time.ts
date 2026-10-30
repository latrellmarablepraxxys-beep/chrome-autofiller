export interface TimeValue {
    hours: number;
    minutes: number;
}

export function padTime(value: number): string {
    return String(value).padStart(2, '0');
}

/** Parse `HH:mm`, `hh:mm aa`, `10:30 AM`, `10:30am`, 24h `23:45`, or a time embedded in a datetime string. */
export function parseTime(value: string): TimeValue | null {
    const trimmed = (value ?? '').trim().toLowerCase();
    if (!trimmed) return null;

    // Search, not anchored: profiles can pass "2026-10-15 10:30 AM".
    const match = /(\d{1,2}):(\d{2})\s*(am|pm)?/.exec(trimmed);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3];

    if (minutes > 59) return null;

    if (meridiem) {
        if (hours < 1 || hours > 12) return null;
        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
    } else if (hours > 23) {
        return null;
    }

    return { hours, minutes };
}

export function addMinutes(value: TimeValue, delta: number): TimeValue {
    const total = value.hours * 60 + value.minutes + delta;
    const normalized = ((total % 1440) + 1440) % 1440;
    return { hours: Math.floor(normalized / 60), minutes: normalized % 60 };
}

/**
 * Picker text is applied when it shows our hour and minute (12h displays
 * convert 22:30 to `10:30 PM`, so both the 24h and 12h hour are accepted)
 * and, when the display carries a meridiem, it matches the target.
 */
export function timeLooksApplied(value: string, hours: number, minutes: number): boolean {
    if (!value) return false;

    const numbers = (value.match(/\d+/g) ?? []).map(Number);
    const lower = value.toLowerCase();

    if (/am|pm/.test(lower)) {
        const wantsPm = hours >= 12;
        if (lower.includes('pm') !== wantsPm) return false;
    }

    const hasHour = numbers.includes(hours) || numbers.includes(hours % 12 || 12);
    return hasHour && numbers.includes(minutes);
}

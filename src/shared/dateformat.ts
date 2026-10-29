const MONTHS_LONG = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const TOKEN_PATTERN = /yyyy|yy|MMMM|MMM|MM|M|dd|d|HH|hh|mm|aa|a/g;

function pad(value: number, length = 2): string {
    return String(value).padStart(length, '0');
}

/** Format a date with the date-fns tokens our pickers actually use. */
export function formatDateTokens(date: Date, pattern: string): string {
    return pattern.replace(TOKEN_PATTERN, (token) => {
        switch (token) {
            case 'yyyy':
                return pad(date.getFullYear(), 4);
            case 'yy':
                return pad(date.getFullYear() % 100);
            case 'MMMM':
                return MONTHS_LONG[date.getMonth()];
            case 'MMM':
                return MONTHS_SHORT[date.getMonth()];
            case 'MM':
                return pad(date.getMonth() + 1);
            case 'M':
                return String(date.getMonth() + 1);
            case 'dd':
                return pad(date.getDate());
            case 'd':
                return String(date.getDate());
            case 'HH':
                return pad(date.getHours());
            case 'hh':
                return pad(date.getHours() % 12 || 12);
            case 'mm':
                return pad(date.getMinutes());
            case 'aa':
                return date.getHours() < 12 ? 'AM' : 'PM';
            case 'a':
                return date.getHours() < 12 ? 'am' : 'pm';
            default:
                return token;
        }
    });
}

export function isoFromDate(date: Date): string {
    return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromIso(iso: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Accepts ISO, `MM/DD/YYYY`, `DD/MM/YYYY`, or anything `Date` can parse. */
export function toIsoDate(value: string): string | null {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
    if (slash) {
        const first = Number(slash[1]);
        // Ambiguous for the first 12 days: prefer MM/DD/YYYY (vuepic default).
        const month = first > 12 ? Number(slash[2]) : first;
        const day = first > 12 ? first : Number(slash[2]);
        return `${slash[3]}-${pad(month)}-${pad(day)}`;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : isoFromDate(parsed);
}

const TOKEN_FOR_PART: Record<string, string> = {
    yyyy: 'yyyy', yy: 'yy',
    mmmm: 'MMMM', mmm: 'MMM', mm: 'MM', m: 'M',
    dd: 'dd', d: 'd',
};

/**
 * Turn a placeholder such as `MM/DD/YYYY`, `dd-mm-yyyy`, or `DD MMM YYYY`
 * into a date-fns pattern. Returns null for free text like "Select date".
 */
export function parseFormatHint(text: string): string | null {
    const value = (text ?? '').trim();
    if (!value || value.length > 40) return null;

    const parts = value.split(/([/\-.,\s]+)/);
    const tokens: string[] = [];
    let hasYear = false;
    let hasMonth = false;
    let hasDay = false;

    for (const part of parts) {
        if (!part) continue;
        if (/^[/\-.,\s]+$/.test(part)) {
            tokens.push(part);
            continue;
        }

        const token = TOKEN_FOR_PART[part.toLowerCase()];
        if (!token) return null;

        if (token.startsWith('y')) hasYear = true;
        else if (token.startsWith('M')) hasMonth = true;
        else hasDay = true;
        tokens.push(token);
    }

    if (!hasYear || !hasMonth || !hasDay) return null;

    // Collapse a stray separator at either end.
    return tokens.join('').replace(/^[\s/\-.,]+|[\s/\-.,]+$/g, '');
}

/** Picker text is applied when it carries our year plus the month or the day. */
export function dateLooksApplied(value: string, iso: string): boolean {
    const target = dateFromIso(iso);
    if (!target) return false;
    if (!value) return false;

    const numbers = (value.match(/\d+/g) ?? []).map(Number);
    const year = target.getFullYear();
    const month = target.getMonth() + 1;
    const day = target.getDate();

    const lower = value.toLowerCase();
    const monthNamed = lower.includes(MONTHS_LONG[month - 1].toLowerCase().slice(0, 3));

    const hasYear = numbers.includes(year) || numbers.includes(year % 100);
    if (!hasYear) return false;

    return numbers.includes(month) || numbers.includes(day) || monthNamed;
}

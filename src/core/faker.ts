import type { DetectedControl } from '../shared/types';
import { dateFromIso, formatDateTokens } from '../shared/dateformat';
import { isDatePickerInput } from '../shared/picker';
import { Rng } from '../shared/random';
import { slugify } from '../shared/slug';
import type { Semantic } from './lexicon';
import type { ModuleContext, ModuleKind } from './module';

const FIRST_NAMES = [
    'Maria', 'Jose', 'Ana', 'Miguel', 'Andrea', 'Paolo', 'Jasmine', 'Carlo', 'Liza', 'Ramon',
    'Sofia', 'Gabriel', 'Camille', 'Rafael', 'Bianca', 'Marco', 'Isabel', 'Daniel', 'Patricia', 'Luis',
    'Angela', 'Enrique', 'Teresa', 'Francisco', 'Carmela', 'Joaquin', 'Beatriz', 'Ricardo', 'Elena', 'Manuel',
    'Rosa', 'Antonio', 'Clara', 'Eduardo', 'Nina', 'Victor', 'Alice', 'Nathan', 'Grace', 'Liam',
    'Chloe', 'Noah', 'Emma', 'Olivia', 'Ethan', 'Mia', 'Lucas', 'Amara', 'Diego', 'Sienna',
];
const LAST_NAMES = [
    'Dela Cruz', 'Santos', 'Reyes', 'Ramos', 'Mendoza', 'Garcia', 'Bautista', 'Villanueva',
    'Aquino', 'Castillo', 'Flores', 'Gonzales', 'Torres', 'Rivera', 'Domingo', 'Navarro',
    'Salazar', 'Fernandez', 'Pascual', 'Lim', 'Tan', 'Sy', 'Ong', 'Chua',
    'Mercado', 'Aguilar', 'Velasco', 'Padilla', 'Serrano', 'Fuentes', 'Cabrera', 'Marquez',
    'Solis', 'Ibarra', 'Zamora', 'Evangelista', 'Cortez', 'Montes', 'Arellano', 'Dizon',
    'Hernandez', 'Lopez', 'Martinez', 'Ramirez', 'Cruz', 'Reyes', 'Bautista', 'Ocampo',
];
const MIDDLE_NAMES = [
    'Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos',
    'Navarro', 'Domingo', 'Castillo', 'Mercado', 'Aquino', 'Salazar', 'Rivera', 'Gonzales',
];
const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III'];
const STREETS = [
    'Mabini St.', 'Rizal Ave.', 'Bonifacio St.', 'Katipunan Ave.', 'Quezon Blvd.',
    'Ayala Ave.', 'Ortigas Ave.', 'Shaw Blvd.', 'Banawe St.', 'Macapagal Ave.',
];
const BARANGAYS = ['San Antonio', 'Poblacion', 'San Isidro', 'Santa Cruz', 'Bagong Silang', 'Poblacion East', 'San Roque'];
const POSITIONS = [
    'Administrator', 'Operations Officer', 'QA Specialist', 'Account Manager',
    'Branch Supervisor', 'Finance Associate', 'HR Coordinator', 'Store Manager',
];
const COMPANY_NAMES = [
    'Sunrise Trading Co.', 'Blue Harbor Enterprises', 'PRAXXYS Demo Corp.',
    'Rizal Commercial Supplies', 'Northwind Distribution Inc.', 'Golden Harvest Foods',
    'Metro Pacific Trading', 'Luntian Goods Co.', 'Cedar & Pine Trading', 'Island Bridge Supply',
];
const OFFICE_NAMES = [
    'PRAXXYS Office — Makati', 'Barangay San Antonio Hall', 'Cebu City Branch',
    'Davao Service Center', 'Quezon City Office', 'Baguio Satellite Office',
];
const PRODUCT_ADJECTIVES = ['Organic', 'Handcrafted', 'Premium', 'Classic', 'Artisan', 'Fresh', 'Roasted', 'Natural', 'Signature'];
const PRODUCT_NOUNS = [
    'Arabica Coffee', 'Green Tea', 'Ceramic Mug', 'Cotton T-Shirt', 'Vitamin C Serum',
    'Chocolate Cookies', 'Olive Oil', 'Bamboo Toothbrush', 'Linen Tote Bag', 'Sea Salt',
    'Herbal Shampoo', 'Coconut Sugar', 'Stainless Tumbler', 'Woven Placemat', 'Cacao Nibs',
];
const PRODUCT_SIZES = ['250g', '500g', '1L', '30ml', '50ml', '200g', '12oz', 'Pack of 6', 'Set of 3'];
const SERVICE_NAMES = [
    'Home Deep Cleaning', 'Express Delivery', 'Dental Checkup Package', 'Aircon Maintenance',
    'Event Catering', 'Same-Day Installation', 'Monthly Bookkeeping', 'Website Maintenance',
];
const CATEGORY_NAMES = [
    'Beverages', 'Snacks', 'Personal Care', 'Home Essentials', 'Dairy & Eggs',
    'Bakery', 'Frozen Foods', 'Condiments', 'Fresh Produce', 'Household Supplies',
];
const BRAND_NAMES = ['Aurora Trading', 'Northwind Supply Co.', 'Blue Harbor', 'Cedar & Co.', 'Luntian Goods', 'Isla Home'];
const CONTENT_TITLES = [
    'About Us', 'Privacy Policy', 'Summer Promo 2026', 'How to Register',
    'Frequently Asked Questions', 'Terms and Conditions', 'Contact Us', 'Our Story',
];
const EVENT_NAMES = [
    'Community Health Fair 2026', 'Summer Sale 2026', 'Barangay Assembly', 'Holiday Bazaar',
    'Product Launch 2026', 'Customer Appreciation Day',
];
const WORDS = ['sample', 'demo', 'quality', 'check', 'record', 'content', 'entry', 'data'];

export const RICH_TEXT_MARKER = 'PRAXXYS QA sample content';

function sentence(rng: Rng): string {
    return `${rng.pick(WORDS)} ${rng.pick(WORDS)} ${rng.pick(['record', 'entry', 'content'])} number ${rng.digits(2)}.`;
}

export interface CoordinateContext {
    coordinates: Map<string, { lat: number; lng: number }>;
}

export interface GenerationContext extends CoordinateContext {
    module?: ModuleContext;
}

const coordinateContainers = new WeakMap<Element, number>();
let coordinateContainerCounter = 0;

function coordinateKey(control: DetectedControl): string {
    const container =
        control.el.closest('form') ?? control.el.closest('fieldset') ?? document.body;
    let id = coordinateContainers.get(container);
    if (!id) {
        coordinateContainerCounter += 1;
        id = coordinateContainerCounter;
        coordinateContainers.set(container, id);
    }
    return `form-${id}`;
}

function coordinatesFor(
    control: DetectedControl,
    rng: Rng,
    context?: CoordinateContext,
): { lat: number; lng: number } {
    const key = coordinateKey(control);
    const existing = context?.coordinates.get(key);
    if (existing) return existing;

    const [baseLatitude, baseLongitude] = rng.pick(MAP_POINTS);
    const point = {
        lat: baseLatitude + rng.int(-300, 300) / 100000,
        lng: baseLongitude + rng.int(-300, 300) / 100000,
    };

    context?.coordinates.set(key, point);
    return point;
}

export function generateValue(
    semantic: Semantic,
    control: DetectedControl,
    rng: Rng,
    context?: GenerationContext,
): string {
    if (control.kind === 'color') {
        return `#${rng.int(0, 0xffffff).toString(16).padStart(6, '0')}`;
    }

    switch (semantic) {
        case 'first_name':
            return rng.pick(FIRST_NAMES);
        case 'middle_name':
            return rng.pick(MIDDLE_NAMES);
        case 'last_name':
            return rng.pick(LAST_NAMES);
        case 'suffix':
            return rng.pick(SUFFIXES);
        case 'full_name':
            return personName(rng);
        case 'entity_name':
            return entityName(control, rng, context?.module);
        case 'email':
            return `qa.${rng.pick(FIRST_NAMES).toLowerCase()}.${rng
                .pick(LAST_NAMES)
                .replace(/\s+/g, '')
                .toLowerCase()}.${rng.digits(3)}@praxxys.test`;
        case 'phone': {
            let hasCountryAddon = false;
            let node: HTMLElement | null = control.el;
            for (let depth = 0; depth < 3 && node; depth += 1) {
                if ((node.textContent ?? '').includes('+63')) {
                    hasCountryAddon = true;
                    break;
                }
                node = node.parentElement;
            }

            return hasCountryAddon
                ? `9${rng.digits(9)}`
                : `09${rng.digits(9)}`;
        }
        case 'company': {
            const haystack = `${control.label} ${control.placeholder}`.toLowerCase();
            if (/lgu|barangay|office|branch|store|outlet/.test(haystack)) {
                return rng.pick(OFFICE_NAMES);
            }
            return rng.pick(COMPANY_NAMES);
        }
        case 'position':
            return rng.pick(POSITIONS);
        case 'address':
            return `${rng.int(1, 999)} ${rng.pick(STREETS)}, ${rng.pick(BARANGAYS)}`;
        case 'address_line_2':
            return `Unit ${rng.int(1, 20)}${rng.pick(['A', 'B', ''])}`;
        case 'region':
        case 'province':
        case 'city':
        case 'barangay':
            return '';
        case 'postal':
            return rng.digits(4);
        case 'latitude': {
            const point = coordinatesFor(control, rng, context);
            return point.lat.toFixed(6);
        }
        case 'longitude': {
            const point = coordinatesFor(control, rng, context);
            return point.lng.toFixed(6);
        }
        case 'coordinates': {
            const point = coordinatesFor(control, rng, context);
            return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
        }
        case 'tin':
            return `${rng.digits(3)}-${rng.digits(3)}-${rng.digits(3)}-${rng.digits(3)}`;
        case 'philsys':
            return control.numeric
                ? rng.digits(16)
                : `${rng.digits(4)}-${rng.digits(4)}-${rng.digits(4)}-${rng.digits(4)}`;
        case 'id_number': {
            if (!control.numeric) return `QA-${rng.digits(8)}`;
            const max = control.el instanceof HTMLInputElement ? control.el.maxLength : 0;
            const length = Math.min(max > 0 ? max : 8, 16);
            return rng.digits(length);
        }
        case 'title':
            if (context?.module && context.module.kind !== 'person') {
                return entityName(control, rng, context.module);
            }
            return `${rng.pick(['QA', 'Sample', 'Demo'])} ${rng.pick([
                'Page',
                'Product',
                'Service',
                'Announcement',
            ])} ${rng.digits(3)}`;
        case 'slug':
            return `${slugify(`${rng.pick(WORDS)} ${rng.pick(WORDS)}`)}-${rng.digits(4)}`;
        case 'seo_title':
            return `PRAXXYS QA Sample ${rng.digits(2)} | PRAXXYS`;
        case 'seo_description':
            return `${sentence(rng)} ${sentence(rng)}`;
        case 'description':
            return `${sentence(rng)} ${sentence(rng)}`;
        case 'rich_text':
            return richText(rng);
        case 'price':
            return (rng.int(1000, 500000) / 100).toFixed(2);
        case 'percent':
            return String(rng.int(5, 25));
        case 'quantity':
            return String(rng.int(1, 100));
        case 'sku':
            return control.numeric ? rng.digits(6) : `QA-${rng.digits(6)}`;
        case 'url':
            return genericUrl(control, rng);
        case 'video_url':
            return videoUrl(control, rng);
        case 'map_url':
            return mapUrl(control, rng, context);
        case 'social_url':
            return socialUrl(control, rng);
        case 'password':
            return `Qa!${rng.digits(4)}${rng.pick(['A', 'B', 'C', 'D'])}${rng.digits(2)}`;
        case 'confirm_password':
            return '';
        case 'date':
            return isoDate(rng, control);
        case 'time':
            return `${String(rng.int(8, 17)).padStart(2, '0')}:${rng.pick(['00', '15', '30', '45'])}`;
        case 'number': {
            const haystack = `${control.label} ${control.placeholder}`.toLowerCase();
            if (/tenure|years? (in|of) (business|operation)/.test(haystack)) {
                return String(rng.int(1, 20));
            }
            return String(rng.int(1, 100));
        }
        case 'file':
        case 'option':
        case 'unknown':
            return '';
        default:
            return `${rng.pick(WORDS)} ${rng.pick(WORDS)} ${rng.digits(2)}`;
    }
}

const YOUTUBE_IDS = ['aqz-KE-bpKQ', 'jNQXAC9IVRw', 'M7lc1UVf-VE'];
const VIMEO_IDS = ['22439234', '76979871'];
const MAP_POINTS: Array<[number, number]> = [
    [14.5995, 120.9842],
    [10.3157, 123.8854],
    [7.1907, 125.4553],
    [16.4023, 120.596],
    [8.9475, 125.5406],
];

function urlHaystack(control: DetectedControl): string {
    return `${control.label} ${control.name} ${control.placeholder}`.toLowerCase();
}

function genericUrl(control: DetectedControl, rng: Rng): string {
    const haystack = urlHaystack(control);

    if (/website|homepage|site url|site link/.test(haystack)) {
        return 'https://www.praxxystech.com';
    }

    if (/portfolio/.test(haystack)) {
        return `https://www.praxxystech.com/portfolio/${slugify(rng.pick(WORDS))}`;
    }

    return `https://www.praxxystech.com/${slugify(`${rng.pick(WORDS)} ${rng.pick(WORDS)}`)}`;
}

function videoUrl(control: DetectedControl, rng: Rng): string {
    const haystack = urlHaystack(control);
    const embed = /embed/.test(haystack);

    if (/vimeo/.test(haystack)) {
        const id = rng.pick(VIMEO_IDS);
        return embed ? `https://player.vimeo.com/video/${id}` : `https://vimeo.com/${id}`;
    }

    const id = rng.pick(YOUTUBE_IDS);

    if (/shorts/.test(haystack)) return `https://www.youtube.com/shorts/${id}`;
    return embed
        ? `https://www.youtube.com/embed/${id}`
        : `https://www.youtube.com/watch?v=${id}`;
}

function mapUrl(control: DetectedControl, rng: Rng, context?: CoordinateContext): string {
    const haystack = urlHaystack(control);
    const point = coordinatesFor(control, rng, context);
    const latitude = point.lat.toFixed(5);
    const longitude = point.lng.toFixed(5);

    if (/embed/.test(haystack)) {
        return `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
    }

    return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function socialUrl(control: DetectedControl, rng: Rng): string {
    const haystack = urlHaystack(control);
    const handle = `praxxys${rng.bool(0.4) ? '' : rng.digits(2)}`;

    if (/facebook|\bfb\b/.test(haystack)) return `https://www.facebook.com/${handle}`;
    if (/instagram|\big\b/.test(haystack)) return `https://www.instagram.com/${handle}`;
    if (/linkedin/.test(haystack)) return `https://www.linkedin.com/company/${handle}`;
    if (/tiktok/.test(haystack)) return `https://www.tiktok.com/@${handle}`;
    if (/twitter|\bx\.com\b|x com/.test(haystack)) return `https://x.com/${handle}`;

    return 'https://www.praxxystech.com';
}

function personName(rng: Rng): string {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);

    return rng.bool(0.55)
        ? `${first} ${rng.pick(MIDDLE_NAMES)} ${last}`
        : `${first} ${last}`;
}

function inferEntityKind(label: string, module?: ModuleContext): ModuleKind {
    if (/category|cuisine|classification/.test(label)) return 'category';
    if (/brand/.test(label)) return 'brand';
    if (/company|merchant|supplier|vendor|business/.test(label)) return 'company';
    if (/office|branch|store|outlet|location/.test(label)) return 'office';
    if (/service|package|treatment/.test(label)) return 'service';
    if (/event|promo|campaign|coupon/.test(label)) return 'event';
    if (/page|post|article|blog|content|faq|announcement|banner/.test(label)) return 'content';
    if (/product|item|ingredient|dish|inventory/.test(label)) return 'product';

    if (module && module.kind !== 'person' && module.kind !== 'generic') {
        return module.kind;
    }

    return 'generic';
}

function entityName(control: DetectedControl, rng: Rng, module?: ModuleContext): string {
    const kind = inferEntityKind(urlHaystack(control), module);

    switch (kind) {
        case 'product': {
            const size = rng.bool(0.8) ? ` ${rng.pick(PRODUCT_SIZES)}` : '';
            return `${rng.pick(PRODUCT_ADJECTIVES)} ${rng.pick(PRODUCT_NOUNS)}${size}`;
        }
        case 'service':
            return rng.pick(SERVICE_NAMES);
        case 'category':
            return rng.pick(CATEGORY_NAMES);
        case 'brand':
            return rng.pick(BRAND_NAMES);
        case 'company':
            return rng.pick(COMPANY_NAMES);
        case 'office':
            return rng.pick(OFFICE_NAMES);
        case 'content':
            return rng.pick(CONTENT_TITLES);
        case 'event':
            return rng.pick(EVENT_NAMES);
        default:
            return `${rng.pick(['Sample', 'Test', 'Demo'])} ${rng.pick(['Record', 'Entry', 'Item'])} ${rng.digits(3)}`;
    }
}

function isoDate(rng: Rng, control?: DetectedControl): string {    const label = `${control?.label ?? ''} ${control?.name ?? ''} ${control?.id ?? ''}`.toLowerCase();
    const base = new Date();

    // Birthdates must be in the past and plausible for an adult applicant.
    if (/birth|dob|date of birth/.test(label)) {
        base.setFullYear(base.getFullYear() - rng.int(18, 45));
        base.setMonth(rng.int(0, 11));
        base.setDate(rng.int(1, 28));
        return base.toISOString().slice(0, 10);
    }

    base.setDate(base.getDate() + rng.int(-30, 30));
    return base.toISOString().slice(0, 10);
}

function richText(rng: Rng): string {
    const heading = `${rng.pick(['QA', 'Sample', 'Demo'])} content ${rng.digits(2)}`;
    return [
        `<h2>${heading}</h2>`,
        `<p>${RICH_TEXT_MARKER} — ${sentence(rng)}</p>`,
        `<ul><li>${rng.pick(WORDS)} ${rng.pick(WORDS)}</li><li>${sentence(rng)}</li></ul>`,
        `<p><a href="https://praxxys.test">PRAXXYS sample link</a></p>`,
        `<p><img src="${sampleImageDataUri()}" alt="PRAXXYS QA sample" /></p>`,
    ].join('');
}

export function sampleImageDataUri(): string {
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
        '<rect width="640" height="360" fill="#6d28d9"/>' +
        '<text x="320" y="195" font-family="sans-serif" font-size="38" fill="#ffffff" text-anchor="middle">PRAXXYS QA</text>' +
        '</svg>';
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** Format an ISO date the way a control expects to receive it. */
export function formatDateForControl(value: string, control: DetectedControl): string {
    const el = control.el as HTMLInputElement;
    if (el.type === 'date') return value;

    const date = dateFromIso(value) ?? new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    // vue-datepicker's default input format is `MM/dd/yyyy`.
    if (isDatePickerInput(el)) return formatDateTokens(date, 'MM/dd/yyyy');

    return formatDateTokens(date, 'yyyy-MM-dd');
}

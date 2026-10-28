import type { DetectedControl } from '../shared/types';
import { normalizeForMatch } from './lexicon';

export type ModuleKind =
    | 'person'
    | 'product'
    | 'service'
    | 'category'
    | 'brand'
    | 'company'
    | 'office'
    | 'content'
    | 'event'
    | 'generic';

export interface ModuleContext {
    kind: ModuleKind;
    label: string;
    source: 'path' | 'heading' | 'signals' | 'default';
}

const PATH_KINDS: Record<string, ModuleKind> = {
    product: 'product',
    products: 'product',
    item: 'product',
    items: 'product',
    dish: 'product',
    dishes: 'product',
    ingredient: 'product',
    ingredients: 'product',
    inventory: 'product',
    variant: 'product',
    variants: 'product',

    service: 'service',
    services: 'service',
    package: 'service',
    packages: 'service',
    treatment: 'service',
    treatments: 'service',

    category: 'category',
    categories: 'category',
    cuisine: 'category',
    cuisines: 'category',
    type: 'category',
    types: 'category',
    classification: 'category',
    classifications: 'category',

    brand: 'brand',
    brands: 'brand',

    company: 'company',
    companies: 'company',
    merchant: 'company',
    merchants: 'company',
    supplier: 'company',
    suppliers: 'company',
    vendor: 'company',
    vendors: 'company',
    partner: 'company',
    partners: 'company',
    organization: 'company',
    organizations: 'company',

    office: 'office',
    offices: 'office',
    branch: 'office',
    branches: 'office',
    location: 'office',
    locations: 'office',
    store: 'office',
    stores: 'office',
    outlet: 'office',
    outlets: 'office',

    page: 'content',
    pages: 'content',
    post: 'content',
    posts: 'content',
    article: 'content',
    articles: 'content',
    blog: 'content',
    blogs: 'content',
    content: 'content',
    contents: 'content',
    announcement: 'content',
    announcements: 'content',
    faq: 'content',
    faqs: 'content',
    banner: 'content',
    banners: 'content',

    event: 'event',
    events: 'event',
    promo: 'event',
    promos: 'event',
    promotion: 'event',
    promotions: 'event',
    campaign: 'event',
    campaigns: 'event',
    coupon: 'event',
    coupons: 'event',

    customer: 'person',
    customers: 'person',
    user: 'person',
    users: 'person',
    admins: 'person',
    account: 'person',
    accounts: 'person',
    employee: 'person',
    employees: 'person',
    staff: 'person',
    member: 'person',
    members: 'person',
    applicant: 'person',
    applicants: 'person',
    pwd: 'person',
    registrant: 'person',
    registrants: 'person',
    tenant: 'person',
    tenants: 'person',
};

const SKIPPED_SEGMENTS = new Set([
    '',
    'admin',
    'auth',
    'api',
    'dashboard',
    'settings',
    'create',
    'edit',
    'show',
    'index',
    'list',
    'new',
    'view',
    'contents',
]);

export function moduleFromPath(pathname: string): ModuleContext | null {
    const segments = pathname
        .toLowerCase()
        .split('/')
        .filter((segment) => segment && !/^\d+$/.test(segment))
        .reverse();

    for (const segment of segments) {
        if (SKIPPED_SEGMENTS.has(segment)) continue;

        const clean = segment.replace(/[-_]/g, '');
        const kind = PATH_KINDS[clean];

        if (kind) {
            return { kind, label: segment, source: 'path' };
        }
    }

    return null;
}

const HEADING_RULES: Array<[ModuleKind, RegExp]> = [
    ['product', /\b(product|item|dish|ingredient|inventory)\b/],
    ['service', /\b(service|package|treatment)\b/],
    ['category', /\b(category|categories|cuisine|classification)\b/],
    ['brand', /\bbrand\b/],
    ['company', /\b(company|merchant|supplier|vendor|partner|organization)\b/],
    ['office', /\b(office|branch|store|outlet|location)\b/],
    ['event', /\b(event|promo|promotion|campaign|coupon)\b/],
    ['content', /\b(page|post|article|blog|content|announcement|faq|banner)\b/],
    ['person', /\b(customer|user|admin|account|employee|member|applicant|pwd|registrant|tenant|profile)\b/],
];

export function moduleFromHeading(): ModuleContext | null {
    if (typeof document === 'undefined') return null;

    const heading = document.querySelector('h1, h2')?.textContent ?? '';
    const text = normalizeForMatch(`${document.title} ${heading}`);

    if (!text) return null;

    for (const [kind, pattern] of HEADING_RULES) {
        if (pattern.test(text)) {
            return { kind, label: text.slice(0, 80), source: 'heading' };
        }
    }

    return null;
}

export function moduleFromSignals(controls: DetectedControl[]): ModuleContext | null {
    const scores: Record<ModuleKind, number> = {
        person: 0,
        product: 0,
        service: 0,
        category: 0,
        brand: 0,
        company: 0,
        office: 0,
        content: 0,
        event: 0,
        generic: 0,
    };

    for (const control of controls) {
        const haystack = normalizeForMatch(
            [control.label, control.name, control.id, control.placeholder].join(' '),
        );

        if (!haystack) continue;

        if (/first ?name|last ?name|middle ?name|surname/.test(haystack)) scores.person += 3;
        else if (/birth|gender|password|role|department|position|designation/.test(haystack)) {
            scores.person += 2;
        } else if (/email|phone|mobile|contact ?number/.test(haystack)) scores.person += 1;

        if (/price|cost|sku|stock|barcode|variant|weight|unit/.test(haystack)) scores.product += 3;
        else if (/category|brand/.test(haystack)) scores.product += 1;

        if (/service|package|duration|treatment/.test(haystack)) scores.service += 2;
        if (/slug|body|excerpt|meta ?title|seo|rich ?text|content/.test(haystack)) scores.content += 2;
        if (/event|promo|campaign|coupon|discount/.test(haystack)) scores.event += 2;
        if (/company|business|merchant|tin\b/.test(haystack)) scores.company += 2;
        if (/office|branch|store|outlet/.test(haystack)) scores.office += 2;
    }

    const best = (Object.entries(scores) as Array<[ModuleKind, number]>)
        .filter(([kind]) => kind !== 'generic')
        .sort((left, right) => right[1] - left[1])[0];

    if (!best || best[1] < 2) return null;

    return { kind: best[0], label: best[0], source: 'signals' };
}

export function detectModule(controls: DetectedControl[]): ModuleContext {
    if (typeof location !== 'undefined') {
        const fromPath = moduleFromPath(location.pathname);
        if (fromPath) return fromPath;
    }

    return (
        moduleFromHeading() ??
        moduleFromSignals(controls) ?? {
            kind: 'person',
            label: 'person',
            source: 'default',
        }
    );
}

export type Semantic =
    | 'first_name'
    | 'middle_name'
    | 'last_name'
    | 'suffix'
    | 'full_name'
    | 'entity_name'
    | 'email'
    | 'phone'
    | 'company'
    | 'position'
    | 'address'
    | 'address_line_2'
    | 'region'
    | 'province'
    | 'city'
    | 'barangay'
    | 'postal'
    | 'latitude'
    | 'longitude'
    | 'coordinates'
    | 'tin'
    | 'philsys'
    | 'id_number'
    | 'title'
    | 'slug'
    | 'seo_title'
    | 'seo_description'
    | 'description'
    | 'rich_text'
    | 'price'
    | 'percent'
    | 'quantity'
    | 'sku'
    | 'url'
    | 'video_url'
    | 'map_url'
    | 'social_url'
    | 'password'
    | 'confirm_password'
    | 'date'
    | 'time'
    | 'number'
    | 'option'
    | 'file'
    | 'generic_text'
    | 'unknown';

export const RULES: Array<[Semantic, RegExp[]]> = [
    ['confirm_password', [/confirm.*pass/, /re ?type.*pass/, /pass.*confirm/]],
    ['password', [/password/, /passcode/]],
    ['first_name', [/first ?name/, /given ?name/, /\bfname\b/, /first ?name/]],
    ['middle_name', [/middle ?name/, /\bmname\b/]],
    ['last_name', [/last ?name/, /surname/, /family ?name/, /\blname\b/]],
    ['suffix', [/\bsuffix\b/]],
    ['full_name', [/full ?name/, /contact ?person/, /contact ?name/, /\bperson ?name\b/, /^name$/]],
    [
        'entity_name',
        [
            /^(product|item|service|category|brand|company|merchant|office|branch|event|page|record)$/,
            /(product|item|service|category|brand|company|merchant|office|branch|event|page) ?(name|title)$/,
        ],
    ],
    ['email', [/\be ?mail\b/, /email ?address/]],
    ['philsys', [/phil ?sys/, /\bpsn\b/]],
    ['tin', [/\btin\b/, /tax ?id/]],
    ['id_number', [/\bid\b/, /id ?number/, /id ?no/, /government ?id/]],
    ['phone', [/mobile/, /phone/, /contact ?(number|no)/, /telephone/, /landline/]],
    ['region', [/region/]],
    ['province', [/province/, /\bstate\b/]],
    ['city', [/\bcity\b/, /municipality/]],
    ['barangay', [/barangay/, /\bbrgy\b/]],
    ['postal', [/zip/, /postal/]],
    ['latitude', [/\blatitude\b/, /\blat\b/]],
    ['longitude', [/\blongitude\b/, /\blng\b/, /\blon\b/, /\blong\b/]],
    ['coordinates', [/\bcoordinates\b/, /\bcoordinate\b/]],
    ['address_line_2', [/address ?line ?2/, /address ?2/, /unit|floor|suite/]],
    ['address', [/address/, /street/, /house ?(no|number)/]],
    ['position', [/position/, /designation/, /job ?title/, /\brole\b/]],
    [
        'company',
        [/company/, /business ?name/, /merchant/, /\blgu\b/, /office ?name/, /organization/, /establishment/],
    ],
    ['seo_title', [/meta ?title/, /seo ?title/]],
    ['seo_description', [/meta ?description/, /seo ?description/]],
    ['slug', [/slug/]],
    [
        'video_url',
        [/youtube/, /youtu\.?be/, /vimeo/, /video ?(url|link|embed)/, /watch ?(url|link)/],
    ],
    [
        'map_url',
        [
            /google ?maps?/,
            /maps? ?(url|link|embed)/,
            /map ?(url|link)/,
            /location ?(url|link)/,
            /directions/,
            /geo ?(url|link)/,
            /coordinates ?(url|link)/,
        ],
    ],
    ['social_url', [/facebook/, /instagram/, /linkedin/, /tiktok/, /twitter/, /\bx\.com\b/]],
    ['url', [/\burl\b/, /website/, /\blink\b/]],
    ['price', [/price/, /amount/, /cost/, /\bfee\b/, /rate/, /salary/]],
    ['percent', [/percent/, /discount/, /\bvat\b/]],
    ['quantity', [/quantity/, /\bqty\b/, /stock/, /count/]],
    ['sku', [/\bsku\b/, /product ?code/, /item ?code/, /reference ?(no|number)/]],
    ['date', [/\bdate\b/, /birth/, /\bdob\b/, /expiry/, /expiration/]],
    ['time', [/\btime\b/, /opening/, /closing/]],
    ['title', [/\btitle\b/, /subject/, /headline/]],
    [
        'description',
        [/description/, /summary/, /excerpt/, /content/, /body/, /details/, /remarks/, /note/],
    ],
    ['title', [/\bname\b/]],
];

export const ADDRESS_SEMANTICS: Semantic[] = [
    'region',
    'province',
    'city',
    'barangay',
    'postal',
    'address',
    'address_line_2',
];

export const NEGATIVE_TOGGLE =
    /archiv|delete|inactive|hidden|disable|draft|suspend|block|\bno middle name\b|\bdo not\b|don't|opt out|unsubscribe|without\b/;
export const POSITIVE_TOGGLE = /active|publish|visible|featured|available|enabled|approved|primary/;

export function normalizeForMatch(value: string): string {
    return value
        .toLowerCase()
        .replace(/[_\-./]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

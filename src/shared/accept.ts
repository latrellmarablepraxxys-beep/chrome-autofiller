export type FileFormat =
    | 'png'
    | 'jpeg'
    | 'webp'
    | 'gif'
    | 'pdf'
    | 'csv'
    | 'txt'
    | 'docx'
    | 'xlsx'
    | 'pptx'
    | 'webm'
    | 'mp4';

export interface AcceptInfo {
    raw: string;
    tokens: string[];
    formats: FileFormat[];
    allowsImages: boolean;
    allowsPdf: boolean;
    allowsCsv: boolean;
    allowsText: boolean;
    allowsOffice: boolean;
    allowsVideo: boolean;
}

const IMAGE_FORMATS: FileFormat[] = ['png', 'jpeg', 'webp', 'gif'];
const DEFAULT_IMAGE_FORMATS: FileFormat[] = ['png', 'jpeg', 'webp'];
const OFFICE_FORMATS: FileFormat[] = ['docx', 'xlsx', 'pptx'];
const VIDEO_FORMATS: FileFormat[] = ['webm', 'mp4'];

export function isImageFormat(format: FileFormat): boolean {
    return IMAGE_FORMATS.includes(format);
}

export const MIME_BY_FORMAT: Record<FileFormat, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    csv: 'text/csv',
    txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    webm: 'video/webm',
    mp4: 'video/mp4',
};

export function parseAccept(value: string | null | undefined): AcceptInfo {
    const raw = (value ?? '').trim().toLowerCase();
    const tokens = raw
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);

    const formats: FileFormat[] = [];
    const add = (format: FileFormat) => {
        if (!formats.includes(format)) formats.push(format);
    };
    const has = (...values: string[]) => tokens.some((token) => values.includes(token));

    if (tokens.length === 0) {
        DEFAULT_IMAGE_FORMATS.forEach(add);
    }

    if (tokens.includes('image/*')) {
        DEFAULT_IMAGE_FORMATS.forEach(add);
    }
    if (has('image/png', '.png')) add('png');
    if (has('image/jpeg', 'image/jpg', '.jpg', '.jpeg')) add('jpeg');
    if (has('image/webp', '.webp')) add('webp');
    if (has('image/gif', '.gif')) add('gif');

    if (has('application/pdf', '.pdf')) add('pdf');
    if (has('text/csv', '.csv')) add('csv');
    if (has('text/plain', '.txt')) add('txt');

    if (has('.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        add('docx');
    }
    if (has('.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        add('xlsx');
    }
    if (has('.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
        add('pptx');
    }

    if (tokens.includes('video/*')) {
        VIDEO_FORMATS.forEach(add);
    }
    if (has('video/webm', '.webm')) add('webm');
    if (has('video/mp4', '.mp4')) add('mp4');

    return {
        raw,
        tokens,
        formats,
        allowsImages: formats.some((format) => IMAGE_FORMATS.includes(format)),
        allowsPdf: formats.includes('pdf'),
        allowsCsv: formats.includes('csv'),
        allowsText: formats.includes('txt'),
        allowsOffice: formats.some((format) => OFFICE_FORMATS.includes(format)),
        allowsVideo: formats.some((format) => VIDEO_FORMATS.includes(format)),
    };
}

export function candidateFormats(info: AcceptInfo): FileFormat[] {
    return [...info.formats];
}

export function pickFormat(info: AcceptInfo): FileFormat | null {
    return info.formats[0] ?? null;
}

export function matchesAccept(fileName: string, mime: string, info: AcceptInfo): boolean {
    if (info.tokens.length === 0) return true;

    const extension = `.${fileName.split('.').pop()?.toLowerCase() ?? ''}`;

    return info.tokens.some((token) => {
        if (token === mime) return true;
        if (token === extension) return true;
        if (token === 'image/jpg' && mime === 'image/jpeg') return true;
        if (token.endsWith('/*')) {
            return mime.startsWith(token.replace('/*', '/'));
        }
        return false;
    });
}

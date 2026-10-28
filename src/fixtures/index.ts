import {
    candidateFormats,
    isImageFormat,
    matchesAccept,
    MIME_BY_FORMAT,
    type AcceptInfo,
    type FileFormat,
} from '../shared/accept';
import type { Rng } from '../shared/random';
import { slugify } from '../shared/slug';

export interface BuiltFixture {
    file: File;
    format: FileFormat;
}

const PALETTES: Array<[string, string]> = [
    ['#5b21b6', '#c4b5fd'],
    ['#0f766e', '#99f6e4'],
    ['#9d174d', '#fbcfe8'],
    ['#1e3a8a', '#bfdbfe'],
    ['#92400e', '#fde68a'],
    ['#166534', '#bbf7d0'],
];

const WORDS = ['sample', 'demo', 'quality', 'check', 'record', 'content', 'entry', 'data'];

export async function buildFixture(
    info: AcceptInfo,
    label: string,
    rng: Rng,
    exclude: Set<FileFormat> = new Set(),
): Promise<BuiltFixture | null> {
    const all = candidateFormats(info).filter((format) => !exclude.has(format));
    if (!all.length) return null;

    // A field labelled "photo" / "signature" / "logo" should stay an image even
    // when the uploader also accepts PDFs. Fall back to every accepted format
    // when no image is allowed.
    const imageHint = /photo|signature|image|logo|avatar|cover|picture|selfie|1\s*x\s*1/i.test(label);
    const preferred = imageHint ? all.filter(isImageFormat) : all;
    const candidates = preferred.length ? preferred : all;

    for (const format of shuffle(candidates, rng)) {
        try {
            const file = await createFile(format, label, rng);
            if (matchesAccept(file.name, file.type, info)) {
                return { file, format };
            }
        } catch {
            // Try the next accepted format (e.g. video codec unavailable).
        }
    }

    return null;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = rng.int(0, index);
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
}

async function createFile(format: FileFormat, label: string, rng: Rng): Promise<File> {
    const baseName = `${slugify(label) || 'praxxys-sample'}-${rng.digits(4)}`;

    switch (format) {
        case 'png':
        case 'jpeg':
        case 'webp':
            return makeImage(baseName, format, label, rng);
        case 'gif': {
            const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='), (char) =>
                char.charCodeAt(0),
            );
            return new File([bytes], `${baseName}.gif`, { type: 'image/gif' });
        }
        case 'pdf':
            return new File([makePdf(label, rng)], `${baseName}.pdf`, { type: 'application/pdf' });
        case 'csv':
            return new File([makeCsv(label, rng)], `${baseName}.csv`, { type: 'text/csv' });
        case 'txt':
            return new File([makeTxt(label, rng)], `${baseName}.txt`, { type: 'text/plain' });
        case 'docx':
        case 'xlsx':
        case 'pptx':
            return new File([makeOffice(format, label, rng)], `${baseName}.${format}`, {
                type: MIME_BY_FORMAT[format],
            });
        case 'webm':
        case 'mp4':
            return makeVideo(baseName, format, rng);
    }
}

async function makeImage(
    name: string,
    format: 'png' | 'jpeg' | 'webp',
    label: string,
    rng: Rng,
): Promise<File> {
    const lower = label.toLowerCase();
    const square = /1\s*x\s*1|photo|signature|avatar|logo/.test(lower);
    const canvas = document.createElement('canvas');
    canvas.width = square ? 800 : 1200;
    canvas.height = 800;
    const context = canvas.getContext('2d');
    const [background, accent] = rng.pick(PALETTES);

    if (context) {
        const width = canvas.width;
        const height = canvas.height;

        if (lower.includes('signature')) {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
            context.strokeStyle = '#111827';
            context.lineWidth = 6;
            context.beginPath();
            context.moveTo(width * 0.16, height * 0.62);
            for (let point = 1; point <= 4; point += 1) {
                context.bezierCurveTo(
                    width * (0.16 + point * 0.16),
                    height * (0.2 + rng.float(0, 0.6)),
                    width * (0.16 + point * 0.16 + 0.05),
                    height * (0.2 + rng.float(0, 0.6)),
                    width * (0.16 + point * 0.16),
                    height * 0.52,
                );
            }
            context.stroke();
            context.fillStyle = '#6b7280';
            context.font = '26px sans-serif';
            context.textAlign = 'center';
            context.fillText('PRAXXYS QA signature', width / 2, height * 0.82);
        } else {
            context.fillStyle = background;
            context.fillRect(0, 0, width, height);

            // A few flat blocks keep the PNG small while making each file unique.
            for (let shape = 0; shape < 3; shape += 1) {
                context.fillStyle = accent;
                context.globalAlpha = rng.float(0.08, 0.22);
                context.fillRect(
                    rng.int(0, Math.max(1, width - 260)),
                    rng.int(0, Math.max(1, height - 200)),
                    rng.int(140, 320),
                    rng.int(100, 220),
                );
            }
            context.globalAlpha = 1;
            context.fillStyle = '#ffffff';
            context.textAlign = 'center';
            context.font = 'bold 56px sans-serif';
            context.fillText('PRAXXYS QA', width / 2, height * 0.42);
            context.font = '28px sans-serif';
            context.fillText(label.slice(0, 48) || 'sample image', width / 2, height * 0.53);
        }
    }

    const mime = `image/${format}`;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.82));

    if (!blob) throw new Error(`Could not create ${format} image`);

    const extension = format === 'jpeg' ? 'jpg' : format;
    return new File([blob], `${name}.${extension}`, { type: mime });
}

function makePdf(label: string, rng: Rng): Blob {
    const escape = (value: string) => value.replace(/([()\\])/g, '\\$1');
    const lines = [
        `PRAXXYS QA ${rng.pick(WORDS)} sample`,
        escape(label.slice(0, 60)),
        `Reference ${rng.digits(6)}`,
    ];

    const content = [
        'BT',
        '/F1 18 Tf',
        '72 760 Td',
        `(${escape(lines[0])}) Tj`,
        '/F1 12 Tf',
        '0 -30 Td',
        `(${lines[1]}) Tj`,
        '0 -30 Td',
        `(${lines[2]}) Tj`,
        'ET',
    ].join('\n');

    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
}

function makeCsv(label: string, rng: Rng): Blob {
    const rows = ['field,value', `label,"${label.replace(/"/g, '""')}"`];
    for (let row = 0; row < 4; row += 1) {
        rows.push(`${rng.pick(WORDS)},${rng.pick(WORDS)} ${rng.digits(3)}`);
    }
    return new Blob([rows.join('\n')], { type: 'text/csv' });
}

function makeTxt(label: string, rng: Rng): Blob {
    return new Blob(
        [`PRAXXYS QA sample for ${label}\nReference ${rng.digits(6)}\n${rng.pick(WORDS)} ${rng.pick(WORDS)}\n`],
        { type: 'text/plain' },
    );
}

function makeOffice(format: 'docx' | 'xlsx' | 'pptx', label: string, rng: Rng): Blob {
    const text = escapeXml(`PRAXXYS QA ${label} ${rng.digits(4)}`);
    const entries: Record<string, string> =
        format === 'docx' ? docxEntries(text) : format === 'xlsx' ? xlsxEntries(text) : pptxEntries(text);

    const bytes = zip(entries);
    return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
}

function docxEntries(text: string): Record<string, string> {
    return {
        '[Content_Types].xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
            '</Types>',
        '_rels/.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
            '</Relationships>',
        'word/document.xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
            `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>` +
            '</w:body></w:document>',
    };
}

function xlsxEntries(text: string): Record<string, string> {
    return {
        '[Content_Types].xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
            '</Types>',
        '_rels/.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
            '</Relationships>',
        'xl/workbook.xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
            '</Relationships>',
        'xl/worksheets/sheet1.xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
            `<row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row>` +
            '</sheetData></worksheet>',
    };
}

function pptxEntries(text: string): Record<string, string> {
    const namespaces =
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

    return {
        '[Content_Types].xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
            '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
            '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
            '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
            '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
            '</Types>',
        '_rels/.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
            '</Relationships>',
        'ppt/presentation.xml':
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${namespaces}>` +
            '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
            '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>' +
            '<p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>' +
            '</p:presentation>',
        'ppt/_rels/presentation.xml.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
            '</Relationships>',
        'ppt/slideMasters/slideMaster1.xml':
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster ${namespaces}>` +
            '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>' +
            '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
            '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
            '</p:sldMaster>',
        'ppt/slideMasters/_rels/slideMaster1.xml.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
            '</Relationships>',
        'ppt/slideLayouts/slideLayout1.xml':
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${namespaces} type="blank" preserve="1">` +
            '<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>' +
            '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>',
        'ppt/slideLayouts/_rels/slideLayout1.xml.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
            '</Relationships>',
        'ppt/slides/slide1.xml':
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${namespaces}>` +
            '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
            '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr/>' +
            `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>` +
            '</p:spTree></p:cSld></p:sld>',
        'ppt/slides/_rels/slide1.xml.rels':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
            '</Relationships>',
        'ppt/theme/theme1.xml':
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">' +
            '<a:themeElements><a:clrScheme name="Office">' +
            '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
            '<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>' +
            '<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>' +
            '<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>' +
            '<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>' +
            '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>' +
            '</a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
            '<a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>' +
            '</a:themeElements></a:theme>',
    };
}

async function makeVideo(name: string, format: 'webm' | 'mp4', rng: Rng): Promise<File> {
    const mime = format === 'mp4' ? 'video/mp4' : 'video/webm';

    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(mime)) {
        throw new Error(`MediaRecorder does not support ${mime}`);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
    });

    recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
    };

    recorder.start();
    const started = performance.now();

    await new Promise<void>((resolve) => {
        const draw = () => {
            const elapsed = performance.now() - started;
            const hue = Math.floor((elapsed / 700) * 320);
            if (context) {
                context.fillStyle = `hsl(${hue}, 70%, 35%)`;
                context.fillRect(0, 0, 640, 360);
                context.fillStyle = '#ffffff';
                context.textAlign = 'center';
                context.font = 'bold 36px sans-serif';
                context.fillText('PRAXXYS QA', 320, 170);
                context.font = '20px sans-serif';
                context.fillText(`sample ${rng.digits(2)}`, 320, 210);
            }
            if (elapsed < 700) setTimeout(draw, 60);
            else resolve();
        };
        draw();
    });

    recorder.stop();
    await stopped;

    if (!chunks.length) throw new Error('video recording produced no data');
    return new File(chunks, `${name}.${format}`, { type: mime });
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function zip(entries: Record<string, string>): Uint8Array {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;

    for (const [name, content] of Object.entries(entries)) {
        const nameBytes = encoder.encode(name);
        const data = encoder.encode(content);
        const crc = crc32(data);

        const local = new Uint8Array(30 + nameBytes.length);
        const localView = new DataView(local.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0, true);
        localView.setUint16(8, 0, true);
        localView.setUint16(10, 0, true);
        localView.setUint16(12, 0, true);
        localView.setUint32(14, crc, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, data.length, true);
        localView.setUint16(26, nameBytes.length, true);
        localView.setUint16(28, 0, true);
        local.set(nameBytes, 30);

        chunks.push(local, data);

        const directory = new Uint8Array(46 + nameBytes.length);
        const directoryView = new DataView(directory.buffer);
        directoryView.setUint32(0, 0x02014b50, true);
        directoryView.setUint16(4, 20, true);
        directoryView.setUint16(6, 20, true);
        directoryView.setUint16(8, 0, true);
        directoryView.setUint16(10, 0, true);
        directoryView.setUint16(12, 0, true);
        directoryView.setUint16(14, 0, true);
        directoryView.setUint32(16, crc, true);
        directoryView.setUint32(20, data.length, true);
        directoryView.setUint32(24, data.length, true);
        directoryView.setUint16(28, nameBytes.length, true);
        directoryView.setUint16(30, 0, true);
        directoryView.setUint16(32, 0, true);
        directoryView.setUint16(34, 0, true);
        directoryView.setUint16(36, 0, true);
        directoryView.setUint32(38, 0, true);
        directoryView.setUint32(42, offset, true);
        directory.set(nameBytes, 46);
        central.push(directory);

        offset += local.length + data.length;
    }

    const centralSize = central.reduce((total, entry) => total + entry.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, Object.keys(entries).length, true);
    endView.setUint16(10, Object.keys(entries).length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    return new Uint8Array(concat([...chunks, ...central, end]));
}

function concat(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((size, chunk) => size + chunk.length, 0);
    const output = new Uint8Array(total);
    let position = 0;
    for (const chunk of chunks) {
        output.set(chunk, position);
        position += chunk.length;
    }
    return output;
}

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let index = 0; index < 256; index += 1) {
            let value = index;
            for (let bit = 0; bit < 8; bit += 1) {
                value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
            }
            crcTable[index] = value >>> 0;
        }
    }

    let crc = 0xffffffff;
    for (const byte of data) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

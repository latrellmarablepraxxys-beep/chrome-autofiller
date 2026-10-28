import type { DetectedControl } from '../shared/types';
import { isDisabled, sleep } from '../shared/dom';
import { candidateFormats, parseAccept, type FileFormat } from '../shared/accept';
import type { Rng } from '../shared/random';
import { buildFixture } from '../fixtures';
import { fail, ok, skip, type FieldOutcome } from './types';

export async function fillFile(control: DetectedControl, rng: Rng): Promise<FieldOutcome> {
    const input = control.el as HTMLInputElement;
    if (isDisabled(input)) return skip('disabled');
    if (input.type !== 'file') return skip('not a file input');

    const accept = control.accept || input.accept || '';
    const info = parseAccept(accept);
    const count = input.multiple ? 2 : 1;
    const transfer = new DataTransfer();
    const used = new Set<FileFormat>();
    const formats: string[] = [];

    for (let index = 0; index < count; index += 1) {
        let built = await buildFixture(info, `${control.label || 'sample'} ${index + 1}`.trim(), rng, used);

        // A single accepted format (or a codec failure) may force a repeat.
        if (!built && used.size > 0) {
            built = await buildFixture(info, `${control.label || 'sample'} ${index + 1}`.trim(), rng);
        }

        if (!built) {
            const supported = candidateFormats(info);
            return fail(
                supported.length
                    ? `could not build a file for accept="${accept}" (allowed: ${supported.join(', ')})`
                    : `unsupported accept: ${accept || 'unknown'}`,
            );
        }

        used.add(built.format);
        formats.push(built.format);
        transfer.items.add(built.file);
    }

    input.files = transfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await sleep(350);

    const error = findUploadError(input);
    if (error) return fail(error);

    return ok('file-input', formats.join(' + '));
}

function findUploadError(input: HTMLInputElement): string | null {
    let node: HTMLElement | null = input.parentElement;
    for (let depth = 0; depth < 4 && node; depth += 1) {
        const errorNode = node.querySelector<HTMLElement>(
            '[data-testid="fileType-error"], [test-id="fileType-error"], [data-testid="upload-error"], [test-id="upload-error"]',
        );
        if (errorNode?.textContent?.trim()) return errorNode.textContent.trim();

        const destructive = Array.from(node.querySelectorAll<HTMLElement>('.text-destructive')).find(
            (candidate) => /not accepted|exceeds|invalid file/i.test(candidate.textContent ?? ''),
        );
        if (destructive?.textContent) return destructive.textContent.trim();

        node = node.parentElement;
    }
    return null;
}

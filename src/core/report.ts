import type { FieldResult, FillReport, RunMode } from '../shared/types';

export function buildReport(
    mode: RunMode,
    startedMs: number,
    fields: FieldResult[],
): FillReport {
    const count = (status: FieldResult['status']) =>
        fields.filter((field) => field.status === status).length;

    return {
        url: location.href,
        mode,
        startedAt: new Date(startedMs).toISOString(),
        durationMs: Date.now() - startedMs,
        filled: count('filled'),
        skipped: count('skipped'),
        failed: count('failed'),
        detected: count('detected'),
        fields,
    };
}

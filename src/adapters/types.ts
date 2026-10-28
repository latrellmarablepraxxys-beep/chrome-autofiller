import type { FieldStatus } from '../shared/types';

export interface FieldOutcome {
    status: FieldStatus;
    reason?: string;
    strategy?: string;
    preview?: string;
    retryable?: boolean;
}

export interface DropdownIntent {
    labels: string[];
    policy: 'first' | 'random' | 'profile';
    seed: number;
    count: number;
}

export function ok(strategy: string, preview?: string): FieldOutcome {
    return { status: 'filled', strategy, preview };
}

export function skip(reason: string): FieldOutcome {
    return { status: 'skipped', reason };
}

export function skipRetry(reason: string): FieldOutcome {
    return { status: 'skipped', reason, retryable: true };
}

export function fail(reason: string, retryable = false): FieldOutcome {
    return { status: 'failed', reason, retryable };
}

export const PASSWORD_MASK = '••••••••';

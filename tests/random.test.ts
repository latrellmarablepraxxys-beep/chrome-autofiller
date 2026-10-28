import { describe, expect, it } from 'vitest';
import { hashString, Rng } from '../src/shared/random';

describe('seeded random', () => {
    it('produces the same sequence for the same seed', () => {
        const left = new Rng(42);
        const right = new Rng(42);

        const a = [left.digits(6), left.int(1, 10), left.pick(['a', 'b', 'c'])];
        const b = [right.digits(6), right.int(1, 10), right.pick(['a', 'b', 'c'])];

        expect(a).toEqual(b);
    });

    it('produces different sequences for different seeds', () => {
        expect(new Rng(1).digits(10)).not.toEqual(new Rng(2).digits(10));
    });

    it('hashes keys stably', () => {
        expect(hashString('first_name')).toBe(hashString('first_name'));
        expect(hashString('first_name')).not.toBe(hashString('last_name'));
    });
});

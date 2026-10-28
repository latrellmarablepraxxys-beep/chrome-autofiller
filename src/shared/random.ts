export function hashString(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class Rng {
    private readonly next: () => number;

    constructor(seed: number) {
        this.next = mulberry32(seed);
    }

    float(min = 0, max = 1): number {
        return min + this.next() * (max - min);
    }

    int(min: number, max: number): number {
        return Math.floor(this.float(min, max + 1));
    }

    pick<T>(items: readonly T[]): T {
        return items[this.int(0, items.length - 1)];
    }

    bool(probability = 0.5): boolean {
        return this.next() < probability;
    }

    digits(length: number): string {
        let out = '';
        for (let index = 0; index < length; index += 1) {
            out += String(this.int(0, 9));
        }
        return out;
    }
}

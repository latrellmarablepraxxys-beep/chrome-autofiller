import { copyFileSync } from 'node:fs';

copyFileSync('manifest.json', 'dist/manifest.json');
console.log('copied manifest.json -> dist/manifest.json');

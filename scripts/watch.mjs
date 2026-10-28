import { spawn } from 'node:child_process';
import { watchFile } from 'node:fs';

const builds = [
    ['vite', 'build', '--watch'],
    ['vite', 'build', '--watch', '--config', 'vite.content.config.ts'],
    ['vite', 'build', '--watch', '--config', 'vite.main.config.ts'],
];

for (const args of builds) {
    const child = spawn('npx', args, { stdio: 'inherit' });
    child.on('exit', (code) => {
        if (code) process.exitCode = code;
    });
}

watchFile('manifest.json', () => {
    const child = spawn('node', ['scripts/copy-manifest.mjs'], { stdio: 'inherit' });
    child.on('exit', (code) => {
        if (code) process.exitCode = code;
    });
});

console.log('watching popup/background, content, main-world and manifest');

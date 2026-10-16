import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'src/assets.json'), 'utf8'));
const read = file => readFile(path.join(root, 'src', file), 'utf8');
await mkdir(path.join(root, 'dist/assets'), { recursive: true });
for (const [output, inputs] of Object.entries(manifest)) {
  const contents = await Promise.all(inputs.map(read));
  // Keep the legacy shared scope and declaration hoisting while separating ownership.
  await writeFile(path.join(root, 'dist/assets', output), contents.join('\n'), 'utf8');
}
await writeFile(path.join(root, 'dist/index.html'), await read('index.html'), 'utf8');
await cp(path.join(root, 'public'), path.join(root, 'dist'), { recursive: true });
console.log('Build ready in dist/');

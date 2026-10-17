import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
const contents = [
  `VAPID_PUBLIC_KEY=${publicKey}`,
  `VAPID_PRIVATE_KEY=${jwk.d}`,
  'VAPID_SUBJECT=https://theusrato.github.io/mesa-arcana/',
  'PUSH_APP_URL=https://theusrato.github.io/mesa-arcana/',
  `PUSH_WEBHOOK_SECRET=${randomBytes(32).toString('hex')}`
].join('\n') + '\n';
writeFileSync(new URL('../.push-secrets.env', import.meta.url), contents, { flag: 'wx', mode: 0o600 });
console.log('Saved .push-secrets.env locally. Keep it private; this file is excluded from Git.');

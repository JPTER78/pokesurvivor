import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createHandler } from './core.mjs';

// Verification uses Google's public signing certificates and an explicit project
// ID. No service-account key, Firestore access or Identity Platform is needed.
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) throw Error('Auth emulator is forbidden here');
if (process.getuid?.() === 0 || process.getgid?.() === 0) throw Error('Run the credential service as a non-root user and group');
const config = JSON.parse(readFileSync(process.env.CONFIG_FILE, 'utf8'));
const secret = readFileSync(process.env.SECRET_FILE, 'utf8').trim();
if (!/^[a-f0-9]{64}$/.test(secret)) throw Error('Invalid auth secret');
if (config.projectId !== 'pokesurvivor-free') throw Error('Unexpected Firebase project');
if (!Array.isArray(config.origins) || !config.origins.length || !Array.isArray(config.allowedUids) ||
    typeof config.allowAllAuthenticated !== 'boolean' || !Number.isInteger(config.credentialTtl) ||
    config.credentialTtl < 600 || config.credentialTtl > 7200) throw Error('Invalid broker config');
initializeApp({ projectId: config.projectId });
const server = createServer({ maxHeaderSize: 16384 }, createHandler({ config, secret,
  verifyToken: token => getAuth().verifyIdToken(token) }));
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
// No published port: only the dedicated Compose bridge and the host can reach it.
server.listen(8088, '0.0.0.0', () => console.log('TURN credential service listening on container port 8088'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());

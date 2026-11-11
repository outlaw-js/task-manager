// Prints a new VAPID key pair for Web Push. Paste the lines into the server's .env.
// Usage: npm run push:keys
import crypto from "node:crypto";

const ecdh = crypto.createECDH("prime256v1");
ecdh.generateKeys();
console.log(`VAPID_PUBLIC_KEY="${ecdh.getPublicKey().toString("base64url")}"`);
console.log(`VAPID_PRIVATE_KEY="${ecdh.getPrivateKey().toString("base64url")}"`);
console.log(`VAPID_SUBJECT="mailto:you@example.com"`);

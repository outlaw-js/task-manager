// Minimal Web Push sender written on Node's crypto — no Firebase, no third-party library.
//  - Payload encryption: RFC 8291 (Message Encryption for Web Push, "aes128gcm" content coding, RFC 8188)
//  - Server identity:     RFC 8292 (VAPID), ES256-signed JWT with our own key pair
// The browser's own push service (Chrome, Firefox, Safari, Edge each run one) holds the message
// and wakes the service worker, which is what lets a notification arrive while the app is closed.

import crypto from "node:crypto";

export interface PushTarget {
  endpoint: string;
  p256dh: string; // browser's P-256 public key, base64url
  auth: string; // browser's 16-byte auth secret, base64url
}

export interface VapidKeys {
  publicKey: string; // 65-byte uncompressed P-256 point, base64url
  privateKey: string; // 32-byte scalar, base64url
  subject: string; // "mailto:..." or "https://..."
}

const b64url = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

/** Generates a VAPID key pair in the format Web Push expects. */
export function generateVapidKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(ecdh.getPrivateKey()) };
}

/** RFC 8292: `Authorization: vapid t=<jwt>, k=<public key>` for the push service's origin. */
function vapidAuthorization(endpoint: string, keys: VapidKeys) {
  const pub = fromB64url(keys.publicKey);
  const key = crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)), d: keys.privateKey },
    format: "jwk",
  });
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: keys.subject,
      }),
    ),
  );
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`;
}

const hkdf = (ikm: Buffer, salt: Buffer, info: Buffer, length: number) =>
  Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, length));

/** RFC 8291 + RFC 8188: encrypts `payload` for one subscription as a single aes128gcm record. */
export function encryptPayload(payload: Buffer, target: Pick<PushTarget, "p256dh" | "auth">) {
  const uaPublic = fromB64url(target.p256dh);
  const authSecret = fromB64url(target.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("Invalid push subscription keys");

  // Fresh sender key pair and salt for every message.
  const ecdh = crypto.createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(sharedSecret, authSecret, keyInfo, 32);
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);

  // One record: plaintext followed by the 0x02 "last record" delimiter, no padding.
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  const header = Buffer.concat([salt, recordSize, Buffer.from([asPublic.length]), asPublic]);
  return Buffer.concat([header, ciphertext]);
}

export type PushResult = { ok: true } | { ok: false; status: number; gone: boolean; body: string };

/** Sends one encrypted message. `gone` means the subscription is dead and should be deleted. */
export async function sendWebPush(target: PushTarget, payload: unknown, keys: VapidKeys, ttlSeconds = 24 * 60 * 60): Promise<PushResult> {
  const body = encryptPayload(Buffer.from(JSON.stringify(payload)), target);
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(target.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
      Urgency: "high",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, gone: res.status === 404 || res.status === 410, body: await res.text().catch(() => "") };
}

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Payload, PayloadCodec } from '@temporalio/common';
import { temporal } from '@temporalio/proto';

// Demo-only key, shared with the codec server. In production, use a key
// management system.
const KEY = Buffer.from('banking-demo-encryption-key-32b!');
const KEY_ID = 'banking-demo-key';
const ENCODING = 'binary/encrypted';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

const ProtoPayload = temporal.api.common.v1.Payload;

/** Encrypts each whole payload with AES-GCM before it reaches Temporal. */
export class EncryptionCodec implements PayloadCodec {
  async encode(payloads: Payload[]): Promise<Payload[]> {
    return payloads.map((payload) => ({
      metadata: {
        encoding: Buffer.from(ENCODING),
        'encryption-key-id': Buffer.from(KEY_ID),
      },
      data: encrypt(ProtoPayload.encode(payload).finish()),
    }));
  }

  /** The API doesn't use the codec, so Workflow input arrives in plain JSON and passes through. */
  async decode(payloads: Payload[]): Promise<Payload[]> {
    return payloads.map((payload) => {
      const encoding = payload.metadata?.encoding;
      if (!encoding || Buffer.from(encoding).toString() !== ENCODING) return payload;
      const keyId = Buffer.from(payload.metadata?.['encryption-key-id'] ?? []).toString();
      if (keyId !== KEY_ID) throw new Error(`Unrecognized key ID ${keyId}`);
      return ProtoPayload.decode(decrypt(Buffer.from(payload.data ?? [])));
    });
  }
}

function encrypt(plain: Uint8Array): Buffer {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', KEY, nonce);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]);
}

function decrypt(data: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', KEY, data.subarray(0, NONCE_BYTES));
  decipher.setAuthTag(data.subarray(data.length - TAG_BYTES));
  return Buffer.concat([decipher.update(data.subarray(NONCE_BYTES, data.length - TAG_BYTES)), decipher.final()]);
}

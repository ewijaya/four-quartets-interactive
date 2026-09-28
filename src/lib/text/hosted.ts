/** Node-only encrypted text bundle for hosted builds. The key stays out of Git. */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

export const HOSTED_JSON = "content/text-hosted/quartets.enc.json";

function keyBytes(key: string): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error("STILLPOINT_TEXT_KEY must be a 32-byte hex key.");
  return Buffer.from(key, "hex");
}

export function sealText(text: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  const ciphertext = Buffer.concat([cipher.update(gzipSync(text)), cipher.final()]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    ciphertext: ciphertext.toString("base64"),
  }) + "\n";
}

export function openText(sealed: string, key: string): string {
  const bytes = keyBytes(key);
  try {
    const data = JSON.parse(sealed);
    if (data.version !== 1 || !/^[a-f0-9]{24}$/.test(data.iv) || !/^[a-f0-9]{32}$/.test(data.tag)) {
      throw new Error("Invalid envelope");
    }
    const decipher = createDecipheriv("aes-256-gcm", bytes, Buffer.from(data.iv, "hex"));
    decipher.setAuthTag(Buffer.from(data.tag, "hex"));
    const compressed = Buffer.concat([decipher.update(Buffer.from(data.ciphertext, "base64")), decipher.final()]);
    return gunzipSync(compressed).toString("utf8");
  } catch {
    throw new Error("Cannot decrypt hosted text. Check STILLPOINT_TEXT_KEY and the encrypted bundle.");
  }
}

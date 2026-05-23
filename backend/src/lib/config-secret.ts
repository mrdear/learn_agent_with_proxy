import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CIPHER_PREFIX = "enc:v1";
const SECRET_PATH = path.resolve(import.meta.dirname, "../../.proxy-secret");

function readSecretMaterial(): string {
  const envSecret = process.env.PROXY_CONFIG_SECRET?.trim();
  if (envSecret) {
    return envSecret;
  }

  if (fs.existsSync(SECRET_PATH)) {
    return fs.readFileSync(SECRET_PATH, "utf-8").trim();
  }

  const secret = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(SECRET_PATH, `${secret}\n`, { mode: 0o600 });
  return secret;
}

function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(readSecretMaterial()).digest();
}

function getHashKey(): Buffer {
  return crypto.createHash("sha256").update(`access:${readSecretMaterial()}`).digest();
}

export function ensureConfigSecret(): void {
  readSecretMaterial();
}

export function createAccessKey(): string {
  return `sk-${crypto.randomBytes(24).toString("base64url")}`;
}

export function hashConfigSecret(value: string): string {
  return crypto.createHmac("sha256", getHashKey()).update(value).digest("base64url");
}

export function encryptConfigSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    CIPHER_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptConfigSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!value.startsWith(`${CIPHER_PREFIX}:`)) {
    return value;
  }

  const parts = value.split(":");
  if (parts.length !== 5) {
    throw new Error("Invalid encrypted config secret");
  }

  const [, , ivValue, tagValue, encryptedValue] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf-8");
}

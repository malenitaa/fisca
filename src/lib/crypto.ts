import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Cifrado simétrico (AES-256-GCM) para guardar el certificado y la clave
 * privada de ARCA en la base de datos. La master key nunca sale del server
 * (ver CREDENTIALS_ENCRYPTION_KEY en .env) y no se loggea ni se expone al cliente.
 */

function getMasterKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta CREDENTIALS_ENCRYPTION_KEY en las variables de entorno del servidor."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY debe ser una clave de 32 bytes codificada en base64 (generala con: openssl rand -base64 32)."
    );
  }
  return key;
}

/** Devuelve un string "iv:authTag:ciphertext" (todo en base64). */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

export function decryptSecret(payload: string): string {
  const key = getMasterKey();
  const [ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Formato de secreto cifrado inválido.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

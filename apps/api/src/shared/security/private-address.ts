import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
// Criptografia de dados de endereço no armazenamento; chave distinta recomendada em produção.
const secret = createHash("sha256").update(env.ENCRYPTION_KEY ?? env.JWT_SECRET).digest();
export function encryptAddress(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${data.toString("hex")}`;
}
export function decryptAddress(value: string): string {
  if (!value.startsWith("v1:")) return value; // Compatibilidade com dados de demonstração antigos.
  const [, hexIv, hexTag, hexData] = value.split(":");
  if (!hexIv || !hexTag || !hexData) throw new Error("Endereço criptografado corrompido");
  const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(hexIv, "hex"));
  decipher.setAuthTag(Buffer.from(hexTag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(hexData, "hex")), decipher.final()]).toString("utf8");
}

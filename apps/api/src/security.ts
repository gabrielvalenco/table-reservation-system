import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";

/** Token com 192 bits de entropia, em base64url (cabe em URL e em cookie). */
export const newToken = () => randomBytes(24).toString("base64url");

/** Só o hash do token vai para o banco: quem lê o banco não consegue usar os links nem as sessões. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (password: string) => hash(password);

// Verificação contra um hash fixo quando o e-mail não existe, para o tempo de resposta não revelar contas.
const decoyHash = await hash("senha-que-nunca-sera-usada");

export async function verifyPassword(passwordHash: string | undefined, password: string) {
  try {
    return await verify(passwordHash ?? decoyHash, password) && passwordHash !== undefined;
  } catch {
    return false;
  }
}

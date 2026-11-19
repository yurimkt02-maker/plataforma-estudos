import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64,
  maxmem: 32 * 1024 * 1024,
} as const;

/**
 * Gera um hash criptográfico seguro com salt aleatório de 32 bytes.
 * Compatível com o runtime Node.js da Vercel sem dependências binárias nativas frágeis.
 */
export function hashPassword(plainPassword: string): string {
  if (!plainPassword || plainPassword.length < 8) {
    throw new Error("A senha deve possuir no mínimo 8 caracteres.");
  }

  const salt = randomBytes(32);
  const derivedKey = scryptSync(plainPassword, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });

  return `$scrypt$n=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

/**
 * Verifica uma senha em tempo constante (constant-time) contra o hash armazenado.
 */
export function verifyPassword(
  plainPassword: string,
  storedHash: string
): boolean {
  if (!plainPassword || !storedHash) {
    return false;
  }

  const parts = storedHash.split("$").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "scrypt") {
    return false;
  }

  const paramString = parts[1];
  const saltBase64 = parts[2];
  const hashBase64 = parts[3];

  if (!paramString || !saltBase64 || !hashBase64) {
    return false;
  }

  const paramMap = Object.fromEntries(
    paramString.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, Number(v)];
    })
  );

  const N = paramMap.n || SCRYPT_PARAMS.N;
  const r = paramMap.r || SCRYPT_PARAMS.r;
  const p = paramMap.p || SCRYPT_PARAMS.p;

  const salt = Buffer.from(saltBase64, "base64");
  const expectedKey = Buffer.from(hashBase64, "base64");

  const derivedKey = scryptSync(plainPassword, salt, expectedKey.length, {
    N,
    r,
    p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });

  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedKey);
}

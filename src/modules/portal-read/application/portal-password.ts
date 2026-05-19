import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPortalPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPortalPassword(plain: string, passwordHash: string | null | undefined): Promise<boolean> {
  if (!passwordHash || !plain) {
    return false;
  }
  return bcrypt.compare(plain, passwordHash);
}

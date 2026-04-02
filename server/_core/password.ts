import { scrypt, randomBytes, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return resolve(false);
    scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      const hashBuffer = Buffer.from(hash, "hex");
      resolve(timingSafeEqual(hashBuffer, derivedKey));
    });
  });
}

export { hashPassword, verifyPassword };

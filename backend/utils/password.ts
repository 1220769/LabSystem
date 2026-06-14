import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LEN = 64

export async function hashPassword(password: string): Promise<string> {
  const salt    = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(candidate: string, stored: string): Promise<boolean> {
  const colonIdx = stored.indexOf(':')
  if (colonIdx === -1) return false
  const salt      = stored.slice(0, colonIdx)
  const hashHex   = stored.slice(colonIdx + 1)
  const storedBuf = Buffer.from(hashHex, 'hex')
  if (storedBuf.length !== KEY_LEN) return false
  const derived = (await scryptAsync(candidate, salt, KEY_LEN)) as Buffer
  return timingSafeEqual(derived, storedBuf)
}

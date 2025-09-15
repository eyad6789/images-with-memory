import crypto from 'crypto';

export interface EncryptionResult {
  encryptedData: string;
  salt: string;
  iv: string;
  authTag: string;
}

export interface DecryptionParams {
  encryptedData: string;
  salt: string;
  iv: string;
  authTag: string;
  password: string;
}

/**
 * Derives a key from password using PBKDF2
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

/**
 * Encrypts text using AES-256-GCM
 */
export function encryptNote(text: string, password: string): EncryptionResult {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  
  const cipher = crypto.createCipher('aes-256-gcm', key);
  cipher.setAAD(Buffer.from('memoryink-note'));
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

/**
 * Decrypts text using AES-256-GCM
 */
export function decryptNote(params: DecryptionParams): string {
  const { encryptedData, salt, iv, authTag, password } = params;
  
  const saltBuffer = Buffer.from(salt, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');
  const key = deriveKey(password, saltBuffer);
  
  const decipher = crypto.createDecipher('aes-256-gcm', key);
  decipher.setAAD(Buffer.from('memoryink-note'));
  decipher.setAuthTag(authTagBuffer);
  
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Creates a hash of the note content for integrity checking
 */
export function createNoteHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Verifies the integrity of a note
 */
export function verifyNoteHash(content: string, hash: string): boolean {
  return createNoteHash(content) === hash;
}

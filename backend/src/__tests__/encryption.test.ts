import { encryptNote, decryptNote, createNoteHash, verifyNoteHash } from '../utils/encryption'

describe('Encryption Utils', () => {
  const testNote = 'This is a test memory note with some special characters: éñ中文'
  const testPassword = 'mySecretPassword123'

  describe('encryptNote', () => {
    it('should encrypt a note successfully', () => {
      const result = encryptNote(testNote, testPassword)

      expect(result.encryptedData).toBeDefined()
      expect(result.salt).toBeDefined()
      expect(result.iv).toBeDefined()
      expect(result.authTag).toBeDefined()
      expect(result.encryptedData).not.toBe(testNote)
    })

    it('should produce different results for same input (due to random salt/iv)', () => {
      const result1 = encryptNote(testNote, testPassword)
      const result2 = encryptNote(testNote, testPassword)

      expect(result1.encryptedData).not.toBe(result2.encryptedData)
      expect(result1.salt).not.toBe(result2.salt)
      expect(result1.iv).not.toBe(result2.iv)
    })
  })

  describe('decryptNote', () => {
    it('should decrypt a note successfully', () => {
      const encrypted = encryptNote(testNote, testPassword)
      const decrypted = decryptNote({
        encryptedData: encrypted.encryptedData,
        salt: encrypted.salt,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        password: testPassword
      })

      expect(decrypted).toBe(testNote)
    })

    it('should throw error with wrong password', () => {
      const encrypted = encryptNote(testNote, testPassword)
      
      expect(() => {
        decryptNote({
          encryptedData: encrypted.encryptedData,
          salt: encrypted.salt,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          password: 'wrongPassword'
        })
      }).toThrow()
    })

    it('should throw error with corrupted data', () => {
      const encrypted = encryptNote(testNote, testPassword)
      
      expect(() => {
        decryptNote({
          encryptedData: 'corrupted' + encrypted.encryptedData,
          salt: encrypted.salt,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          password: testPassword
        })
      }).toThrow()
    })
  })

  describe('createNoteHash', () => {
    it('should create consistent hash for same content', () => {
      const hash1 = createNoteHash(testNote)
      const hash2 = createNoteHash(testNote)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex length
    })

    it('should create different hashes for different content', () => {
      const hash1 = createNoteHash(testNote)
      const hash2 = createNoteHash(testNote + ' modified')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyNoteHash', () => {
    it('should verify correct hash', () => {
      const hash = createNoteHash(testNote)
      const isValid = verifyNoteHash(testNote, hash)

      expect(isValid).toBe(true)
    })

    it('should reject incorrect hash', () => {
      const hash = createNoteHash(testNote)
      const isValid = verifyNoteHash(testNote + ' modified', hash)

      expect(isValid).toBe(false)
    })
  })

  describe('End-to-end encryption', () => {
    it('should encrypt and decrypt complex unicode text', () => {
      const complexNote = '🎉 Memory from 2023! 中文测试 éñüñ special chars: @#$%^&*()'
      const encrypted = encryptNote(complexNote, testPassword)
      const decrypted = decryptNote({
        encryptedData: encrypted.encryptedData,
        salt: encrypted.salt,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        password: testPassword
      })

      expect(decrypted).toBe(complexNote)
    })

    it('should handle empty notes', () => {
      const emptyNote = ''
      const encrypted = encryptNote(emptyNote, testPassword)
      const decrypted = decryptNote({
        encryptedData: encrypted.encryptedData,
        salt: encrypted.salt,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        password: testPassword
      })

      expect(decrypted).toBe(emptyNote)
    })

    it('should handle very long notes', () => {
      const longNote = 'A'.repeat(10000)
      const encrypted = encryptNote(longNote, testPassword)
      const decrypted = decryptNote({
        encryptedData: encrypted.encryptedData,
        salt: encrypted.salt,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        password: testPassword
      })

      expect(decrypted).toBe(longNote)
    })
  })
})

import piexif from 'piexifjs'
import * as pngChunksExtract from 'png-chunks-extract'
import * as pngChunksEncode from 'png-chunks-encode'
import * as pngChunkText from 'png-chunk-text'
import CryptoJS from 'crypto-js'

export interface EmbedOptions {
  imageDataUrl: string
  note: string
  isEncrypted?: boolean
}

export interface ExtractResult {
  note: string | null
  isEncrypted: boolean
}

/**
 * Derives a key from password using PBKDF2
 */
function deriveKey(password: string, salt: string): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 100000
  }).toString()
}

/**
 * Encrypts text using AES
 */
export function encryptNote(text: string, password: string): {
  encryptedData: string
  salt: string
  iv: string
} {
  const salt = CryptoJS.lib.WordArray.random(256 / 8).toString()
  const iv = CryptoJS.lib.WordArray.random(128 / 8).toString()
  const key = deriveKey(password, salt)
  
  const encrypted = CryptoJS.AES.encrypt(text, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  })
  
  return {
    encryptedData: encrypted.toString(),
    salt,
    iv
  }
}

/**
 * Decrypts text using AES
 */
export function decryptNote(encryptedData: string, password: string, salt: string, iv: string): string {
  const key = deriveKey(password, salt)
  
  const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  })
  
  return decrypted.toString(CryptoJS.enc.Utf8)
}

/**
 * Embeds a note into JPEG image using EXIF metadata (client-side)
 */
export function embedNoteInJPEG(options: EmbedOptions): string {
  const { imageDataUrl, note, isEncrypted = false } = options
  
  try {
    // Parse existing EXIF data
    const exifObj = piexif.load(imageDataUrl)
    
    // Embed note in multiple fields for redundancy
    exifObj['0th'][piexif.ImageIFD.ImageDescription] = note
    exifObj['0th'][piexif.ImageIFD.XPComment] = note
    
    // Add custom fields
    exifObj['0th'][piexif.ImageIFD.Software] = 'MemoryInk v1.0'
    exifObj['0th'][piexif.ImageIFD.Artist] = isEncrypted ? 'ENCRYPTED' : 'PLAINTEXT'
    
    // Convert back to data URL
    const exifBytes = piexif.dump(exifObj)
    return piexif.insert(exifBytes, imageDataUrl)
  } catch (error) {
    console.error('Error embedding note in JPEG:', error)
    throw new Error('Failed to embed note in JPEG')
  }
}

/**
 * Embeds a note into PNG image using tEXt chunks (client-side)
 */
export function embedNoteInPNG(options: EmbedOptions): string {
  const { imageDataUrl, note, isEncrypted = false } = options
  
  try {
    // Convert data URL to buffer
    const base64Data = imageDataUrl.split(',')[1]
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    
    const chunks = pngChunksExtract(buffer)
    
    // Remove existing MemoryInk chunks
    const filteredChunks = chunks.filter(chunk => 
      !['mInk', 'mIne', 'mInv'].includes(chunk.name)
    )
    
    // Add our custom chunks
    const noteChunk = pngChunkText.encode('MemoryInkNote', note)
    const encryptedChunk = pngChunkText.encode('MemoryInkEncrypted', isEncrypted ? 'true' : 'false')
    const versionChunk = pngChunkText.encode('MemoryInkVersion', '1.0')
    
    // Insert before IEND chunk
    const iendIndex = filteredChunks.findIndex(chunk => chunk.name === 'IEND')
    filteredChunks.splice(iendIndex, 0, noteChunk, encryptedChunk, versionChunk)
    
    const newBuffer = pngChunksEncode(filteredChunks)
    const newBase64 = btoa(String.fromCharCode(...new Uint8Array(newBuffer)))
    
    return `data:image/png;base64,${newBase64}`
  } catch (error) {
    console.error('Error embedding note in PNG:', error)
    throw new Error('Failed to embed note in PNG')
  }
}

/**
 * Extracts note from JPEG image (client-side)
 */
export function extractNoteFromJPEG(imageDataUrl: string): ExtractResult {
  try {
    const exifObj = piexif.load(imageDataUrl)
    
    // Try multiple fields in order of preference
    let note: string | null = null
    
    if (exifObj['0th'][piexif.ImageIFD.ImageDescription]) {
      note = exifObj['0th'][piexif.ImageIFD.ImageDescription]
    } else if (exifObj['0th'][piexif.ImageIFD.XPComment]) {
      note = exifObj['0th'][piexif.ImageIFD.XPComment]
    }
    
    const isEncrypted = exifObj['0th'][piexif.ImageIFD.Artist] === 'ENCRYPTED'
    
    return { note, isEncrypted }
  } catch (error) {
    console.error('Error extracting note from JPEG:', error)
    return { note: null, isEncrypted: false }
  }
}

/**
 * Extracts note from PNG image (client-side)
 */
export function extractNoteFromPNG(imageDataUrl: string): ExtractResult {
  try {
    const base64Data = imageDataUrl.split(',')[1]
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    const chunks = pngChunksExtract(buffer)
    
    let note: string | null = null
    let isEncrypted = false
    
    for (const chunk of chunks) {
      if (chunk.name === 'tEXt' || chunk.name === 'iTXt') {
        const textData = pngChunkText.decode(chunk.data)
        
        if (textData.keyword === 'MemoryInkNote') {
          note = textData.text
        } else if (textData.keyword === 'MemoryInkEncrypted') {
          isEncrypted = textData.text === 'true'
        }
      }
    }
    
    return { note, isEncrypted }
  } catch (error) {
    console.error('Error extracting note from PNG:', error)
    return { note: null, isEncrypted: false }
  }
}

/**
 * Generic function to embed note based on image format
 */
export function embedNote(options: EmbedOptions): string {
  const { imageDataUrl } = options
  
  if (imageDataUrl.startsWith('data:image/jpeg') || imageDataUrl.startsWith('data:image/jpg')) {
    return embedNoteInJPEG(options)
  } else if (imageDataUrl.startsWith('data:image/png')) {
    return embedNoteInPNG(options)
  } else {
    throw new Error('Unsupported image format for client-side embedding')
  }
}

/**
 * Generic function to extract note based on image format
 */
export function extractNote(imageDataUrl: string): ExtractResult {
  if (imageDataUrl.startsWith('data:image/jpeg') || imageDataUrl.startsWith('data:image/jpg')) {
    return extractNoteFromJPEG(imageDataUrl)
  } else if (imageDataUrl.startsWith('data:image/png')) {
    return extractNoteFromPNG(imageDataUrl)
  } else {
    return { note: null, isEncrypted: false }
  }
}

/**
 * Converts File to data URL
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Downloads a data URL as a file
 */
export function downloadDataURL(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

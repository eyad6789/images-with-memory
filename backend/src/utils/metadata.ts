import { ExifTool } from 'exiftool-vendored';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import * as pngChunksExtract from 'png-chunks-extract';
import * as pngChunksEncode from 'png-chunks-encode';
import * as pngChunkText from 'png-chunk-text';

const exiftool = new ExifTool();

export interface EmbedOptions {
  imagePath: string;
  note: string;
  isEncrypted?: boolean;
  outputPath?: string;
}

export interface ExtractResult {
  note: string | null;
  isEncrypted: boolean;
  metadata?: any;
}

/**
 * Embeds a note into JPEG image using EXIF/XMP metadata
 */
export async function embedNoteInJPEG(options: EmbedOptions): Promise<string> {
  const { imagePath, note, isEncrypted = false, outputPath } = options;
  const output = outputPath || imagePath.replace(/\.(jpg|jpeg)$/i, '_embedded.jpg');
  
  try {
    // First copy the image to preserve original
    await fs.promises.copyFile(imagePath, output);
    
    // Embed note in multiple fields for redundancy
    const tags = {
      'ImageDescription': note,
      'UserComment': note,
      'XMP:Description': note,
      'XMP:MemoryInkNote': note,
      'XMP:MemoryInkEncrypted': isEncrypted ? 'true' : 'false',
      'XMP:MemoryInkVersion': '1.0'
    };
    
    await exiftool.write(output, tags, ['-overwrite_original']);
    
    return output;
  } catch (error) {
    console.error('Error embedding note in JPEG:', error);
    throw new Error('Failed to embed note in JPEG');
  }
}

/**
 * Embeds a note into PNG image using tEXt chunks
 */
export async function embedNoteInPNG(options: EmbedOptions): Promise<string> {
  const { imagePath, note, isEncrypted = false, outputPath } = options;
  const output = outputPath || imagePath.replace(/\.png$/i, '_embedded.png');
  
  try {
    const buffer = await fs.promises.readFile(imagePath);
    const chunks = pngChunksExtract(buffer);
    
    // Remove existing MemoryInk chunks
    const filteredChunks = chunks.filter(chunk => 
      !['mInk', 'mIne', 'mInv'].includes(chunk.name)
    );
    
    // Add our custom chunks
    const noteChunk = pngChunkText.encode('MemoryInkNote', note);
    const encryptedChunk = pngChunkText.encode('MemoryInkEncrypted', isEncrypted ? 'true' : 'false');
    const versionChunk = pngChunkText.encode('MemoryInkVersion', '1.0');
    
    // Insert before IEND chunk
    const iendIndex = filteredChunks.findIndex(chunk => chunk.name === 'IEND');
    filteredChunks.splice(iendIndex, 0, noteChunk, encryptedChunk, versionChunk);
    
    const newBuffer = Buffer.from(pngChunksEncode(filteredChunks));
    await fs.promises.writeFile(output, newBuffer);
    
    return output;
  } catch (error) {
    console.error('Error embedding note in PNG:', error);
    throw new Error('Failed to embed note in PNG');
  }
}

/**
 * Extracts note from JPEG image
 */
export async function extractNoteFromJPEG(imagePath: string): Promise<ExtractResult> {
  try {
    const metadata = await exiftool.read(imagePath);
    
    // Try multiple fields in order of preference
    const noteFields = [
      'XMP:MemoryInkNote',
      'ImageDescription',
      'UserComment',
      'XMP:Description'
    ];
    
    let note: string | null = null;
    for (const field of noteFields) {
      if (metadata[field]) {
        note = metadata[field] as string;
        break;
      }
    }
    
    const isEncrypted = metadata['XMP:MemoryInkEncrypted'] === 'true';
    
    return {
      note,
      isEncrypted,
      metadata
    };
  } catch (error) {
    console.error('Error extracting note from JPEG:', error);
    return { note: null, isEncrypted: false };
  }
}

/**
 * Extracts note from PNG image
 */
export async function extractNoteFromPNG(imagePath: string): Promise<ExtractResult> {
  try {
    const buffer = await fs.promises.readFile(imagePath);
    const chunks = pngChunksExtract(buffer);
    
    let note: string | null = null;
    let isEncrypted = false;
    
    for (const chunk of chunks) {
      if (chunk.name === 'tEXt' || chunk.name === 'iTXt') {
        const textData = pngChunkText.decode(chunk.data);
        
        if (textData.keyword === 'MemoryInkNote') {
          note = textData.text;
        } else if (textData.keyword === 'MemoryInkEncrypted') {
          isEncrypted = textData.text === 'true';
        }
      }
    }
    
    return {
      note,
      isEncrypted
    };
  } catch (error) {
    console.error('Error extracting note from PNG:', error);
    return { note: null, isEncrypted: false };
  }
}

/**
 * Generic function to embed note based on image format
 */
export async function embedNote(options: EmbedOptions): Promise<string> {
  const { imagePath } = options;
  const ext = path.extname(imagePath).toLowerCase();
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return embedNoteInJPEG(options);
    case '.png':
      return embedNoteInPNG(options);
    default:
      throw new Error(`Unsupported image format: ${ext}`);
  }
}

/**
 * Generic function to extract note based on image format
 */
export async function extractNote(imagePath: string): Promise<ExtractResult> {
  const ext = path.extname(imagePath).toLowerCase();
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return extractNoteFromJPEG(imagePath);
    case '.png':
      return extractNoteFromPNG(imagePath);
    default:
      return { note: null, isEncrypted: false };
  }
}

/**
 * Gets image metadata using Sharp
 */
export async function getImageMetadata(imagePath: string) {
  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: (await fs.promises.stat(imagePath)).size
    };
  } catch (error) {
    console.error('Error getting image metadata:', error);
    throw new Error('Failed to get image metadata');
  }
}

/**
 * Cleanup function to close ExifTool
 */
export async function cleanup() {
  await exiftool.end();
}

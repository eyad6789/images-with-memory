#!/usr/bin/env node

import { Command } from 'commander'
import { ExifTool } from 'exiftool-vendored'
import * as pngChunksExtract from 'png-chunks-extract'
import * as pngChunkText from 'png-chunk-text'
import * as fs from 'fs'
import * as path from 'path'
import chalk from 'chalk'

const program = new Command()
const exiftool = new ExifTool()

interface ExtractResult {
  note: string | null
  isEncrypted: boolean
  version?: string
  metadata?: any
}

/**
 * Extracts note from JPEG image using ExifTool
 */
async function extractFromJPEG(imagePath: string): Promise<ExtractResult> {
  try {
    const metadata = await exiftool.read(imagePath)
    
    // Try multiple fields in order of preference
    const noteFields = [
      'XMP:MemoryInkNote',
      'ImageDescription',
      'UserComment',
      'XMP:Description'
    ]
    
    let note: string | null = null
    for (const field of noteFields) {
      if (metadata[field]) {
        note = metadata[field] as string
        break
      }
    }
    
    const isEncrypted = metadata['XMP:MemoryInkEncrypted'] === 'true'
    const version = metadata['XMP:MemoryInkVersion'] as string
    
    return {
      note,
      isEncrypted,
      version,
      metadata: {
        software: metadata['Software'],
        artist: metadata['Artist'],
        dateTime: metadata['DateTime']
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error reading JPEG metadata: ${error}`))
    return { note: null, isEncrypted: false }
  }
}

/**
 * Extracts note from PNG image using chunk parsing
 */
async function extractFromPNG(imagePath: string): Promise<ExtractResult> {
  try {
    const buffer = await fs.promises.readFile(imagePath)
    const chunks = pngChunksExtract(buffer)
    
    let note: string | null = null
    let isEncrypted = false
    let version: string | undefined
    
    for (const chunk of chunks) {
      if (chunk.name === 'tEXt' || chunk.name === 'iTXt') {
        const textData = pngChunkText.decode(chunk.data)
        
        if (textData.keyword === 'MemoryInkNote') {
          note = textData.text
        } else if (textData.keyword === 'MemoryInkEncrypted') {
          isEncrypted = textData.text === 'true'
        } else if (textData.keyword === 'MemoryInkVersion') {
          version = textData.text
        }
      }
    }
    
    return { note, isEncrypted, version }
  } catch (error) {
    console.error(chalk.red(`Error reading PNG chunks: ${error}`))
    return { note: null, isEncrypted: false }
  }
}

/**
 * Extracts note from image based on format
 */
async function extractNote(imagePath: string): Promise<ExtractResult> {
  const ext = path.extname(imagePath).toLowerCase()
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return extractFromJPEG(imagePath)
    case '.png':
      return extractFromPNG(imagePath)
    default:
      console.error(chalk.red(`Unsupported image format: ${ext}`))
      return { note: null, isEncrypted: false }
  }
}

/**
 * Formats the output based on the specified format
 */
function formatOutput(result: ExtractResult, format: string, imagePath: string) {
  switch (format) {
    case 'json':
      return JSON.stringify({
        file: imagePath,
        note: result.note,
        isEncrypted: result.isEncrypted,
        version: result.version,
        metadata: result.metadata
      }, null, 2)
    
    case 'text':
    default:
      let output = `${chalk.bold('File:')} ${imagePath}\n`
      
      if (result.note) {
        output += `${chalk.bold('Note:')} ${result.isEncrypted ? chalk.yellow('[ENCRYPTED]') : result.note}\n`
        output += `${chalk.bold('Encrypted:')} ${result.isEncrypted ? chalk.red('Yes') : chalk.green('No')}\n`
        
        if (result.version) {
          output += `${chalk.bold('Version:')} ${result.version}\n`
        }
        
        if (result.metadata) {
          output += `${chalk.bold('Metadata:')}\n`
          Object.entries(result.metadata).forEach(([key, value]) => {
            if (value) {
              output += `  ${key}: ${value}\n`
            }
          })
        }
      } else {
        output += `${chalk.yellow('No MemoryInk note found')}\n`
      }
      
      return output
  }
}

// CLI Commands
program
  .name('memoryink-extract')
  .description('Extract embedded notes from MemoryInk images')
  .version('1.0.0')

program
  .command('extract')
  .description('Extract note from a single image')
  .argument('<image>', 'path to image file')
  .option('-f, --format <format>', 'output format (text, json)', 'text')
  .option('-o, --output <file>', 'output to file instead of console')
  .action(async (imagePath: string, options) => {
    try {
      if (!fs.existsSync(imagePath)) {
        console.error(chalk.red(`File not found: ${imagePath}`))
        process.exit(1)
      }
      
      console.log(chalk.blue(`Extracting note from: ${imagePath}`))
      const result = await extractNote(imagePath)
      const output = formatOutput(result, options.format, imagePath)
      
      if (options.output) {
        await fs.promises.writeFile(options.output, output)
        console.log(chalk.green(`Output written to: ${options.output}`))
      } else {
        console.log(output)
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`))
      process.exit(1)
    }
  })

program
  .command('batch')
  .description('Extract notes from multiple images in a directory')
  .argument('<directory>', 'path to directory containing images')
  .option('-f, --format <format>', 'output format (text, json)', 'text')
  .option('-o, --output <file>', 'output to file instead of console')
  .option('-r, --recursive', 'search subdirectories recursively')
  .action(async (directory: string, options) => {
    try {
      if (!fs.existsSync(directory)) {
        console.error(chalk.red(`Directory not found: ${directory}`))
        process.exit(1)
      }
      
      const imageExtensions = ['.jpg', '.jpeg', '.png']
      const results: any[] = []
      
      async function processDirectory(dir: string) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          
          if (entry.isDirectory() && options.recursive) {
            await processDirectory(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (imageExtensions.includes(ext)) {
              console.log(chalk.blue(`Processing: ${fullPath}`))
              const result = await extractNote(fullPath)
              
              if (options.format === 'json') {
                results.push({
                  file: fullPath,
                  note: result.note,
                  isEncrypted: result.isEncrypted,
                  version: result.version,
                  metadata: result.metadata
                })
              } else {
                const output = formatOutput(result, 'text', fullPath)
                if (options.output) {
                  await fs.promises.appendFile(options.output, output + '\n---\n')
                } else {
                  console.log(output)
                  console.log('---')
                }
              }
            }
          }
        }
      }
      
      await processDirectory(directory)
      
      if (options.format === 'json') {
        const output = JSON.stringify(results, null, 2)
        if (options.output) {
          await fs.promises.writeFile(options.output, output)
          console.log(chalk.green(`Output written to: ${options.output}`))
        } else {
          console.log(output)
        }
      }
      
      console.log(chalk.green(`\nProcessed ${results.length || 'multiple'} images`))
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`))
      process.exit(1)
    }
  })

program
  .command('verify')
  .description('Verify if an image contains MemoryInk metadata')
  .argument('<image>', 'path to image file')
  .action(async (imagePath: string) => {
    try {
      if (!fs.existsSync(imagePath)) {
        console.error(chalk.red(`File not found: ${imagePath}`))
        process.exit(1)
      }
      
      const result = await extractNote(imagePath)
      
      if (result.note) {
        console.log(chalk.green(`✓ MemoryInk metadata found`))
        console.log(`  Note length: ${result.note.length} characters`)
        console.log(`  Encrypted: ${result.isEncrypted ? chalk.red('Yes') : chalk.green('No')}`)
        if (result.version) {
          console.log(`  Version: ${result.version}`)
        }
      } else {
        console.log(chalk.yellow(`✗ No MemoryInk metadata found`))
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`))
      process.exit(1)
    }
  })

// Handle cleanup on exit
process.on('exit', async () => {
  await exiftool.end()
})

process.on('SIGINT', async () => {
  await exiftool.end()
  process.exit(0)
})

program.parse()

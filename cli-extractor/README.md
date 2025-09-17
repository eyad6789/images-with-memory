# MemoryInk CLI Extractor

A command-line tool to extract embedded notes from MemoryInk images outside of the main application.

## Installation

```bash
cd cli-extractor
npm install
npm run build
npm link  # Makes memoryink-extract available globally
```

## Usage

### Extract note from a single image

```bash
# Basic extraction
memoryink-extract extract photo.jpg

# JSON output
memoryink-extract extract photo.jpg --format json

# Save to file
memoryink-extract extract photo.jpg --output note.txt
```

### Batch extract from directory

```bash
# Process all images in directory
memoryink-extract batch ./photos

# Recursive processing
memoryink-extract batch ./photos --recursive

# JSON output for all images
memoryink-extract batch ./photos --format json --output results.json
```

### Verify MemoryInk metadata

```bash
# Check if image contains MemoryInk data
memoryink-extract verify photo.jpg
```

## Supported Formats

- **JPEG**: Reads from EXIF ImageDescription, UserComment, and XMP fields
- **PNG**: Reads from tEXt/iTXt chunks with MemoryInk keywords

## Output Formats

### Text Format (default)
```
File: photo.jpg
Note: This is my favorite vacation photo from 2023
Encrypted: No
Version: 1.0
Metadata:
  software: MemoryInk v1.0
  dateTime: 2023:12:25 10:30:00
```

### JSON Format
```json
{
  "file": "photo.jpg",
  "note": "This is my favorite vacation photo from 2023",
  "isEncrypted": false,
  "version": "1.0",
  "metadata": {
    "software": "MemoryInk v1.0",
    "dateTime": "2023:12:25 10:30:00"
  }
}
```

## Requirements

- Node.js 18+
- ExifTool (must be installed separately)

### Installing ExifTool

**Windows:**
```bash
# Using chocolatey
choco install exiftool

# Or download from https://exiftool.org/
```

**macOS:**
```bash
brew install exiftool
```

**Linux:**
```bash
sudo apt-get install libimage-exiftool-perl
```

## Examples

```bash
# Extract all notes from a photo album
memoryink-extract batch ~/Photos/Vacation2023 --recursive --output vacation-memories.txt

# Get machine-readable data for processing
memoryink-extract batch ~/Photos --format json --output photo-data.json

# Quick check if photo has embedded memory
memoryink-extract verify important-photo.jpg
```

## Privacy & Security

- Encrypted notes will show as `[ENCRYPTED]` - the CLI tool cannot decrypt them
- Only metadata fields used by MemoryInk are read
- No data is sent over the network
- Tool works completely offline

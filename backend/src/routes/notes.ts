import express from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { encryptNote, decryptNote, createNoteHash, verifyNoteHash } from '../utils/encryption';
import { embedNote } from '../utils/metadata';
import path from 'path';

const router = express.Router();
const prisma = new PrismaClient();

// Create or update note for an image
router.post('/:imageId', authenticateToken, [
  body('content').notEmpty().withMessage('Note content is required'),
  body('encrypt').optional().isBoolean(),
  body('password').optional().isString()
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { imageId } = req.params;
    const { content, encrypt = false, password } = req.body;

    // Verify image belongs to user
    const image = await prisma.image.findFirst({
      where: {
        id: imageId,
        userId: req.user!.id
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Check if encryption is requested but no password provided
    if (encrypt && !password) {
      return res.status(400).json({ error: 'Password required for encryption' });
    }

    // Find existing note
    const existingNote = await prisma.note.findFirst({
      where: {
        imageId,
        userId: req.user!.id
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    let noteData: any = {
      content,
      isEncrypted: encrypt,
      noteHash: createNoteHash(content)
    };

    // Handle encryption
    if (encrypt && password) {
      const encrypted = encryptNote(content, password);
      noteData = {
        content: encrypted.encryptedData,
        isEncrypted: true,
        salt: encrypted.salt,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        noteHash: createNoteHash(content) // Hash of original content
      };
    }

    let note;
    let version = 1;

    if (existingNote) {
      // Save current version to history (keep last 10)
      const currentVersion = existingNote.versions[0]?.version || existingNote.version;
      version = currentVersion + 1;

      await prisma.noteVersion.create({
        data: {
          noteId: existingNote.id,
          content: existingNote.content,
          version: existingNote.version
        }
      });

      // Clean up old versions (keep only last 10)
      const oldVersions = await prisma.noteVersion.findMany({
        where: { noteId: existingNote.id },
        orderBy: { version: 'desc' },
        skip: 10
      });

      if (oldVersions.length > 0) {
        await prisma.noteVersion.deleteMany({
          where: {
            id: { in: oldVersions.map(v => v.id) }
          }
        });
      }

      // Update existing note
      note = await prisma.note.update({
        where: { id: existingNote.id },
        data: {
          ...noteData,
          version
        }
      });
    } else {
      // Create new note
      note = await prisma.note.create({
        data: {
          imageId,
          userId: req.user!.id,
          ...noteData,
          version
        }
      });
    }

    // Embed note in image file
    try {
      const noteToEmbed = encrypt ? `ENCRYPTED:${noteData.content}` : content;
      const embeddedPath = await embedNote({
        imagePath: image.originalUrl,
        note: noteToEmbed,
        isEncrypted: encrypt,
        outputPath: image.originalUrl.replace(/(\.[^.]+)$/, '_embedded$1')
      });

      // Update image with embedded URL
      await prisma.image.update({
        where: { id: imageId },
        data: { embeddedUrl: embeddedPath }
      });
    } catch (embedError) {
      console.warn('Failed to embed note in image:', embedError);
      // Continue without embedding - note is still saved in database
    }

    res.json({
      message: 'Note saved successfully',
      note: {
        id: note.id,
        content: encrypt ? '[ENCRYPTED]' : content,
        isEncrypted: encrypt,
        version,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      }
    });
  } catch (error) {
    console.error('Create/update note error:', error);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// Get note for an image
router.get('/:imageId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { imageId } = req.params;
    const { password } = req.query;

    const note = await prisma.note.findFirst({
      where: {
        imageId,
        userId: req.user!.id
      },
      include: {
        image: {
          select: { id: true, filename: true }
        }
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    let content = note.content;

    // Handle decryption
    if (note.isEncrypted) {
      if (!password) {
        return res.status(400).json({ 
          error: 'Password required to decrypt note',
          isEncrypted: true
        });
      }

      try {
        content = decryptNote({
          encryptedData: note.content,
          salt: note.salt!,
          iv: note.iv!,
          authTag: note.authTag!,
          password: password as string
        });

        // Verify integrity
        if (note.noteHash && !verifyNoteHash(content, note.noteHash)) {
          return res.status(400).json({ error: 'Note integrity check failed' });
        }
      } catch (decryptError) {
        return res.status(400).json({ error: 'Invalid password or corrupted note' });
      }
    }

    res.json({
      note: {
        id: note.id,
        content,
        isEncrypted: note.isEncrypted,
        version: note.version,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        image: note.image
      }
    });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: 'Failed to get note' });
  }
});

// Get note history/versions
router.get('/:imageId/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { imageId } = req.params;

    const note = await prisma.note.findFirst({
      where: {
        imageId,
        userId: req.user!.id
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 10
        }
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Include current version
    const allVersions = [
      {
        id: note.id,
        content: note.isEncrypted ? '[ENCRYPTED]' : note.content,
        version: note.version,
        createdAt: note.updatedAt,
        isCurrent: true
      },
      ...note.versions.map(v => ({
        id: v.id,
        content: note.isEncrypted ? '[ENCRYPTED]' : v.content,
        version: v.version,
        createdAt: v.createdAt,
        isCurrent: false
      }))
    ];

    res.json({
      versions: allVersions
    });
  } catch (error) {
    console.error('Get note history error:', error);
    res.status(500).json({ error: 'Failed to get note history' });
  }
});

// Delete note
router.delete('/:imageId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { imageId } = req.params;

    const note = await prisma.note.findFirst({
      where: {
        imageId,
        userId: req.user!.id
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete note and its versions (cascade)
    await prisma.note.delete({
      where: { id: note.id }
    });

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Search notes
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const where: any = {
      userId: req.user!.id,
      isEncrypted: false, // Only search unencrypted notes
      content: {
        contains: q as string,
        mode: 'insensitive'
      }
    };

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        include: {
          image: {
            select: {
              id: true,
              filename: true,
              width: true,
              height: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.note.count({ where })
    ]);

    res.json({
      notes: notes.map(note => ({
        ...note,
        image: {
          ...note.image,
          url: `/uploads/${req.user!.id}/${note.image.filename}`
        }
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Search notes error:', error);
    res.status(500).json({ error: 'Failed to search notes' });
  }
});

export default router;

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { embedNote } from '../utils/metadata';
import { decryptNote } from '../utils/encryption';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const prisma = new PrismaClient();

// Download image with embedded note
router.get('/image/:imageId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { imageId } = req.params;
    const { password } = req.query;

    // Get image and note
    const image = await prisma.image.findFirst({
      where: {
        id: imageId,
        userId: req.user!.id
      },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const note = image.notes[0];
    let noteContent = '';

    if (note) {
      if (note.isEncrypted) {
        if (!password) {
          return res.status(400).json({ 
            error: 'Password required for encrypted note',
            isEncrypted: true
          });
        }

        try {
          noteContent = decryptNote({
            encryptedData: note.content,
            salt: note.salt!,
            iv: note.iv!,
            authTag: note.authTag!,
            password: password as string
          });
        } catch (decryptError) {
          return res.status(400).json({ error: 'Invalid password' });
        }
      } else {
        noteContent = note.content;
      }
    }

    // Create embedded image
    let downloadPath = image.originalUrl;
    
    if (noteContent) {
      try {
        const tempPath = path.join(
          path.dirname(image.originalUrl),
          `download_${Date.now()}_${path.basename(image.originalUrl)}`
        );

        downloadPath = await embedNote({
          imagePath: image.originalUrl,
          note: noteContent,
          isEncrypted: note?.isEncrypted || false,
          outputPath: tempPath
        });

        // Set up cleanup after download
        res.on('finish', () => {
          setTimeout(() => {
            fs.unlink(downloadPath, (err) => {
              if (err) console.warn('Failed to cleanup temp file:', err);
            });
          }, 5000);
        });
      } catch (embedError) {
        console.warn('Failed to embed note, downloading original:', embedError);
        // Fall back to original image
      }
    }

    // Set download headers
    const filename = `${path.parse(image.filename).name}_with_memory${path.extname(image.filename)}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', `image/${image.format}`);

    // Stream the file
    const fileStream = fs.createReadStream(downloadPath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Download stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download image' });
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download image' });
  }
});

// Export all user data (GDPR compliance)
router.get('/export', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { password } = req.query;

    // Get all user data
    const userData = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        images: {
          include: {
            notes: {
              include: {
                versions: true
              }
            },
            tags: true,
            shares: true
          }
        }
      }
    });

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Decrypt notes if password provided
    const processedImages = await Promise.all(
      userData.images.map(async (image) => {
        const processedNotes = await Promise.all(
          image.notes.map(async (note) => {
            let content = note.content;
            
            if (note.isEncrypted && password) {
              try {
                content = decryptNote({
                  encryptedData: note.content,
                  salt: note.salt!,
                  iv: note.iv!,
                  authTag: note.authTag!,
                  password: password as string
                });
              } catch (decryptError) {
                content = '[ENCRYPTED - Invalid Password]';
              }
            } else if (note.isEncrypted) {
              content = '[ENCRYPTED]';
            }

            return {
              ...note,
              content,
              salt: undefined,
              iv: undefined,
              authTag: undefined
            };
          })
        );

        return {
          ...image,
          notes: processedNotes,
          originalUrl: undefined, // Don't expose file paths
          embeddedUrl: undefined
        };
      })
    );

    const exportData = {
      user: {
        id: userData.id,
        email: userData.email,
        createdAt: userData.createdAt,
        encryptionEnabled: userData.encryptionEnabled
      },
      images: processedImages,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="memoryink_export_${Date.now()}.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;

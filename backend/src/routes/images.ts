import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getImageMetadata, extractNote } from '../utils/metadata';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const userDir = path.join(uploadDir, (req as AuthRequest).user!.id);
    
    // Create user directory if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Upload image
router.post('/upload', authenticateToken, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { isPrivate = true, tags = [] } = req.body;
    const imagePath = req.file.path;
    
    // Get image metadata
    const metadata = await getImageMetadata(imagePath);
    
    // Check if image has embedded note
    const extractedNote = await extractNote(imagePath);
    
    // Create image record
    const image = await prisma.image.create({
      data: {
        userId: req.user!.id,
        filename: req.file.filename,
        originalUrl: imagePath,
        format: metadata.format || path.extname(req.file.filename).slice(1),
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: metadata.size,
        isPrivate: isPrivate === 'true' || isPrivate === true,
        tags: {
          create: Array.isArray(tags) ? tags.map((tag: string) => ({ name: tag })) : []
        }
      },
      include: {
        tags: true,
        notes: true
      }
    });

    // If image has embedded note, create note record
    if (extractedNote.note) {
      await prisma.note.create({
        data: {
          imageId: image.id,
          userId: req.user!.id,
          content: extractedNote.note,
          isEncrypted: extractedNote.isEncrypted
        }
      });
    }

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: {
        ...image,
        url: `/uploads/${req.user!.id}/${req.file.filename}`,
        hasEmbeddedNote: !!extractedNote.note
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get user's images
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 20, search, tags } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {
      userId: req.user!.id
    };

    // Add search filter
    if (search) {
      where.OR = [
        { filename: { contains: search as string, mode: 'insensitive' } },
        { notes: { some: { content: { contains: search as string, mode: 'insensitive' } } } }
      ];
    }

    // Add tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      where.tags = {
        some: {
          name: { in: tagArray as string[] }
        }
      };
    }

    const [images, total] = await Promise.all([
      prisma.image.findMany({
        where,
        include: {
          tags: true,
          notes: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          _count: {
            select: { notes: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.image.count({ where })
    ]);

    const imagesWithUrls = images.map(image => ({
      ...image,
      url: `/uploads/${req.user!.id}/${image.filename}`,
      latestNote: image.notes[0] || null
    }));

    res.json({
      images: imagesWithUrls,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({ error: 'Failed to get images' });
  }
});

// Get single image
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findFirst({
      where: {
        id,
        userId: req.user!.id
      },
      include: {
        tags: true,
        notes: {
          orderBy: { createdAt: 'desc' }
        },
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({
      ...image,
      url: `/uploads/${req.user!.id}/${image.filename}`
    });
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// Delete image
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete file from filesystem
    try {
      await fs.promises.unlink(image.originalUrl);
      if (image.embeddedUrl) {
        await fs.promises.unlink(image.embeddedUrl);
      }
    } catch (fileError) {
      console.warn('Failed to delete image files:', fileError);
    }

    // Delete from database (cascade will handle related records)
    await prisma.image.delete({
      where: { id }
    });

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Update image metadata
router.patch('/:id', authenticateToken, [
  body('isPrivate').optional().isBoolean(),
  body('isPublic').optional().isBoolean(),
  body('tags').optional().isArray()
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { isPrivate, isPublic, tags } = req.body;

    const image = await prisma.image.findFirst({
      where: {
        id,
        userId: req.user!.id
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Update image
    const updateData: any = {};
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const updatedImage = await prisma.image.update({
      where: { id },
      data: updateData,
      include: {
        tags: true,
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Update tags if provided
    if (tags) {
      // Delete existing tags
      await prisma.tag.deleteMany({
        where: { imageId: id }
      });

      // Create new tags
      if (tags.length > 0) {
        await prisma.tag.createMany({
          data: tags.map((tag: string) => ({
            name: tag,
            imageId: id
          }))
        });
      }
    }

    res.json({
      message: 'Image updated successfully',
      image: {
        ...updatedImage,
        url: `/uploads/${req.user!.id}/${updatedImage.filename}`
      }
    });
  } catch (error) {
    console.error('Update image error:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

export default router;

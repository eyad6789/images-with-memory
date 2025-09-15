import express from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest, optionalAuth } from '../middleware/auth';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = express.Router();
const prisma = new PrismaClient();

// Create shareable link
router.post('/:imageId/share', authenticateToken, [
  body('password').optional().isString(),
  body('expiresIn').optional().isInt({ min: 1 }).withMessage('Expiration must be positive number of hours')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { imageId } = req.params;
    const { password, expiresIn } = req.body;

    // Verify image belongs to user and is not private
    const image = await prisma.image.findFirst({
      where: {
        id: imageId,
        userId: req.user!.id,
        isPrivate: false
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found or is private' });
    }

    // Generate unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresIn);
    }

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create share record
    const share = await prisma.share.create({
      data: {
        imageId,
        userId: req.user!.id,
        shareToken,
        password: hashedPassword,
        expiresAt
      }
    });

    res.json({
      message: 'Share link created successfully',
      shareUrl: `/api/shares/${shareToken}`,
      shareToken,
      expiresAt,
      hasPassword: !!password
    });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// Access shared image
router.get('/:shareToken', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { shareToken } = req.params;
    const { password } = req.query;

    const share = await prisma.share.findUnique({
      where: { shareToken },
      include: {
        image: {
          include: {
            notes: {
              where: { isEncrypted: false }, // Only show unencrypted notes in shares
              orderBy: { createdAt: 'desc' },
              take: 1
            },
            tags: true,
            user: {
              select: { email: true }
            }
          }
        }
      }
    });

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // Check password if required
    if (share.password) {
      if (!password) {
        return res.status(401).json({ 
          error: 'Password required',
          requiresPassword: true
        });
      }

      const isValidPassword = await bcrypt.compare(password as string, share.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    // Return image data
    res.json({
      image: {
        id: share.image.id,
        filename: share.image.filename,
        url: `/uploads/${share.image.userId}/${share.image.filename}`,
        format: share.image.format,
        width: share.image.width,
        height: share.image.height,
        createdAt: share.image.createdAt,
        tags: share.image.tags,
        note: share.image.notes[0] || null,
        sharedBy: share.image.user.email
      },
      share: {
        createdAt: share.createdAt,
        expiresAt: share.expiresAt
      }
    });
  } catch (error) {
    console.error('Access share error:', error);
    res.status(500).json({ error: 'Failed to access shared image' });
  }
});

// Get user's shares
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const shares = await prisma.share.findMany({
      where: { userId: req.user!.id },
      include: {
        image: {
          select: {
            id: true,
            filename: true,
            format: true,
            width: true,
            height: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const sharesWithUrls = shares.map(share => ({
      ...share,
      shareUrl: `/api/shares/${share.shareToken}`,
      image: {
        ...share.image,
        url: `/uploads/${req.user!.id}/${share.image.filename}`
      },
      isExpired: share.expiresAt ? share.expiresAt < new Date() : false,
      hasPassword: !!share.password
    }));

    res.json({ shares: sharesWithUrls });
  } catch (error) {
    console.error('Get shares error:', error);
    res.status(500).json({ error: 'Failed to get shares' });
  }
});

// Delete share
router.delete('/:shareToken', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { shareToken } = req.params;

    const share = await prisma.share.findFirst({
      where: {
        shareToken,
        userId: req.user!.id
      }
    });

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    await prisma.share.delete({
      where: { id: share.id }
    });

    res.json({ message: 'Share deleted successfully' });
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ error: 'Failed to delete share' });
  }
});

export default router;

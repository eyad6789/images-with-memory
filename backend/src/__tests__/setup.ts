import { PrismaClient } from '@prisma/client'

// Mock Prisma Client for tests
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    image: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    note: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    share: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}))

// Mock ExifTool
jest.mock('exiftool-vendored', () => ({
  ExifTool: jest.fn().mockImplementation(() => ({
    read: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  })),
}))

// Mock Sharp
jest.mock('sharp', () => jest.fn(() => ({
  metadata: jest.fn().mockResolvedValue({
    format: 'jpeg',
    width: 1920,
    height: 1080,
  }),
})))

// Setup test environment
beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
})

afterAll(async () => {
  // Cleanup
})

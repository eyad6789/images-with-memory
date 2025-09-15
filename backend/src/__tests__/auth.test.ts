import request from 'supertest'
import express from 'express'
import authRoutes from '../routes/auth'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const app = express()
app.use(express.json())
app.use('/auth', authRoutes)

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /auth/register', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      }

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null)
      mockPrisma.user.create = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: userData.email,
        createdAt: new Date(),
        encryptionEnabled: false
      })

      const response = await request(app)
        .post('/auth/register')
        .send(userData)

      expect(response.status).toBe(201)
      expect(response.body.message).toBe('User created successfully')
      expect(response.body.user.email).toBe(userData.email)
      expect(response.body.token).toBeDefined()
    })

    it('should return error for existing user', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123'
      }

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: userData.email,
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
        encryptionEnabled: false
      })

      const response = await request(app)
        .post('/auth/register')
        .send(userData)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('User already exists with this email')
    })

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })

      expect(response.status).toBe(400)
      expect(response.body.errors).toBeDefined()
    })

    it('should validate password length', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: '123'
        })

      expect(response.status).toBe(400)
      expect(response.body.errors).toBeDefined()
    })
  })

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      }

      const hashedPassword = await bcrypt.hash(userData.password, 12)

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: userData.email,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
        encryptionEnabled: false
      })

      const response = await request(app)
        .post('/auth/login')
        .send(userData)

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Login successful')
      expect(response.body.user.email).toBe(userData.email)
      expect(response.body.token).toBeDefined()
    })

    it('should return error for non-existent user', async () => {
      mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null)

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid email or password')
    })

    it('should return error for invalid password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 12)

      mockPrisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
        encryptionEnabled: false
      })

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Invalid email or password')
    })
  })
})

# MemoryInk - Photo Memory Embedding App

A production-ready web application that allows users to upload photos and embed personal memories directly into image files using metadata.

## Features

- 🔐 User authentication (email/password + JWT)
- 📸 Image upload with support for JPEG, PNG, WebP
- ✍️ Write and edit personal memories/notes for each photo
- 🔒 Optional encryption of notes with user password
- 💾 Embed notes directly into image metadata (EXIF/XMP for JPEG, tEXt chunks for PNG)
- 🔍 Search and index notes (unencrypted only)
- 📱 Progressive Web App (PWA) with offline support
- 🔗 Shareable links with privacy controls
- 📦 Export/backup functionality
- 🎨 Responsive, accessible UI

## Tech Stack

### Frontend
- Next.js 14 with TypeScript
- TailwindCSS for styling
- PWA capabilities
- Client-side image processing

### Backend
- Node.js with Express and TypeScript
- PostgreSQL database
- JWT authentication
- Sharp for image processing
- ExifTool for metadata manipulation

### Image Processing & Metadata
- `sharp` for image processing
- `exiftool-vendored` for EXIF/XMP manipulation
- `png-chunks-*` for PNG metadata
- `piexifjs` for client-side JPEG processing

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- ExifTool installed globally

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd write-memory-in-images
```

2. Install dependencies:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Set up environment variables:
```bash
# Backend (.env)
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials and JWT secret

# Frontend (.env.local)
cp frontend/.env.local.example frontend/.env.local
# Edit frontend/.env.local with API URL
```

4. Set up the database:
```bash
cd backend
npm run db:migrate
```

5. Start the development servers:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

6. Open http://localhost:3000 in your browser

## API Documentation

See `backend/docs/api.md` for complete API documentation.

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## Deployment

See `docs/deployment.md` for production deployment instructions.

## Security & Privacy

- Notes embedded in EXIF/XMP are readable by any metadata reader unless encrypted
- Social networks often strip metadata - use export for safe backup
- Encryption uses AES-GCM with PBKDF2 key derivation
- Lost encryption passwords cannot be recovered

## License

MIT License - see LICENSE file for details

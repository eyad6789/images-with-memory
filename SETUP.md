# MemoryInk - Quick Setup Guide

## Prerequisites

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **PostgreSQL 14+** - [Download here](https://www.postgresql.org/download/)
3. **ExifTool** - Required for metadata processing

### Installing ExifTool

**Windows:**
```bash
# Using chocolatey (recommended)
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

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install all project dependencies
npm run install:all
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb memoryink

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# Edit backend/.env with your database URL:
# DATABASE_URL="postgresql://username:password@localhost:5432/memoryink"

# Run database migrations
cd backend
npm run db:migrate
cd ..
```

### 3. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
# npm run dev:backend  # Runs on http://localhost:3001
# npm run dev:frontend # Runs on http://localhost:3000
```

### 4. Open the App

Visit **http://localhost:3000** in your browser and create an account!

## Testing the Core Features

### 1. Upload & Embed Test

1. Register/login at http://localhost:3000
2. Click "Upload Photo" 
3. Upload a JPEG or PNG image
4. Add a memory note
5. Download the image with embedded note
6. Re-upload the downloaded image to verify note extraction

### 2. Encryption Test

1. Upload an image
2. Add a note with "Encrypt this note" checked
3. Set a password
4. Download and verify the note is encrypted
5. Re-upload and enter password to decrypt

### 3. CLI Extractor Test

```bash
# Build and test CLI tool
cd cli-extractor
npm install
npm run build

# Extract note from downloaded image
npm run dev -- extract path/to/downloaded-image.jpg
```

## Environment Configuration

### Backend (.env)
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/memoryink"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=MemoryInk
NEXT_PUBLIC_MAX_FILE_SIZE=10485760
```

## Available Scripts

```bash
# Development
npm run dev              # Start both servers
npm run dev:backend      # Backend only (port 3001)
npm run dev:frontend     # Frontend only (port 3000)

# Building
npm run build            # Build both projects
npm run build:backend    # Build backend only
npm run build:frontend   # Build frontend only

# Testing
npm test                 # Run all tests
npm run test:backend     # Backend tests only
npm run test:frontend    # Frontend tests only
npm run test:e2e         # End-to-end tests

# Database
cd backend
npm run db:migrate       # Run migrations
npm run db:generate      # Generate Prisma client
npm run db:studio        # Open Prisma Studio
```

## Troubleshooting

### Common Issues

**1. ExifTool not found**
```bash
# Verify installation
exiftool -ver

# If not found, install using package manager above
```

**2. Database connection error**
```bash
# Check PostgreSQL is running
pg_isready

# Verify database exists
psql -l | grep memoryink
```

**3. Port already in use**
```bash
# Kill processes on ports 3000/3001
npx kill-port 3000 3001

# Or change ports in .env files
```

**4. Module not found errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json  
rm -rf frontend/node_modules frontend/package-lock.json
npm run install:all
```

## Project Structure

```
write-memory-in-images/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth & validation
│   │   ├── utils/          # Encryption & metadata
│   │   └── __tests__/      # Backend tests
│   ├── prisma/             # Database schema
│   └── uploads/            # File storage
├── frontend/               # Next.js React app
│   ├── app/                # App router pages
│   ├── components/         # Reusable components
│   ├── lib/                # API & utilities
│   └── public/             # Static assets
├── cli-extractor/          # Standalone CLI tool
├── docs/                   # Documentation
└── README.md
```

## Next Steps

1. **Customize the UI** - Edit components in `frontend/components/`
2. **Add features** - Extend API routes in `backend/src/routes/`
3. **Deploy** - Follow `docs/deployment.md` for production setup
4. **Test thoroughly** - Run the test suite with `npm test`

## Support

- Check the documentation in `/docs/`
- Review the API endpoints in backend routes
- Test with the CLI extractor tool
- All core features are implemented and working!

---

🎉 **You now have a fully functional MemoryInk app!** 

Upload photos, add memories, and watch them get embedded directly into your image files. The memories travel with your photos forever, even when shared outside the app.

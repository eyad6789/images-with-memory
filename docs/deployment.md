# MemoryInk Deployment Guide

This guide covers deploying MemoryInk to production environments.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- ExifTool installed on server
- Domain name and SSL certificate
- Cloud storage (AWS S3 or similar)

## Environment Setup

### Backend Environment Variables

Create `.env` file in the backend directory:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:5432/memoryink_prod"

# JWT
JWT_SECRET="your-super-secure-jwt-secret-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="production"

# File Upload
UPLOAD_DIR="/var/www/memoryink/uploads"
MAX_FILE_SIZE=10485760

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Optional: Cloud Storage
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="memoryink-uploads"
```

### Frontend Environment Variables

Create `.env.local` file in the frontend directory:

```bash
NEXT_PUBLIC_API_URL=https://api.memoryink.app
NEXT_PUBLIC_APP_NAME=MemoryInk
NEXT_PUBLIC_MAX_FILE_SIZE=10485760
```

## Database Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE memoryink_prod;
CREATE USER memoryink WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE memoryink_prod TO memoryink;
```

2. Run migrations:
```bash
cd backend
npm run db:migrate
```

## Docker Deployment

### Using Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: memoryink
      POSTGRES_USER: memoryink
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - memoryink-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      DATABASE_URL: postgresql://memoryink:${DB_PASSWORD}@postgres:5432/memoryink
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    volumes:
      - uploads:/app/uploads
    depends_on:
      - postgres
    networks:
      - memoryink-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      NEXT_PUBLIC_API_URL: https://api.memoryink.app
    depends_on:
      - backend
    networks:
      - memoryink-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - uploads:/var/www/uploads
    depends_on:
      - frontend
      - backend
    networks:
      - memoryink-network

volumes:
  postgres_data:
  uploads:

networks:
  memoryink-network:
    driver: bridge
```

### Backend Dockerfile

Create `backend/Dockerfile.prod`:

```dockerfile
FROM node:18-alpine

# Install ExifTool
RUN apk add --no-cache exiftool

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

# Set permissions
RUN chown -R node:node /app
USER node

EXPOSE 3001

CMD ["npm", "start"]
```

### Frontend Dockerfile

Create `frontend/Dockerfile.prod`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production image
FROM node:18-alpine AS runner

WORKDIR /app

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./

# Install production dependencies
RUN npm ci --only=production

# Set permissions
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "start"]
```

## Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3001;
    }

    upstream frontend {
        server frontend:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

    server {
        listen 80;
        server_name memoryink.app www.memoryink.app;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name memoryink.app www.memoryink.app;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Upload endpoint with special limits
        location /api/images/upload {
            limit_req zone=upload burst=5 nodelay;
            client_max_body_size 50M;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location /uploads/ {
            alias /var/www/uploads/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## Cloud Deployment Options

### AWS Deployment

1. **ECS with Fargate**:
   - Use the Docker images
   - Set up Application Load Balancer
   - Use RDS for PostgreSQL
   - Use S3 for file storage

2. **Elastic Beanstalk**:
   - Deploy backend and frontend separately
   - Use environment variables for configuration

### Vercel + Railway

1. **Frontend on Vercel**:
```bash
cd frontend
vercel --prod
```

2. **Backend on Railway**:
   - Connect GitHub repository
   - Set environment variables
   - Deploy automatically

### DigitalOcean App Platform

Create `app.yaml`:

```yaml
name: memoryink
services:
- name: backend
  source_dir: backend
  github:
    repo: your-username/memoryink
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
  - key: JWT_SECRET
    value: ${JWT_SECRET}

- name: frontend
  source_dir: frontend
  github:
    repo: your-username/memoryink
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NEXT_PUBLIC_API_URL
    value: ${backend.PUBLIC_URL}

databases:
- name: db
  engine: PG
  version: "15"
```

## SSL Certificate Setup

### Using Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d memoryink.app -d www.memoryink.app

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Logging

### Application Monitoring

Add to backend `package.json`:

```json
{
  "dependencies": {
    "@sentry/node": "^7.0.0",
    "winston": "^3.8.0"
  }
}
```

### Health Checks

The backend includes a `/health` endpoint for monitoring:

```bash
curl https://api.memoryink.app/health
```

### Log Management

Configure log rotation in production:

```bash
# /etc/logrotate.d/memoryink
/var/log/memoryink/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
```

## Security Checklist

- [ ] Use HTTPS everywhere
- [ ] Set secure JWT secret (min 32 characters)
- [ ] Enable rate limiting
- [ ] Set up CORS properly
- [ ] Use environment variables for secrets
- [ ] Enable security headers
- [ ] Set up database backups
- [ ] Monitor for vulnerabilities
- [ ] Use least privilege access
- [ ] Enable audit logging

## Backup Strategy

### Database Backups

```bash
#!/bin/bash
# backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > /backups/memoryink_$DATE.sql
aws s3 cp /backups/memoryink_$DATE.sql s3://memoryink-backups/
```

### File Backups

```bash
#!/bin/bash
# backup-files.sh
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backups/uploads_$DATE.tar.gz /var/www/memoryink/uploads/
aws s3 cp /backups/uploads_$DATE.tar.gz s3://memoryink-backups/
```

## Performance Optimization

1. **Enable gzip compression** in Nginx
2. **Use CDN** for static assets
3. **Implement caching** for API responses
4. **Optimize images** on upload
5. **Use connection pooling** for database
6. **Monitor performance** with APM tools

## Troubleshooting

### Common Issues

1. **ExifTool not found**:
   ```bash
   # Install ExifTool on server
   sudo apt-get install libimage-exiftool-perl
   ```

2. **File upload fails**:
   - Check disk space
   - Verify upload directory permissions
   - Check Nginx client_max_body_size

3. **Database connection errors**:
   - Verify DATABASE_URL format
   - Check network connectivity
   - Ensure database exists

4. **JWT token issues**:
   - Verify JWT_SECRET is set
   - Check token expiration
   - Ensure consistent secret across instances

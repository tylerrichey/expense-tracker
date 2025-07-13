# Expense Tracker - Docker Setup

This guide explains how to build and run the Expense Tracker application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (included with Docker Desktop)
- Google Places API key (for location functionality)

## Quick Start

### 1. Environment Setup

Copy the environment template and add your Google Places API key:

```bash
cp .env.example .env
# Edit .env and add your GOOGLE_PLACES_API_KEY
```

### 2. Build and Run with Docker Compose

```bash
# Build and start the application
docker-compose up --build

# Run in detached mode
docker-compose up -d --build
```

The application will be available at http://localhost:3000

### 3. Stop the Application

```bash
docker-compose down
```

## Manual Docker Build

### Build the Image

**Linux/Mac:**
```bash
chmod +x build.sh
./build.sh
```

**Windows:**
```cmd
build.bat
```

**Manual build:**
```bash
docker build -t tylerrichey/expense-tracker:latest .
```

### Run the Container

```bash
# Default port (3000)
docker run -p 3000:3000 \
  -e GOOGLE_PLACES_API_KEY=your_api_key_here \
  -v expense_data:/app/data \
  tylerrichey/expense-tracker:latest

# Custom port (e.g., 8080)
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e GOOGLE_PLACES_API_KEY=your_api_key_here \
  -v expense_data:/app/data \
  tylerrichey/expense-tracker:latest
```

## Configuration

### Environment Variables

- `GOOGLE_PLACES_API_KEY` - Required for location search functionality
- `NODE_ENV` - Set to "production" (default in container)
- `PORT` - Application port (default: 3000)
- `VITE_DEV_PORT` - Vite development server port (default: 5173, for development only)

### Port Configuration

You can run the application on any port by setting the `PORT` environment variable:

```bash
# Using docker-compose with custom port
PORT=8080 docker-compose up

# Using docker run with custom port
docker run -p 8080:8080 -e PORT=8080 tylerrichey/expense-tracker:latest

# Development with custom ports
PORT=4000 VITE_DEV_PORT=3001 npm run dev
```

### Data Persistence

The SQLite database is stored in a Docker volume (`expense_data`) to persist data between container restarts.

## Development

For development with hot reload, use the regular npm commands:

```bash
npm install
npm run dev
```

## Docker Image Details

- **Base Image:** node:18-alpine
- **Size:** Optimized multi-stage build
- **User:** Runs as non-root user for security
- **Health Check:** Built-in health monitoring
- **Port:** Exposes port 3000

## Production Deployment

### HTTPS Requirement

**Important:** The geolocation feature requires HTTPS in production environments. Modern browsers block geolocation requests on non-secure origins for security reasons.

**Allowed origins:**
- `https://` (any HTTPS URL)
- `http://localhost` (development)
- `http://127.0.0.1` (development)

### Setting up HTTPS

You'll need to deploy behind a reverse proxy with SSL/TLS:

**Option 1: Using Nginx with SSL**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Option 2: Using Cloudflare, AWS ALB, or similar**
- Deploy the container on port 3000
- Configure your load balancer/proxy to handle SSL termination
- Forward traffic to the container

**Option 3: Using Docker with Traefik**
```yaml
# Add to docker-compose.yml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.expense-tracker.rule=Host(`your-domain.com`)"
  - "traefik.http.routers.expense-tracker.tls.certresolver=letsencrypt"
```

## Troubleshooting

### Geolocation not working:
- Ensure you're using HTTPS in production
- Check browser console for specific error messages
- Verify location permissions are granted

### Check container logs:
```bash
docker-compose logs expense-tracker
```

### Inspect the container:
```bash
docker exec -it expense-tracker-app sh
```

### Reset data:
```bash
docker-compose down -v  # Removes volumes
docker-compose up --build
```
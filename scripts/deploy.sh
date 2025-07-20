#!/bin/bash

# Zero-downtime deployment script
set -e

echo "🚀 Starting zero-downtime deployment..."

# Configuration
HEALTH_URL="http://localhost:3000/api/health"
MAX_RETRIES=12
RETRY_DELAY=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check health
check_health() {
    curl -f "$HEALTH_URL" > /dev/null 2>&1
}

# Function to wait for health check
wait_for_health() {
    local service_name=$1
    log_info "Waiting for $service_name to become healthy..."
    
    for i in $(seq 1 $MAX_RETRIES); do
        if check_health; then
            log_success "$service_name is healthy!"
            return 0
        else
            log_warning "Health check attempt $i/$MAX_RETRIES failed, retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    done
    
    log_error "$service_name failed to become healthy after $MAX_RETRIES attempts"
    return 1
}

# Check if old deployment is running
OLD_RUNNING=false
if docker compose ps | grep -q "Up"; then
    OLD_RUNNING=true
    log_info "Detected running deployment"
else
    log_info "No existing deployment found"
fi

# Pull latest code
log_info "Pulling latest code..."
git pull origin main

# Build new image
log_info "Building new Docker image..."
docker compose build

# If this is the first deployment
if [ "$OLD_RUNNING" = false ]; then
    log_info "First deployment - starting containers..."
    docker compose up -d
    wait_for_health "new deployment"
    log_success "First deployment completed successfully!"
    exit 0
fi

# For existing deployments, use rolling update strategy
log_info "Performing rolling update..."

# Create a temporary compose file for new deployment
TEMP_COMPOSE=$(mktemp)
cat > "$TEMP_COMPOSE" << EOF
services:
  app-new:
    build: .
    restart: unless-stopped
    ports:
      - "3001:3000"  # Temporary port
    environment:
      - NODE_ENV=production
      - AUTH_PASSWORD=\${AUTH_PASSWORD}
      - GOOGLE_PLACES_API_KEY=\${GOOGLE_PLACES_API_KEY}
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
EOF

# Start new container on different port
log_info "Starting new container on port 3001..."
docker compose -f "$TEMP_COMPOSE" up -d

# Wait for new deployment to be healthy
log_info "Testing new deployment on port 3001..."
TEMP_HEALTH_URL="http://localhost:3001/api/health"
for i in $(seq 1 $MAX_RETRIES); do
    if curl -f "$TEMP_HEALTH_URL" > /dev/null 2>&1; then
        log_success "New deployment is healthy!"
        break
    else
        if [ $i -eq $MAX_RETRIES ]; then
            log_error "New deployment failed health checks"
            log_info "Cleaning up failed deployment..."
            docker compose -f "$TEMP_COMPOSE" down
            rm "$TEMP_COMPOSE"
            exit 1
        fi
        log_warning "Health check attempt $i/$MAX_RETRIES failed, retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
    fi
done

# Switch ports (new container to 3000, stop old container)
log_info "Switching to new deployment..."

# Update the new container to use port 3000
docker compose -f "$TEMP_COMPOSE" down
cat > "$TEMP_COMPOSE" << EOF
services:
  app-new:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - AUTH_PASSWORD=\${AUTH_PASSWORD}
      - GOOGLE_PLACES_API_KEY=\${GOOGLE_PLACES_API_KEY}
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
EOF

# Stop old deployment and start new one on port 3000
log_info "Stopping old deployment..."
docker compose down

log_info "Starting new deployment on port 3000..."
docker compose -f "$TEMP_COMPOSE" up -d

# Final health check
wait_for_health "final deployment"

# Clean up
log_info "Cleaning up..."
docker compose -f "$TEMP_COMPOSE" down
rm "$TEMP_COMPOSE"

# Start the regular deployment
docker compose up -d

# Clean up old images
log_info "Cleaning up old Docker images..."
docker image prune -af

log_success "Zero-downtime deployment completed successfully!"
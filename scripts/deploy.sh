#!/bin/bash

# Zero-downtime deployment script
set -e

echo "🚀 Starting minimal-downtime deployment (SQLite-safe)..."

# Configuration
HEALTH_URL="http://localhost:3000/api/health"
MAX_RETRIES=6
RETRY_DELAY=5

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
        log_info "Health check attempt $i/$MAX_RETRIES..."
        if check_health; then
            log_success "$service_name is healthy!"
            return 0
        else
            if [ $i -eq $MAX_RETRIES ]; then
                log_error "$service_name failed to become healthy after $MAX_RETRIES attempts"
                log_error "Container logs for debugging:"
                docker compose logs --tail=50
                log_error "Container status:"
                docker compose ps
                return 1
            else
                log_warning "Health check failed, retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
            fi
        fi
    done
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

# Generate build info with git history available
log_info "Generating build info..."
node scripts/generate-build-info.js

# Build new image
log_info "Building new Docker image..."
docker compose build

# Ensure data directory exists with proper permissions
log_info "Setting up data directory..."
mkdir -p data

# Try to set permissions, but don't fail if we can't
if ! chmod 755 data 2>/dev/null; then
    log_warning "Could not change data directory permissions (may not be needed)"
    log_info "Current data directory permissions:"
    ls -la data 2>/dev/null || echo "Directory listing not available"
fi

# For SQLite, we need minimal downtime to avoid database locks
if [ "$OLD_RUNNING" = true ]; then
    log_warning "SQLite requires minimal downtime for database lock safety..."
    log_info "Stopping old container..."
    docker compose down
fi

log_info "Starting new deployment..."
docker compose up -d

# Health check
wait_for_health "deployment"

# Clean up old images
log_info "Cleaning up old Docker images..."
docker image prune -af

log_success "Zero-downtime deployment completed successfully!"
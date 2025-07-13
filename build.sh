#!/bin/bash

# Build script for expense-tracker Docker image
# Usage: ./build.sh [tag]

set -e

# Default tag
TAG=${1:-latest}
IMAGE_NAME="tylerrichey/expense-tracker"
FULL_TAG="${IMAGE_NAME}:${TAG}"

echo "Building Docker image: ${FULL_TAG}"

# Build the Docker image
docker build -t "${FULL_TAG}" .

echo "Successfully built ${FULL_TAG}"

# Also tag as latest if a specific tag was provided
if [ "$TAG" != "latest" ]; then
    docker tag "${FULL_TAG}" "${IMAGE_NAME}:latest"
    echo "Also tagged as ${IMAGE_NAME}:latest"
fi

echo "Build complete!"
echo ""
echo "To run the container:"
echo "  docker run -p 3000:3000 ${FULL_TAG}"
echo "  # Or with custom port:"
echo "  docker run -p 8080:8080 -e PORT=8080 ${FULL_TAG}"
echo ""
echo "To push to Docker Hub:"
echo "  docker push ${FULL_TAG}"
if [ "$TAG" != "latest" ]; then
    echo "  docker push ${IMAGE_NAME}:latest"
fi
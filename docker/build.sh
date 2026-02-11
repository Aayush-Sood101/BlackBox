#!/bin/bash

# Build the sandbox Docker image
echo "Building sandbox Docker image..."

cd "$(dirname "$0")"

docker build -t sandbox:latest -f Dockerfile.sandbox .

if [ $? -eq 0 ]; then
    echo "✅ Sandbox image built successfully!"
    echo "Image: sandbox:latest"
    docker images sandbox:latest
else
    echo "❌ Failed to build sandbox image"
    exit 1
fi

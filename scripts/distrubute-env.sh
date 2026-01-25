#!/bin/bash

# Source .env file location
SOURCE_ENV=".env"

# Target directories
TARGETS=(
    "apps/gatewai-fe"
    "apps/mcp-server"
    "packages/db"
)

# Check if source .env file exists
if [ ! -f "$SOURCE_ENV" ]; then
    echo "Error: $SOURCE_ENV file not found in current directory"
    exit 1
fi

echo "Distributing .env file to target directories..."
echo "---"

# Distribute .env to each target directory
for target in "${TARGETS[@]}"; do
    if [ -d "$target" ]; then
        cp "$SOURCE_ENV" "$target/.env"
        echo "✓ Copied to $target/.env"
    else
        echo "✗ Warning: Directory $target does not exist, skipping..."
    fi
done

echo "---"
echo "Distribution complete!"
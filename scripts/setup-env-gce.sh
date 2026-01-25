#!/bin/bash

# Define the output file
ENV_FILE=".env"

echo "Fetching secrets from Google Secret Manager..."

# Fetch secrets
GEMINI_API_KEY=$(gcloud secrets versions access latest --secret="GEMINI_API_KEY")
GOOGLE_CLIENT_ID=$(gcloud secrets versions access latest --secret="GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET=$(gcloud secrets versions access latest --secret="GOOGLE_CLIENT_SECRET")

# Check if secrets were fetched successfully before overwriting
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: Failed to fetch secrets. Aborting to protect existing .env file."
  exit 1
fi

# Create/Override the .env file
cat << EOF > "$ENV_FILE"
# --- App Configuration ---
PORT=8081
VITE_BASE_URL=https://gatewai.studio
BASE_URL=https://gatewai.studio
GCS_ASSETS_BUCKET=gatewai-media

# --- Secrets (Fetched from GCP) ---
GEMINI_API_KEY=$GEMINI_API_KEY
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET

# --- Database & Redis ---
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gatewai"
REDIS_HOST=localhost
REDIS_PORT=6379

MCP_PORT=4001
# --- Logging & Debug ---
LOG_LEVEL=debug
DEBUG_LOG_MEDIA=false
EOF

echo "Successfully updated and overwrote $ENV_FILE"
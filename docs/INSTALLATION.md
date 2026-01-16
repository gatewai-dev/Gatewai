# Gatewai Installation Guide

Follow these steps to get **Gatewai** up and running on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

* **Node.js** (20+ recommended)
* **pnpm** (`npm install -g pnpm`)
* **Docker & Docker Compose**
* **Google Cloud Account** (for storage)

---

## Step 1: Repository Setup

First, clone the project and prepare your environment variables.

```bash
# Clone the repository
git clone https://github.com/okanasl/gatewai
cd gatewai

# Initialize environment variables
cp .env.example .env

```

> [!IMPORTANT]
> Open the `.env` file and fill in your specific credentials (database, redis, and Google Cloud paths) before proceeding.

---

## Step 2: Google Cloud Configuration

Gatewai uses Google Cloud Storage (GCS) for media persistence.

### 1. Create a Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown and select **New Project**.
3. Name it `Gatewai` and click **Create**.

### 2. Service Account & Keys

1. Navigate to **IAM & Admin > Service Accounts**.
2. Click **+ Create Service Account**. Name it `gatewai-storage`.
3. **Role**: Select `Storage Object Admin`.
4. Once created, click the account's **Email** > **Keys** tab > **Add Key** > **Create New Key (JSON)**.
5. Download the file and move it to the root path of this repository.

### 3. Update Environment

Add the absolute path of that JSON file to your `.env`:

```text
GOOGLE_APPLICATION_CREDENTIALS_PATH="/your/local/path/gatewai/apps/gatewai-fe/gcp-key.json"
```

---

## Step 3: Deployment Options

### Option A: Docker (Recommended)

This is the fastest way to start the infrastructure (PostgreSQL, Redis).

```bash
docker-compose up -d

```

### Option B: Manual Setup

Use this if you prefer running the application layers individually.

```bash
# Install dependencies
pnpm i

# Build the project
pnpm build

# Start the application
pnpm start

```

---

## 🔍 Troubleshooting

* **Database connection fails:** Ensure the ports in your `.env` match the ports defined in `docker-compose.yml`.
* **GCP Permissions:** If uploads fail, double-check that your Service Account has the `Storage Object Admin` role and the bucket name in `.env` is correct.

---

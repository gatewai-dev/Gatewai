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
git clone https://github.com/gatewai-dev/Gatewai
cd Gatewai

# Initialize environment variables
cp .env.example .env

```

> [!IMPORTANT]
> Open the `.env` file and fill in your specific credentials (postgres database, redis, and Google Cloud paths) before proceeding.

---

## Step 2: Google Cloud Configuration

Gatewai uses Google Cloud Storage (GCS) for media persistence.

### 1. Create a Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown and select **New Project**.
3. Name it `Gatewai` and click **Create**.

### 2. Create a Storage Bucket

1. Navigate to **Cloud Storage > Buckets**.
2. Click **+ Create**.
3. **Name your bucket:** (e.g., `gatewai-media-assets`). Keep this name handy for your `.env` file.
4. **Location type:** Choose `Region` and select the one closest to you.
5. **Storage class:** Select `Standard`.
6. Click **Create**.

### 3. Service Account & Keys

1. Navigate to **IAM & Admin > Service Accounts**.
2. Click **+ Create Service Account**. Name it `gatewai-storage`.
3. **Role:** Select `Storage Object Admin`.
4. Once created, click the account's **Email** > **Keys** tab > **Add Key** > **Create New Key (JSON)**.
5. Download the file and move it to the root path of this repository.

### 4. Configure Lifecycle Rules (Highly Reccommended)

To manage costs and clean up temporary processing files, you must set a lifecycle policy.

1. Go back to your **Bucket Details** page.
2. Select the **Lifecycle** tab and click **+ Add a Rule**.
3. **Select an action:** Choose `Delete object`.
4. **Select object conditions:**

* **Age:** Set to `2` days.
* **Name prefix matches:** Enter `temp/`.

1. Click **Create**.

### 5. Update Environment

Add your bucket name and the absolute path of your JSON key to your `.env`:

```text
GCP_BUCKET_NAME="your-bucket-name"
GOOGLE_APPLICATION_CREDENTIALS_PATH="/your/local/path/gatewai/apps/gatewai-fe/gcp-key.json"

```

---

---

## Step 3: Deployment Options

### Option A: Docker (Recommended)

This is the fastest way to start the infrastructure (PostgreSQL, Redis) and the application environment without manually installing system libraries.

```bash
docker-compose up -d

```

### Option B: Manual Setup (Local Machine)

If you prefer running the application directly on your host, you must first install the system-level dependencies required for media processing.

#### 1. Install System Dependencies

**For macOS:**

```bash
brew install cairo pango libpng jpeg giflib librsvg ffmpeg
```

**For Debian/Ubuntu:**

```bash
sudo apt-get update && sudo apt-get install -y \
    python3 build-essential libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev libgl1-mesa-dev \
    libglew-dev pkg-config ffmpeg

```

#### 2. Initialize Application

Once the system libraries are ready, run the following commands:

```bash
# Install Node dependencies
pnpm i

# Build the frontend and backend artifacts
pnpm run build

# Start the application
pnpm start-cli

```

---

## 🔍 Troubleshooting

* **Missing `ffmpeg` or `canvas` errors:** If you see errors related to `node-canvas` or video processing during `pnpm i` or at runtime, ensure the system dependencies listed in Step 3 are correctly installed and linked in your PATH.
* **Database connection fails:** Ensure the ports in your `.env` match the ports defined in `docker-compose.yml`.
* **GCP Permissions:** If uploads fail, double-check that your Service Account has the `Storage Object Admin` role and the bucket name in `.env` is correct.

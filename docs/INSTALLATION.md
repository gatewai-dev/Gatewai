# Gatewai Installation Guide

Follow these steps to get **Gatewai** up and running on your local machine using Docker.

## Prerequisites

Before you begin, ensure you have the following installed:

* **Docker & Docker Compose**
* **Google Cloud Account** (for storage)
* **Git**

---

## Step 1: Repository Setup

First, clone the project and prepare your environment variables.

```bash
# Clone the repository
git clone https://github.com/gatewai-dev/Gatewai
git checkout dev
cd Gatewai

# Initialize environment variables
cp env.local.example .env.local
```

> [!IMPORTANT]
> Open the `.env.local` file and fill in your specific credentials (Google Cloud keys, etc.) before proceeding.

---

## Step 2: Google Cloud Configuration

Gatewai uses Google Cloud Storage (GCS) for media persistence. You must set up a service account and download the JSON key file.

### 1. Create a Project & Bucket

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2. Navigate to **Cloud Storage > Buckets** and create a bucket (e.g., `gatewai-media-assets`).
3. Set GCS_ASSETS_BUCKET env variable to your bucket name.

### 2. Service Account & Keys

1. Navigate to **IAM & Admin > Service Accounts**.
2. Create a service account named `gatewai-storage`.
3. Assign the **Storage Object Admin** role.
4. Create a JSON Key:
   - Click the account email > **Keys** > **Add Key** > **Create New Key (JSON)**.
5. **Download the key file** to root of the Gatewai project or a secure location on your machine.
6. Set GOOGLE_APPLICATION_CREDENTIALS_PATH env variable to the absolute path of the JSON key file.

### 3. Update Environment Variables

Open `.env.local` and update the following:

- `GCS_ASSETS_BUCKET`: Your bucket name.
- `GOOGLE_APPLICATION_CREDENTIALS_PATH`: The **absolute path** to the JSON key file you just downloaded.

> [!NOTE]
> Docker Compose will automatically mount this file into the container based on the path you provide.

**Example:**
```env
# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS_PATH=/Users/yourname/secrets/gatewai-key.json

# Postgres (Optional - defaults to postgres/postgres/gatewai_db)
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydb
```

---

## Step 3: Run with Docker

Start the entire application stack (App, Database, Redis, MCP server) with a single command:

```bash
# Start Docker containers

pnpm run start:docker
```

The application will be available at [http://localhost:8081](http://localhost:8081).
The MCP server will be available at [http://localhost:4001](http://localhost:4001).

---

## 🔍 Troubleshooting

* **Credentials File Not Found:** Ensure `GOOGLE_APPLICATION_CREDENTIALS_PATH` in `.env.local` points to an existing file on your host machine. Docker needs the absolute path to mount it correctly.
* **Port Conflicts:** Ensure ports `8081` (App), `5432` (Postgres), `6379` (Redis), and `4001` (MCP) are free on your machine.

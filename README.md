# GATEWAI

**The Multi-Modal Generative AI Workflow Engine.**

Gatewai is a powerful, node-based orchestration platform designed to bridge the gap between complex AI models and intuitive creative workflows. Whether you're generating cinematic videos, composing multi-layered images, or building sophisticated LLM chains, Gatewai provides the canvas for your imagination.

[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)

---

## Key Pillars

### Hybrid Intelligence

Experience the best of both worlds. Gatewai utilizes a **Hybrid Execution Model** that intelligently distributes workloads. Lightweight tasks like real-time painting and image modulation run instantly at the **Edge** (your browser), while heavy generative tasks and video rendering are handled by our high-performance **Cloud** backend.

### Multi-Modal Mastery

Stop switching between tools. Gatewai offers a unified interface for:

- **Video**: Text-to-video, cinematic extensions (up to 148s), and first-to-last frame interpolation.
- **Image**: Generative fill, real-time painting, and advanced compositional tools.
- **Audio**: High-fidelity text-to-speech and deep audio understanding.
- **Text**: State-of-the-art LLM orchestration using Gemini 3.

### ⚡ Real-time Creativity

Don't wait for results. Our interactive canvas allows for instant feedback, enabling a fluid creative process where AI becomes an extension of your brush.

---

## 🚀 Features at a Glance

- **Cinematic Video Suite**: Generate, extend, and interpolate videos with professional-grade control.
- **AI-Powered Paint**: Draw, mask, and fill with generative precision directly on the canvas.
- **Intelligent Compositor**: Merge images, text, and AI outputs into complex, multi-layered masterpieces.
- **Modular LLM Chains**: Build sophisticated logic by connecting LLMs with real-world data and media.
- **Seamless Asset Management**: Unified handling of all your media assets with cloud-native storage.

---

## 🛠️ Getting Started

### Community & Support

- **Join the Stars ⭐**: Support our journey by starring the repo!
- **Discord**: Connect with other creators in our [Community Discord](https://discord.gg/phbS3XZb).

---

## ⚙️ Setup & Configuration

### Google Cloud Storage Setup

To enable media persistence and high-performance asset handling, you'll need a Google Cloud Service Account.

1. **Create a Service Account**:
   - Go to the [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) page.
   - Click **+ Create Service Account**.
   - Name it (e.g., "gatewai-storage") and click **Create and Continue**.

2. **Assign Permissions**:
   - In the Role dropdown, select **Storage Object Admin**.
   - Click **Continue** and then **Done**.

3. **Generate JSON Key**:
   - Click on the Email of your new account.
   - Go to the **Keys** tab -> **Add Key** -> **Create new key**.
   - Select **JSON** and download it.
   - Move the file to the `apps/gatewai-fe` folder.

4. **Update your `.env`**:

   ```text
   GOOGLE_APPLICATION_CREDENTIALS_PATH="/absolute/path/to/your-key.json"
   ```

> [!WARNING]
> **Security First**: Never commit your JSON key to Git. Ensure it is added to your `.gitignore` immediately.

---

## 📜 License

Gatewai is Open Source. See the LICENSE file for details.

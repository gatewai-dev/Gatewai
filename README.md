# GATEWAI

[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)

## Asset Bucket CORS configuration

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:5173"
        ],
        "ExposeHeaders": [
            "ETag",
            "Content-Length"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

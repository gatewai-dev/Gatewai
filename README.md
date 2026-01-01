# GATEWAI

[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)

## Support

Click that      ⭐ button!

![Click](/assets/ddr.gif "Click")

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

## Build node-canvas

By default, "canvas" package is not being built with pnpm for security reasons.

To make it build, run

```sh
cd apps/gatewai-fe
pnpm approve-builds
```

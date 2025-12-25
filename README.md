# GATEWAI

![Gatewai Wallpaper](/assets/wallpaper.png)

Gatewai is an open source AI RPG Game Engine. It enables D&D style, turn based RPG game with NPC Agents, Environment Agents.

## What's inside?

This repository includes the following:

### Apps and Packages

- `@gatewai/engine`: Main game engine
- `@gatewai/tsconfig`: shared `tsconfig.json`s used throughout the monorepo
- `@gatewai/eslint-config`: ESLint preset
- `@gatewai/cli`: CLI interface to play the game. - For development

## Versioning and Publishing packages

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
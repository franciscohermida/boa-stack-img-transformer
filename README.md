# BOA Image Transformer

A simple demonstration/POC showcasing **Cloudflare Containers** for building your own image transformation service.

## What This Demo Shows

This project demonstrates how to use Cloudflare's new Containers product to create a scalable image transformation service that:

- **Containerized Processing**: Runs a [Hono](https://hono.dev/) server inside a Cloudflare Container using the [Sharp](https://sharp.pixelplumbing.com/) library for image transformations
- **Service Binding**: Connects your app to the transformer container using Cloudflare's service binding
- **Smart Caching**: Automatically caches transformed images in R2 to avoid reprocessing
- **Configurable Presets**: Define transformation presets (resize, format conversion, quality settings)

## How It Works

1. **Request**: App receives image transformation request with preset configuration
2. **Cache Check**: Looks for cached version in R2 bucket first
3. **Transform**: If cache miss, sends image + config to containerized Hono server via service binding
4. **Process**: Container runs Sharp transformations (resize, format conversion, etc.)
5. **Cache & Return**: Stores result in R2 and returns transformed image

## Architecture

```
Client Request → App (Vue/Server) → Service Binding → Container (Image Processing) → R2 Cache
```

## Key Components

- **`apps/app-vue/`**: Demo application that handles requests and caching
- **`services/boa-img-transformer/`**: Containerized image transformer service
  - `container_src/server.ts`: Hono server with Sharp image processing
  - `Dockerfile`: Container configuration
- **White listed image transformation presets**: Pre-configured transformations (webp conversion, thumbnails, etc.)

## Why This Matters

Instead of relying on external image services, you can now run your own image transformation infrastructure on Cloudflare's edge with:

- ✅ Full control over processing logic
- ✅ Automatic scaling and global distribution
- ✅ Built-in caching and optimization
- ✅ Cost-effective processing at the edge

Perfect for applications needing custom image processing workflows while maintaining performance and control.

## How to run

```bash
cd services/boa-img-transformer
pnpm dev
pnpm dev:container # not necessary if you are not using windows you must tweak the wrangler.jsonc file to run the container locally
```

```bash
cd apps/app-vue
pnpm dev
```

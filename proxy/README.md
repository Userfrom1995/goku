# Goku Multi-Thread Proxy

GitHub Pages doesn't support custom HTTP headers, so `SharedArrayBuffer` (needed for multi-threaded WASM) doesn't work there.

This Cloudflare Worker proxies your GitHub Pages site and adds the required headers.

## Setup (one-time, ~2 minutes)

```bash
# 1. Install wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare (free account)
wrangler login

# 3. Edit wrangler.toml — set SITE_URL to your GitHub Pages URL
# e.g. SITE_URL = "https://username.github.io/goku/"

# 4. Deploy
cd proxy
wrangler deploy
```

## After Deploy

Your site will be available at:
```
https://goku-proxy.YOUR_SUBDOMAIN.workers.dev/goku/
```

This URL has COOP/COEP headers, so multi-threaded WASM works:
- **Before (GitHub Pages)**: ~3-8 tok/s (single-threaded)
- **After (Cloudflare proxy)**: ~15-50 tok/s (multi-threaded)

## How It Works

1. User visits `https://goku-proxy.workers.dev/goku/`
2. Worker fetches the page from `https://YOUR_USERNAME.github.io/goku/`
3. Worker adds `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers
4. Browser enables `SharedArrayBuffer`
5. wllama uses multiple WASM threads for inference

## Cost

Cloudflare Workers free tier: 100,000 requests/day. More than enough for personal use.

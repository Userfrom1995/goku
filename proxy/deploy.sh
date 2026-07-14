#!/bin/bash
# Deploy a Cloudflare Worker that adds COOP/COEP headers for SharedArrayBuffer support
# This enables multi-threaded WASM (15-50 tok/s instead of 3-8 tok/s)
#
# Prerequisites:
#   1. Install wrangler: npm install -g wrangler
#   2. Login: wrangler login
#   3. Run this script
#
# After deployment, update SITE_URL in the worker to point to your GitHub Pages URL.

set -e

echo "=== Goku Multi-Thread Proxy ==="
echo ""
echo "This deploys a Cloudflare Worker that:"
echo "  1. Proxies your GitHub Pages site"
echo "  2. Adds COOP/COEP headers for SharedArrayBuffer"
echo "  3. Enables multi-threaded WASM (15-50 tok/s)"
echo ""

# Create temp directory
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

cat > "$TMPDIR/wrangler.toml" << 'EOF'
name = "goku-proxy"
main = "index.js"
compatibility_date = "2024-01-01"

[vars]
SITE_URL = "https://USERNAME.github.io/goku/"
EOF

cat > "$TMPDIR/index.js" << 'WORKER'
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const siteUrl = new URL(env.SITE_URL);

    // Proxy the request to GitHub Pages
    const targetUrl = new URL(request.url);
    targetUrl.hostname = siteUrl.hostname;
    targetUrl.pathname = siteUrl.pathname + url.pathname;
    targetUrl.search = url.search;

    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Clone response and add COOP/COEP headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    return newResponse;
  },
};
WORKER

echo "Worker files created in: $TMPDIR"
echo ""
echo "Before deploying, edit $TMPDIR/wrangler.toml"
echo "and set SITE_URL to your GitHub Pages URL."
echo ""
echo "Then run:"
echo "  cd $TMPDIR && wrangler deploy"
echo ""
echo "After deployment, your site will be at:"
echo "  https://goku-proxy.YOUR_SUBDOMAIN.workers.dev/"

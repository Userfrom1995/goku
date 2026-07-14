// Cloudflare Worker: Adds COOP/COEP headers for SharedArrayBuffer support
// This enables multi-threaded WASM inference (15-50 tok/s instead of 3-8 tok/s)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const siteUrl = new URL(env.SITE_URL);

    // Build target URL pointing to GitHub Pages
    const targetUrl = new URL(request.url);
    targetUrl.hostname = siteUrl.hostname;
    targetUrl.pathname = siteUrl.pathname.replace(/\/$/, '') + url.pathname;
    targetUrl.search = url.search;

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      // Clone response and inject cross-origin isolation headers
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

      return newResponse;
    } catch (e) {
      return new Response('Proxy error: ' + e.message, { status: 502 });
    }
  },
};

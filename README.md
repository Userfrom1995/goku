# Goku

A fully client-side web app for running open-source LLMs directly in your browser. Powered by [wllama](https://github.com/ngxson/wllama) (llama.cpp compiled to WebAssembly) with WebGPU acceleration support. No server, no backend, no data leaves your machine.

**[Try it now](https://userfrom1995.github.io/goku/)**

## Highlights

- **Zero backend** - Everything runs in the browser via WebAssembly. Your prompts never leave your device.
- **WebGPU acceleration** - Offload model layers to your GPU for faster inference (15-50 tok/s with multi-threading).
- **One-click model download** - Curated catalog of popular models (200MB-2GB) ready to download, or add any GGUF model from HuggingFace.
- **Real-time streaming** - Watch tokens appear as they're generated, with stop generation at any time.
- **Chat history** - Multiple conversations with persistent storage in your browser.

## Features

### Model Management
- **Curated catalog** - 8 popular models (LFM2.5 350M to SmolLM3 3B) with one-click download
- **Custom models** - Add any GGUF model from HuggingFace by pasting a repo URL
- **Multi-shard support** - Automatically loads models split across multiple files
- **Background downloads** - Close the dialog, download continues in the background
- **Cancel downloads** - Stop incomplete downloads anytime
- **Clear cache** - Remove all models and data with typed confirmation

### Inference
- **GPU acceleration** - WebGPU with adaptive layer offloading (auto-detects optimal layers)
- **Multi-threading** - SharedArrayBuffer support via Service Worker or Cloudflare proxy
- **Context management** - Per-model context length slider with training limit detection
- **Generation settings** - Temperature, top-p, top-k, system prompt
- **Stop generation** - Interrupt without losing loaded model

### Chat
- **Real-time streaming** - Tokens appear as they're generated
- **Markdown rendering** - Code blocks, lists, formatting in responses
- **Multiple conversations** - Switch between chat threads
- **Export/Import** - Backup chat history as JSON

### Device
- **Auto-detection** - RAM, storage, WebGPU capabilities detected automatically
- **Manual override** - Configure RAM, tier, and storage limits in Settings
- **Model fit check** - Warns when model exceeds recommended size for your device

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173/goku/` in your browser.

## Quick Start

1. Go to the **Models** tab
2. Pick a model from the **Recommended models** list (or click **+ Add GGUF** for custom)
3. Click **Download** - it starts immediately
4. Once downloaded, click **Load** to load it into memory
5. Switch to **Chat** tab and start talking

## Model Requirements

- Format: GGUF (`.gguf` files)
- Max single file: 2 GB (browser ArrayBuffer limit)
- For larger models: use sharded GGUF files (e.g., `model-00001-of-00003.gguf`)
- Recommended quantization: Q4_K_M for most devices

## Multi-Threading on GitHub Pages

SharedArrayBuffer requires `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers. Two options:

**Option 1: Service Worker (automatic)**
The app includes a Service Worker (`public/sw.js`) that injects the required headers. No setup needed - it activates automatically on first visit.

**Option 2: Cloudflare Worker (optional, better performance)**
Deploy a reverse proxy for 15-50 tok/s instead of 3-8 tok/s:

```bash
cd proxy
# Edit deploy.sh and set SITE_URL to your GitHub Pages URL
./deploy.sh
```

## Tech Stack

- **React 19** + TypeScript + Vite
- **Tailwind CSS** for styling
- **[wllama](https://github.com/ngxson/wllama)** v3.5.1 for WebAssembly inference
- **[@huggingface/hub](https://www.npmjs.com/package/@huggingface/hub)** for model downloads
- **IndexedDB** for metadata + **OPFS** for model file caching

## Project Structure

```
goku/
  src/
    components/
      Chat/           Chat interface, message input, generation settings
      Models/         Model list with catalog and custom models
      Settings/       RAM/tier/storage override panel
    engine/
      wllama.ts       WASM inference engine wrapper
      huggingface.ts  HuggingFace API, shard detection
      gguf.ts         GGUF metadata parser
      modelCatalog.ts Curated model list
    storage/
      wllamaCache.ts  Model file caching via wllama's CacheManager
      db.ts           IndexedDB for metadata, sessions, settings
    context/          React state management (AppContext)
  public/
    wasm/             wllama WASM binaries
    sw.js             Service Worker for COOP/COEP headers
  proxy/              Cloudflare Worker for multi-threading
```

## License

MIT License - see [LICENSE](LICENSE)

## Acknowledgments

- **[ngxson/wllama](https://github.com/ngxson/wllama)** - The core WASM inference engine (created by Xuan-Son Nguyen)
- **[reeselevine/wllama](https://github.com/reeselevine/wllama)** - WebGPU backend for llama.cpp (maintained by Reese Levine)
- **[ggml-org/llama.cpp](https://github.com/ggerganov/llama.cpp)** - The C++ inference library that wllama wraps

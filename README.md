# Goku

A browser-based LLM inference engine powered by [wllama](https://github.com/ngxson/wllama) (llama.cpp WASM). Run open-source language models directly in your browser, no server required.

## Features

- **Multi-model management** - Download and manage GGUF models from HuggingFace
- **Multi-shard support** - Load models split across multiple files (70B+ models)
- **GPU acceleration** - WebGPU support with adaptive layer offloading
- **Multi-threading** - SharedArrayBuffer support via Service Worker (COOP/COEP headers)
- **Chat interface** - Real-time streaming with conversation history
- **Context management** - Dynamic context length with per-model configuration
- **Generation settings** - Temperature, top-p, top-k, system prompt
- **Stop generation** - Interrupt mid-generation without losing context
- **Import/Export** - Export chat history as JSON
- **Device detection** - Auto-detects RAM, storage, and WebGPU capabilities
- **Manual override** - Configure RAM, tier, and storage limits in Settings
- **Adaptive offloading** - Auto-detects optimal GPU layer count with fallback
- **Cancel downloads** - Stop incomplete downloads without losing progress
- **Clear cache** - Remove all models and data with confirmation

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173/goku/` in your browser.

## Usage

1. Go to the **Models** tab
2. Paste a HuggingFace repo URL (e.g., `TheBloke/Llama-2-7B-Chat-GGUF`)
3. Select a GGUF file (sharded models are grouped automatically)
4. Click **Download** - the model downloads in the background
5. Switch to **Chat** tab and select your model
6. Start chatting!

## Model Requirements

- Format: GGUF (`.gguf` files)
- Max single file: 2 GB (JS ArrayBuffer limit)
- For larger models: use sharded GGUF files (e.g., `model-00001-of-00003.gguf`)
- Recommended: Q4_K_M quantization for most devices

## Build

```bash
npm run build
```

The `dist/` folder can be deployed to any static host (GitHub Pages, Netlify, etc.).

## Multi-Threading on GitHub Pages

SharedArrayBuffer requires COOP/COEP headers. Two options:

1. **Service Worker** (automatic) - The app includes a Service Worker that injects the required headers. No setup needed.

2. **Cloudflare Worker** (optional, better performance) - Deploy a proxy worker for 15-50 tok/s instead of 3-8 tok/s:

```bash
cd proxy
# Edit deploy.sh and set SITE_URL to your GitHub Pages URL
./deploy.sh
```

## Project Structure

```
goku/
  src/
    components/
      Chat/          - Chat interface, message input, generation settings
      Models/        - Model list, GPU settings, device info
      ModelManager/  - Add model dialog with HuggingFace integration
      Settings/      - RAM/tier/storage override panel
    engine/
      wllama.ts      - WASM inference engine wrapper
      huggingface.ts - HuggingFace API, shard detection
      gguf.ts        - GGUF metadata parser
    storage/
      wllamaCache.ts - Model file caching (OPFS/IndexedDB)
      db.ts          - IndexedDB for metadata, sessions, settings
    context/         - React state management
    types/           - TypeScript interfaces
  public/
    wasm/            - wllama WASM binaries
    sw.js            - Service Worker for COOP/COEP headers
  proxy/             - Cloudflare Worker for multi-threading
```

## License

MIT License - see [LICENSE](LICENSE)

## Special Thanks

- **[ngxson/wllama](https://github.com/ngxson/wllama)** - The core WASM inference engine that makes this possible
- **[reeselevine/wllama](https://github.com/reeselevine/wllama)** - Reference implementation and inspiration

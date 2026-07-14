# Goku

A browser-based LLM inference engine powered by [wllama](https://github.com/ngxson/wllama) (llama.cpp WASM). Run open-source language models directly in your browser, no server required.

## Features

- **Multi-model management** - Download and manage GGUF models from HuggingFace
- **GPU acceleration** - WebGPU support with adaptive layer offloading
- **Multi-threading** - SharedArrayBuffer support via COOP/COEP headers
- **Chat interface** - Real-time streaming with conversation history
- **Context management** - Dynamic context length with per-model configuration
- **Import/Export** - Export chat history as JSON
- **Device detection** - Auto-detects RAM, storage, and WebGPU capabilities

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173/goku/` in your browser.

## Usage

1. Go to the **Models** tab
2. Paste a HuggingFace GGUF model URL (e.g., `https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf`)
3. Click **Download** - the model downloads in the background
4. Switch to **Chat** tab and select your model
5. Start chatting!

## Build

```bash
npm run build
```

The `dist/` folder can be deployed to any static host (GitHub Pages, Netlify, etc.).

## License

MIT License - see [LICENSE](LICENSE)

## Special Thanks

- **[ngxson/wllama](https://github.com/ngxson/wllama)** - The core WASM inference engine that makes this possible
- **[reeselevine/wllama](https://github.com/reeselevine/wllama)** - Reference implementation and inspiration

This project is my own version built on top of the amazing wllama library.

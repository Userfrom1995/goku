# Goku - Client-Side LLM Inference Platform

A completely client-side web-based LLM inference website hosted on GitHub Pages. Users can download GGUF models from HuggingFace, manage multiple models, and run inference directly in the browser — powered by llama.cpp (WASM) via wllama.

## Architecture Overview

```
React + Vite (static build → GitHub Pages)
├── UI Layer (React components)
│   ├── Model Manager (download, select, delete models)
│   ├── Chat Interface (message input, streaming responses)
│   ├── Chat History (session list, load/save/export)
│   └── System Info Panel (RAM/disk estimates)
├── Engine Layer
│   ├── wllama (@wllama/wllama) — llama.cpp WASM inference
│   ├── HuggingFace Client (@huggingface/hub) — model downloads
│   └── GGUF Reader (@huggingface/gguf) — read model metadata
└── Storage Layer
    ├── IndexedDB — chat history, sessions, app state
    └── OPFS (with IndexedDB fallback) — GGUF model file blobs
```

## Tech Stack

| Component | Library |
|---|---|
| Framework | React 19 + Vite |
| Inference | `@wllama/wllama` (llama.cpp WASM, WebGPU when available) |
| HF Downloads | `@huggingface/hub` (handles auth, CORS, streaming) |
| GGUF Metadata | `@huggingface/gguf` (read headers without full download) |
| Model Storage | OPFS primary, IndexedDB fallback (via `idb` lib) |
| Chat Persistence | IndexedDB (via `idb` lib) |
| Styling | Tailwind CSS |
| State | React context + useReducer |
| Export | JSON export/import for chat sessions |

## Core Features

### 1. Model Management

- **Add Model**: User pastes HuggingFace repo URL (e.g., `TheBloke/Llama-2-7B-Chat-GGUF`) or direct GGUF file URL
- **Token Input**: Optional field for HF token (for gated models like Llama, Mistral)
- **Pre-download Check**:
  - Fetch GGUF metadata via `@huggingface/gguf` (reads only header bytes via Range request)
  - Show model info: architecture, quantization, parameter count, file size
  - Check `navigator.deviceMemory` (total RAM estimate) and `navigator.storage.estimate()` (available quota)
  - Recommend quantization level based on available resources (Q4_K_M for most, Q2_K for low RAM)
  - Warn user if model likely won't fit in memory
- **Download**: Stream to OPFS/IndexedDB with progress bar. Support cancel/pause.
- **Multi-Model Storage**: Store multiple downloaded models, each with metadata (name, size, quant, architecture)
- **Model Selector**: Dropdown at top of chat (like Claude/ChatGPT model picker) to switch active model
- **Delete Models**: Remove stored models to free up space

### 2. Chat Interface

- **Model Selector Dropdown**: Top of chat, shows downloaded models with size/quant info
- **Message Input**: Text area with send button
- **Streaming Responses**: Token-by-token display as wllama generates
- **System Prompt**: Optional configurable system prompt field
- **Generation Settings**: Temperature, max tokens, top-p, top-k controls (collapsible panel)
- **Stop Generation**: Button to interrupt mid-generation

### 3. Chat History & Sessions

- **Session List**: Sidebar showing all chat sessions with timestamps
- **New Session**: Create fresh chat
- **Auto-save**: Messages saved to IndexedDB as user chats
- **Load Session**: Click to restore any previous session
- **Session Metadata**: Model used, message count, timestamps
- **Export**: Download full chat history as JSON
- **Import**: Load a previously exported JSON chat session
- **Delete Sessions**: Remove old sessions

### 4. Resource Detection & Manual Override

- **Auto-detect on load**:
  - `navigator.deviceMemory` (Chromium only, falls back to heuristic)
  - `navigator.storage.estimate()` for available storage quota
  - `navigator.hardwareConcurrency` for CPU cores
  - `navigator.gpu` for WebGPU support
- **Device Tier Classification**: Combine RAM + CPU into Low/Medium/High tier
- **Manual Override Settings** (persisted in localStorage):
  - RAM: input field (GB), auto-detected or user-set
  - CPU Cores: input field, auto-detected or user-set
  - Storage: input field (GB), auto-detected or user-set
  - Device Tier: dropdown (Low/Medium/High), auto-classified or user-set
- **Override UI**: Edit button next to detected values → inline edit fields
- **Fallback Heuristics** (when auto-detect fails):
  - Mobile (Android/iPhone) → assume 4GB RAM
  - Desktop with ≤4 cores → assume 4GB RAM
  - Desktop with >4 cores → assume 8GB RAM
- **Confidence Display**: Show "(detected)" or "(estimated)" next to values so user knows which are auto-detected vs guessed

## Project Structure

```
goku/
├── public/
│   └── wasm/                    # wllama WASM binaries
├── src/
│   ├── components/
│   │   ├── App.tsx
│   │   ├── ModelManager/
│   │   │   ├── ModelSelector.tsx      # Dropdown to pick active model
│   │   │   ├── AddModelDialog.tsx     # URL input, token, download
│   │   │   ├── ModelCard.tsx          # Downloaded model info card
│   │   │   └── DownloadProgress.tsx   # Progress bar during download
│   │   ├── Chat/
│   │   │   ├── ChatInterface.tsx      # Main chat area
│   │   │   ├── MessageBubble.tsx      # Individual message
│   │   │   ├── MessageInput.tsx       # Input area
│   │   │   └── GenerationSettings.tsx # Temp, tokens, etc.
│   │   ├── Sidebar/
│   │   │   ├── SessionList.tsx        # Chat history list
│   │   │   └── SessionItem.tsx        # Individual session entry
│   │   └── Settings/
│   │       └── SystemInfo.tsx         # RAM/disk/GPU info display
│   ├── engine/
│   │   ├── wllama.ts                  # wllama wrapper (load, inference, unload)
│   │   ├── huggingface.ts             # HF API calls (list files, download)
│   │   └── gguf.ts                    # GGUF metadata reader
│   ├── storage/
│   │   ├── modelStore.ts              # OPFS/IndexedDB for model blobs
│   │   ├── chatStore.ts               # IndexedDB for chat sessions
│   │   └── opfs.ts                    # OPFS with IndexedDB fallback
│   ├── hooks/
│   │   ├── useWllama.ts              # React hook for inference engine
│   │   ├── useModels.ts              # Model list state management
│   │   └── useChat.ts               # Chat message state management
│   ├── context/
│   │   └── AppContext.tsx            # Global state provider
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces
│   ├── utils/
│   │   ├── resourceCheck.ts         # RAM/disk/GPU detection
│   │   └── export.ts               # Chat export/import utilities
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## Key Implementation Details

### Model Download Flow

```
User pastes HF URL → Parse repo/file path
→ @huggingface/gguf reads header (fast, few KB)
→ Display: architecture, quant, size, layers
→ navigator.storage.estimate() + navigator.deviceMemory
→ Show "OK to download" or "Warning: may not fit"
→ User confirms → Stream download to OPFS/IndexedDB
→ Add to model list → Auto-select as active model
```

### Inference Flow

```
User selects model → Check if loaded in wllama
→ If not, load from OPFS/IndexedDB into wllama (30-60s for 1GB)
→ User types message → Build prompt with chat template
→ wllama.createCompletion() with streaming callback
→ Token-by-token UI update
→ Save message to IndexedDB
```

### OPFS/IndexedDB Fallback

```typescript
async function getModelStore(): Promise<ModelStore> {
  if (navigator.storage?.getDirectory) {
    try {
      return await opfsStore(); // OPFS primary
    } catch { /* fallback */ }
  }
  return await indexedDBStore(); // IndexedDB fallback
}
```

### Resource Detection & Manual Override

```typescript
interface DeviceCapabilities {
  ram: number;           // GB
  cores: number;         // CPU cores
  storage: number;       // GB available
  hasWebGPU: boolean;
  tier: 'low' | 'medium' | 'high';
  isAutoDetected: boolean;  // true if auto-detected, false if user-set
}

function getDeviceCapabilities(): DeviceCapabilities {
  // 1. Check for user overrides in localStorage
  const overrides = loadOverrides();
  if (overrides) return { ...overrides, isAutoDetected: false };

  // 2. Auto-detect
  const ram = navigator.deviceMemory || guessRAMFromUA();
  const cores = navigator.hardwareConcurrency || 4;
  const hasWebGPU = !!navigator.gpu;

  // 3. Classify tier
  const tier = classifyDevice(ram, cores);

  return { ram, cores, storage: 0, hasWebGPU, tier, isAutoDetected: true };
}

function guessRAMFromUA(): number {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad/.test(ua)) return 4;  // mobile = assume 4GB
  if (/Windows|Mac|Linux/.test(ua)) return 8;    // desktop = assume 8GB
  return 4;
}
```

**Settings UI**: Edit button next to each detected value → inline input → saves to localStorage → persists across sessions. "Reset to Auto" clears overrides.

### Model Size Recommendations

| Device Tier | RAM | Recommended Models | Max Model Size |
|---|---|---|---|
| Low | ≤2GB | SmolLM2 135M, Qwen 2.5 0.5B | ~500MB |
| Medium | 2-4GB | TinyLlama 1.1B, Llama 3.2 1B | ~1.5GB |
| High | 4GB+ | Phi 3.5 Mini, Gemma 2 2B, Llama 3.2 3B | ~2GB+ |

### Quantization Guide

| Format | Size (7B model) | Quality | Browser Recommendation |
|---|---|---|---|
| Q2_K | ~2.5 GB | Low | Only for very constrained devices |
| Q3_K_M | ~3.3 GB | Fair | Tight memory budgets |
| **Q4_K_M** | **~4.1 GB** | **Good** | **Sweet spot for most users** |
| Q5_K_M | ~4.8 GB | Very Good | When RAM allows |
| Q6_K | ~5.5 GB | Excellent | High-end devices only |
| Q8_0 | ~7.2 GB | Near-FP16 | Not recommended for browser |

## Speed & Performance

WASM inference speed varies based on threading and GPU availability:

| Mode | Speed (tok/s) | When Available | Notes |
|---|---|---|---|
| Single-thread WASM | 3-8 | Always | Works everywhere, no special setup |
| Multi-thread WASM | 15-50 | Needs COOP/COEP headers | 3-10x faster, uses all CPU cores |
| WebGPU | 10-25 | Chrome 113+, Edge 113+ | GPU-accelerated, faster for larger models |

**Why slower than native**: WASM runs in a sandboxed VM. Native llama.cpp uses AVX/NEON SIMD directly on the CPU.

**How we maximize speed**:
1. **Auto-detect best mode**: Check for WebGPU + SharedArrayBuffer, use fastest available
2. **WebGPU first**: Use wllama v3's WebGPU backend when supported (Chrome/Edge)
3. **Multi-thread when possible**: Detect COOP/COEP headers, enable threading
4. **User choice**: Show estimated speed per model so users pick size vs speed
5. **Cloudflare proxy script**: Provide a free Worker for GH Pages users who want multi-threading (~15-50 tok/s)

**Token generation**: No hard token limit. Users set their own max. Context window (model-dependent, typically 2048-8192 tokens) is the real constraint.

## Build & Deploy

### Development

```bash
npm install
npm run dev        # Start dev server at localhost:5173
```

### Production Build

```bash
npm run build      # Static files in dist/
npm run preview    # Preview production build locally
```

### GitHub Pages Deployment

1. Push code to `main` branch
2. GitHub Actions workflow builds and deploys `dist/` to `gh-pages` branch
3. Site available at `https://username.github.io/goku/`

### Multi-Threading on GitHub Pages

`SharedArrayBuffer` requires HTTP headers that GH Pages doesn't support. Options:

1. **Cloudflare Workers proxy** (free, recommended):
   - Deploy a simple Worker that adds COOP/COEP headers
   - Point GH Pages URL through the Worker
   - Enables ~15-50 tok/s instead of ~3-8 tok/s

2. **Local dev**: Vite dev server sets headers automatically

3. **WebGPU fallback**: Even without threading, WebGPU works in Chrome/Edge (~10-25 tok/s)

We auto-detect the best mode at runtime and show users what speed to expect.

## Implementation Phases

| Phase | Tasks | Status |
|---|---|---|
| **1. Scaffold** | Vite + React + TS setup, Tailwind, project structure | Pending |
| **2. Storage** | OPFS/IndexedDB model store, chat history store | Pending |
| **3. Engine** | wllama integration, model loading/unloading | Pending |
| **4. HF Integration** | URL parsing, metadata reading, download with progress | Pending |
| **5. Resource Check** | RAM/disk detection, model viability warnings | Pending |
| **6. Model UI** | Model selector, add/delete dialogs, download progress | Pending |
| **7. Chat UI** | Chat interface, streaming, generation settings | Pending |
| **8. History** | Session list, load/save, export/import | Pending |
| **9. Polish** | Error handling, loading states, responsive design | Pending |
| **10. Deploy** | GitHub Pages setup, COOP/COEP notes | Pending |

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| WASM | 57+ | 52+ | 11+ | 16+ |
| WebGPU | 113+ | 141+ (partial) | 26+ | 113+ |
| OPFS | 86+ | 111+ | 15.2+ | 86+ |
| navigator.deviceMemory | 63+ | ❌ | ❌ | 79+ |
| Storage API | 52+ | 51+ | 15.2+ | 79+ |

## Known Limitations

1. **Single-file 2GB limit**: JS ArrayBuffer max. For larger models, use `llama-gguf-split` to split into chunks. wllama supports loading split models automatically.
2. **RAM detection is approximate**: `navigator.deviceMemory` rounds to powers of 2 (6GB→4, 12GB→8). Only works in Chromium. **Mitigation**: Users can manually override detected values in Settings.
3. **Storage is origin-scoped**: Browser APIs report quota for our origin, not total disk. Users can override this value.
4. **Firefox/Safari detection**: No `deviceMemory` API. We guess from device type + cores. **Mitigation**: Users can set their actual RAM in Settings.
5. **GH Pages threading**: No `SharedArrayBuffer` without custom headers. Use Cloudflare proxy or WebGPU for faster speeds.
6. **Model loading time**: First load takes 30-60 seconds as WASM compiles and model loads into memory. Cached loads are faster.

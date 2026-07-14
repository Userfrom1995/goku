# Goku - Stage-wise Implementation Plan

## Progress: Stages 1-9 Complete ✅

## Stage 1: Project Scaffold ✅
**Goal**: Working React + Vite + TypeScript project with Tailwind, ready for development.

### Tasks
- [x] Initialize Vite project with React + TypeScript template
- [x] Install and configure Tailwind CSS
- [x] Set up project folder structure (components/, engine/, storage/, hooks/, types/, utils/)
- [x] Create base TypeScript interfaces (Model, ChatMessage, ChatSession, etc.)
- [x] Set up basic App.tsx with layout skeleton (sidebar + main area)
- [x] Configure Vite for GitHub Pages deployment (base path)
- [x] Add GitHub Actions workflow for auto-deploy to GH Pages

### Deliverable
Empty shell app that builds, deploys to GH Pages, and shows a basic two-panel layout.

---

## Stage 2: Storage Layer ✅
**Goal**: Persistent storage for models and chat data that works across browser sessions.

### Tasks
- [x] Implement OPFS storage module with IndexedDB fallback
  - [x] Detect OPFS support (`navigator.storage.getDirectory`)
  - [x] Write/read/delete blob files in OPFS
  - [x] Fall back to IndexedDB `BlobStore` if OPFS unavailable
- [x] Implement chat history store (IndexedDB via `idb` library)
  - [x] Save/load/delete chat sessions
  - [x] Store metadata (model name, timestamps, message count)
  - [x] Load all sessions for sidebar list
- [x] Implement model metadata store (IndexedDB)
  - [x] Save model info (name, repo, file, size, quant, architecture, storage key)
  - [x] List all downloaded models
  - [x] Delete model blob and metadata

### Deliverable
Storage utilities that can save/load/delete model blobs and chat sessions, surviving page reloads.

---

## Stage 3: Engine Integration ✅
**Goal**: wllama loaded and able to run basic inference with a hardcoded model.

### Tasks
- [x] Install `@wllama/wllama` and configure WASM CDN paths
- [x] Create wllama wrapper class
  - [x] `loadModel(url)` — load GGUF from URL
  - [x] `loadModelFromBlob(blob)` — load from stored blob
  - [x] `unloadModel()` — free memory
  - [x] `generate(messages, options)` — run completion with streaming callback
  - [x] `stop()` — interrupt generation

### Deliverable
Can load a model and generate text via a hardcoded test.

---

## Stage 4: HuggingFace Integration ✅
**Goal**: User can paste an HF URL, see model metadata, and download with progress.

### Tasks
- [x] URL parser
  - [x] Parse `namespace/repo` from full HF URL
  - [x] List GGUF files in a repo via API
  - [x] Handle direct GGUF file URLs too
- [x] Metadata reader
  - [x] Fetch GGUF header via Range request (fast)
  - [x] Extract: architecture, quantization, parameter count, context length
  - [x] Display metadata to user before download
- [x] Download manager
  - [x] Download with fetch + progress tracking
  - [x] Stream to OPFS/IndexedDB via storage layer
  - [x] Store model metadata alongside blob
- [x] Token support
  - [x] Optional token input field
  - [x] Pass token as Bearer auth header
  - [x] Handle 403 errors (gated model, token invalid, license not accepted)

### Deliverable
Can paste HF URL, see model info, enter token, and download with a progress bar.

---

## Stage 5: Resource Detection & Manual Override ✅
**Goal**: Check user's machine, warn if model won't fit, let user override settings.

### Tasks
- [x] Auto-detect on page load
  - [x] `navigator.deviceMemory` (Chromium) — returns rounded power of 2
  - [x] `navigator.hardwareConcurrency` — CPU core count
  - [x] `navigator.storage.estimate()` — available storage quota
  - [x] `navigator.gpu` — WebGPU availability
  - [x] Fallback heuristics for Firefox/Safari (mobile=4GB, desktop=4-8GB based on cores)
- [x] Device tier classifier
  - [x] Combine RAM + CPU into low/medium/high tier
  - [x] Suggest max model size per tier
- [x] Settings store (localStorage)
  - [x] Save user overrides: ram, cores, storage, tier
  - [x] Load overrides on page load
  - [x] Reset to auto-detect option
- [x] Settings UI component
  - [x] Display detected values with confidence badge ("detected" vs "estimated")
  - [x] Edit fields for RAM, cores, tier
  - [x] "Reset to Auto" button to clear overrides
  - [x] Persist changes to localStorage
- [x] Pre-download warnings
  - [x] Compare model size against (detected or user-set) RAM and storage
  - [x] Show green "Model will fit" or red "Warning: may not fit" with details

### Deliverable
App detects user capabilities and warns before downloading models that won't fit.

---

## Stage 6: Model Management UI ✅
**Goal**: Full model management — add, select, delete, switch between models.

### Tasks
- [x] Model selector dropdown (top of chat)
  - [x] Show downloaded models with name, size, quant
  - [x] Highlight active model
  - [x] Switch loads/unloads models in wllama
- [x] Add model dialog
  - [x] URL input field
  - [x] Token input field (optional)
  - [x] "Fetch Info" button → list files or show metadata
  - [x] "Download" button → start download with progress
- [x] Download progress component
  - [x] Progress bar with percentage
- [x] Model card component
  - [x] Model name, repo, quant, size, architecture
  - [x] "Use" button to switch to this model
  - [x] "Delete" button to remove with confirmation

### Deliverable
Full model management UI — add models via URL, see them in a list, switch between them, delete them.

---

## Stage 7: Chat Interface ✅
**Goal**: Working chat with streaming responses and generation controls.

### Tasks
- [x] Chat interface layout
  - [x] Message list (scrollable, auto-scroll to bottom)
  - [x] Input area at bottom
  - [x] Send button + Enter key to send
- [x] Message bubble component
  - [x] User message (right-aligned, styled)
  - [x] Assistant message (left-aligned, styled)
  - [x] Streaming text display (token-by-token update)
- [x] Generation settings panel
  - [x] Temperature slider (0-2)
  - [x] Max tokens input
  - [x] Top-p slider
  - [x] Top-k input
  - [x] System prompt textarea
  - [x] Collapsible panel
- [x] Stop generation button
  - [x] Visible during generation
  - [x] Calls `wllama.stop()`
- [x] Empty state
  - [x] Welcome message with "Add Model" button
  - [x] "Select a model" prompt

### Deliverable
Can chat with a loaded model, see streaming responses, adjust generation settings.

---

## Stage 8: Chat History & Sessions ✅
**Goal**: Session management with sidebar, load/save, export/import.

### Tasks
- [x] Sidebar component
  - [x] Session list with timestamps
  - [x] Active session highlighted
  - [x] "New Chat" button
- [x] Session item component
  - [x] Title (first message preview)
  - [x] Message count
  - [x] Timestamp (relative: "2 hours ago")
  - [x] Click to load
  - [x] Delete button with confirmation
- [x] Auto-save
  - [x] Save messages to IndexedDB on each send/receive
- [x] Load session
  - [x] Click session → restore messages to chat
- [x] Export
  - [x] "Export" button per session
  - [x] Download as JSON
- [x] Import
  - [x] "Import" button in sidebar
  - [x] Upload JSON file
  - [x] Create new session from imported data

### Deliverable
Full session management — create, switch, delete, export, import chat histories.

---

## Stage 9: Polish & Error Handling ✅
**Goal**: Production-quality UX with proper error handling and responsive design.

### Tasks
- [x] Error handling
  - [x] Network errors during download
  - [x] Model load failures (out of memory, corrupted file)
  - [x] Generation errors
  - [x] Toast notification system for errors
- [x] Loading states
  - [x] Progress bars for model loading
  - [x] Download progress in model card
- [x] Responsive design
  - [x] Mobile-friendly layout (sidebar collapses)
  - [x] Touch-friendly buttons and inputs
- [x] Keyboard shortcuts
  - [x] Enter to send, Shift+Enter for newline
- [x] Dark theme (default)
- [x] Onboarding
  - [x] First-use welcome message
  - [x] Step-by-step guide: "Download a model → Start chatting"

### Deliverable
Polished, error-resilient app that works well on desktop and mobile.

---

## Stage 10: Deploy & Documentation
**Goal**: Live on GitHub Pages with working CI/CD and documentation.

### Tasks
- [ ] GitHub Actions workflow
  - [ ] Build on push to main
  - [ ] Deploy to gh-pages branch
  - [ ] Cache node_modules for faster builds
- [ ] README.md
  - [ ] Project description and features
  - [ ] Screenshot/demo
  - [ ] Quick start instructions
  - [ ] Model compatibility table
  - [ ] Browser requirements
  - [ ] Cloudflare proxy setup for multi-threading
- [ ] Final testing
  - [ ] Test on Chrome, Firefox, Safari
  - [ ] Test with multiple model sizes
  - [ ] Test download, chat, export, import flow
  - [ ] Test on mobile devices
- [ ] Performance optimization
  - [ ] Lazy load components
  - [ ] Optimize bundle size
  - [ ] Compress WASM files

### Deliverable
Production deployment live on GitHub Pages, fully documented.

---

## Implementation Order

```
Stage 1 (Scaffold)          ← Start here
    ↓
Stage 2 (Storage)           ← Foundation for everything
    ↓
Stage 3 (Engine)            ← Core inference capability
    ↓
Stage 4 (HF Integration)    ← Download models from HuggingFace
    ↓
Stage 5 (Resource Check)    ← Smart warnings before download
    ↓
Stage 6 (Model UI)          ← User-facing model management
    ↓
Stage 7 (Chat UI)           ← Core chat functionality
    ↓
Stage 8 (Chat History)      ← Session persistence
    ↓
Stage 9 (Polish)            ← Production quality
    ↓
Stage 10 (Deploy)           ← Ship it
```

Each stage builds on the previous one. Stages 1-5 are backend/engine work. Stages 6-8 are frontend UI work. Stage 9-10 are polish and deployment.

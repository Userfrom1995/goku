export interface CatalogModel {
  name: string;
  repo: string;
  file: string;
  sizeBytes: number;
  quantization: string;
  architecture: string;
  description: string;
  tier: 'small' | 'medium' | 'large';
  contextLength: number;
}

export const MODEL_CATALOG: CatalogModel[] = [
  {
    name: 'LFM2.5 350M',
    repo: 'LiquidAI/LFM2.5-350M-GGUF',
    file: 'LFM2.5-350M-Q4_K_M.gguf',
    sizeBytes: 229_312_224,
    quantization: 'Q4_K_M',
    architecture: 'lfm',
    description: 'Liquid AI compact model. Tiny and fast.',
    tier: 'small',
    contextLength: 4096,
  },
  {
    name: 'Bonsai 1.7B',
    repo: 'prism-ml/Bonsai-1.7B-gguf',
    file: 'Bonsai-1.7B-Q1_0.gguf',
    sizeBytes: 248_302_272,
    quantization: 'Q1_0',
    architecture: 'bonsai',
    description: 'Prism ML model. Ultra-quantized for minimal size.',
    tier: 'small',
    contextLength: 4096,
  },
  {
    name: 'Gemma 3 270M',
    repo: 'unsloth/gemma-3-270m-it-GGUF',
    file: 'gemma-3-270m-it-Q4_K_M.gguf',
    sizeBytes: 253_115_424,
    quantization: 'Q4_K_M',
    architecture: 'gemma3',
    description: 'Google smallest Gemma. Great for testing.',
    tier: 'small',
    contextLength: 32768,
  },
  {
    name: 'Qwen3 0.6B',
    repo: 'unsloth/Qwen3-0.6B-GGUF',
    file: 'Qwen3-0.6B-Q4_K_M.gguf',
    sizeBytes: 396_705_472,
    quantization: 'Q4_K_M',
    architecture: 'qwen3',
    description: 'Alibaba compact model. Strong for its size.',
    tier: 'small',
    contextLength: 32768,
  },
  {
    name: 'Llama 3.2 1B',
    repo: 'unsloth/Llama-3.2-1B-Instruct-GGUF',
    file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeBytes: 807_694_368,
    quantization: 'Q4_K_M',
    architecture: 'llama',
    description: "Meta's 1B instruct model. Runs on any device.",
    tier: 'medium',
    contextLength: 131072,
  },
  {
    name: 'Granite 4.0 1B',
    repo: 'ibm-granite/granite-4.0-h-1b-GGUF',
    file: 'granite-4.0-h-1b-Q4_K_M.gguf',
    sizeBytes: 901_162_208,
    quantization: 'Q4_K_M',
    architecture: 'granite',
    description: "IBM's enterprise model. Solid reasoning.",
    tier: 'medium',
    contextLength: 131072,
  },
  {
    name: 'Qwen3.5 2B',
    repo: 'unsloth/Qwen3.5-2B-GGUF',
    file: 'Qwen3.5-2B-Q4_K_M.gguf',
    sizeBytes: 1_280_835_840,
    quantization: 'Q4_K_M',
    architecture: 'qwen3',
    description: 'Alibaba 2B model. Great balance of speed and quality.',
    tier: 'medium',
    contextLength: 32768,
  },
  {
    name: 'SmolLM3 3B',
    repo: 'unsloth/SmolLM3-3B-GGUF',
    file: 'SmolLM3-3B-Q4_K_M.gguf',
    sizeBytes: 1_915_306_528,
    quantization: 'Q4_K_M',
    architecture: 'smollm',
    description: 'HuggingFace 3B model. Excellent quality.',
    tier: 'medium',
    contextLength: 65536,
  },
];

export const TIER_INFO = {
  small: { label: 'Small', description: 'Under 500MB, runs on any device', maxRam: 2 },
  medium: { label: 'Medium', description: '500MB-2GB, needs 4GB+ RAM', maxRam: 4 },
  large: { label: 'Large', description: '2GB+, needs 8GB+ RAM', maxRam: 8 },
} as const;

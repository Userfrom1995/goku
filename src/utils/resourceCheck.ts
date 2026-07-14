import type { DeviceCapabilities, DeviceOverrides } from '../types';

const OVERRIDES_KEY = 'goku_device_overrides';

export async function detectDeviceCapabilities(
  overrides?: DeviceOverrides
): Promise<DeviceCapabilities> {
  if (overrides?.ram || overrides?.tier) {
    return {
      ram: overrides.ram ?? guessRAM(),
      storage: overrides.storage ?? (await getStorageQuota()),
      hasWebGPU: !!navigator.gpu,
      tier: overrides.tier ?? 'medium',
      isAutoDetected: false,
    };
  }

  const ram = getDeviceMemory() || guessRAM();
  const storage = await getStorageQuota();
  const hasWebGPU = !!navigator.gpu;
  const tier = classifyDevice(ram);

  return { ram, storage, hasWebGPU, tier, isAutoDetected: true };
}

function getDeviceMemory(): number | undefined {
  const nav = navigator as any;
  if (typeof nav.deviceMemory === 'number') return nav.deviceMemory;
  return undefined;
}

function guessRAM(): number {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/.test(ua)) return 4;
  if (/Windows|Mac|Linux/.test(ua)) return 8;
  return 4;
}

async function getStorageQuota(): Promise<number> {
  try {
    const estimate = await navigator.storage.estimate();
    return Math.floor((estimate.quota || 0) / (1024 * 1024 * 1024));
  } catch {
    return 0;
  }
}

function classifyDevice(ram: number): 'low' | 'medium' | 'high' {
  if (ram <= 2) return 'low';
  if (ram <= 4) return 'medium';
  return 'high';
}

export function loadOverrides(): DeviceOverrides | null {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOverrides(overrides: DeviceOverrides): void {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

export function clearOverrides(): void {
  localStorage.removeItem(OVERRIDES_KEY);
}

export function getRecommendedMaxModelSize(tier: 'low' | 'medium' | 'high'): number {
  switch (tier) {
    case 'low': return 500 * 1024 * 1024;
    case 'medium': return 1500 * 1024 * 1024;
    case 'high': return 2500 * 1024 * 1024;
  }
}

export function checkModelFit(
  modelSizeBytes: number,
  capabilities: DeviceCapabilities
): { fits: boolean; message: string } {
  if (modelSizeBytes <= 0) return { fits: true, message: 'Size unknown' };

  const withBuffer = modelSizeBytes * 1.2;
  const availableBytes = capabilities.storage * 1024 * 1024 * 1024;
  const maxRecommended = getRecommendedMaxModelSize(capabilities.tier);

  if (modelSizeBytes > maxRecommended) {
    const maxGB = (maxRecommended / (1024 * 1024 * 1024)).toFixed(1);
    return {
      fits: false,
      message: `This model (${formatSize(modelSizeBytes)}) exceeds recommended max (${maxGB} GB) for your ${capabilities.tier}-tier device`,
    };
  }

  if (availableBytes > 0 && withBuffer > availableBytes) {
    return {
      fits: false,
      message: `Need ${formatSize(withBuffer)} but only ${formatSize(availableBytes)} storage available`,
    };
  }

  return { fits: true, message: 'Model should work on your device' };
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

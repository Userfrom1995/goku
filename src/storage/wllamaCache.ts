import { CacheManager, type DownloadOptions } from '@wllama/wllama';

export interface CacheProgress {
  loaded: number;
  total: number;
}

export interface WllamaCacheStore {
  download(url: string, options?: DownloadOptions): Promise<void>;
  load(url: string): Promise<Blob | null>;
  loadMultiple(urls: string[]): Promise<Blob[]>;
  delete(url: string): Promise<void>;
  deleteMultiple(urls: string[]): Promise<void>;
  has(url: string): Promise<boolean>;
  getSize(url: string): Promise<number>;
}

let instance: WllamaCacheStore | null = null;
let cacheManager: CacheManager | null = null;

function getCacheManager(): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager();
  }
  return cacheManager;
}

export async function getWllamaCacheStore(): Promise<WllamaCacheStore> {
  if (instance) return instance;

  const cm = getCacheManager();

  instance = {
    async download(url, options) {
      await cm.download(url, options);
    },

    async load(url) {
      return cm.open(url);
    },

    async loadMultiple(urls) {
      const blobs: Blob[] = [];
      for (const url of urls) {
        const blob = await cm.open(url);
        if (blob) blobs.push(blob);
      }
      return blobs;
    },

    async delete(url) {
      await cm.delete(url);
    },

    async deleteMultiple(urls) {
      for (const url of urls) {
        await cm.delete(url);
      }
    },

    async has(url) {
      const size = await cm.getSize(await cm.getNameFromURL(url));
      return size > 0;
    },

    async getSize(url) {
      const name = await cm.getNameFromURL(url);
      return cm.getSize(name);
    },
  };

  return instance;
}

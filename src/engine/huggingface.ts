export interface HuggingFaceFile {
  path: string;
  size: number;
  lfs?: { oid: string; size: number; pointerSize: number };
}

export interface ParsedModelUrl {
  repo: string;
  file?: string;
  baseUrl: string;
}

export function parseHuggingFaceUrl(url: string): ParsedModelUrl {
  const cleaned = url.trim().replace(/\/+$/, '');

  const resolveMatch = cleaned.match(
    /huggingface\.co\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+\.gguf)/i
  );
  if (resolveMatch) {
    return { repo: resolveMatch[1], file: resolveMatch[2], baseUrl: cleaned };
  }

  const repoMatch = cleaned.match(
    /huggingface\.co\/([^/]+\/[^/]+?)(?:\/tree\/[^/]+(?:\/(.+))?)?$/i
  );
  if (repoMatch) {
    return { repo: repoMatch[1], file: repoMatch[2] || undefined, baseUrl: cleaned };
  }

  const bareMatch = cleaned.match(/^([^/]+\/[^/]+)$/);
  if (bareMatch) {
    return { repo: bareMatch[1], baseUrl: `https://huggingface.co/${bareMatch[1]}` };
  }

  throw new Error(`Invalid HuggingFace URL: ${url}`);
}

export async function listGgufFiles(
  repo: string,
  token?: string
): Promise<HuggingFaceFile[]> {
  const url = `https://huggingface.co/api/models/${repo}`;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 403) throw new Error('Access denied. Check your token or accept the model license on HuggingFace.');
    if (res.status === 404) throw new Error(`Repository not found: ${repo}`);
    throw new Error(`Failed to fetch repo info: ${res.status}`);
  }

  const data = await res.json();
  const siblings: Array<{ rfilename: string; size?: number; lfs?: any }> = data.siblings || [];

  return siblings
    .filter(s => s.rfilename.endsWith('.gguf'))
    .map(s => ({
      path: s.rfilename,
      size: s.size ?? s.lfs?.size ?? 0,
      lfs: s.lfs,
    }));
}

export async function getFileSizeFromUrl(
  url: string,
  token?: string
): Promise<number> {
  const headers: Record<string, string> = { Range: 'bytes=0-0' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers, redirect: 'follow' });
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const total = parseInt(contentRange.split('/').pop() || '0', 10);
      if (!isNaN(total) && total > 0) return total;
    }
    const cl = parseInt(res.headers.get('content-length') || '0', 10);
    if (cl > 0) return cl;
  } catch {}
  return 0;
}

export function getDownloadUrl(repo: string, file: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${file}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

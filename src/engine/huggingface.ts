export interface HuggingFaceFile {
  path: string;
  size: number;
  lfs?: { oid: string; size: number; pointerSize: number };
}

export interface GgufFileGroup {
  displayName: string;
  files: HuggingFaceFile[];
  totalSize: number;
  isSharded: boolean;
}

const SHARD_REGEX = /^(.*?)-(\d{5})-of-(\d{5})\.gguf$/;

function parseShardInfo(path: string): { base: string; index: number; total: number } | null {
  const match = path.match(SHARD_REGEX);
  if (!match) return null;
  return { base: match[1], index: parseInt(match[2], 10), total: parseInt(match[3], 10) };
}

export function groupGgufFiles(files: HuggingFaceFile[]): GgufFileGroup[] {
  const shards = new Map<string, HuggingFaceFile[]>();
  const standalone: HuggingFaceFile[] = [];

  for (const file of files) {
    const info = parseShardInfo(file.path);
    if (info) {
      const key = `${info.base}-${info.total}`;
      if (!shards.has(key)) shards.set(key, []);
      shards.get(key)!.push(file);
    } else {
      standalone.push(file);
    }
  }

  const groups: GgufFileGroup[] = [];

  for (const [, shardFiles] of shards) {
    shardFiles.sort((a, b) => a.path.localeCompare(b.path));
    const firstShard = parseShardInfo(shardFiles[0].path);
    const total = firstShard?.total ?? shardFiles.length;
    const displayName = shardFiles[0].path.replace(SHARD_REGEX, `$1 ($total shards)`);
    const totalSize = shardFiles.reduce((sum, f) => sum + f.size, 0);
    groups.push({ displayName, files: shardFiles, totalSize, isSharded: true });
  }

  for (const file of standalone) {
    groups.push({
      displayName: file.path,
      files: [file],
      totalSize: file.size,
      isSharded: false,
    });
  }

  groups.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return groups;
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

export async function listGgufFileGroups(
  repo: string,
  token?: string
): Promise<GgufFileGroup[]> {
  const files = await listGgufFiles(repo, token);
  return groupGgufFiles(files);
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

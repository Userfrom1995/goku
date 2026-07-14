import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { parseHuggingFaceUrl, listGgufFileGroups, getDownloadUrl, formatFileSize, getFileSizeFromUrl, type GgufFileGroup } from '../../engine/huggingface';
import { readGgufMetadata, type GgufMetadata } from '../../engine/gguf';
import { getWllamaCacheStore } from '../../storage/wllamaCache';
import * as db from '../../storage/db';
import { checkModelFit } from '../../utils/resourceCheck';
import type { ModelMetadata, DownloadTask } from '../../types';

interface Props { onClose: () => void }

export default function AddModelDialog({ onClose }: Props) {
  const { state, dispatch, cancelDownload } = useApp();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'input' | 'select' | 'confirm'>('input');
  const [groups, setGroups] = useState<GgufFileGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GgufFileGroup | null>(null);
  const [metadata, setMetadata] = useState<GgufMetadata | null>(null);
  const [error, setError] = useState('');
  const [repo, setRepo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFetchFiles = async () => {
    setError('');
    setLoading(true);
    try {
      const parsed = parseHuggingFaceUrl(url);
      setRepo(parsed.repo);

      if (parsed.file) {
        const group: GgufFileGroup = {
          displayName: parsed.file,
          files: [{ path: parsed.file, size: 0 }],
          totalSize: 0,
          isSharded: false,
        };
        const [meta, size] = await Promise.all([
          readGgufMetadata(getDownloadUrl(parsed.repo, parsed.file), token || undefined),
          getFileSizeFromUrl(getDownloadUrl(parsed.repo, parsed.file), token || undefined),
        ]);
        group.files[0].size = size;
        group.totalSize = size;
        setSelectedGroup(group);
        setMetadata(meta);
        setStep('confirm');
        setLoading(false);
        return;
      }

      const fileGroups = await listGgufFileGroups(parsed.repo, token || undefined);
      if (fileGroups.length === 0) {
        setError('No GGUF files found in this repository');
        setLoading(false);
        return;
      }
      setGroups(fileGroups);
      setStep('select');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSelectGroup = async (group: GgufFileGroup) => {
    setSelectedGroup(group);
    setError('');
    setLoading(true);
    try {
      const firstFile = group.files[0].path;
      const [meta, size] = await Promise.all([
        readGgufMetadata(getDownloadUrl(repo, firstFile), token || undefined),
        group.isSharded
          ? Promise.all(group.files.map(f => getFileSizeFromUrl(getDownloadUrl(repo, f.path), token || undefined)))
              .then(sizes => sizes.reduce((a, b) => a + b, 0))
          : getFileSizeFromUrl(getDownloadUrl(repo, firstFile), token || undefined),
      ]);

      if (group.isSharded) {
        const sizes = await Promise.all(group.files.map(f => getFileSizeFromUrl(getDownloadUrl(repo, f.path), token || undefined)));
        group.files.forEach((f, i) => { f.size = sizes[i]; });
        group.totalSize = sizes.reduce((a, b) => a + b, 0);
      }

      setMetadata(meta);
      setStep('confirm');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!selectedGroup) return;

    const allUrls = selectedGroup.files.map(f => getDownloadUrl(repo, f.path));
    const firstUrl = allUrls[0];
    const modelId = `${repo}/${selectedGroup.files[0].path}`.replace(/[^a-zA-Z0-9]/g, '_');

    const task: DownloadTask = {
      id: crypto.randomUUID(),
      modelId,
      fileName: selectedGroup.displayName,
      repo,
      url: firstUrl,
      token: token || undefined,
      progress: 0,
      status: 'downloading',
      totalBytes: selectedGroup.totalSize,
      receivedBytes: 0,
      metadata: metadata ? {
        architecture: metadata.architecture,
        quantization: metadata.quantization,
        contextLength: metadata.contextLength,
        parameterCount: metadata.parameterCount,
        name: metadata.name,
      } : undefined,
      files: allUrls,
      totalShards: selectedGroup.files.length,
    };

    dispatch({ type: 'ADD_DOWNLOAD', task });
    onClose();

    const abortController = new AbortController();
    (window as any).__gokuAbortControllers = (window as any).__gokuAbortControllers || {};
    (window as any).__gokuAbortControllers[task.id] = abortController;

    (async () => {
      try {
        const cache = await getWllamaCacheStore();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const totalShards = allUrls.length;
        let completedShards = 0;

        for (let i = 0; i < allUrls.length; i++) {
          if (abortController.signal.aborted) break;

          await cache.download(allUrls[i], {
            headers,
            signal: abortController.signal,
            progressCallback: ({ loaded, total }) => {
              if (total > 0) {
                const shardProgress = loaded / total;
                const overallProgress = ((completedShards + shardProgress) / totalShards) * 100;
                const overallLoaded = completedShards * (selectedGroup.totalSize / totalShards) + loaded;
                dispatch({ type: 'UPDATE_DOWNLOAD', id: task.id, update: {
                  progress: Math.round(overallProgress),
                  receivedBytes: Math.round(overallLoaded),
                  totalBytes: selectedGroup.totalSize,
                }});
              }
            },
          });
          completedShards++;
        }

        const modelRecord: ModelMetadata = {
          id: modelId,
          name: metadata?.name || selectedGroup.displayName.replace('.gguf', ''),
          repo,
          file: selectedGroup.files[0].path,
          url: firstUrl,
          sizeBytes: selectedGroup.totalSize,
          quantization: metadata?.quantization || 'unknown',
          architecture: metadata?.architecture || 'unknown',
          contextLength: metadata?.contextLength || 2048,
          totalLayers: metadata?.totalLayers || 0,
          parameterCount: metadata?.parameterCount || 'unknown',
          downloadedAt: Date.now(),
          storageKey: firstUrl,
          files: allUrls,
          totalShards: selectedGroup.files.length,
        };

        await db.saveModel(modelRecord);
        dispatch({ type: 'ADD_MODEL', model: modelRecord });
        dispatch({ type: 'UPDATE_DOWNLOAD', id: task.id, update: { status: 'done', progress: 100 } });

        setTimeout(() => dispatch({ type: 'REMOVE_DOWNLOAD', id: task.id }), 3000);
      } catch (err: any) {
        dispatch({ type: 'UPDATE_DOWNLOAD', id: task.id, update: { status: 'error', error: err.message } });
      }
    })();
  };

  const totalSize = selectedGroup?.totalSize || 0;
  const fitCheck = totalSize > 0 ? checkModelFit(totalSize, state.device) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Add Model</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg">x</button>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">
            {step === 'input' && 'Paste a HuggingFace URL or namespace/repo'}
            {step === 'select' && 'Select a GGUF model to download'}
            {step === 'confirm' && 'Review model details before downloading'}
          </p>
        </div>

        <div className="px-6 py-4">
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">HuggingFace URL or repo</label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && url.trim() && handleFetchFiles()}
                  placeholder="e.g. TheBloke/Llama-2-7B-Chat-GGUF"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-600"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">HF Token <span className="text-zinc-600">(optional, for gated models)</span></label>
                <input
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  type="password"
                  placeholder="hf_..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-600"
                />
              </div>
              {error && (
                <div className="px-3 py-2 bg-red-600/10 border border-red-600/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}
              <button
                onClick={handleFetchFiles}
                disabled={!url.trim() || loading}
                className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {loading ? 'Fetching...' : 'Fetch Model Info'}
              </button>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-3">
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {groups.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectGroup(g)}
                    className="w-full text-left px-3 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors"
                  >
                    <span className="text-sm text-zinc-300 block truncate">{g.displayName}</span>
                    <span className="text-xs text-zinc-500">
                      {g.totalSize > 0 ? formatFileSize(g.totalSize) : 'size unknown'}
                      {g.isSharded && ` (${g.files.length} shards)`}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('input')} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                {'<- Back'}
              </button>
            </div>
          )}

          {step === 'confirm' && metadata && selectedGroup && (
            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Architecture</span>
                  <span className="text-zinc-200 font-mono">{metadata.architecture}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Quantization</span>
                  <span className="text-zinc-200 font-mono">{metadata.quantization}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Context Length</span>
                  <span className="text-zinc-200">{metadata.contextLength.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Parameters</span>
                  <span className="text-zinc-200">{metadata.parameterCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Total Size</span>
                  <span className="text-zinc-200">{totalSize > 0 ? formatFileSize(totalSize) : 'unknown'}</span>
                </div>
                {selectedGroup.isSharded && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Shards</span>
                    <span className="text-zinc-200">{selectedGroup.files.length} files</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">File</span>
                  <span className="text-zinc-200 font-mono text-xs truncate max-w-[60%]">{selectedGroup.displayName}</span>
                </div>
              </div>

              {fitCheck && !fitCheck.fits && (
                <div className="px-3 py-2.5 bg-amber-600/10 border border-amber-600/20 rounded-lg text-sm text-amber-400">
                  {fitCheck.message}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep('select')} className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-300 transition-colors">
                  Back
                </button>
                <button onClick={handleDownload} className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors">
                  Download
                </button>
              </div>
            </div>
          )}
        </div>

        {step !== 'confirm' && (
          <div className="px-6 pb-4">
            <button onClick={onClose} className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

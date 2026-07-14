import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { parseHuggingFaceUrl, listGgufFiles, getDownloadUrl, formatFileSize, getFileSizeFromUrl } from '../../engine/huggingface';
import { readGgufMetadata, type GgufMetadata } from '../../engine/gguf';
import { getWllamaCacheStore } from '../../storage/wllamaCache';
import * as db from '../../storage/db';
import { checkModelFit } from '../../utils/resourceCheck';
import type { ModelMetadata, DownloadTask } from '../../types';

interface Props { onClose: () => void }

export default function AddModelDialog({ onClose }: Props) {
  const { state, dispatch } = useApp();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'input' | 'select' | 'confirm'>('input');
  const [ggufFiles, setGgufFiles] = useState<{ path: string; size: number }[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [metadata, setMetadata] = useState<GgufMetadata | null>(null);
  const [fileSize, setFileSize] = useState(0);
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
        setSelectedFile(parsed.file);
        const [meta, size] = await Promise.all([
          readGgufMetadata(getDownloadUrl(parsed.repo, parsed.file), token || undefined),
          getFileSizeFromUrl(getDownloadUrl(parsed.repo, parsed.file), token || undefined),
        ]);
        setMetadata(meta);
        setFileSize(size);
        setStep('confirm');
        setLoading(false);
        return;
      }

      const files = await listGgufFiles(parsed.repo, token || undefined);
      if (files.length === 0) {
        setError('No GGUF files found in this repository');
        setLoading(false);
        return;
      }
      setGgufFiles(files);
      setStep('select');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSelectFile = async (file: string) => {
    setSelectedFile(file);
    setError('');
    setLoading(true);
    try {
      const [meta, size] = await Promise.all([
        readGgufMetadata(getDownloadUrl(repo, file), token || undefined),
        getFileSizeFromUrl(getDownloadUrl(repo, file), token || undefined),
      ]);
      setMetadata(meta);
      setFileSize(size);
      setStep('confirm');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDownload = async () => {
    const downloadUrl = getDownloadUrl(repo, selectedFile);
    const modelId = `${repo}/${selectedFile}`.replace(/[^a-zA-Z0-9]/g, '_');

    const task: DownloadTask = {
      id: crypto.randomUUID(),
      modelId,
      fileName: selectedFile,
      repo,
      url: downloadUrl,
      token: token || undefined,
      progress: 0,
      status: 'downloading',
      totalBytes: fileSize,
      receivedBytes: 0,
      metadata: metadata ? {
        architecture: metadata.architecture,
        quantization: metadata.quantization,
        contextLength: metadata.contextLength,
        parameterCount: metadata.parameterCount,
        name: metadata.name,
      } : undefined,
    };

    dispatch({ type: 'ADD_DOWNLOAD', task });
    onClose();

    // Background download using CacheManager (streaming, no memory buffer)
    (async () => {
      try {
        const cache = await getWllamaCacheStore();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await cache.download(downloadUrl, {
          headers,
          progressCallback: ({ loaded, total }) => {
            if (total > 0) {
              dispatch({ type: 'UPDATE_DOWNLOAD', id: task.id, update: {
                progress: Math.round((loaded / total) * 100),
                receivedBytes: loaded,
                totalBytes: total,
              }});
            }
          },
        });

        const modelRecord: ModelMetadata = {
          id: modelId,
          name: metadata?.name || selectedFile.replace('.gguf', ''),
          repo,
          file: selectedFile,
          url: downloadUrl,
          sizeBytes: fileSize,
          quantization: metadata?.quantization || 'unknown',
          architecture: metadata?.architecture || 'unknown',
          contextLength: metadata?.contextLength || 2048,
          parameterCount: metadata?.parameterCount || 'unknown',
          downloadedAt: Date.now(),
          storageKey: downloadUrl, // Use URL as storage key for CacheManager
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

  const totalSize = metadata ? (fileSize || ggufFiles.find(f => f.path === selectedFile)?.size || 0) : 0;
  const fitCheck = totalSize > 0 ? checkModelFit(totalSize, state.device) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Add Model</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg">×</button>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">
            {step === 'input' && 'Paste a HuggingFace URL or namespace/repo'}
            {step === 'select' && 'Select a GGUF file to download'}
            {step === 'confirm' && 'Review model details before downloading'}
          </p>
        </div>

        {/* Body */}
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
                {ggufFiles.map(f => (
                  <button
                    key={f.path}
                    onClick={() => handleSelectFile(f.path)}
                    className="w-full text-left px-3 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors"
                  >
                    <span className="text-sm text-zinc-300 block truncate">{f.path}</span>
                    <span className="text-xs text-zinc-500">{f.size > 0 ? formatFileSize(f.size) : 'size unknown'}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('input')} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                ← Back
              </button>
            </div>
          )}

          {step === 'confirm' && metadata && (
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
                  <span className="text-zinc-500">File Size</span>
                  <span className="text-zinc-200">{totalSize > 0 ? formatFileSize(totalSize) : 'unknown'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">File</span>
                  <span className="text-zinc-200 font-mono text-xs truncate max-w-[60%]">{selectedFile}</span>
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

        {/* Footer */}
        {step !== 'confirm' && (
          <div className="px-6 pb-4">
            <button onClick={onClose} className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

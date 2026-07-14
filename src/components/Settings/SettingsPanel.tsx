import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { saveOverrides, clearOverrides, detectDeviceCapabilities } from '../../utils/resourceCheck';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const { device } = state;
  const [ram, setRam] = useState(String(device.ram));
  const [tier, setTier] = useState(device.tier);

  const handleSave = async () => {
    const overrides = { ram: parseInt(ram) || undefined, tier };
    saveOverrides(overrides);
    const updated = await detectDeviceCapabilities(overrides);
    dispatch({ type: 'SET_DEVICE', device: updated });
  };

  const handleReset = async () => {
    clearOverrides();
    const detected = await detectDeviceCapabilities();
    dispatch({ type: 'SET_DEVICE', device: detected });
    setRam(String(detected.ram));
    setTier(detected.tier);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg">×</button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Device */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-300">Device</h3>
              <span className="text-xs text-zinc-600">
                {device.isAutoDetected ? 'Auto-detected' : 'Custom values'}
              </span>
            </div>

            {/* RAM */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">RAM (GB)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={device.ramDetected ? device.ram : 128}
                  value={ram}
                  onChange={e => setRam(e.target.value)}
                  className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-violet-600/50"
                />
                <span className="text-xs text-zinc-600">GB</span>
              </div>
              {device.isAutoDetected && device.ramDetected && (
                <p className="text-xs text-emerald-500/70 mt-1">Chromium detected {device.ram} GB. Do not exceed.</p>
              )}
              {device.isAutoDetected && !device.ramDetected && (
                <p className="text-xs text-amber-500/70 mt-1">Detection failed (non-Chromium). Using default {device.ram} GB.</p>
              )}
              {!device.isAutoDetected && (
                <p className="text-xs text-amber-500/70 mt-1">Manual override active</p>
              )}
            </div>

            {/* Tier */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Device Tier</label>
              <select
                value={tier}
                onChange={e => setTier(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-600/50"
              >
                <option value="low">Low (≤2 GB)</option>
                <option value="medium">Medium (3–4 GB)</option>
                <option value="high">High (≥8 GB)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors">
                Save
              </button>
              <button onClick={handleReset} className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-400 transition-colors">
                Reset to Auto
              </button>
            </div>
          </div>

          {/* System Info */}
          <div className="p-3 bg-zinc-800/50 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">WebGPU</span>
              <span className={device.hasWebGPU ? 'text-emerald-400' : 'text-zinc-600'}>
                {device.hasWebGPU ? 'Available' : 'Not available'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Browser Storage Cap</span>
              <span className="text-zinc-400">{device.storage} GB</span>
            </div>
            <p className="text-xs text-zinc-600">Max storage the browser allows this site to use. Not adjustable.</p>
          </div>
        </div>

        <div className="px-6 pb-4">
          <button onClick={onClose} className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Activity, 
  Cpu, 
  HardDrive,
  AlertCircle,
  CheckCircle,
  XCircle,
  Terminal,
  Layers,
  Box,
  Film,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Types
interface VRAMStatus {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  percentUsed: number;
  timestamp: number;
}

interface ComfyHealth {
  status: 'starting' | 'healthy' | 'unhealthy' | 'stopped' | 'crashed';
  uptime: number;
  lastResponse: number;
  queueDepth: number;
  vram: VRAMStatus;
  loadedModels: string[];
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

interface ArtifactStatus {
  id: string;
  name: string;
  hasCanonical: boolean;
  has3D: boolean;
  appearances: number;
  avgDrift: number;
}

interface QueueStatus {
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}

export default function FilmBridgeDashboard() {
  const [comfyStatus, setComfyStatus] = useState<ComfyHealth | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactStatus[]>([]);
  const [queue, setQueue] = useState<QueueStatus>({ pending: 0, inProgress: 0, completed: 0, failed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'artifacts' | 'queue' | 'logs' | 'settings'>('overview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['vram', 'models']));
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Poll for updates
  useEffect(() => {
    const poll = async () => {
      try {
        const [statusRes, queueRes, artifactsRes] = await Promise.all([
          fetch('/api/film-bridge/status'),
          fetch('/api/film-bridge/queue'),
          fetch('/api/film-bridge/artifacts'),
        ]);

        if (statusRes.ok) setComfyStatus(await statusRes.json());
        if (queueRes.ok) setQueue(await queueRes.json());
        if (artifactsRes.ok) setArtifacts(await artifactsRes.json());
      } catch (error) {
        console.error('Poll error:', error);
      }
      setIsLoading(false);
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for real-time logs
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/api/film-bridge/ws`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setLogs(prev => [...prev.slice(-100), {
          timestamp: new Date().toISOString(),
          level: data.level,
          message: data.message,
        }]);
      }
    };

    return () => ws.close();
  }, []);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await fetch('/api/film-bridge/start', { method: 'POST' });
      addLog('ComfyUI start requested', 'info');
    } catch (error) {
      addLog(`Start failed: ${error}`, 'error');
    }
    setIsStarting(false);
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await fetch('/api/film-bridge/stop', { method: 'POST' });
      addLog('ComfyUI stop requested', 'info');
    } catch (error) {
      addLog(`Stop failed: ${error}`, 'error');
    }
    setIsStopping(false);
  };

  const handleRestart = async () => {
    try {
      await fetch('/api/film-bridge/restart', { method: 'POST' });
      addLog('ComfyUI restart requested', 'info');
    } catch (error) {
      addLog(`Restart failed: ${error}`, 'error');
    }
  };

  const addLog = (message: string, level: LogEntry['level']) => {
    setLogs(prev => [...prev.slice(-100), {
      timestamp: new Date().toISOString(),
      level,
      message,
    }]);
  };

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    setExpandedSections(next);
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'starting': return 'text-yellow-400';
      case 'unhealthy': return 'text-orange-400';
      case 'crashed': return 'text-red-400';
      case 'stopped': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'starting': return <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin" />;
      case 'unhealthy': return <AlertCircle className="w-5 h-5 text-orange-400" />;
      case 'crashed': return <XCircle className="w-5 h-5 text-red-400" />;
      case 'stopped': return <Square className="w-5 h-5 text-gray-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Connecting to Film Bridge...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Film Bridge | Production Dashboard</title>
      </Head>

      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Film className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Film Bridge</h1>
                  <p className="text-sm text-gray-400">Production Dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* ComfyUI Status */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg">
                  {getStatusIcon(comfyStatus?.status || 'stopped')}
                  <span className={`font-medium ${getStatusColor(comfyStatus?.status || 'stopped')}`}>
                    {comfyStatus?.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  {(comfyStatus?.uptime ?? 0) > 0 && (
                    <span className="text-gray-500 text-sm">
                      ({formatDuration(comfyStatus?.uptime ?? 0)})
                    </span>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex gap-2">
                  {comfyStatus?.status === 'stopped' ? (
                    <button
                      onClick={handleStart}
                      disabled={isStarting}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      {isStarting ? 'Starting...' : 'Start ComfyUI'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleRestart}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Restart
                      </button>
                      <button
                        onClick={handleStop}
                        disabled={isStopping}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        <Square className="w-4 h-4" />
                        {isStopping ? 'Stopping...' : 'Stop'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex gap-6 mt-4">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'artifacts', label: 'Artifacts', icon: Box },
                { id: 'queue', label: 'Queue', icon: Layers },
                { id: 'logs', label: 'Logs', icon: Terminal },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 pb-2 border-b-2 transition-colors ${
                    activeTab === id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* VRAM Monitor */}
              <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800">
                <button
                  onClick={() => toggleSection('vram')}
                  className="w-full flex items-center justify-between p-4 border-b border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-blue-400" />
                    <h2 className="font-semibold">VRAM Usage</h2>
                  </div>
                  {expandedSections.has('vram') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                
                {expandedSections.has('vram') && (
                  <div className="p-4">
                    {comfyStatus?.vram ? (
                      <>
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <span className="text-3xl font-bold">
                              {(comfyStatus.vram.usedMB / 1024).toFixed(1)}
                            </span>
                            <span className="text-gray-400 ml-1">/ {(comfyStatus.vram.totalMB / 1024).toFixed(1)} GB</span>
                          </div>
                          <span className={`text-2xl font-bold ${
                            comfyStatus.vram.percentUsed > 90 ? 'text-red-400' :
                            comfyStatus.vram.percentUsed > 75 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {comfyStatus.vram.percentUsed.toFixed(1)}%
                          </span>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              comfyStatus.vram.percentUsed > 90 ? 'bg-red-500' :
                              comfyStatus.vram.percentUsed > 75 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(comfyStatus.vram.percentUsed, 100)}%` }}
                          />
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                          <div className="p-3 bg-gray-800 rounded-lg">
                            <div className="text-sm text-gray-400">Used</div>
                            <div className="font-mono">{(comfyStatus.vram.usedMB / 1024).toFixed(2)} GB</div>
                          </div>
                          <div className="p-3 bg-gray-800 rounded-lg">
                            <div className="text-sm text-gray-400">Free</div>
                            <div className="font-mono">{(comfyStatus.vram.freeMB / 1024).toFixed(2)} GB</div>
                          </div>
                          <div className="p-3 bg-gray-800 rounded-lg">
                            <div className="text-sm text-gray-400">Limit</div>
                            <div className="font-mono">18 GB</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-500 text-center py-8">
                        <Cpu className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>ComfyUI not running</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Queue Stats */}
              <div className="bg-gray-900 rounded-xl border border-gray-800">
                <div className="flex items-center gap-3 p-4 border-b border-gray-800">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <h2 className="font-semibold">Queue Status</h2>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <span className="text-yellow-400">Pending</span>
                    <span className="text-2xl font-bold">{queue.pending}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <span className="text-blue-400">In Progress</span>
                    <span className="text-2xl font-bold">{queue.inProgress}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <span className="text-green-400">Completed</span>
                    <span className="text-2xl font-bold">{queue.completed}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <span className="text-red-400">Failed</span>
                    <span className="text-2xl font-bold">{queue.failed}</span>
                  </div>
                </div>
              </div>

              {/* Loaded Models */}
              <div className="lg:col-span-3 bg-gray-900 rounded-xl border border-gray-800">
                <button
                  onClick={() => toggleSection('models')}
                  className="w-full flex items-center justify-between p-4 border-b border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-green-400" />
                    <h2 className="font-semibold">Loaded Models</h2>
                    <span className="px-2 py-1 bg-gray-800 rounded text-sm">
                      {comfyStatus?.loadedModels.length || 0}
                    </span>
                  </div>
                  {expandedSections.has('models') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                
                {expandedSections.has('models') && (
                  <div className="p-4">
                    {comfyStatus?.loadedModels && comfyStatus.loadedModels.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {comfyStatus.loadedModels.map((model, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-gray-800 rounded text-sm">
                            <Box className="w-4 h-4 text-blue-400" />
                            <span className="truncate">{model}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-center py-8">
                        <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>No models loaded</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recent Logs Preview */}
              <div className="lg:col-span-3 bg-gray-900 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-gray-400" />
                    <h2 className="font-semibold">Recent Logs</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('logs')}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    View All
                  </button>
                </div>
                <div className="p-4 max-h-48 overflow-y-auto font-mono text-sm">
                  {logs.slice(-10).map((log, i) => (
                    <div key={i} className="flex gap-3 py-1">
                      <span className="text-gray-500 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warning' ? 'text-yellow-400' :
                        log.level === 'success' ? 'text-green-400' :
                        'text-gray-300'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-gray-500 text-center py-4">No logs yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ARTIFACTS TAB */}
          {activeTab === 'artifacts' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="font-semibold">Production Artifacts</h2>
                <button 
                  onClick={() => window.open('/film-bridge/artifacts/new', '_blank')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
                >
                  + Register Artifact
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Name</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Canonical</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">3D Model</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Appearances</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Avg Drift</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artifacts.map((artifact) => (
                      <tr key={artifact.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{artifact.name}</div>
                          <div className="text-sm text-gray-500">{artifact.id}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {artifact.hasCanonical ? (
                            <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-600 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {artifact.has3D ? (
                            <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-600 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 bg-gray-800 rounded text-sm">
                            {artifact.appearances}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm ${
                            artifact.avgDrift > 0.3 ? 'text-red-400' :
                            artifact.avgDrift > 0.15 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {(artifact.avgDrift * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-blue-400 hover:text-blue-300 text-sm">
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                    {artifacts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          <Box className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p>No artifacts registered yet</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* QUEUE TAB */}
          {activeTab === 'queue' && (
            <div className="space-y-6">
              {/* Queue Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 text-center">
                  <div className="text-3xl font-bold text-yellow-400">{queue.pending}</div>
                  <div className="text-gray-400 mt-1">Pending</div>
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 text-center">
                  <div className="text-3xl font-bold text-blue-400">{queue.inProgress}</div>
                  <div className="text-gray-400 mt-1">In Progress</div>
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 text-center">
                  <div className="text-3xl font-bold text-green-400">{queue.completed}</div>
                  <div className="text-gray-400 mt-1">Completed</div>
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 text-center">
                  <div className="text-3xl font-bold text-red-400">{queue.failed}</div>
                  <div className="text-gray-400 mt-1">Failed</div>
                </div>
              </div>

              {/* Active Jobs */}
              <div className="bg-gray-900 rounded-xl border border-gray-800">
                <div className="p-4 border-b border-gray-800">
                  <h2 className="font-semibold">Active Jobs</h2>
                </div>
                <div className="p-4">
                  <p className="text-gray-500 text-center py-8">
                    Job queue visualization coming soon...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-gray-400" />
                  <h2 className="font-semibold">System Logs</h2>
                </div>
                <button
                  onClick={() => setLogs([])}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <div className="p-4 h-[600px] overflow-y-auto font-mono text-sm">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 py-1 border-b border-gray-800/50">
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`uppercase text-xs px-1.5 py-0.5 rounded ${
                      log.level === 'error' ? 'bg-red-900/50 text-red-400' :
                      log.level === 'warning' ? 'bg-yellow-900/50 text-yellow-400' :
                      log.level === 'success' ? 'bg-green-900/50 text-green-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {log.level}
                    </span>
                    <span className={`${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warning' ? 'text-yellow-400' :
                      log.level === 'success' ? 'text-green-400' :
                      'text-gray-300'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-gray-500 text-center py-12">
                    <Terminal className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No logs yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-xl font-semibold mb-6">Service Configuration</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    ComfyUI Directory
                  </label>
                  <input
                    type="text"
                    value="C:\Users\alexw\Downloads\USE_THIS_COMFY\ComfyUI_windows_portable\ComfyUI"
                    readOnly
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    API Port
                  </label>
                  <input
                    type="number"
                    value="8188"
                    readOnly
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    VRAM Limit (GB)
                  </label>
                  <input
                    type="number"
                    value="18"
                    readOnly
                    className="w-full px-4 py-2 bg-gray-800 rounded-lg text-gray-400"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Leave 2GB headroom on your 20GB RTX A4500
                  </p>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-gray-800">
                  <div>
                    <div className="font-medium">Aggressive Model Unloading</div>
                    <div className="text-sm text-gray-400">
                      Free VRAM between jobs
                    </div>
                  </div>
                  <div className="w-12 h-6 bg-green-600 rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-gray-800">
                  <div>
                    <div className="font-medium">Auto-Restart on Crash</div>
                    <div className="text-sm text-gray-400">
                      Max 3 retry attempts
                    </div>
                  </div>
                  <div className="w-12 h-6 bg-green-600 rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

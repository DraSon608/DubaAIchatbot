import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  SquarePen,
  ChevronDown,
  Sparkles,
  Cpu,
  Cloud,
  Check,
  Share2,
  Radio,
  Wifi,
  WifiOff,
  Flame,
  Code2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { ModelMode, NetworkConnectionType } from '../types/chat';
import { translations } from '../services/translations';
import { BhutanFlagLogo } from './BhutanFlagLogo';

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  title: string;
  modelMode: ModelMode;
  onChangeModelMode: (mode: ModelMode) => void;
  isOnline: boolean;
  connectionType?: NetworkConnectionType;
  effectiveType?: string;
  pingMs?: number | null;
  connectionLabel?: string;
  forceOffline: boolean;
  onToggleForceOffline: () => void;
  autoInterpretOnline: boolean;
  onToggleAutoInterpret: () => void;
  onRefreshConnectivity?: () => void;
  isRefreshingPing?: boolean;
  onNewChat: () => void;
  onOpenSandbox: () => void;
  onOpenAutomation: () => void;
  onExportMarkdown: () => void;
  language: 'en' | 'dz';
  onToggleLanguage: () => void;
  isTemporaryChat?: boolean;
  onToggleTemporaryChat?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  title,
  modelMode,
  onChangeModelMode,
  isOnline,
  connectionType = 'unknown',
  effectiveType,
  pingMs,
  forceOffline,
  onToggleForceOffline,
  autoInterpretOnline,
  onToggleAutoInterpret,
  onRefreshConnectivity,
  isRefreshingPing = false,
  onNewChat,
  onOpenSandbox,
  onOpenAutomation,
  onExportMarkdown,
  language,
  onToggleLanguage,
  isTemporaryChat = false,
  onToggleTemporaryChat,
}) => {
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const t = translations[language];

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setShowModelMenu(false);
      }
      if (
        networkDropdownRef.current &&
        !networkDropdownRef.current.contains(e.target as Node)
      ) {
        setShowNetworkMenu(false);
      }
    };

    if (showModelMenu || showNetworkMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelMenu, showNetworkMenu]);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-white/5 bg-[#212121]/95 px-3 sm:px-4 backdrop-blur-md">
      {/* Left: Sidebar Toggle, New Chat, Model Selector & Network Badge */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Sidebar Toggle Icon */}
        <button
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Close sidebar (Ctrl+B)' : 'Open sidebar (Ctrl+B)'}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </button>

        {/* New Chat Icon Button (visible when sidebar is closed) */}
        {!sidebarOpen && (
          <button
            onClick={onNewChat}
            title="New Chat (Ctrl+K)"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        )}

        {/* ChatGPT Style Model Selector Dropdown */}
        <div className="relative" ref={modelDropdownRef}>
          <button
            onClick={() => {
              setShowModelMenu((prev) => !prev);
              setShowNetworkMenu(false);
            }}
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-slate-200 hover:bg-white/10 transition"
          >
            <span className="flex items-center gap-2">
              <span className="font-bold text-white">Duba AI</span>
              <span className="flex items-center gap-1 text-xs font-normal text-slate-300">
                <span
                  className={`h-2 w-2 rounded-full ${
                    modelMode === 'offline' || forceOffline || !isOnline
                      ? 'bg-amber-400'
                      : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                <span>{modelMode === 'offline' || forceOffline || !isOnline ? 'Offline' : 'Online'}</span>
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {/* Model Selection Menu */}
          {showModelMenu && (
            <div className="absolute top-11 left-0 z-50 w-72 rounded-2xl border border-white/10 bg-[#212121] p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Intelligence Engine
              </div>

              {/* Online Mode */}
              <button
                onClick={() => {
                  onChangeModelMode('cloud');
                  if (forceOffline) onToggleForceOffline();
                  setShowModelMenu(false);
                }}
                className={`flex w-full items-start justify-between rounded-xl p-2.5 text-left transition ${
                  modelMode !== 'offline' && !forceOffline
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <Cloud className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Duba Online Mode</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Fast cloud reasoning with sub-second streaming answers like ChatGPT.
                  </p>
                </div>
                {modelMode !== 'offline' && !forceOffline && (
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
              </button>

              {/* Offline Core */}
              <button
                onClick={() => {
                  onChangeModelMode('offline');
                  setShowModelMenu(false);
                }}
                className={`flex w-full items-start justify-between rounded-xl p-2.5 text-left transition ${
                  modelMode === 'offline' || forceOffline
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <Cpu className="h-3.5 w-3.5 text-amber-400" />
                    <span>Duba Offline Core</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    100% on-device neural edge execution without internet.
                  </p>
                </div>
                {(modelMode === 'offline' || forceOffline) && (
                  <Check className="h-4 w-4 text-amber-400 shrink-0" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Dedicated Interactive Network & Online Status Badge */}
        <div className="relative" ref={networkDropdownRef}>
          <button
            onClick={() => {
              setShowNetworkMenu((prev) => !prev);
              setShowModelMenu(false);
            }}
            title="Manage Online & Network Connection"
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition ${
              isOnline && !forceOffline
                ? connectionType === 'cellular'
                  ? 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-950/60'
                  : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/60'
                : 'border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-950/60'
            }`}
          >
            {isOnline && !forceOffline ? (
              connectionType === 'cellular' ? (
                <>
                  <Radio className="h-3 w-3 text-cyan-400 animate-pulse" />
                  <span className="font-mono hidden sm:inline">
                    Mobile ({effectiveType || '4G'})
                  </span>
                  <span className="font-mono sm:hidden">4G/5G</span>
                  {pingMs !== null && (
                    <span className="text-[10px] text-cyan-400/80 font-mono">
                      {pingMs}ms
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Wifi className="h-3 w-3 text-emerald-400" />
                  <span className="font-mono hidden sm:inline">Wi-Fi Online</span>
                  <span className="font-mono sm:hidden">Wi-Fi</span>
                  {pingMs !== null && (
                    <span className="text-[10px] text-emerald-400/80 font-mono">
                      {pingMs}ms
                    </span>
                  )}
                </>
              )
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-amber-400" />
                <span className="font-mono">Offline Core</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
          </button>

          {/* Quick Network Manager Popover */}
          {showNetworkMenu && (
            <div className="absolute top-10 left-0 z-50 w-72 rounded-2xl border border-white/10 bg-[#212121] p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  Online Connection Manager
                </span>
                {onRefreshConnectivity && (
                  <button
                    onClick={() => onRefreshConnectivity()}
                    title="Test ping / reconnect"
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition p-1 rounded"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshingPing ? 'animate-spin text-amber-400' : ''}`} />
                    <span>Ping</span>
                  </button>
                )}
              </div>

              {/* Status details */}
              <div className="rounded-xl bg-[#171717] p-2.5 mb-2.5 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Medium:</span>
                  <span className="text-white font-medium">
                    {connectionType === 'cellular'
                      ? `Mobile Data (${effectiveType ? effectiveType.toUpperCase() : '4G/5G'})`
                      : connectionType === 'wifi'
                      ? 'Wi-Fi Network'
                      : 'Local Device'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Status:</span>
                  <span className={isOnline && !forceOffline ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                    {isOnline && !forceOffline ? 'Online (Gemini Cloud)' : 'Offline Core'}
                  </span>
                </div>
                {pingMs !== null && (
                  <div className="flex justify-between items-center font-mono text-[11px]">
                    <span className="text-slate-400">Latency:</span>
                    <span className="text-slate-200">{pingMs}ms</span>
                  </div>
                )}
              </div>

              {/* Auto-Connect Toggle Switch */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 mb-2.5">
                <div className="space-y-0.5 max-w-[190px]">
                  <div className="text-xs font-semibold text-white">
                    Auto-Connect to Online
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    Automatically connects to Cloud when Wi-Fi or mobile data is present.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoInterpretOnline}
                    onChange={onToggleAutoInterpret}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    if (forceOffline) onToggleForceOffline();
                    onChangeModelMode('cloud');
                    setShowNetworkMenu(false);
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-[11px] font-semibold text-center transition"
                >
                  Force Online
                </button>
                <button
                  onClick={() => {
                    if (!forceOffline) onToggleForceOffline();
                    setShowNetworkMenu(false);
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-[11px] font-medium text-center transition"
                >
                  Test Offline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Conversation Title preview */}
      <div className="hidden md:flex items-center gap-2 max-w-[280px] lg:max-w-[340px] truncate text-xs text-slate-400">
        <span className="truncate">{title}</span>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Temporary Chat Toggle (ChatGPT style) */}
        {onToggleTemporaryChat && (
          <button
            onClick={onToggleTemporaryChat}
            title={
              isTemporaryChat
                ? 'Temporary Chat active: History is not saved. Click to disable.'
                : 'Enable Temporary Chat (incognito, won\'t appear in history)'
            }
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
              isTemporaryChat
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Flame className={`h-3.5 w-3.5 ${isTemporaryChat ? 'fill-amber-400' : ''}`} />
            <span className="hidden sm:inline">
              {isTemporaryChat ? 'Temporary' : 'Temp'}
            </span>
          </button>
        )}

        {/* Bhutanese Dzongkha / English Toggle */}
        <button
          onClick={onToggleLanguage}
          title={t.languageToggle}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 transition"
        >
          <BhutanFlagLogo size="xs" />
          <span className="font-semibold">{language === 'dz' ? 'རྫོང་ཁ' : 'EN'}</span>
        </button>

        {/* Export / Share Conversation */}
        <button
          onClick={onExportMarkdown}
          title="Export conversation as Markdown"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          <Share2 className="h-4 w-4" />
        </button>

        {/* Code Sandbox shortcut */}
        <button
          onClick={onOpenSandbox}
          title="Open Code Sandbox"
          className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          <Code2 className="h-4 w-4 text-indigo-400" />
        </button>
      </div>
    </header>
  );
};

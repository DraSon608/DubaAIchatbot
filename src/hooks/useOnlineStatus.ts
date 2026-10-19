import { useEffect, useState, useCallback, useRef } from 'react';
import { ApiService } from '../services/api';
import { NetworkConnectionType, NetworkTelemetry } from '../types/chat';

interface UseOnlineStatusOptions {
  forceOffline?: boolean;
  autoInterpretOnline?: boolean;
  onConnectionChange?: (telemetry: NetworkTelemetry) => void;
}

export function useOnlineStatus({
  forceOffline = false,
  autoInterpretOnline = true,
  onConnectionChange,
}: UseOnlineStatusOptions = {}) {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [connectionType, setConnectionType] = useState<NetworkConnectionType>('unknown');
  const [effectiveType, setEffectiveType] = useState<string | undefined>(undefined);
  const [downlinkMbps, setDownlinkMbps] = useState<number | undefined>(undefined);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const prevOnlineRef = useRef<boolean | null>(null);

  // Helper to inspect NetworkInformation API
  const inspectNetworkMedium = useCallback((): {
    type: NetworkConnectionType;
    effectiveType?: string;
    downlink?: number;
  } => {
    if (typeof navigator === 'undefined') {
      return { type: 'unknown' };
    }

    if (!navigator.onLine) {
      return { type: 'none' };
    }

    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!conn) {
      return { type: 'wifi' }; // Standard fallback default for online browsers
    }

    const rawType = conn.type as string | undefined;
    const effType = conn.effectiveType as string | undefined;
    const dlink = conn.downlink as number | undefined;

    let interpretedType: NetworkConnectionType = 'unknown';

    if (rawType === 'wifi') {
      interpretedType = 'wifi';
    } else if (rawType === 'cellular') {
      interpretedType = 'cellular';
    } else if (rawType === 'ethernet') {
      interpretedType = 'ethernet';
    } else if (rawType === 'bluetooth') {
      interpretedType = 'bluetooth';
    } else if (rawType === 'none') {
      interpretedType = 'none';
    } else {
      // Heuristic interpretation if rawType is 'unknown' or empty (e.g., in Chrome/Android)
      if (effType === '4g' || effType === '3g' || effType === '2g') {
        const isMobileUA = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
        interpretedType = isMobileUA ? 'cellular' : 'wifi';
      } else {
        interpretedType = 'wifi';
      }
    }

    return {
      type: interpretedType,
      effectiveType: effType,
      downlink: dlink,
    };
  }, []);

  const checkConnectivity = useCallback(async () => {
    setIsChecking(true);
    const medium = inspectNetworkMedium();
    setConnectionType(medium.type);
    setEffectiveType(medium.effectiveType);
    setDownlinkMbps(medium.downlink);

    // If browser navigator is strictly offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setBrowserOnline(false);
      setServerOnline(false);
      setPingMs(null);
      setConnectionType('none');

      if (prevOnlineRef.current !== false) {
        prevOnlineRef.current = false;
        onConnectionChange?.({
          isOnline: false,
          connectionType: 'none',
          effectiveType: medium.effectiveType,
          downlinkMbps: medium.downlink,
          pingMs: null,
          serverReachable: false,
          lastChecked: Date.now(),
        });
      }
      return;
    }

    const start = performance.now();
    try {
      const health = await ApiService.checkHealth();
      const elapsed = Math.round(performance.now() - start);

      setServerOnline(health.online);
      setPingMs(elapsed);
      setBrowserOnline(true);

      // When autoInterpretOnline is enabled, physical reachability overrides stale manual offline flags
      const isReachable = Boolean(health.online);
      const isEffectivelyOnline = autoInterpretOnline ? isReachable : (isReachable && !forceOffline);

      if (prevOnlineRef.current !== isEffectivelyOnline) {
        prevOnlineRef.current = isEffectivelyOnline;
        onConnectionChange?.({
          isOnline: isEffectivelyOnline,
          connectionType: medium.type === 'none' ? 'wifi' : medium.type,
          effectiveType: medium.effectiveType,
          downlinkMbps: medium.downlink,
          pingMs: elapsed,
          serverReachable: isReachable,
          lastChecked: Date.now(),
        });
      }
    } catch {
      setServerOnline(false);
      setPingMs(null);

      if (prevOnlineRef.current !== false) {
        prevOnlineRef.current = false;
        onConnectionChange?.({
          isOnline: false,
          connectionType: medium.type,
          effectiveType: medium.effectiveType,
          downlinkMbps: medium.downlink,
          pingMs: null,
          serverReachable: false,
          lastChecked: Date.now(),
        });
      }
    } finally {
      setIsChecking(false);
    }
  }, [inspectNetworkMedium, forceOffline, autoInterpretOnline, onConnectionChange]);

  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      checkConnectivity();
    };

    const handleOffline = () => {
      setBrowserOnline(false);
      setServerOnline(false);
      setPingMs(null);
      setConnectionType('none');
      if (prevOnlineRef.current !== false) {
        prevOnlineRef.current = false;
        onConnectionChange?.({
          isOnline: false,
          connectionType: 'none',
          pingMs: null,
          serverReachable: false,
          lastChecked: Date.now(),
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API change listener
    const conn =
      typeof navigator !== 'undefined'
        ? (navigator as any).connection ||
          (navigator as any).mozConnection ||
          (navigator as any).webkitConnection
        : null;

    const handleConnChange = () => {
      checkConnectivity();
    };

    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', handleConnChange);
    }

    // Instant check when window regains focus or tab becomes visible
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkConnectivity();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Initial check
    checkConnectivity();

    // Regular ping every 15 seconds to guarantee freshness
    const interval = setInterval(checkConnectivity, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', handleConnChange);
      }
      clearInterval(interval);
    };
  }, [checkConnectivity, onConnectionChange]);

  const isActuallyOnline = autoInterpretOnline
    ? browserOnline && serverOnline
    : !forceOffline && browserOnline && serverOnline;

  const getConnectionLabel = useCallback(
    (lang: 'en' | 'dz' = 'en'): string => {
      if (!isActuallyOnline) {
        return lang === 'dz' ? 'རྒྱུན་འབྲེལ་མེདཔ (Offline Core)' : 'Offline Core';
      }

      const pingStr = pingMs !== null ? `${pingMs}ms` : '';

      if (connectionType === 'cellular') {
        const eff = effectiveType ? `${effectiveType.toUpperCase()}` : 'Mobile';
        return lang === 'dz'
          ? `འགྲུལ་འཕྲིན་དྲ་རྒྱ (${eff} • ${pingStr})`
          : `Mobile Data (${eff} • ${pingStr})`;
      }

      if (connectionType === 'ethernet') {
        return lang === 'dz'
          ? `ཐག་སྐུད་དྲ་རྒྱ (${pingStr})`
          : `Ethernet (${pingStr})`;
      }

      // Default Wi-Fi
      return lang === 'dz'
        ? `ཝའི་ཕའི (${pingStr})`
        : `Wi-Fi (${pingStr})`;
    },
    [isActuallyOnline, connectionType, effectiveType, pingMs]
  );

  return {
    isOnline: isActuallyOnline,
    browserOnline,
    serverOnline,
    pingMs,
    connectionType,
    effectiveType,
    downlinkMbps,
    connectionLabel: getConnectionLabel(),
    getConnectionLabel,
    refreshStatus: checkConnectivity,
    isChecking,
  };
}

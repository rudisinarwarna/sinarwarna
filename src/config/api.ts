const EXTERNAL_BACKEND_ORIGIN =
  'https://ais-pre-zk5qxocqz5th2imqy7s4hy-599604854177.asia-northeast1.run.app';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getBackendHttpOrigin(): string {
  const envOrigin = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envOrigin) {
    return trimTrailingSlash(envOrigin);
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    const isSameRunAppCluster = host.endsWith('.run.app');
    if (!isLocalHost && !isSameRunAppCluster) {
      return EXTERNAL_BACKEND_ORIGIN;
    }
  }

  return '';
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getBackendHttpOrigin();
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}

export function buildLiveWsUrl(voice: string, mode: string): string {
  const query = `voice=${encodeURIComponent(voice)}&mode=${encodeURIComponent(mode)}`;
  const origin = getBackendHttpOrigin();
  if (origin) {
    const wsOrigin = origin.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    return `${wsOrigin}/live?${query}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/live?${query}`;
}

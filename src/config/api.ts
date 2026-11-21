function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getBackendHttpOrigin(): string {
  const envOrigin = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envOrigin) {
    return trimTrailingSlash(envOrigin);
  }

  return '';
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getBackendHttpOrigin();
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}

export function buildLiveWsUrl(voice: string, mode: string, idToken?: string | null): string {
  const params = new URLSearchParams({
    voice,
    mode,
  });
  if (idToken) {
    params.set('token', idToken);
  }
  const query = params.toString();
  const origin = getBackendHttpOrigin();
  if (origin) {
    const wsOrigin = origin.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    return `${wsOrigin}/live?${query}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/live?${query}`;
}

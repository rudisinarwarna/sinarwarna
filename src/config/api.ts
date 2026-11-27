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

export function buildLiveWsUrl(
  voice: string,
  mode: string,
  idToken?: string | null,
  initialCamera = false,
  options?: { lang?: string; lat?: number; lng?: number }
): string {
  const params = new URLSearchParams({
    voice,
    mode,
  });
  if (idToken) {
    params.set('token', idToken);
  }
  if (initialCamera) {
    params.set('camera', '1');
  }
  if (options?.lang) {
    params.set('lang', options.lang);
  }
  if (typeof options?.lat === 'number' && Number.isFinite(options.lat)) {
    params.set('lat', String(options.lat));
  }
  if (typeof options?.lng === 'number' && Number.isFinite(options.lng)) {
    params.set('lng', String(options.lng));
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

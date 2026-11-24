let token = '';
let pendingRefresh;
export function getAccessToken() {
  return token;
}
export function setAccessToken(value) {
  token = value || '';
}
export function refreshAccessToken(base, previous) {
  if (token && token !== previous) return Promise.resolve(token);
  if (!pendingRefresh) {
    pendingRefresh = (async () => {
      try {
        const response = await fetch(base + '/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
          headers: { Accept: 'application/json' },
        });
        if (!response.ok)
          throw new Error(
            'Authentication expired. Sign in through the configured identity provider.'
          );
        const data = await response.json();
        if (typeof data.accessToken !== 'string' || !data.accessToken)
          throw new Error('The refresh service returned no access token.');
        setAccessToken(data.accessToken);
        return token;
      } catch (error) {
        setAccessToken('');
        throw error;
      } finally {
        pendingRefresh = undefined;
      }
    })();
  }
  return pendingRefresh;
}

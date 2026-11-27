export function spanStyle(span, mode, limit = 75) {
  if (span.status === 'Locked') return { color: '#8894a0', dash: '2 6' };
  if (span.status !== 'In-Place') return { color: '#088583', dash: '9 5' };
  if (mode === 'Lifecycle') return { color: '#1d2125' };
  const use = Math.max(...span.bores);
  return use >= limit
    ? { color: '#b42323', dash: '10 6' }
    : use >= 60
      ? { color: '#b87e00' }
      : { color: '#1f5fbf' };
}

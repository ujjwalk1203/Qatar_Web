import { useCallback, useEffect, useState } from 'react';
import { getAccessToken, refreshAccessToken, setAccessToken } from '../auth/authApi.js';
import { mockRequest } from './mockApi.js';

export const demo = import.meta.env.VITE_DEMO_MODE !== 'false';
export const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const liveServices = new Set((import.meta.env.VITE_LIVE_SERVICES || '').split(',').map(value => value.trim()).filter(Boolean));
export function usesMock(path) {
  const endpoint = path.split('?')[0];
  const service = endpoint === '/network' || endpoint.startsWith('/reservations') ? 'inventory' :
    endpoint === '/audit' || endpoint === '/demo/audit-events' ? 'audit' : 'api';
  return demo && !liveServices.has(service);
}
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function messageFor(status, data) {
  if (status === 401)
    return 'Your session has expired. Sign in through the configured identity provider.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'The service is temporarily unavailable. Try again shortly.';
  return typeof data?.message === 'string' ? data.message : 'Request failed (' + status + ').';
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  if (typeof path !== 'string' || !/^\/(?!\/)[^\\#]*$/.test(path) || /[\u0000-\u0020]/.test(path))
    throw new Error('Enter a relative endpoint beginning with one slash.');
  let pathname;
  try {
    pathname = decodeURIComponent(path.split('?')[0]);
  } catch {
    throw new Error('Enter a valid endpoint.');
  }
  if (
    pathname.split('/').some((part) => part === '.' || part === '..') ||
    pathname.includes('\\') ||
    pathname.startsWith('//')
  )
    throw new Error('Use an endpoint within the configured API.');
  if (!methods.includes(method)) throw new Error('Select a supported HTTP method.');
  signal?.throwIfAborted();
  let result;
  if (usesMock(path)) {
    result = await mockRequest(path, method, body, signal);
  } else {
    const deadline = AbortSignal.timeout(15000);
    const active = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const send = (token) => {
      const headers = { Accept: 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      return fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: active,
        redirect: 'error',
      });
    };
    try {
      const previous = getAccessToken();
      let response = await send(previous);
      if (response.status === 401) {
        active.throwIfAborted();
        const renewed = await refreshAccessToken(base, previous);
        active.throwIfAborted();
        response = await send(renewed);
        if (response.status === 401 && getAccessToken() === renewed) setAccessToken('');
      }
      const raw = await response.text();
      let data = raw || null;
      if (raw && response.headers.get('content-type')?.includes('json')) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error('The API returned an unreadable JSON response.');
        }
      }
      result = { status: response.status, data };
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (deadline.aborted || error.name === 'TimeoutError')
        throw new Error('The request timed out. Check the connection and try again.');
      if (error instanceof TypeError)
        throw new Error('Could not reach the configured API. Check the connection and try again.');
      throw error;
    }
  }
  if (result.status >= 400)
    throw Object.assign(new Error(messageFor(result.status, result.data)), result);
  return result;
}
export const api = Object.fromEntries(
  methods.map((method) => [
    method.toLowerCase(),
    (path, options) => request(path, { ...options, method }),
  ]),
);

export function useResource(path) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({ loading: true, data: null, error: '' });
    api
      .get(path, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setState({ loading: false, data, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [path, revision]);
  const updateData = (updater) =>
    setState((current) => ({ ...current, data: updater(current.data) }));
  return path ? { ...state, retry, updateData } : { loading: false, data: null, error: '', retry };
}


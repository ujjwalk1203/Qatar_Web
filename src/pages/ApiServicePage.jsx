import React, { useEffect, useRef, useState } from 'react';
import { Download, Send, Square, Terminal } from 'lucide-react';
import { Title, exportFile } from '../components/Shared.jsx';
import { base, usesMock, request } from '../services/api.js';
import { getAccessToken } from '../auth/authApi.js';

const examples = [
  ['GET', '/health', 'Service health'],
  ['GET', '/network', 'Network inventory'],
  ['POST', '/sandbox', 'Sandbox JSON'],
];
export default function ApiServicePage() {
  const [method, setMethod] = useState('GET'),
    [path, setPath] = useState('/health'),
    [body, setBody] = useState('{}');
  const [state, setState] = useState({});
  const active = useRef(null);
  const demo = usesMock(path);
  const hasBody = !['GET', 'DELETE'].includes(method);
  const hasResponse = state.data !== undefined;
  useEffect(() => () => active.current?.abort(), []);
  async function send(event) {
    event.preventDefault();
    if (active.current) return;
    let payload;
    if (hasBody) {
      try {
        payload = JSON.parse(body);
      } catch {
        setState({ invalidBody: true, error: 'Enter valid JSON in the request body.' });
        return;
      }
    }
    const controller = new AbortController();
    active.current = controller;
    const start = performance.now();
    setState({ loading: true });
    try {
      const result = await request(path.trim(), {
        method,
        body: payload,
        signal: controller.signal,
      });
      setState({ ...result, elapsed: Math.round(performance.now() - start) });
    } catch (error) {
      if (controller.signal.aborted) setState({ message: 'Request cancelled.' });
      else setState({ error: error.message, status: error.status, data: error.data });
    } finally {
      active.current = null;
    }
  }
  function choose(verb, endpoint) {
    setMethod(verb);
    setPath(endpoint);
    if (verb === 'POST') setBody(JSON.stringify({ message: 'Qatar DMS demo' }, null, 2));
    setState({});
  }
  return (
    <>
      <Title code="F-04" title="API service layer">
        Inspect requests, authentication and responses.
      </Title>
      <div className="grid two api-grid">
        <form className="card panel stack" onSubmit={send}>
          <h2>Request console</h2>
          <div className="readout">
            <span>Base URL</span>
            <code dir="ltr">{demo ? 'mock://qatar-dms' : base}</code>
            <span>Authentication</span>
            <strong>
              {demo
                ? 'Simulated session'
                : getAccessToken()
                  ? 'Bearer token present'
                  : 'No access token'}
            </strong>
          </div>
          <fieldset disabled={state.loading}>
            {demo && (
              <div className="tabs" aria-label="Example requests">
                {examples.map(([verb, endpoint, label]) => (
                  <button key={endpoint} type="button" onClick={() => choose(verb, endpoint)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="field-row api-fields">
              <label>
                Method
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Endpoint
                <input
                  required
                  dir="ltr"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  spellCheck={false}
                />
              </label>
            </div>
            {hasBody && (
              <label>
                JSON body
                <textarea
                  dir="ltr"
                  spellCheck={false}
                  aria-invalid={state.invalidBody || undefined}
                  aria-describedby={state.invalidBody ? 'api-json-error' : undefined}
                  className="json-input"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
            )}
            {state.invalidBody && (
              <p id="api-json-error" className="inline-error" role="alert">
                {state.error}
              </p>
            )}
            <button className="button">
              <Send size={17} />
              {state.loading ? 'Sending…' : 'Send request'}
            </button>
          </fieldset>
          {state.loading && (
            <button
              type="button"
              className="button secondary"
              onClick={() => active.current?.abort()}
            >
              <Square size={14} />
              Cancel request
            </button>
          )}
        </form>
        <section className="card panel response-panel">
          <div className="section-head">
            <h2>
              <Terminal size={19} /> Response
            </h2>
            <div className="response-badges">
              {state.status && (
                <span className={'code ' + (state.status >= 400 ? 'failed' : '')}>
                  HTTP {state.status}
                </span>
              )}
              {state.elapsed !== undefined && <span className="code">{state.elapsed} ms</span>}
            </div>
          </div>
          {state.error && !state.invalidBody && (
            <p className="notice error" role="alert">
              {state.error}
            </p>
          )}
          <pre dir="ltr" aria-live="polite">
            {state.loading
              ? 'Waiting for response…'
              : hasResponse
                ? JSON.stringify(state.data, null, 2)
                : state.message || 'Send a request to view the response.'}
          </pre>
          {hasResponse && (
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                exportFile(
                  'api-response.json',
                  JSON.stringify(state.data, null, 2),
                  'application/json;charset=utf-8'
                )
              }
            >
              <Download size={16} />
              Download JSON
            </button>
          )}
        </section>
      </div>
    </>
  );
}


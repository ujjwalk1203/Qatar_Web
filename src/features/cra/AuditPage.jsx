import React, { useState } from 'react';
import { Download, ShieldAlert } from 'lucide-react';
import { Title, State, exportFile, csv } from '../../components/Shared.jsx';
import { api, usesMock, useResource } from '../../services/api.js';
const demo=usesMock('/audit');
const emptyFilters = { q: '', user: '', action: '', status: '', from: '', to: '' };
const pageSize = 8;
const columns = ['Time', 'User', 'Action', 'Status', 'Target', 'Details'];
const dateKey = (at) => new Date(at).toLocaleDateString('sv-SE');
export default function AuditPage() {
  const resource = useResource('/audit');
  const [appended, setAppended] = useState([]),
    [eventType, setEventType] = useState('Sign-in'),
    [eventState, setEventState] = useState({});
  async function appendEvent(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setEventState({ busy: true });
    try {
      const { data } = await api.post('/demo/audit-events', {
        body: {
          action: eventType,
          target: form.get('target'),
          detail: form.get('detail'),
          failed: form.get('failed') === 'on',
        },
      });
      setAppended((events) => [data, ...events]);
      setPage(1);
      setEventState({ message: 'Demo event recorded.' });
    } catch (error) {
      setEventState({ error: error.message });
    }
  }
  const [filters, setFilters] = useState(emptyFilters),
    [page, setPage] = useState(1);
  const logs = [...appended, ...(resource.data || [])];
  const query = filters.q.trim().toLowerCase();
  const rows = logs.filter((entry) => {
    if (filters.user && entry.user !== filters.user) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.status && entry.status !== filters.status) return false;
    if (filters.from || filters.to) {
      const date = dateKey(entry.at);
      if ((filters.from && date < filters.from) || (filters.to && date > filters.to)) return false;
    }
    return (
      !query || Object.values(entry).some((value) => String(value).toLowerCase().includes(query))
    );
  });

  const failedAttempts = new Map();
  for (const entry of logs) {
    if (entry.action === 'Sign-in' && entry.status === 'Failed') {
      failedAttempts.set(entry.user, (failedAttempts.get(entry.user) ?? 0) + 1);
    }
  }
  const atRisk = [...failedAttempts.keys()].filter((user) => failedAttempts.get(user) >= 3);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  function exportRows() {
    exportFile(
      'cra-audit-log.csv',
      csv([columns, ...rows.map((r) => [r.at, r.user, r.action, r.status, r.target, r.detail])]),
      'text/csv;charset=utf-8'
    );
  }
  return (
    <>
      <Title code="C-08" title="CRA audit log">
        Review sign-ins, regulatory decisions, overrides and request activity.
      </Title>
      <State resource={resource} />
      {resource.data && (
        <>
          {atRisk.length > 0 && (
            <div className="notice alert">
              <ShieldAlert size={20} />
              <div>
                <strong>Repeated failed sign-ins</strong>
                <p>
                  {atRisk.join(', ')} · Three or more failed sign-ins in loaded records.{' '}
                  {demo
                    ? 'Demo detection threshold requires CRA confirmation.'
                    : 'Review against CRA policy.'}
                </p>
              </div>
            </div>
          )}
          {demo && (
            <details className="card panel event-form">
              <summary>Simulate an auditable event</summary>
              <form className="stack" onSubmit={appendEvent}>
                <div className="field-row">
                  <label>
                    Event type
                    <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                      {['Sign-in', 'Decision', 'Override'].map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                  {eventType === 'Sign-in' ? (
                    <label className="check">
                      <input type="checkbox" name="failed" />
                      Failed sign-in
                    </label>
                  ) : (
                    <label>
                      Request or asset ID
                      <input name="target" required maxLength={60} />
                    </label>
                  )}
                  <label>
                    Event detail
                    <input name="detail" maxLength={180} />
                  </label>
                </div>
                <button className="button secondary" disabled={eventState.busy}>
                  {eventState.busy ? 'Recording…' : 'Record demo event'}
                </button>
                {eventState.error && (
                  <div className="notice error" role="alert">
                    {eventState.error}
                  </div>
                )}
                {eventState.message && <div role="status">{eventState.message}</div>}
              </form>
            </details>
          )}
          <section className="card panel stack">
            <div className="section-head">
              <h2>Activity records</h2>
              <button className="button secondary" disabled={!rows.length} onClick={exportRows}>
                <Download size={17} />
                Export CSV
              </button>
            </div>
            <div className="filters">
              <label>
                Search
                <input
                  placeholder="Search activity"
                  value={filters.q}
                  onChange={(e) => updateFilter('q', e.target.value)}
                />
              </label>
              {[
                ['user', 'User'],
                ['action', 'Action'],
                ['status', 'Status'],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <select value={filters[key]} onChange={(e) => updateFilter(key, e.target.value)}>
                    <option value="">All</option>
                    {[...new Set(logs.map((r) => r[key]))].sort().map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                From
                <input
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(e) => updateFilter('from', e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(e) => updateFilter('to', e.target.value)}
                />
              </label>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((page - 1) * pageSize, page * pageSize).map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.at).toLocaleString()}</td>
                      <td>{r.user}</td>
                      <td>{r.action}</td>
                      <td>
                        <span className={'code ' + (r.status === 'Failed' ? 'failed' : '')}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.target}</td>
                      <td>{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p className="empty">No audit events match these filters.</p>}
            </div>
            <div className="map-footer">
              <span>
                {rows.length} records · Page {page} of {pageCount}
              </span>
              <div className="tabs">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <button disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            </div>
            <small className="muted">
              {demo
                ? 'Demo events are saved in this tab. Production audit records require server-enforced append-only storage.'
                : 'Audit records are read from the API. Append-only enforcement belongs to the backend.'}
            </small>
          </section>
        </>
      )}
    </>
  );
}


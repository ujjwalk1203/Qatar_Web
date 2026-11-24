import { useLanguage } from '../../services/language.js';
import React, { useState, useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { State, csv, exportFile } from '../../components/Shared.jsx';
import { useResource } from '../../services/api.js';
import { operators } from '../../data/mockData.js';

const mobileQuery = '(max-width: 520px)';
function subscribe(callback) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
export function usePhoneViewport() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
}
export function RequestList({ records, empty = 'No matching requests.' }) {
  const { t } = useLanguage();
  if (!records.length)
    return (
      <div className="requests-empty">
        <ClipboardList size={23} />
        <p>{t(empty)}</p>
      </div>
    );
  return (
    <div className="request-list">
      {records.map((record) => {
        const fields = [
          ['Reservation ID', record.id],
          ['Status', record.status],
          ['Operator', operators[record.operator] || record.operator],
          ['Duct spans', record.spans?.join(', ')],
          ['Manholes', record.manholes?.join(', ')],
          ['Cable type', record.cable],
          ['Cable count', record.count],
          [
            'Planned splices',
            record.splicePlans
              ? Object.values(record.splicePlans).reduce((sum, p) => sum + p.count, 0)
              : record.spliceCount,
          ],
          ...Object.entries(record.splicePlans || {})
            .filter(([, p]) => p.count)
            .map(([id, p]) => [id, p.count + ' ' + p.type]),
          ['Splice location', record.spliceAt],
          ['Comments', record.comments],
          ['Created', record.createdAt],
        ];
        return (
          <details key={record.id} className="request-record">
            <summary>
              <span>
                <bdi>{record.id}</bdi>
                <small>
                  {record.kind === 'Maintenance'
                    ? t('Maintenance access')
                    : t('Duct space & splice reservation')}
                </small>
              </span>
              <span
                className={
                  'status-chip ' +
                  (record.status === 'Reserved'
                    ? 'reserved'
                    : record.status === 'Rejected'
                      ? 'failed'
                      : 'submitted')
                }
              >
                {t(record.status)}
              </span>
            </summary>
            <div className="request-record-body">
              <dl className="request-data">
                {fields
                  .slice(2)
                  .filter(([, value]) => value !== undefined && value !== '')
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{t(key)}</dt>
                      <dd>
                        <bdi>{value}</bdi>
                      </dd>
                    </div>
                  ))}
              </dl>
              {record.kind !== 'Maintenance' && record.manholes?.map(id => (
                <Link key={id} className="quiet-link" to={'/manhole-layout?' + new URLSearchParams({ manhole:id, request:record.id })}>
                  {t('Manhole layout')} · {id}
                </Link>
              ))}
              <button
                className="button secondary"
                onClick={() =>
                  exportFile(
                    record.id + '.csv',
                    csv([['Field', 'Value'], ...fields]),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                {t('Export details')}
              </button>
            </div>
          </details>
        );
      })}
    </div>
  );
}
export default function RequestMonitor({ phone = false }) {
  const resource = useResource('/reservations');
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('All');
  const query = params.get('q') || '';
  function setQuery(next) {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next) updated.set('q', next);
        else updated.delete('q');
        return updated;
      },
      { replace: true },
    );
  }
  const records = resource.data || [];
  const filters = [
    'All',
    ...new Set(['Submitted', 'Under review', 'Reserved', ...records.map((r) => r.status)]),
  ];
  const filtered = records.filter(
    (r) =>
      (status === 'All' || r.status === status) &&
      r.id.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="request-monitor stack">
      <div className="section-head">
        <h1>My requests</h1>
        {!phone && (
          <Link className="button" to="/reservation">
            New reservation
          </Link>
        )}
      </div>
      {phone && (
        <p className="notice monitor-note">
          Use the desktop portal to check availability and submit new requests.
        </p>
      )}
      <label className="monitor-search">
        <Search size={16} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search request ID"
          aria-label="Search request ID"
        />
      </label>
      <div className="tabs" aria-label="Request status">
        {filters.map((label) => (
          <button key={label} onClick={() => setStatus(label)} aria-pressed={status === label}>
            {label}
          </button>
        ))}
      </div>
      <State resource={resource} />
      {resource.data && (
        <>
          <p className="muted" role="status">
            {filtered.length} {filtered.length === 1 ? 'request' : 'requests'}
          </p>
          <RequestList records={filtered} />
        </>
      )}
    </section>
  );
}


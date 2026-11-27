import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Title, State } from './Shared.jsx';
import ManholeButterflyDiagram from './ManholeButterflyDiagram.jsx';
import { demo, useResource } from '../services/api.js';
export default function ManholeLayoutView() {
  const network = useResource('/network');
  const [params] = useSearchParams();
  const requestId = params.get('request');
  const reservations = useResource(requestId ? '/reservations' : null);
  const record = reservations.data?.find(item => item.id === requestId);
  const [id, setId] = useState(params.get('manhole') || ''),
    [show, setShow] = useState(true),
    [flow, setFlow] = useState(requestId ? 'review' : 'access'),
    [focus, setFocus] = useState('');
  const point = network.data?.manholes.find((m) => m.id === id) || network.data?.manholes[0];
  const spans = network.data?.spans.filter((s) => s.a === point?.id || s.b === point?.id) || [];
  const requestedPlan = record?.splicePlans?.[point?.id] ?? (record?.spliceAt === point?.id && record?.spliceCount ? {count:record.spliceCount,type:record.spliceType} : null);
  const selected = spans.find((s) => s.id === focus);
  return (
    <>
      <Title code="M-13" title="Manhole butterfly view">
        Inspect entering ducts, cable connections and splice locations.
      </Title>
      <State resource={network} />
      <State resource={reservations} />
      {requestId && <p className="notice">{record ? 'Reviewing reservation ' + record.id : reservations.loading ? 'Loading reservation…' : 'Reservation unavailable.'}</p>}
      {!network.loading && !network.error && !point && (
        <p className="notice">No manholes available.</p>
      )}
      {point && (
        <>
          <div className="card panel layout-controls">
            <label>
              Manhole
              <select
                aria-label="Manhole"
                value={point.id}
                onChange={(e) => {
                  setId(e.target.value);
                  setFocus('');
                }}
              >
                {network.data.manholes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} · {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Workflow context
              <select value={flow} onChange={(e) => setFlow(e.target.value)}>
                <option value="access">Operator access request</option>
                <option value="review">CRA review</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show proposed splices
            </label>
          </div>
          <div className="grid detail">
            <section className="card panel">
              <h2>{point.id} · Butterfly layout</h2>
              <ManholeButterflyDiagram
                point={point}
                spans={spans}
                focus={focus}
                onFocus={setFocus}
                showProposed={show}
                requestedPlan={requestId ? requestedPlan : null}
                demo={demo}
              />
            </section>
            <aside className="card panel stack">
              <h2>Connected ducts</h2>
              {!spans.length && <p className="muted">No connected ducts listed.</p>}
              {spans.map((s) => (
                <button
                  key={s.id}
                  className="button secondary"
                  aria-pressed={focus === s.id}
                  onClick={() => setFocus(s.id)}
                >
                  {s.id} · {s.length} m
                </button>
              ))}
              {selected && (
                <div className="readout">
                  <span>Lifecycle</span>
                  <strong>{selected.status}</strong>
                  <span>Route</span>
                  <strong>
                    {selected.a} – {selected.b}
                  </strong>
                  <span>Cables</span>
                  <strong>
                    {selected.cables?.join(', ') ||
                      (demo ? '24-core fibre · sample' : 'Unavailable')}
                  </strong>
                  <span>Bore utilisation</span>
                  <strong>{selected.bores.join('% / ')}%</strong>
                </div>
              )}
              <div className="notice">
                {flow === 'access'
                  ? 'Use this layout to identify the proposed access and splice location.'
                  : 'Compare existing and proposed connections as review evidence.'}
              </div>
              {flow === 'access' && (
                <Link className="button" to={'/reservation?manhole=' + point.id}>
                  Use in reservation
                </Link>
              )}
              {demo && (
                <small className="muted">
                  Schematic routing and cable labels are demo assumptions requiring CRA
                  confirmation.
                </small>
              )}
            </aside>
          </div>
        </>
      )}
    </>
  );
}

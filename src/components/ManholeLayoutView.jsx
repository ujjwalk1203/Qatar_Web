import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Title, State } from './Shared.jsx';
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
              <svg
                className="butterfly"
                viewBox="0 0 720 385"
                role="img"
                aria-label={'Duct and splice layout for ' + point.id}
              >
                <rect
                  x="235"
                  y="44"
                  width="250"
                  height="290"
                  rx="32"
                  fill="#eef1f4"
                  stroke="#9ca6b1"
                  strokeWidth="2"
                />
                <text x="360" y="82" textAnchor="middle" fill="#1d2125" fontWeight="700">
                  {point.id}
                </text>
                {spans.map((s, i) => {
                  const left = i % 2 === 0,
                    x = left ? 52 : 668,
                    y = 146 + Math.floor(i / 2) * 91,
                    y2 = 165 + i * 24;
                  return (
                    <g key={s.id} onClick={() => setFocus(s.id)} className="duct-click">
                      <path
                        d={'M' + x + ' ' + y + ' H' + (left ? 230 : 490) + ' L360 ' + y2}
                        fill="none"
                        stroke={focus === s.id ? '#00a8cc' : '#47505a'}
                        strokeWidth="6"
                      />
                      <circle cx={x} cy={y} r="13" fill="#fff" stroke="#1d2125" strokeWidth="3" />
                      <text x={x} y={y + 31} textAnchor="middle" fill="#1d2125" fontSize="14">
                        {s.id}
                      </text>
                    </g>
                  );
                })}
                {(point.existingSplices?.length > 0 || (demo && spans.length > 1)) && (
                  <g>
                    <circle cx="360" cy="177" r="12" fill="#47505a" />
                    <text x="379" y="156" fill="#1d2125" fontSize="14">
                      {point.existingSplices?.[0]?.id || 'Existing splice'}
                    </text>
                  </g>
                )}
                {show && (requestId ? requestedPlan?.count > 0 : point.proposedSplices?.length > 0 || (demo && spans.length > 1)) && (
                  <g>
                    <path
                      d="M360 188V266"
                      fill="none"
                      stroke="#c75a17"
                      strokeWidth="3"
                      strokeDasharray="6 5"
                    />
                    <circle
                      cx="360"
                      cy="267"
                      r="11"
                      fill="#fff7e7"
                      stroke="#c75a17"
                      strokeWidth="3"
                      strokeDasharray="4 2"
                    />
                    <text x="360" y="302" textAnchor="middle" fill="#8f3b13" fontSize="14">
                      {requestId ? requestedPlan.count + ' × ' + requestedPlan.type : point.proposedSplices?.[0]?.id || 'Proposed splice'}
                    </text>
                  </g>
                )}
              </svg>
              <div className="legend">
                <span>● Existing connection</span>
                <span>◌ Proposed splice</span>
              </div>
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

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function CapacitySection({ spans, manholes, capacity, limit: defaultLimit }) {
  const [capacityTab, setCapacityTab] = useState('cross');
  const [spanId, setSpanId] = useState('');
  const spanCapacity = capacity.find(({ id }) => id === spanId) || capacity[0];
  const effectiveLimit = spanCapacity?.limit ?? defaultLimit;
  const selectedSpan = spans.find(({ id }) => id === spanCapacity?.id);

  return (
    <section className="task-section">
      <h2>2 · Capacity</h2>
      <div className="tabs segmented">
        <button
          type="button"
          aria-pressed={capacityTab === 'cross'}
          onClick={() => setCapacityTab('cross')}
        >
          Cross-section
        </button>
        <button
          type="button"
          aria-pressed={capacityTab === 'manhole'}
          onClick={() => setCapacityTab('manhole')}
        >
          Manhole layout
        </button>
      </div>
      {capacityTab === 'manhole' ? (
        <div className="stack">
          {manholes.size ? (
            [...manholes].map((id) => (
              <Link key={id} className="button secondary" to={'/manhole-layout?manhole=' + id}>
                Inspect <bdi>{id}</bdi>
              </Link>
            ))
          ) : (
            <p className="muted">Select a span to see connected manholes.</p>
          )}
        </div>
      ) : selectedSpan ? (
        <>
          <label>
            Span
            <select value={selectedSpan.id} onChange={(e) => setSpanId(e.target.value)}>
              {spans.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.bores.length}-way duct bank
                </option>
              ))}
            </select>
          </label>
          <div className="duct-cross-section">
            {spanCapacity.existing.map((use, index) => (
              <div className="bore" key={index}>
                <svg viewBox="0 0 74 74" aria-label={'Bore ' + (index + 1)} role="img">
                  <circle
                    cx="37"
                    cy="37"
                    r="34"
                    fill="#fff"
                    stroke={spanCapacity.projected[index] > use ? '#00a8cc' : '#47505a'}
                    strokeWidth="2.5"
                  />
                  {[
                    [27, 27],
                    [47, 27],
                    [27, 47],
                    [47, 47],
                  ]
                    .slice(0, Math.ceil(use / 25))
                    .map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r="6" fill="#5f6873" />
                    ))}
                  {spanCapacity.projected[index] > use && (
                    <circle cx="37" cy="37" r="6" fill="#c75a17" />
                  )}
                </svg>
                <strong>B-{String(index + 1).padStart(2, '0')}</strong>
              </div>
            ))}
          </div>
          <div className="bore-legend">
            <span>● Existing use</span>
            <span>● Proposed cable</span>
          </div>
          {spanCapacity.projected.map((use, index) => (
            <div className="bore-meter" key={index}>
              <strong>B-{String(index + 1).padStart(2, '0')}</strong>
              <div className="meter">
                <span
                  className={
                    use > effectiveLimit
                      ? 'bad'
                      : use > spanCapacity.existing[index]
                        ? 'proposed'
                        : ''
                  }
                  style={{ width: Math.min(100, use) + '%' }}
                />
                <i style={{ left: effectiveLimit + '%' }} />
              </div>
              <span>
                {spanCapacity.existing[index]}%
                {spanCapacity.existing[index] !== use ? ' → ' + use + '%' : ''}
              </span>
            </div>
          ))}
          <small className="muted">CRA utilisation limit · {effectiveLimit}% per bore</small>
        </>
      ) : (
        <p className="muted">Select a duct span to see bore capacity.</p>
      )}
    </section>
  );
}

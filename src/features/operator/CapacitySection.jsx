import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import DuctCrossSectionDiagram from '../../components/DuctCrossSectionDiagram.jsx';

export default function CapacitySection({
  spans,
  manholes,
  capacity,
  limit: defaultLimit,
  onInspectAsset,
}) {
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
            [...manholes].map((id) =>
              onInspectAsset ? (
                <button
                  key={id}
                  type="button"
                  className="button secondary"
                  onClick={() => onInspectAsset(id, 'butterfly')}
                >
                  Inspect Butterfly · <bdi>{id}</bdi>
                </button>
              ) : (
                <Link key={id} className="button secondary" to={'/manhole-layout?manhole=' + id}>
                  Inspect <bdi>{id}</bdi>
                </Link>
              )
            )
          ) : (
            <p className="muted">Select a span on the GIS map to inspect connected manholes.</p>
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
          <DuctCrossSectionDiagram
            existing={spanCapacity.existing}
            projected={spanCapacity.projected}
            limit={effectiveLimit}
          />
          {onInspectAsset && (
            <button
              type="button"
              className="button secondary"
              onClick={() => onInspectAsset(selectedSpan.id, 'cross')}
            >
              Open detail view · <bdi>{selectedSpan.id}</bdi>
            </button>
          )}
        </>
      ) : (
        <p className="muted">Select a duct span on the GIS map to see bore capacity.</p>
      )}
    </section>
  );
}

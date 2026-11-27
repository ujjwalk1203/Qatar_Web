import React from 'react';

export default function DuctCrossSectionDiagram({
  existing = [],
  projected = [],
  limit = 75,
}) {
  const effectiveProjected = projected.length === existing.length ? projected : existing;

  return (
    <div className="stack">
      <div className="duct-cross-section">
        {existing.map((use, index) => (
          <div className="bore" key={index}>
            <svg viewBox="0 0 74 74" aria-label={'Bore ' + (index + 1)} role="img">
              <circle
                cx="37"
                cy="37"
                r="34"
                fill="#fff"
                stroke={effectiveProjected[index] > use ? '#00a8cc' : '#47505a'}
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
              {effectiveProjected[index] > use && (
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
      {effectiveProjected.map((use, index) => (
        <div className="bore-meter" key={index}>
          <strong>B-{String(index + 1).padStart(2, '0')}</strong>
          <div className="meter">
            <span
              className={
                use > limit ? 'bad' : use > existing[index] ? 'proposed' : ''
              }
              style={{ width: Math.min(100, use) + '%' }}
            />
            <i style={{ left: limit + '%' }} />
          </div>
          <span>
            {existing[index]}%
            {existing[index] !== use ? ' → ' + use + '%' : ''}
          </span>
        </div>
      ))}
      <small className="muted">CRA utilisation limit · {limit}% per bore</small>
    </div>
  );
}

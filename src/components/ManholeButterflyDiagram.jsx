import React from 'react';

export default function ManholeButterflyDiagram({
  point,
  spans = [],
  focus = '',
  onFocus,
  showProposed = true,
  requestedPlan = null,
  demo = true,
}) {
  if (!point) return null;
  const hasExisting = point.existingSplices?.length > 0 || (demo && spans.length > 1);
  const hasProposed =
    showProposed &&
    (requestedPlan ? requestedPlan.count > 0 : point.proposedSplices?.length > 0 || (demo && spans.length > 1));

  return (
    <div className="stack">
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
          const left = i % 2 === 0;
          const x = left ? 52 : 668;
          const y = 146 + Math.floor(i / 2) * 91;
          const y2 = 165 + i * 24;
          return (
            <g
              key={s.id}
              onClick={onFocus ? () => onFocus(s.id) : undefined}
              className={onFocus ? 'duct-click' : undefined}
            >
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
        {hasExisting && (
          <g>
            <circle cx="360" cy="177" r="12" fill="#47505a" />
            <text x="379" y="156" fill="#1d2125" fontSize="14">
              {point.existingSplices?.[0]?.id || 'Existing splice'}
            </text>
          </g>
        )}
        {hasProposed && (
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
              {requestedPlan
                ? requestedPlan.count + ' × ' + requestedPlan.type
                : point.proposedSplices?.[0]?.id || 'Proposed splice'}
            </text>
          </g>
        )}
      </svg>
      <div className="legend">
        <span>● Existing connection</span>
        <span>◌ Proposed splice</span>
      </div>
    </div>
  );
}

import { useLanguage } from '../services/language.js';
import React, { useId } from 'react';
import { manholes, spans } from '../data/mockData.js';
export function spanStyle(span, mode, limit = 75) {
  if (span.status === 'Locked') return { color: '#8894a0', dash: '2 6' };
  if (span.status !== 'In-Place') return { color: '#088583', dash: '9 5' };
  if (mode === 'Lifecycle') return { color: '#1d2125' };
  const use = Math.max(...span.bores);
  return use >= limit
    ? { color: '#b42323', dash: '10 6' }
    : use >= 60
      ? { color: '#b87e00' }
      : { color: '#1f5fbf' };
}
export function NetworkGraphic({
  network = { manholes, spans },
  camera = { x: 390, y: 225, z: 1 },
  onSelect,
  selection = [],
  mode = 'Availability',
}) {
  const { t } = useLanguage();
  const grid = useId();
  const places = Object.fromEntries(network.manholes.map((m) => [m.id, m]));
  const pick = (event, id) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  };
  return (
    <svg
      viewBox="0 0 780 450"
      preserveAspectRatio="xMidYMid meet"
      aria-label={t('Duct network schematic')}
    >
      <defs>
        <pattern id={grid} width="148" height="126" patternUnits="userSpaceOnUse" x="90" y="47">
          <rect width="148" height="126" fill="#fff" />
          <rect
            x="10"
            y="10"
            width="128"
            height="106"
            fill="#f2f4f6"
            stroke="#d7dce2"
            strokeWidth="1.5"
          />
          <rect x="27" y="22" width="47" height="56" fill="#e5e9ed" />
          <rect x="89" y="71" width="34" height="26" fill="#e5e9ed" />
        </pattern>
      </defs>
      <rect width="780" height="450" fill="#eef1f4" />
      <g
        transform={
          'translate(390 225) scale(' +
          camera.z +
          ') translate(' +
          -camera.x +
          ' ' +
          -camera.y +
          ')'
        }
      >
        <rect x="-1300" y="-1000" width="3400" height="2500" fill={'url(#' + grid + ')'} />
        <path d="M730 -20 C672 68 705 166 792 261 L950 450 L1100 -30Z" fill="#d6e8ef" />
        <text x="234" y="136" className="street-label">
          {t('Omar Al Mukhtar St')}
        </text>
        <text x="255" y="292" className="street-label">
          {t('Al Wahda St')}
        </text>
        {network.spans.map((s) => {
          const a = places[s.a],
            b = places[s.b],
            style = spanStyle(s, mode, network.catalog?.limit),
            selected = selection.includes(s.id);
          if (!a || !b) return null;
          const path = 'M' + a.x + ' ' + a.y + ' H' + b.x + ' V' + b.y;
          return (
            <g
              key={s.id}
              className={onSelect ? 'asset-target' : ''}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={onSelect ? t('Select ') + s.id : undefined}
              onClick={onSelect ? () => onSelect(s.id) : undefined}
              onKeyDown={onSelect ? (e) => pick(e, s.id) : undefined}
            >
              {selected && (
                <path d={path} stroke="#00a8cc" strokeWidth="15" opacity=".25" fill="none" />
              )}
              <path
                d={path}
                stroke={selected ? '#00a8cc' : style.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={selected ? undefined : style.dash}
                fill="none"
              />
              <path d={path} stroke="transparent" strokeWidth="22" fill="none" />
              <text x={(a.x + b.x) / 2} y={a.y - 10} textAnchor="middle" className="asset-label">
                {s.id}
              </text>
            </g>
          );
        })}
        {network.manholes.map((m) => (
          <g
            key={m.id}
            className={onSelect ? 'asset-target' : ''}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? t('Select ') + m.id : undefined}
            onClick={onSelect ? () => onSelect(m.id) : undefined}
            onKeyDown={onSelect ? (e) => pick(e, m.id) : undefined}
          >
            <circle
              cx={m.x}
              cy={m.y}
              r="7"
              fill="#fff"
              stroke={selection.includes(m.id) ? '#00a8cc' : '#1d2125'}
              strokeWidth="3"
            />
            <text x={m.x} y={m.y + 22} textAnchor="middle" className="asset-label">
              {m.id}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

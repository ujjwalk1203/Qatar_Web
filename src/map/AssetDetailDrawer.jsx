import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Layers, GitBranch, CircleDot } from 'lucide-react';
import DuctCrossSectionDiagram from '../components/DuctCrossSectionDiagram.jsx';
import ManholeButterflyDiagram from '../components/ManholeButterflyDiagram.jsx';
import { wgs84ToQnd95, formatQnd95 } from './qnd95.js';
import { spanStyle } from './symbology.js';
import { demo } from '../services/api.js';

function AssetLocalSchematic({ asset, network, onSelectAsset }) {
  const byId = Object.fromEntries(network.manholes.map((m) => [m.id, m]));
  const isSpan = Boolean(asset.a);
  const connectedSpans = isSpan
    ? [asset]
    : network.spans.filter((s) => s.a === asset.id || s.b === asset.id);

  if (isSpan) {
    const a = byId[asset.a];
    const b = byId[asset.b];
    const style = spanStyle(asset, 'Availability', network.catalog?.limit);
    return (
      <div className="stack">
        <svg
          className="asset-schematic-svg"
          viewBox="0 0 420 150"
          role="img"
          aria-label={'Asset schematic for ' + asset.id}
        >
          <rect width="420" height="150" rx="8" fill="#f5f7f9" />
          <line
            x1="80"
            y1="75"
            x2="340"
            y2="75"
            stroke={style.color}
            strokeWidth="6"
            strokeDasharray={style.dash}
            strokeLinecap="round"
          />
          <text x="210" y="55" textAnchor="middle" fill="#1d2125" fontSize="13" fontWeight="700">
            {asset.id} · {asset.length} m ({asset.ductType || 'Duct'})
          </text>
          <text x="210" y="102" textAnchor="middle" fill="#47505a" fontSize="12">
            {asset.bores.map((v, i) => `B-0${i + 1}: ${v}%`).join('  |  ')}
          </text>
          {[
            [80, a],
            [340, b],
          ].map(([cx, mh]) =>
            mh ? (
              <g
                key={mh.id}
                className="asset-target"
                onClick={() => onSelectAsset?.(mh.id)}
              >
                <circle cx={cx} cy="75" r="12" fill="#fff" stroke="#1d2125" strokeWidth="3" />
                <text x={cx} y="114" textAnchor="middle" fill="#1d2125" fontSize="12" fontWeight="700">
                  {mh.id}
                </text>
                <text x={cx} y="130" textAnchor="middle" fill="#5f6873" fontSize="10">
                  {mh.name}
                </text>
              </g>
            ) : null
          )}
        </svg>
        <small className="muted">
          Single-span schematic view scoped to selected asset <bdi>{asset.id}</bdi>.
        </small>
      </div>
    );
  }

  return (
    <div className="stack">
      <svg
        className="asset-schematic-svg"
        viewBox="0 0 420 210"
        role="img"
        aria-label={'Local junction schematic for ' + asset.id}
      >
        <rect width="420" height="210" rx="8" fill="#f5f7f9" />
        {connectedSpans.map((span, idx) => {
          const otherId = span.a === asset.id ? span.b : span.a;
          const other = byId[otherId];
          const angle = ((idx * 120) - 60) * (Math.PI / 180);
          const x2 = 210 + Math.cos(angle) * 125;
          const y2 = 105 + Math.sin(angle) * 72;
          const style = spanStyle(span, 'Availability', network.catalog?.limit);
          return (
            <g key={span.id}>
              <line
                x1="210"
                y1="105"
                x2={x2}
                y2={y2}
                stroke={style.color}
                strokeWidth="4.5"
                strokeDasharray={style.dash}
                className="asset-target"
                onClick={() => onSelectAsset?.(span.id)}
              />
              <text
                x={(210 + x2) / 2}
                y={(105 + y2) / 2 - 8}
                textAnchor="middle"
                fill="#1d2125"
                fontSize="11"
                fontWeight="700"
              >
                {span.id} ({span.length} m)
              </text>
              {other && (
                <g className="asset-target" onClick={() => onSelectAsset?.(other.id)}>
                  <circle cx={x2} cy={y2} r="8" fill="#fff" stroke="#47505a" strokeWidth="2.5" />
                  <text x={x2} y={y2 + 18} textAnchor="middle" fill="#47505a" fontSize="11">
                    {other.id}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <circle cx="210" cy="105" r="14" fill="#fff" stroke="#00a8cc" strokeWidth="3.5" />
        <text x="210" y="136" textAnchor="middle" fill="#1d2125" fontSize="12" fontWeight="700">
          {asset.id}
        </text>
      </svg>
      <small className="muted">
        Local node schematic scoped to selected manhole <bdi>{asset.id}</bdi>.
      </small>
    </div>
  );
}

export default function AssetDetailDrawer({
  asset,
  network,
  capacityEntry = null,
  splicePlan = null,
  onClose,
  onSelectAsset,
  initialTab,
}) {
  const isSpan = Boolean(asset?.a);
  const defaultTab = initialTab || (isSpan ? 'cross' : 'butterfly');
  const [tab, setTab] = useState(defaultTab);
  const [focusSpan, setFocusSpan] = useState('');

  useEffect(() => {
    setTab(initialTab || (asset?.a ? 'cross' : 'butterfly'));
    setFocusSpan('');
  }, [asset?.id, initialTab]);

  if (!asset || !network) return null;

  const byId = Object.fromEntries(network.manholes.map((m) => [m.id, m]));
  const connectedSpans = isSpan
    ? [asset]
    : network.spans.filter((s) => s.a === asset.id || s.b === asset.id);

  const pointLon = isSpan ? ((byId[asset.a]?.lon || 51.54) + (byId[asset.b]?.lon || 51.54)) / 2 : asset.lon;
  const pointLat = isSpan ? ((byId[asset.a]?.lat || 25.33) + (byId[asset.b]?.lat || 25.33)) / 2 : asset.lat;
  const qnd = wgs84ToQnd95(pointLon, pointLat);
  const effectiveLimit =
    capacityEntry?.limit ??
    Math.min(75, network.catalog?.limit || 75, network.catalog?.ductLimits?.[asset.ductType] ?? 75);

  return (
    <aside className="asset-detail-drawer card" aria-label={'Detail view for ' + asset.id}>
      <div className="section-head detail-drawer-head">
        <div>
          <span className="detail-kicker">
            {isSpan ? 'Selected Duct Span Detail' : 'Selected Manhole Detail'}
          </span>
          <h3>
            <bdi>{asset.id}</bdi> · {isSpan ? `${asset.a} – ${asset.b}` : asset.name}
          </h3>
        </div>
        <button className="shell-icon" type="button" aria-label="Close asset detail" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="detail-meta-grid">
        <div>
          <span>QND95 (EPSG:2932)</span>
          <strong>{formatQnd95(qnd.easting, qnd.northing)}</strong>
        </div>
        <div>
          <span>Lifecycle</span>
          <strong>{asset.status || 'In-Place'}</strong>
        </div>
        {asset.pin && (
          <div>
            <span>PIN</span>
            <strong>{asset.pin}</strong>
          </div>
        )}
        {asset.qars && (
          <div>
            <span>QARS</span>
            <strong>
              Z{asset.qars.zone} · St {asset.qars.street} · Bldg {asset.qars.building}
            </strong>
          </div>
        )}
        {asset.corridor && (
          <div>
            <span>Corridor</span>
            <strong>{asset.corridor}</strong>
          </div>
        )}
        {asset.landuse && (
          <div>
            <span>Landuse</span>
            <strong>{asset.landuse}</strong>
          </div>
        )}
      </div>

      <div className="tabs segmented detail-tabs" role="tablist" aria-label="Selected asset views">
        {isSpan ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'cross'}
            aria-pressed={tab === 'cross'}
            onClick={() => setTab('cross')}
          >
            <CircleDot size={14} /> Cross-Section
          </button>
        ) : (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'butterfly'}
            aria-pressed={tab === 'butterfly'}
            onClick={() => setTab('butterfly')}
          >
            <Layers size={14} /> Manhole Butterfly
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'schematic'}
          aria-pressed={tab === 'schematic'}
          onClick={() => setTab('schematic')}
        >
          <GitBranch size={14} /> Asset Schematic
        </button>
      </div>

      <div className="detail-drawer-body">
        {isSpan && tab === 'cross' && (
          <DuctCrossSectionDiagram
            existing={capacityEntry?.existing || asset.bores}
            projected={capacityEntry?.projected || asset.bores}
            limit={effectiveLimit}
          />
        )}

        {!isSpan && tab === 'butterfly' && (
          <div className="stack">
            <ManholeButterflyDiagram
              point={asset}
              spans={connectedSpans}
              focus={focusSpan}
              onFocus={setFocusSpan}
              showProposed={true}
              requestedPlan={splicePlan}
              demo={demo}
            />
            {connectedSpans.length > 0 && (
              <div className="detail-span-links">
                {connectedSpans.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="button secondary"
                    aria-pressed={focusSpan === s.id}
                    onClick={() => setFocusSpan(s.id)}
                  >
                    {s.id} ({s.length} m)
                  </button>
                ))}
              </div>
            )}
            <Link className="quiet-link" to={'/manhole-layout?manhole=' + asset.id}>
              Open full M-13 Butterfly workspace →
            </Link>
          </div>
        )}

        {tab === 'schematic' && (
          <AssetLocalSchematic
            asset={asset}
            network={network}
            onSelectAsset={onSelectAsset}
          />
        )}
      </div>
    </aside>
  );
}

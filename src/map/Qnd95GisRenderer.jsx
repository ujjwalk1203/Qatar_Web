import React, { useId, useMemo, useRef } from 'react';
import {
  CGIS_PARCELS,
  CGIS_ROADS,
  DOHA_BAY_WATER,
  LANDUSE_ZONES,
  QARS_PIN_FEATURES,
} from '../data/gisLayers.js';
import { formatQnd95, qnd95ToWgs84, wgs84ToQnd95 } from './qnd95.js';
import { spanStyle } from './symbology.js';

// Reference center in West Bay / Diplomatic Quarter / Corniche (QND95 meters)
const CENTER_WGS84 = { lon: 51.541, lat: 25.332 };
const CENTER_QND95 = wgs84ToQnd95(CENTER_WGS84.lon, CENTER_WGS84.lat);
const BASE_METERS_PER_PX = 10; // ~1:38,000 scale across a 780x450 viewport

function projectToSvg(lon, lat, centerQnd95, zoom) {
  const { easting, northing } = wgs84ToQnd95(lon, lat);
  const pxPerMeter = zoom / BASE_METERS_PER_PX;
  const x = 390 + (easting - centerQnd95.easting) * pxPerMeter;
  const y = 225 - (northing - centerQnd95.northing) * pxPerMeter;
  return [x, y];
}

function svgToQnd95(svgX, svgY, centerQnd95, zoom) {
  const pxPerMeter = zoom / BASE_METERS_PER_PX;
  return {
    easting: centerQnd95.easting + (svgX - 390) / pxPerMeter,
    northing: centerQnd95.northing - (svgY - 225) / pxPerMeter,
  };
}

function pointsAttr(coords, centerQnd95, zoom) {
  return coords
    .map(([lon, lat]) => {
      const [x, y] = projectToSvg(lon, lat, centerQnd95, zoom);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function polylinePath(coords, centerQnd95, zoom) {
  return coords
    .map(([lon, lat], i) => {
      const [x, y] = projectToSvg(lon, lat, centerQnd95, zoom);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function Qnd95GisRenderer({
  network,
  camera = { lon: 51.541, lat: 25.332, scale: 36000 },
  basemap = 'cgis-landbase',
  layers = {
    cgisLandbase: true,
    landuse: true,
    qarsPin: true,
    craDucts: true,
    craManholes: true,
  },
  symbology = 'Availability',
  selection = [],
  activeQarsId = '',
  panning = false,
  compact = false,
  onSelectAsset,
  onSelectQars,
  onCameraChange,
  onPointerQnd95,
}) {
  const satPatternId = useId();
  const dragRef = useRef(null);
  const svgRef = useRef(null);

  const zoom = Math.max(0.25, Math.min(18, 36000 / (camera.scale || 36000)));
  const centerQnd95 = useMemo(
    () => wgs84ToQnd95(camera.lon ?? CENTER_WGS84.lon, camera.lat ?? CENTER_WGS84.lat),
    [camera.lon, camera.lat],
  );

  const byId = useMemo(
    () => Object.fromEntries((network?.manholes || []).map((m) => [m.id, m])),
    [network?.manholes],
  );

  // Build 500 m QND95 coordinate grid lines around current center
  const gridStep = zoom > 3 ? 250 : zoom > 1.2 ? 500 : 1000;
  const halfWidthMeters = (390 / zoom) * BASE_METERS_PER_PX;
  const halfHeightMeters = (225 / zoom) * BASE_METERS_PER_PX;
  const minE = Math.floor((centerQnd95.easting - halfWidthMeters) / gridStep) * gridStep;
  const maxE = Math.ceil((centerQnd95.easting + halfWidthMeters) / gridStep) * gridStep;
  const minN = Math.floor((centerQnd95.northing - halfHeightMeters) / gridStep) * gridStep;
  const maxN = Math.ceil((centerQnd95.northing + halfHeightMeters) / gridStep) * gridStep;

  const eastingLines = [];
  for (let e = minE; e <= maxE; e += gridStep) eastingLines.push(e);
  const northingLines = [];
  for (let n = minN; n <= maxN; n += gridStep) northingLines.push(n);

  const isSatellite = basemap === 'satellite';
  const isGray = basemap === 'gray-vector';
  const landFill = isSatellite ? `url(#${satPatternId})` : isGray ? '#eff2f5' : '#f7f5ef';
  const waterFill = isSatellite ? '#12374f' : isGray ? '#d4e2ea' : '#cce3ee';
  const roadStroke = isSatellite ? '#d4c89b' : isGray ? '#c5cdd6' : '#ffffff';
  const roadBorder = isSatellite ? '#4a5560' : '#b7c1cc';
  const pxPerMeter = zoom / BASE_METERS_PER_PX;

  function clientToSvg(clientX, clientY) {
    const el = svgRef.current;
    if (!el) return { x: 390, y: 225 };
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * 780,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * 450,
    };
  }

  return (
    <svg
      ref={svgRef}
      className="qnd95-gis-svg"
      viewBox="0 0 780 450"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="QND95 Qatar National Grid Geographic GIS Map"
      onPointerMove={(e) => {
        if (onPointerQnd95) {
          const { x, y } = clientToSvg(e.clientX, e.clientY);
          const qnd = svgToQnd95(x, y, centerQnd95, zoom);
          onPointerQnd95(qnd);
        }
      }}
      onPointerDown={(e) => {
        if (!panning || compact) return;
        dragRef.current = { x: e.clientX, y: e.clientY, center: centerQnd95 };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onPointerUp={(e) => {
        if (!dragRef.current || !onCameraChange) return;
        const { x, y, center } = dragRef.current;
        dragRef.current = null;
        const rect = e.currentTarget.getBoundingClientRect();
        const scaleX = 780 / Math.max(1, rect.width);
        const scaleY = 450 / Math.max(1, rect.height);
        const dxSvg = (e.clientX - x) * scaleX;
        const dySvg = (e.clientY - y) * scaleY;
        if (Math.hypot(dxSvg, dySvg) < 3) return;
        const nextE = center.easting - dxSvg / pxPerMeter;
        const nextN = center.northing + dySvg / pxPerMeter;
        const nextWgs = qnd95ToWgs84(nextE, nextN);
        onCameraChange({
          lon: nextWgs.lon,
          lat: nextWgs.lat,
          scale: camera.scale,
        });
      }}
    >
      <defs>
        <pattern id={satPatternId} width="60" height="60" patternUnits="userSpaceOnUse">
          <rect width="60" height="60" fill="#2b3a34" />
          <path d="M0 15 H60 M0 45 H60 M20 0 V60 M48 0 V60" stroke="#364840" strokeWidth="1" />
          <rect x="4" y="4" width="12" height="9" fill="#3b4942" />
          <rect x="24" y="20" width="18" height="14" fill="#3f4c43" />
          <rect x="40" y="48" width="14" height="10" fill="#2e4038" />
        </pattern>
      </defs>

      {/* Geographic Land Background */}
      <rect width="780" height="450" fill={landFill} />

      {/* Doha Bay Coastline (CGIS Coastline) */}
      <polygon points={pointsAttr(DOHA_BAY_WATER, centerQnd95, zoom)} fill={waterFill} />

      {/* QND95 National Grid Lines */}
      {!compact && (
        <g opacity={isSatellite ? 0.32 : 0.45}>
          {eastingLines.map((e) => {
            const x = 390 + (e - centerQnd95.easting) * pxPerMeter;
            return (
              <g key={'E' + e}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={450}
                  stroke={isSatellite ? '#90b4c8' : '#b7c3cf'}
                  strokeWidth="0.7"
                  strokeDasharray="3 4"
                />
                <text
                  x={x + 3}
                  y={12}
                  fontSize="9"
                  fill={isSatellite ? '#d4e6f1' : '#5f6873'}
                >
                  E {e}
                </text>
              </g>
            );
          })}
          {northingLines.map((n) => {
            const y = 225 - (n - centerQnd95.northing) * pxPerMeter;
            return (
              <g key={'N' + n}>
                <line
                  x1={0}
                  y1={y}
                  x2={780}
                  y2={y}
                  stroke={isSatellite ? '#90b4c8' : '#b7c3cf'}
                  strokeWidth="0.7"
                  strokeDasharray="3 4"
                />
                <text
                  x={6}
                  y={y - 3}
                  fontSize="9"
                  fill={isSatellite ? '#d4e6f1' : '#5f6873'}
                >
                  N {n}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Landuse Zoning Layer */}
      {layers.landuse &&
        LANDUSE_ZONES.map((zone) => (
          <g key={zone.id}>
            <polygon
              points={pointsAttr(zone.coords, centerQnd95, zoom)}
              fill={isSatellite ? zone.fill.replace('0.2', '0.28') : zone.fill}
              stroke={zone.stroke}
              strokeWidth="1.1"
              strokeDasharray="4 3"
            />
            {!compact && zoom >= 0.8 && (() => {
              const lonAvg = zone.coords.slice(0, 4).reduce((s, c) => s + c[0], 0) / 4;
              const latAvg = zone.coords.slice(0, 4).reduce((s, c) => s + c[1], 0) / 4;
              const [lx, ly] = projectToSvg(lonAvg, latAvg, centerQnd95, zoom);
              return (
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill={isSatellite ? '#f4f7f9' : zone.stroke}
                  opacity="0.85"
                >
                  {zone.code}
                </text>
              );
            })()}
          </g>
        ))}

      {/* CGIS Landbase Layer (Cadastral Parcels & Roads) */}
      {layers.cgisLandbase && (
        <g>
          {CGIS_PARCELS.map((parcel) => (
            <polygon
              key={parcel.id}
              points={pointsAttr(parcel.coords, centerQnd95, zoom)}
              fill="none"
              stroke={isSatellite ? 'rgba(255,255,255,0.28)' : '#c7cfd8'}
              strokeWidth="1"
            />
          ))}
          {CGIS_ROADS.map((road) => (
            <g key={road.id}>
              <path
                d={polylinePath(road.coords, centerQnd95, zoom)}
                fill="none"
                stroke={roadBorder}
                strokeWidth={road.class === 'primary' ? 9 : 6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={polylinePath(road.coords, centerQnd95, zoom)}
                fill="none"
                stroke={roadStroke}
                strokeWidth={road.class === 'primary' ? 6 : 3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {!compact && (() => {
                const mid = road.coords[Math.floor(road.coords.length / 2)];
                const [rx, ry] = projectToSvg(mid[0], mid[1], centerQnd95, zoom);
                return (
                  <text
                    x={rx}
                    y={ry - 7}
                    textAnchor="middle"
                    className="gis-road-label"
                    fill={isSatellite ? '#f8fafc' : '#47505a'}
                  >
                    {road.name}
                  </text>
                );
              })()}
            </g>
          ))}
        </g>
      )}

      {/* QARS / PIN Layer */}
      {layers.qarsPin &&
        QARS_PIN_FEATURES.map((item) => {
          const [qx, qy] = projectToSvg(item.lon, item.lat, centerQnd95, zoom);
          const isActive = activeQarsId === item.id;
          return (
            <g
              key={item.id}
              className={onSelectQars ? 'asset-target' : undefined}
              onClick={onSelectQars ? () => onSelectQars(item) : undefined}
            >
              <rect
                x={qx - 24}
                y={qy - 24}
                width="48"
                height="15"
                rx="3"
                fill={isActive ? '#005a70' : '#1d4ed8'}
                stroke="#ffffff"
                strokeWidth="1.2"
              />
              <text
                x={qx}
                y={qy - 14}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                fill="#ffffff"
              >
                Z{item.zone}·{item.street}·{item.building}
              </text>
              {!compact && zoom >= 1.1 && (
                <text
                  x={qx}
                  y={qy - 27}
                  textAnchor="middle"
                  fontSize="8"
                  fill={isSatellite ? '#cbd5e1' : '#334155'}
                >
                  PIN {item.pin}
                </text>
              )}
            </g>
          );
        })}

      {/* CRA Duct Spans Layer */}
      {layers.craDucts &&
        (network?.spans || []).map((span) => {
          const a = byId[span.a];
          const b = byId[span.b];
          if (!a || !b) return null;
          const coords = span.path && span.path.length >= 2 ? span.path : [[a.lon, a.lat], [b.lon, b.lat]];
          const d = polylinePath(coords, centerQnd95, zoom);
          const style = spanStyle(span, symbology, network.catalog?.limit);
          const selected = selection.includes(span.id);
          const midCoord = coords[Math.floor(coords.length / 2)];
          const [mx, my] = projectToSvg(midCoord[0], midCoord[1], centerQnd95, zoom);

          return (
            <g
              key={span.id}
              className={onSelectAsset ? 'asset-target' : undefined}
              role={onSelectAsset ? 'button' : undefined}
              tabIndex={onSelectAsset ? 0 : undefined}
              aria-label={onSelectAsset ? 'Select ' + span.id : undefined}
              onClick={onSelectAsset ? () => onSelectAsset(span.id) : undefined}
              onKeyDown={
                onSelectAsset
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectAsset(span.id);
                      }
                    }
                  : undefined
              }
            >
              {selected && (
                <path d={d} stroke="#00a8cc" strokeWidth="13" opacity="0.3" fill="none" strokeLinecap="round" />
              )}
              <path
                d={d}
                stroke={selected ? '#00a8cc' : style.color}
                strokeWidth="4.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={selected ? undefined : style.dash}
                fill="none"
              />
              <path d={d} stroke="transparent" strokeWidth="18" fill="none" />
              <text
                x={mx}
                y={my - 8}
                textAnchor="middle"
                className={isSatellite ? 'asset-label asset-label-dark' : 'asset-label'}
              >
                {span.id}
              </text>
            </g>
          );
        })}

      {/* CRA Manholes Layer */}
      {layers.craManholes &&
        (network?.manholes || []).map((mh) => {
          const [mx, my] = projectToSvg(mh.lon, mh.lat, centerQnd95, zoom);
          const selected = selection.includes(mh.id);
          return (
            <g
              key={mh.id}
              className={onSelectAsset ? 'asset-target' : undefined}
              role={onSelectAsset ? 'button' : undefined}
              tabIndex={onSelectAsset ? 0 : undefined}
              aria-label={onSelectAsset ? 'Select ' + mh.id : undefined}
              onClick={onSelectAsset ? () => onSelectAsset(mh.id) : undefined}
              onKeyDown={
                onSelectAsset
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectAsset(mh.id);
                      }
                    }
                  : undefined
              }
            >
              {selected && <circle cx={mx} cy={my} r="12" fill="#00a8cc" opacity="0.28" />}
              <circle
                cx={mx}
                cy={my}
                r="6.5"
                fill="#ffffff"
                stroke={selected ? '#00a8cc' : '#1d2125'}
                strokeWidth="3"
              />
              <text
                x={mx}
                y={my + 18}
                textAnchor="middle"
                className={isSatellite ? 'asset-label asset-label-dark' : 'asset-label'}
              >
                {mh.id}
              </text>
            </g>
          );
        })}

      {!compact && (
        <g pointerEvents="none">
          <rect x="10" y="10" width="236" height="22" rx="4" fill="rgba(29,33,37,0.78)" />
          <text x="18" y="25" fontSize="10.5" fontWeight="600" fill="#ffffff">
            QND95 / WKID 2932 · {formatQnd95(CENTER_QND95.easting, CENTER_QND95.northing)}
          </text>
        </g>
      )}
    </svg>
  );
}

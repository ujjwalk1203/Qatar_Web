import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ZoomIn,
  ZoomOut,
  Hand,
  Maximize,
  Undo2,
  Redo2,
  Layers,
  Table2,
  X,
  MousePointer2,
} from 'lucide-react';
import { Title, State } from '../components/Shared.jsx';
import { useResource } from '../services/api.js';
import { loadArcgis } from './arcgisLoader.js';
import NetworkAttributeTable from './NetworkAttributeTable.jsx';
import { NetworkGraphic, spanStyle } from './NetworkGraphic.jsx';
const initial = { x: 390, y: 225, z: 1, lon: 51.541, lat: 25.332, scale: 48000 };
const tools = [
  ['in', 'Zoom in', '+', ZoomIn],
  ['out', 'Zoom out', '−', ZoomOut],
  ['pan', 'Pan', 'P', Hand],
  ['full', 'Full extent', 'F', Maximize],
  ['previous', 'Previous extent', '[', Undo2],
  ['next', 'Next extent', ']', Redo2],
];
export default function MapWorkspace({ embedded = false, selection = [], onAsset, onClear }) {
  const network = useResource('/network');
  const [params, setParams] = useSearchParams();
  const query = params.get('asset')?.toUpperCase();
  const [symbology, setSymbology] = useState(embedded ? 'Availability' : 'Lifecycle');
  const [legend, setLegend] = useState(true);
  const [table, setTable] = useState(false);
  const [assetType, setAssetType] = useState('spans');
  const [mode, setMode] = useState('schematic');
  const [mapState, setMapState] = useState('');
  const [active, setActive] = useState('');
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState({ list: [initial], index: 0 });
  const camera = history.list[history.index];
  const assets = [...(network.data?.manholes || []), ...(network.data?.spans || [])];
  const queried = assets.find((asset) => asset.id === query);
  const identified = assets.find((asset) => asset.id === selected) || queried;
  const highlight = embedded ? selection : identified ? [identified.id] : [];
  function identify(id) {
    if (embedded) onAsset(id);
    else setSelected(id);
  }
  const host = useRef(null),
    view = useRef(null),
    drag = useRef(null),
    pending = useRef(false);
  function add(next) {
    setHistory((h) => ({ list: [...h.list.slice(0, h.index + 1), next], index: h.index + 1 }));
  }
  useEffect(() => {
    if (mode !== 'arcgis' || !network.data) return;
    let alive = true,
      instance,
      watch,
      timeout;
    setMapState('Loading ArcGIS…');
    (async () => {
      try {
        const esri = await loadArcgis();
        const [Map, MapView, Graphic, reactive] = await Promise.all(
          ['Map', 'views/MapView', 'Graphic', 'core/reactiveUtils'].map((p) =>
            esri.import('@arcgis/core/' + p + '.js')
          )
        );
        if (!alive) return;
        const byId = Object.fromEntries(network.data.manholes.map((m) => [m.id, m]));
        instance = new MapView({
          container: host.current,
          map: new Map({ basemap: 'gray-vector' }),
          center: [initial.lon, initial.lat],
          scale: initial.scale,
          ui: { components: ['attribution'] },
        });
        timeout = setTimeout(() => {
          if (alive) {
            setMapState('ArcGIS view timed out.');
            setMode('schematic');
          }
        }, 16000);
        await instance.when();
        if (!alive) return;
        clearTimeout(timeout);
        view.current = instance;
        for (const span of network.data.spans) {
          const a = byId[span.a],
            b = byId[span.b];
          if (a && b)
            instance.graphics.add(
              new Graphic({
                geometry: {
                  type: 'polyline',
                  paths: [
                    [
                      [a.lon, a.lat],
                      [b.lon, b.lat],
                    ],
                  ],
                  spatialReference: { wkid: 4326 },
                },
                symbol: {
                  type: 'simple-line',
                  color: spanStyle(span, symbology, network.data.catalog?.limit).color,
                  width: 4,
                  style:
                    span.status === 'Locked'
                      ? 'dot'
                      : spanStyle(span, symbology, network.data.catalog?.limit).dash
                        ? 'dash'
                        : 'solid',
                },
                attributes: { id: span.id },
              })
            );
        }
        for (const point of network.data.manholes)
          instance.graphics.add(
            new Graphic({
              geometry: { type: 'point', longitude: point.lon, latitude: point.lat },
              symbol: {
                type: 'simple-marker',
                color: '#fff',
                size: 10,
                outline: { color: '#1d2125', width: 3 },
              },
              attributes: { id: point.id },
            })
          );
        instance.on('click', async (event) => {
          const hit = await instance.hitTest(event, { include: instance.graphics });
          const id = hit.results.find((r) => r.graphic?.attributes?.id)?.graphic.attributes.id;
          if (alive && id) identify(id);
        });
        watch = reactive.watch(
          () => instance.stationary,
          (stable) => {
            if (!stable || pending.current) return;
            const next = {
              ...initial,
              lon: instance.center.longitude,
              lat: instance.center.latitude,
              scale: instance.scale,
            };
            setHistory((h) => {
              const old = h.list[h.index];
              return Math.abs(old.lon - next.lon) + Math.abs(old.lat - next.lat) < 0.00001 &&
                Math.abs(old.scale - next.scale) < 1
                ? h
                : { list: [...h.list.slice(0, h.index + 1), next], index: h.index + 1 };
            });
          }
        );
        setMapState('');
      } catch {
        if (alive) {
          setMapState('ArcGIS unavailable. Showing the demo schematic.');
          setMode('schematic');
        }
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timeout);
      watch?.remove();
      instance?.destroy();
      view.current = null;
      pending.current = false;
    };
  }, [mode, network.data]);
  useEffect(() => {
    if (!view.current || !network.data) return;
    for (const graphic of view.current.graphics) {
      const span = network.data.spans.find((s) => s.id === graphic.attributes.id);
      if (!span) continue;
      const style = spanStyle(span, symbology, network.data.catalog?.limit);
      graphic.symbol = {
        type: 'simple-line',
        color: highlight.includes(span.id) ? '#00a8cc' : style.color,
        width: highlight.includes(span.id) ? 6 : 4,
        style: span.status === 'Locked' ? 'dot' : style.dash ? 'dash' : 'solid',
      };
    }
  }, [symbology, selected, query, network.data]);
  function go(next) {
    if (view.current) {
      pending.current = true;
      const instance = view.current;
      instance
        .goTo({ center: [next.lon, next.lat], scale: next.scale }, { animate: false })
        .catch(() => {})
        .finally(() => {
          if (view.current === instance) pending.current = false;
        });
    }
  }
  function act(action) {
    if (action === 'pan') {
      setActive((a) => (a === 'pan' ? '' : 'pan'));
      return;
    }
    if (action === 'previous' || action === 'next') {
      const index = history.index + (action === 'previous' ? -1 : 1);
      if (index >= 0 && index < history.list.length) {
        setHistory({ ...history, index });
        go(history.list[index]);
      }
      return;
    }
    const factor = action === 'in' ? 1.45 : 1 / 1.45;
    const next =
      action === 'full'
        ? initial
        : {
            ...camera,
            z: Math.min(9, Math.max(0.45, camera.z * factor)),
            scale: Math.min(400000, Math.max(1500, camera.scale / factor)),
          };
    add(next);
    go(next);
  }
  function keyboard(event) {
    if (event.target.closest('button,input,select,[role=button]')) return;
    const key = event.key.toLowerCase();
    if (key === 'l') {
      setLegend((value) => !value);
      return;
    }
    if (key === 's') {
      setActive('');
      return;
    }
    if (key === 'escape') {
      clearSelection();
      return;
    }
    const action = {
      '+': 'in',
      '=': 'in',
      '-': 'out',
      p: 'pan',
      f: 'full',
      '[': 'previous',
      ']': 'next',
    }[key];
    if (action) {
      event.preventDefault();
      act(action);
    }
    if (mode === 'schematic' && key.startsWith('arrow')) {
      event.preventDefault();
      add({
        ...camera,
        x: camera.x + ({ arrowleft: -35, arrowright: 35 }[key] || 0) / camera.z,
        y: camera.y + ({ arrowup: -35, arrowdown: 35 }[key] || 0) / camera.z,
      });
    }
  }
  function clearSelection() {
    setSelected('');
    if (embedded) onClear();
    else if (query) setParams({});
  }
  function selectMode(next) {
    setHistory({ list: [initial], index: 0 });
    setMapState('');
    setMode(next);
  }
  return (
    <>
      {!embedded && (
        <Title code="M-03" title="Network map">
          CRA regulator portal
        </Title>
      )}
      <State resource={network} />
      {network.data && (
        <section className={'card map-card ' + (embedded ? 'embedded-map' : '')}>
          <div className="map-header">
            <div className="map-controls">
              <label className="map-select">
                Symbology
                <select
                  aria-label="Symbology"
                  value={symbology}
                  onChange={(e) => setSymbology(e.target.value)}
                >
                  <option>Availability</option>
                  <option>Lifecycle</option>
                </select>
              </label>
              {embedded ? (
                <span className="selection-chip">
                  {selection.filter((id) => id.startsWith('DS')).length} spans ·{' '}
                  {selection.filter((id) => id.startsWith('MH')).length} manholes selected
                </span>
              ) : (
                <span className="code">Version: DEFAULT</span>
              )}
            </div>
            {!embedded && (
              <div className="tabs">
                <button
                  aria-pressed={mode === 'schematic'}
                  onClick={() => selectMode('schematic')}
                  disabled={mode === 'schematic'}
                >
                  Schematic
                </button>
                <button
                  aria-pressed={mode === 'arcgis'}
                  onClick={() => selectMode('arcgis')}
                  disabled={mode === 'arcgis'}
                >
                  ArcGIS
                </button>
              </div>
            )}
          </div>
          {mapState && (
            <p className="map-message" role="status">
              {mapState}
            </p>
          )}
          {!embedded && query && !queried && (
            <p className="map-message" role="status">
              No demo asset matches <bdi>{query}</bdi>.
            </p>
          )}
          <div
            className={'map-viewport ' + (active === 'pan' ? 'panning' : '')}
            tabIndex="0"
            aria-label="Map navigation workspace"
            onKeyDown={keyboard}
          >
            {mode === 'arcgis' ? (
              <div className="arcgis" ref={host} />
            ) : (
              <div
                className="schematic"
                onPointerDown={(e) => {
                  if (active === 'pan') {
                    drag.current = [e.clientX, e.clientY];
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onPointerUp={(e) => {
                  if (drag.current) {
                    const [x, y] = drag.current;
                    drag.current = null;
                    const scale =
                      Math.max(
                        780 / e.currentTarget.clientWidth,
                        450 / e.currentTarget.clientHeight
                      ) / camera.z;
                    if (Math.hypot(x - e.clientX, y - e.clientY) > 2)
                      add({
                        ...camera,
                        x: camera.x + (x - e.clientX) * scale,
                        y: camera.y + (y - e.clientY) * scale,
                      });
                  }
                }}
              >
                <NetworkGraphic
                  camera={camera}
                  network={network.data}
                  onSelect={active === 'pan' ? undefined : identify}
                  selection={highlight}
                  mode={symbology}
                />
              </div>
            )}
            <div className="palette" aria-label="Map tools">
              {tools.map(([id, label, key, Icon]) => (
                <button
                  key={id}
                  title={label + ' (' + key + ')'}
                  aria-label={label}
                  aria-pressed={id === 'pan' ? active === 'pan' : undefined}
                  disabled={
                    (mode === 'arcgis' && !!mapState) ||
                    (id === 'previous' && history.index === 0) ||
                    (id === 'next' && history.index === history.list.length - 1)
                  }
                  onClick={() => act(id)}
                >
                  <Icon size={19} />
                </button>
              ))}
              <hr />
              <button
                title="Select feature (S)"
                aria-label="Select feature"
                aria-pressed={active !== 'pan'}
                onClick={() => setActive('')}
              >
                <MousePointer2 size={18} />
              </button>
              <button
                title="Clear selection (Esc)"
                aria-label="Clear selection"
                onClick={clearSelection}
              >
                <X size={18} />
              </button>
              <button
                title="Layers & legend (L)"
                aria-label="Layers and legend"
                aria-pressed={legend}
                onClick={() => setLegend(!legend)}
              >
                <Layers size={18} />
              </button>
              {!embedded && (
                <button
                  title="Attribute table"
                  aria-label="Attribute table"
                  aria-pressed={table}
                  onClick={() => setTable(!table)}
                >
                  <Table2 size={18} />
                </button>
              )}
            </div>
            {legend && (
              <aside className="map-legend card">
                <strong>
                  {symbology === 'Lifecycle' ? 'Layers & legend' : 'Duct availability'}
                </strong>
                {symbology === 'Lifecycle' ? (
                  <>
                    <span>
                      <i className="line-ipl" />
                      IPL – In-Place
                    </span>
                    <span>
                      <i className="line-planned" />
                      Planned / construction
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      <i className="line-available" />
                      Available
                    </span>
                    <span>
                      <i className="line-near" />
                      Near limit
                    </span>
                    <span>
                      <i className="line-full" />
                      Full
                    </span>
                  </>
                )}
                <span>
                  <i className="line-locked" />
                  Locked by CRA
                </span>
              </aside>
            )}
            {!embedded && identified && (
              <aside className="identify card">
                <div className="section-head">
                  <strong>
                    <bdi>{identified.id}</bdi>
                  </strong>
                  <button
                    className="shell-icon"
                    aria-label="Close identify"
                    onClick={clearSelection}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="readout">
                  <span>Type</span>
                  <strong>{identified.a ? 'Duct span' : 'Manhole'}</strong>
                  <span>Lifecycle</span>
                  <strong>{identified.status || 'In-Place'}</strong>
                  <span>{identified.a ? 'Length' : 'Name'}</span>
                  <strong>{identified.a ? identified.length + ' m' : identified.name}</strong>
                </div>
                {!identified.a && (
                  <Link
                    className="button secondary"
                    to={'/manhole-layout?manhole=' + identified.id}
                  >
                    Manhole layout
                  </Link>
                )}
              </aside>
            )}
          </div>
          <div className="map-footer">
            <span>{mode === 'arcgis' ? 'ArcGIS basemap' : 'Doha · Demo schematic'}</span>
            <span>
              {mode === 'arcgis'
                ? 'Scale 1:' + Math.round(camera.scale).toLocaleString()
                : 'Zoom ' + camera.z.toFixed(1) + '×'}
            </span>
          </div>
          {!embedded && table && (
            <NetworkAttributeTable
              network={network.data}
              assetType={assetType}
              setAssetType={setAssetType}
              selectedId={identified?.id}
              onSelect={identify}
            />
          )}
        </section>
      )}
    </>
  );
}

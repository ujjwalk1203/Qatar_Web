import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Search,
  MapPin,
  PanelRightOpen,
} from 'lucide-react';
import { Title, State } from '../components/Shared.jsx';
import { useResource } from '../services/api.js';
import { loadArcgis } from './arcgisLoader.js';
import NetworkAttributeTable from './NetworkAttributeTable.jsx';
import AssetDetailDrawer from './AssetDetailDrawer.jsx';
import Qnd95GisRenderer from './Qnd95GisRenderer.jsx';
import { formatQnd95, wgs84ToQnd95 } from './qnd95.js';
import { spanStyle } from './symbology.js';
import {
  ARCGIS_ENTERPRISE_CONFIG,
  CGIS_PARCELS,
  CGIS_ROADS,
  DOHA_BAY_WATER,
  GIS_BASEMAPS,
  GIS_LAYER_CATALOG,
  LANDUSE_ZONES,
  QARS_PIN_FEATURES,
} from '../data/gisLayers.js';

const initial = { lon: 51.541, lat: 25.332, scale: 36000 };

const tools = [
  ['in', 'Zoom in', '+', ZoomIn],
  ['out', 'Zoom out', '−', ZoomOut],
  ['pan', 'Pan', 'P', Hand],
  ['full', 'Full extent', 'F', Maximize],
  ['previous', 'Previous extent', '[', Undo2],
  ['next', 'Next extent', ']', Redo2],
];

export default function MapWorkspace({
  embedded = false,
  selection = [],
  capacity = [],
  splicePlans = {},
  onAsset,
  onClear,
  inspectRequest = null,
}) {
  const network = useResource('/network');
  const [params, setParams] = useSearchParams();
  const query = params.get('asset')?.toUpperCase();

  const [symbology, setSymbology] = useState(embedded ? 'Availability' : 'Lifecycle');
  const [basemap, setBasemap] = useState('cgis-landbase');
  const [layerVis, setLayerVis] = useState(() =>
    Object.fromEntries(GIS_LAYER_CATALOG.map((l) => [l.id, l.defaultVisible])),
  );
  const [legend, setLegend] = useState(true);
  const [table, setTable] = useState(false);
  const [assetType, setAssetType] = useState('spans');
  const [engine, setEngine] = useState('loading'); // 'arcgis' | 'qnd95-local' | 'loading'
  const [mapState, setMapState] = useState('Connecting Esri ArcGIS Enterprise Web Map (QND95)…');
  const [activeTool, setActiveTool] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detailTab, setDetailTab] = useState(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeQars, setActiveQars] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchFeedback, setSearchFeedback] = useState('');
  const [history, setHistory] = useState({ list: [initial], index: 0 });
  const [pointerQnd, setPointerQnd95] = useState(() => wgs84ToQnd95(initial.lon, initial.lat));

  const camera = history.list[history.index];
  const assets = useMemo(
    () => [...(network.data?.manholes || []), ...(network.data?.spans || [])],
    [network.data],
  );
  const queried = assets.find((asset) => asset.id === query);
  const identified = assets.find((asset) => asset.id === selectedId) || queried || null;
  const highlight = embedded
    ? [...new Set([...selection, ...(identified ? [identified.id] : [])])]
    : identified
      ? [identified.id]
      : [];

  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const layerRefs = useRef({});
  const pendingRef = useRef(false);
  const onAssetRef = useRef(onAsset);
  onAssetRef.current = onAsset;

  // Allow external caller (e.g. CapacitySection in Map & Requests) to open selected asset detail view
  useEffect(() => {
    if (!inspectRequest?.id) return;
    setSelectedId(inspectRequest.id);
    setDetailTab(inspectRequest.tab);
    setDetailOpen(true);
  }, [inspectRequest]);

  function identify(id, openDetailDirectly = false) {
    setActiveQars(null);
    setSelectedId(id);
    setDetailTab(undefined);
    if (embedded) {
      onAssetRef.current?.(id);
      if (openDetailDirectly) setDetailOpen(true);
    } else {
      setDetailOpen(true);
    }
  }

  function addCamera(next) {
    setHistory((h) => ({ list: [...h.list.slice(0, h.index + 1), next], index: h.index + 1 }));
  }

  function goToCamera(next) {
    if (viewRef.current) {
      pendingRef.current = true;
      const instance = viewRef.current;
      instance
        .goTo({ center: [next.lon, next.lat], scale: next.scale }, { animate: false })
        .catch(() => {})
        .finally(() => {
          if (viewRef.current === instance) pendingRef.current = false;
        });
    }
  }

  // Initialize Esri ArcGIS Enterprise WebMap / MapView (with QND95 coordinate projection & CRA/CGIS layers)
  useEffect(() => {
    if (!network.data) return;
    let alive = true;
    let instance;
    let watch;
    let pointerHandle;
    let timeout;

    setEngine('loading');
    setMapState('Loading Esri ArcGIS Enterprise Web Map (QND95)…');

    (async () => {
      try {
        const esri = await loadArcgis();
        const [
          esriConfig,
          Map,
          WebMap,
          MapView,
          GraphicsLayer,
          FeatureLayer,
          MapImageLayer,
          Graphic,
          ScaleBar,
          reactive,
        ] = await Promise.all(
          [
            'config',
            'Map',
            'WebMap',
            'views/MapView',
            'layers/GraphicsLayer',
            'layers/FeatureLayer',
            'layers/MapImageLayer',
            'Graphic',
            'widgets/ScaleBar',
            'core/reactiveUtils',
          ].map((p) => esri.import('@arcgis/core/' + p + '.js')),
        );
        if (!alive || !hostRef.current) return;

        if (ARCGIS_ENTERPRISE_CONFIG.portalUrl) {
          esriConfig.portalUrl = ARCGIS_ENTERPRISE_CONFIG.portalUrl;
        }

        const cgisLayer = ARCGIS_ENTERPRISE_CONFIG.serviceUrls.cgisLandbase
          ? new MapImageLayer({
              id: 'cgisLandbase',
              title: 'CGIS Landbase',
              url: ARCGIS_ENTERPRISE_CONFIG.serviceUrls.cgisLandbase,
              visible: layerVis.cgisLandbase,
            })
          : new GraphicsLayer({
              id: 'cgisLandbase',
              title: 'CGIS Landbase (Parcels & Roads)',
              visible: layerVis.cgisLandbase,
            });

        const landuseLayer = ARCGIS_ENTERPRISE_CONFIG.serviceUrls.landuse
          ? new FeatureLayer({
              id: 'landuse',
              title: 'Landuse Zoning',
              url: ARCGIS_ENTERPRISE_CONFIG.serviceUrls.landuse,
              visible: layerVis.landuse,
            })
          : new GraphicsLayer({
              id: 'landuse',
              title: 'Landuse Zoning',
              visible: layerVis.landuse,
            });

        const qarsLayer = ARCGIS_ENTERPRISE_CONFIG.serviceUrls.qarsPin
          ? new FeatureLayer({
              id: 'qarsPin',
              title: 'QARS / PIN Plates',
              url: ARCGIS_ENTERPRISE_CONFIG.serviceUrls.qarsPin,
              visible: layerVis.qarsPin,
            })
          : new GraphicsLayer({
              id: 'qarsPin',
              title: 'QARS / PIN Plates',
              visible: layerVis.qarsPin,
            });

        const ductsLayer = new GraphicsLayer({
          id: 'craDucts',
          title: 'CRA Duct Spans',
          visible: layerVis.craDucts,
        });

        const manholesLayer = new GraphicsLayer({
          id: 'craManholes',
          title: 'CRA Manholes',
          visible: layerVis.craManholes,
        });

        layerRefs.current = {
          Graphic,
          cgisLandbase: cgisLayer,
          landuse: landuseLayer,
          qarsPin: qarsLayer,
          craDucts: ductsLayer,
          craManholes: manholesLayer,
        };

        // Populate CGIS Landbase, Landuse & QARS/PIN vector layers when using local GIS geometry
        if (cgisLayer.graphics) {
          cgisLayer.graphics.add(
            new Graphic({
              geometry: {
                type: 'polygon',
                rings: [DOHA_BAY_WATER],
                spatialReference: { wkid: 4326 },
              },
              symbol: {
                type: 'simple-fill',
                color: [204, 227, 238, 0.5],
                outline: { color: [120, 165, 190, 0.8], width: 1 },
              },
            }),
          );
          for (const parcel of CGIS_PARCELS) {
            cgisLayer.graphics.add(
              new Graphic({
                geometry: {
                  type: 'polygon',
                  rings: [parcel.coords],
                  spatialReference: { wkid: 4326 },
                },
                symbol: {
                  type: 'simple-fill',
                  color: [255, 255, 255, 0.08],
                  outline: { color: [160, 174, 192, 0.7], width: 1 },
                },
                attributes: { pin: parcel.pin },
              }),
            );
          }
          for (const road of CGIS_ROADS) {
            cgisLayer.graphics.add(
              new Graphic({
                geometry: {
                  type: 'polyline',
                  paths: [road.coords],
                  spatialReference: { wkid: 4326 },
                },
                symbol: {
                  type: 'simple-line',
                  color: [255, 255, 255, 0.9],
                  width: road.class === 'primary' ? 4 : 2.5,
                },
                attributes: { roadName: road.name },
              }),
            );
          }
        }

        if (landuseLayer.graphics) {
          for (const zone of LANDUSE_ZONES) {
            landuseLayer.graphics.add(
              new Graphic({
                geometry: {
                  type: 'polygon',
                  rings: [zone.coords],
                  spatialReference: { wkid: 4326 },
                },
                symbol: {
                  type: 'simple-fill',
                  color: zone.fill,
                  outline: { color: zone.stroke, width: 1.5, style: 'dash' },
                },
                attributes: { landuseCode: zone.code, category: zone.category },
              }),
            );
          }
        }

        if (qarsLayer.graphics) {
          for (const item of QARS_PIN_FEATURES) {
            qarsLayer.graphics.add(
              new Graphic({
                geometry: { type: 'point', longitude: item.lon, latitude: item.lat },
                symbol: {
                  type: 'simple-marker',
                  style: 'square',
                  color: '#1d4ed8',
                  size: 10,
                  outline: { color: '#ffffff', width: 1.5 },
                },
                attributes: { qarsId: item.id, pin: item.pin, assetId: item.assetId },
              }),
            );
            qarsLayer.graphics.add(
              new Graphic({
                geometry: { type: 'point', longitude: item.lon, latitude: item.lat },
                symbol: {
                  type: 'text',
                  color: '#1e3a8a',
                  haloColor: '#ffffff',
                  haloSize: '1.5px',
                  text: `Z${item.zone}·${item.street}·${item.building} (${item.pin})`,
                  yoffset: 12,
                  font: { size: 9, weight: 'bold', family: 'IBM Plex Sans' },
                },
                attributes: { qarsId: item.id, pin: item.pin, assetId: item.assetId },
              }),
            );
          }
        }

        const basemapSpec =
          GIS_BASEMAPS.find((b) => b.id === basemap)?.arcgisBasemap || 'streets-navigation-vector';

        const mapObj = ARCGIS_ENTERPRISE_CONFIG.webMapId
          ? new WebMap({
              portalItem: {
                id: ARCGIS_ENTERPRISE_CONFIG.webMapId,
              },
              layers: [cgisLayer, landuseLayer, qarsLayer, ductsLayer, manholesLayer],
            })
          : new Map({
              basemap: basemapSpec,
              layers: [cgisLayer, landuseLayer, qarsLayer, ductsLayer, manholesLayer],
            });

        instance = new MapView({
          container: hostRef.current,
          map: mapObj,
          center: [initial.lon, initial.lat],
          scale: initial.scale,
          ui: { components: ['attribution'] },
        });

        const scaleBar = new ScaleBar({ view: instance, unit: 'metric' });
        instance.ui.add(scaleBar, 'bottom-right');

        timeout = setTimeout(() => {
          if (alive) {
            setEngine('qnd95-local');
            setMapState(
              'ArcGIS Enterprise portal unreachable in this session — displaying QND95 (WKID 2932) geographic GIS layers.',
            );
          }
        }, 9000);

        await instance.when();
        if (!alive) return;
        clearTimeout(timeout);
        viewRef.current = instance;
        setEngine('arcgis');
        setMapState('');

        instance.on('click', async (event) => {
          const hit = await instance.hitTest(event, {
            include: [ductsLayer, manholesLayer, qarsLayer],
          });
          const assetHit = hit.results.find((r) => r.graphic?.attributes?.id);
          if (alive && assetHit) {
            identify(assetHit.graphic.attributes.id);
            return;
          }
          const qarsHit = hit.results.find((r) => r.graphic?.attributes?.qarsId);
          if (alive && qarsHit) {
            const match = QARS_PIN_FEATURES.find(
              (q) => q.id === qarsHit.graphic.attributes.qarsId,
            );
            if (match) {
              setActiveQars(match);
              if (match.assetId) identify(match.assetId);
            }
          }
        });

        pointerHandle = instance.on('pointer-move', (event) => {
          const mapPoint = instance.toMap({ x: event.x, y: event.y });
          if (mapPoint?.longitude != null && mapPoint?.latitude != null) {
            setPointerQnd95(wgs84ToQnd95(mapPoint.longitude, mapPoint.latitude));
          }
        });

        watch = reactive.watch(
          () => instance.stationary,
          (stable) => {
            if (!stable || pendingRef.current) return;
            const next = {
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
          },
        );
      } catch {
        if (alive) {
          clearTimeout(timeout);
          setEngine('qnd95-local');
          setMapState(
            'ArcGIS Enterprise SDK unavailable offline — displaying QND95 (WKID 2932) geographic GIS layers.',
          );
        }
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timeout);
      pointerHandle?.remove();
      watch?.remove();
      instance?.destroy();
      viewRef.current = null;
      pendingRef.current = false;
    };
  }, [network.data]);

  // Sync Basemap when Esri MapView is active
  useEffect(() => {
    if (!viewRef.current?.map || ARCGIS_ENTERPRISE_CONFIG.webMapId) return;
    const spec = GIS_BASEMAPS.find((b) => b.id === basemap)?.arcgisBasemap;
    if (spec) viewRef.current.map.basemap = spec;
  }, [basemap]);

  // Sync Layer Visibility
  useEffect(() => {
    for (const { id } of GIS_LAYER_CATALOG) {
      const layer = layerRefs.current[id];
      if (layer) layer.visible = !!layerVis[id];
    }
  }, [layerVis]);

  // Sync CRA Ducts & Manholes graphics in ArcGIS MapView
  useEffect(() => {
    const { Graphic, craDucts, craManholes } = layerRefs.current;
    if (!Graphic || !craDucts || !craManholes || !network.data) return;

    const byId = Object.fromEntries(network.data.manholes.map((m) => [m.id, m]));
    craDucts.removeAll();
    craManholes.removeAll();

    for (const span of network.data.spans) {
      const a = byId[span.a];
      const b = byId[span.b];
      if (!a || !b) continue;
      const coords =
        span.path && span.path.length >= 2
          ? span.path
          : [
              [a.lon, a.lat],
              [b.lon, b.lat],
            ];
      const style = spanStyle(span, symbology, network.data.catalog?.limit);
      const isSelected = highlight.includes(span.id);
      craDucts.add(
        new Graphic({
          geometry: {
            type: 'polyline',
            paths: [coords],
            spatialReference: { wkid: 4326 },
          },
          symbol: {
            type: 'simple-line',
            color: isSelected ? '#00a8cc' : style.color,
            width: isSelected ? 6 : 4,
            style: span.status === 'Locked' ? 'dot' : style.dash ? 'dash' : 'solid',
          },
          attributes: { id: span.id },
        }),
      );
    }

    for (const point of network.data.manholes) {
      const isSelected = highlight.includes(point.id);
      craManholes.add(
        new Graphic({
          geometry: { type: 'point', longitude: point.lon, latitude: point.lat },
          symbol: {
            type: 'simple-marker',
            color: '#ffffff',
            size: isSelected ? 12 : 9,
            outline: { color: isSelected ? '#00a8cc' : '#1d2125', width: 3 },
          },
          attributes: { id: point.id },
        }),
      );
      craManholes.add(
        new Graphic({
          geometry: { type: 'point', longitude: point.lon, latitude: point.lat },
          symbol: {
            type: 'text',
            color: '#1d2125',
            haloColor: '#ffffff',
            haloSize: '1.5px',
            text: point.id,
            yoffset: -14,
            font: { size: 10, weight: 'bold', family: 'IBM Plex Sans' },
          },
          attributes: { id: point.id },
        }),
      );
    }
  }, [engine, symbology, selectedId, query, selection, network.data]);

  function act(action) {
    if (action === 'pan') {
      setActiveTool((a) => (a === 'pan' ? '' : 'pan'));
      return;
    }
    if (action === 'previous' || action === 'next') {
      const index = history.index + (action === 'previous' ? -1 : 1);
      if (index >= 0 && index < history.list.length) {
        setHistory({ ...history, index });
        goToCamera(history.list[index]);
      }
      return;
    }
    const factor = action === 'in' ? 1.45 : 1 / 1.45;
    const next =
      action === 'full'
        ? initial
        : {
            ...camera,
            scale: Math.min(250000, Math.max(1200, camera.scale / factor)),
          };
    addCamera(next);
    goToCamera(next);
  }

  function clearSelection() {
    setSelectedId('');
    setDetailOpen(false);
    setActiveQars(null);
    if (embedded) onClear?.();
    else if (query) setParams({});
  }

  function locateSearch(event) {
    event.preventDefault();
    const term = searchText.trim().toLowerCase();
    if (!term || !network.data) return;
    setSearchFeedback('');

    // Match Asset ID (MH-102, DS-201)
    const assetMatch = assets.find((a) => a.id.toLowerCase() === term);
    if (assetMatch) {
      const byId = Object.fromEntries(network.data.manholes.map((m) => [m.id, m]));
      const lon = assetMatch.a
        ? (byId[assetMatch.a].lon + byId[assetMatch.b].lon) / 2
        : assetMatch.lon;
      const lat = assetMatch.a
        ? (byId[assetMatch.a].lat + byId[assetMatch.b].lat) / 2
        : assetMatch.lat;
      const next = { lon, lat, scale: 12000 };
      addCamera(next);
      goToCamera(next);
      setSelectedId(assetMatch.id);
      setDetailOpen(true);
      return;
    }

    // Match PIN or QARS (e.g., 61042214 or Z61 / 835 / 22)
    const qarsMatch = QARS_PIN_FEATURES.find(
      (q) =>
        q.pin.includes(term) ||
        q.id.toLowerCase().includes(term) ||
        `${q.zone}/${q.street}/${q.building}`.includes(term) ||
        `${q.zone} ${q.street} ${q.building}`.includes(term) ||
        q.district.toLowerCase().includes(term),
    );
    if (qarsMatch) {
      const next = { lon: qarsMatch.lon, lat: qarsMatch.lat, scale: 9000 };
      addCamera(next);
      goToCamera(next);
      setActiveQars(qarsMatch);
      if (qarsMatch.assetId) setSelectedId(qarsMatch.assetId);
      return;
    }

    setSearchFeedback('No asset, QARS plate, or PIN matches "' + searchText.trim() + '".');
  }

  function keyboard(event) {
    if (event.target.closest('button,input,select,[role=button]')) return;
    const key = event.key.toLowerCase();
    if (key === 'l') {
      setLegend((value) => !value);
      return;
    }
    if (key === 's') {
      setActiveTool('');
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
  }

  const centerQnd = wgs84ToQnd95(camera.lon, camera.lat);
  const selectedCapacity = identified?.a
    ? capacity.find((c) => c.id === identified.id)
    : null;
  const selectedSplicePlan =
    identified && !identified.a ? splicePlans?.[identified.id] || null : null;

  return (
    <>
      {!embedded && (
        <Title code="M-03" title="Network GIS map">
          Esri ArcGIS Enterprise Web Map · QND95 Qatar National Grid (EPSG:2932)
        </Title>
      )}
      <State resource={network} />
      {network.data && (
        <section className={'card map-card ' + (embedded ? 'embedded-map' : '')}>
          <div className="map-header">
            <div className="map-controls">
              <label className="map-select">
                Basemap
                <select
                  aria-label="Basemap"
                  value={basemap}
                  onChange={(e) => setBasemap(e.target.value)}
                >
                  {GIS_BASEMAPS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
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
                  {selection.filter((id) => id.startsWith('MH')).length} manholes
                </span>
              ) : (
                <span className="code">WKID 2932 · QND95</span>
              )}
            </div>

            <form className="gis-locate-form" onSubmit={locateSearch}>
              <Search size={14} />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Locate Asset, PIN, or QARS (e.g. 61042214)"
                aria-label="Locate Asset, PIN, or QARS"
              />
              <button type="submit" className="button secondary">
                Locate
              </button>
            </form>
          </div>

          {mapState && (
            <p className="map-message" role="status">
              {mapState}
            </p>
          )}
          {searchFeedback && (
            <p className="map-message" role="status">
              {searchFeedback}
            </p>
          )}
          {!embedded && query && !queried && (
            <p className="map-message" role="status">
              No asset matches <bdi>{query}</bdi>.
            </p>
          )}

          <div
            className={'map-viewport ' + (activeTool === 'pan' ? 'panning' : '')}
            tabIndex="0"
            aria-label="QND95 GIS Map Workspace"
            onKeyDown={keyboard}
          >
            {/* Esri ArcGIS Enterprise Web Map Container */}
            <div
              className="arcgis"
              ref={hostRef}
              style={{ display: engine === 'arcgis' ? 'block' : 'none' }}
            />

            {/* QND95 (EPSG:2932) Geographic GIS Fallback / Local Tile-Free Renderer */}
            {engine !== 'arcgis' && (
              <div className="qnd95-gis-host">
                <Qnd95GisRenderer
                  network={network.data}
                  camera={camera}
                  basemap={basemap}
                  layers={layerVis}
                  symbology={symbology}
                  selection={highlight}
                  activeQarsId={activeQars?.id || ''}
                  panning={activeTool === 'pan'}
                  onSelectAsset={(id) => identify(id)}
                  onSelectQars={(q) => {
                    setActiveQars(q);
                    if (q.assetId) identify(q.assetId);
                  }}
                  onCameraChange={(next) => addCamera(next)}
                  onPointerQnd95={setPointerQnd95}
                />
              </div>
            )}

            <div className="palette" aria-label="GIS Map tools">
              {tools.map(([id, label, key, Icon]) => (
                <button
                  key={id}
                  type="button"
                  title={label + ' (' + key + ')'}
                  aria-label={label}
                  aria-pressed={id === 'pan' ? activeTool === 'pan' : undefined}
                  disabled={
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
                type="button"
                title="Select feature (S)"
                aria-label="Select feature"
                aria-pressed={activeTool !== 'pan'}
                onClick={() => setActiveTool('')}
              >
                <MousePointer2 size={18} />
              </button>
              <button
                type="button"
                title="Clear selection (Esc)"
                aria-label="Clear selection"
                onClick={clearSelection}
              >
                <X size={18} />
              </button>
              <button
                type="button"
                title="GIS Layers & Legend (L)"
                aria-label="GIS Layers and Legend"
                aria-pressed={legend}
                onClick={() => setLegend(!legend)}
              >
                <Layers size={18} />
              </button>
              {!embedded && (
                <button
                  type="button"
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
              <aside className="map-legend card" aria-label="GIS Layers and Legend">
                <strong>GIS Layers (QND95)</strong>
                <div className="gis-layer-toggles">
                  {GIS_LAYER_CATALOG.map((layer) => (
                    <label key={layer.id} className="gis-layer-check">
                      <input
                        type="checkbox"
                        checked={!!layerVis[layer.id]}
                        onChange={(e) =>
                          setLayerVis((prev) => ({ ...prev, [layer.id]: e.target.checked }))
                        }
                      />
                      <span>{layer.label}</span>
                    </label>
                  ))}
                </div>
                <hr className="legend-sep" />
                <strong>{symbology === 'Lifecycle' ? 'CRA Ducts' : 'Duct availability'}</strong>
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

            {/* Selected QARS / PIN Callout */}
            {activeQars && !detailOpen && (
              <aside className="identify qars-callout card">
                <div className="section-head">
                  <strong>
                    <MapPin size={14} /> QARS {activeQars.zone} · St {activeQars.street} · B{' '}
                    {activeQars.building}
                  </strong>
                  <button
                    type="button"
                    className="shell-icon"
                    aria-label="Close QARS callout"
                    onClick={() => setActiveQars(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="readout">
                  <span>PIN</span>
                  <strong>{activeQars.pin}</strong>
                  <span>Landuse</span>
                  <strong>{activeQars.landuse}</strong>
                  {activeQars.assetId && (
                    <>
                      <span>Linked CRA asset</span>
                      <strong>{activeQars.assetId}</strong>
                    </>
                  )}
                </div>
              </aside>
            )}

            {/* Selected Asset Compact Identify Pill (opens Cross-Section / Butterfly / Schematic detail view) */}
            {identified && !detailOpen && (
              <aside className="identify card" aria-label="Selected asset callout">
                <div className="section-head">
                  <strong>
                    <bdi>{identified.id}</bdi>
                  </strong>
                  <button
                    type="button"
                    className="shell-icon"
                    aria-label="Close identify"
                    onClick={() => {
                      setSelectedId('');
                      if (!embedded && query) setParams({});
                    }}
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
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setDetailOpen(true)}
                >
                  <PanelRightOpen size={15} />
                  {identified.a
                    ? 'Inspect Cross-Section / Schematic'
                    : 'Inspect Butterfly / Schematic'}
                </button>
              </aside>
            )}

            {/* Selected Asset Detail View: Cross-Section / Manhole Butterfly / Asset Schematic */}
            {identified && detailOpen && (
              <AssetDetailDrawer
                asset={identified}
                network={network.data}
                capacityEntry={selectedCapacity}
                splicePlan={selectedSplicePlan}
                initialTab={detailTab}
                onSelectAsset={(id) => identify(id, true)}
                onClose={() => setDetailOpen(false)}
              />
            )}
          </div>

          <div className="map-footer">
            <span>
              {engine === 'arcgis'
                ? 'Esri ArcGIS Enterprise Web Map · QND95 (WKID 2932)'
                : 'QND95 / Qatar National Grid (EPSG:2932) · CGIS Geographic View'}
            </span>
            <span>
              Cursor: {formatQnd95(pointerQnd.easting, pointerQnd.northing)} · Center:{' '}
              {formatQnd95(centerQnd.easting, centerQnd.northing)} · Scale 1:
              {Math.round(camera.scale).toLocaleString()}
            </span>
          </div>

          {!embedded && table && (
            <NetworkAttributeTable
              network={network.data}
              assetType={assetType}
              setAssetType={setAssetType}
              selectedId={identified?.id}
              onSelect={(id) => identify(id, true)}
            />
          )}
        </section>
      )}
    </>
  );
}

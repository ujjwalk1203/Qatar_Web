import test from 'node:test';
import assert from 'node:assert/strict';
import { wgs84ToQnd95, qnd95ToWgs84, formatQnd95 } from '../src/map/qnd95.js';
import {
  GIS_BASEMAPS,
  GIS_LAYER_CATALOG,
  CGIS_ROADS,
  CGIS_PARCELS,
  LANDUSE_ZONES,
  QARS_PIN_FEATURES,
} from '../src/data/gisLayers.js';
import { manholes, spans } from '../src/data/mockData.js';

test('Converts Doha West Bay WGS84 coordinates accurately to QND95 (EPSG:2932) and back', () => {
  const westBay = { lon: 51.523, lat: 25.328 };
  const qnd = wgs84ToQnd95(westBay.lon, westBay.lat);

  // Doha West Bay QND95 Easting ~ 230,000 m, Northing ~ 397,000 m
  assert.ok(qnd.easting > 228000 && qnd.easting < 234000, `Unexpected easting ${qnd.easting}`);
  assert.ok(qnd.northing > 395000 && qnd.northing < 400000, `Unexpected northing ${qnd.northing}`);

  const roundTrip = qnd95ToWgs84(qnd.easting, qnd.northing);
  assert.ok(Math.abs(roundTrip.lon - westBay.lon) < 0.0001);
  assert.ok(Math.abs(roundTrip.lat - westBay.lat) < 0.0001);
  assert.match(formatQnd95(qnd.easting, qnd.northing), /^E [\d,]+ m · N [\d,]+ m$/);
});

test('Provides required CRA Qatar GIS basemaps and operational layers', () => {
  const basemapIds = GIS_BASEMAPS.map((b) => b.id);
  assert.ok(basemapIds.includes('cgis-landbase'));
  assert.ok(basemapIds.includes('satellite'));

  const layerIds = GIS_LAYER_CATALOG.map((l) => l.id);
  for (const required of ['cgisLandbase', 'landuse', 'qarsPin', 'craDucts', 'craManholes']) {
    assert.ok(layerIds.includes(required), `Missing GIS layer ${required}`);
  }

  assert.ok(CGIS_ROADS.length >= 3);
  assert.ok(CGIS_PARCELS.length >= 3);
  assert.ok(LANDUSE_ZONES.length >= 3);
  assert.ok(QARS_PIN_FEATURES.length >= 5);
});

test('Every CRA manhole and duct span has geographic GIS metadata', () => {
  for (const mh of manholes) {
    assert.ok(typeof mh.lon === 'number' && typeof mh.lat === 'number');
    assert.ok(mh.pin && mh.qars?.zone && mh.qars?.street);
  }
  for (const span of spans) {
    assert.ok(Array.isArray(span.path) && span.path.length >= 2);
  }
});

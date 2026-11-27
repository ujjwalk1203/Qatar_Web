// QND95 / Qatar National Grid (EPSG:2932) coordinate transformations.
// Ellipsoid: International 1924 (Hayford) — a = 6378388 m, 1/f = 297
// Projection: Transverse Mercator — lat0 = 24°27'N, lon0 = 51°13'E, k0 = 0.99999, FE = 200000 m, FN = 300000 m
// Datum shift WGS84 <-> QND95 (EPSG:15863 geocentric translation): dx = -119.4248, dy = -303.6587, dz = -11.0006

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const WGS84 = { a: 6378137.0, f: 1 / 298.257223563 };
const INTL24 = { a: 6378388.0, f: 1 / 297.0 };

// Translation from QND95 to WGS84 (EPSG:15863)
const DX = -119.4248;
const DY = -303.6587;
const DZ = -11.0006;

const QNG = {
  lat0: 24.45 * DEG2RAD,
  lon0: (51 + 13 / 60) * DEG2RAD,
  k0: 0.99999,
  fe: 200000.0,
  fn: 300000.0,
};

function e2Of(ell) {
  return 2 * ell.f - ell.f * ell.f;
}

function geodeticToCartesian(lonRad, latRad, h, ell) {
  const e2 = e2Of(ell);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const nu = ell.a / Math.sqrt(1 - e2 * sinLat * sinLat);
  return [
    (nu + h) * cosLat * Math.cos(lonRad),
    (nu + h) * cosLat * Math.sin(lonRad),
    (nu * (1 - e2) + h) * sinLat,
  ];
}

function cartesianToGeodetic(x, y, z, ell) {
  const e2 = e2Of(ell);
  const p = Math.hypot(x, y);
  const lon = Math.atan2(y, x);
  let lat = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 8; i++) {
    const sinLat = Math.sin(lat);
    const nu = ell.a / Math.sqrt(1 - e2 * sinLat * sinLat);
    lat = Math.atan2(z + e2 * nu * sinLat, p);
  }
  return [lon, lat];
}

function meridionalArc(lat, ell) {
  const e2 = e2Of(ell);
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const c0 = 1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256;
  const c2 = (3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024;
  const c4 = (15 * e4) / 256 + (45 * e6) / 1024;
  const c6 = (35 * e6) / 3072;
  return (
    ell.a *
    (c0 * lat -
      c2 * Math.sin(2 * lat) +
      c4 * Math.sin(4 * lat) -
      c6 * Math.sin(6 * lat))
  );
}

const M0 = meridionalArc(QNG.lat0, INTL24);

/**
 * Converts WGS84 (longitude, latitude in degrees) to QND95 / Qatar National Grid (EPSG:2932) meters.
 */
export function wgs84ToQnd95(lon, lat) {
  const [xw, yw, zw] = geodeticToCartesian(lon * DEG2RAD, lat * DEG2RAD, 0, WGS84);
  const [lonQ, latQ] = cartesianToGeodetic(xw - DX, yw - DY, zw - DZ, INTL24);

  const e2 = e2Of(INTL24);
  const ep2 = e2 / (1 - e2);
  const sinLat = Math.sin(latQ);
  const cosLat = Math.cos(latQ);
  const tanLat = Math.tan(latQ);

  const nu = INTL24.a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = ep2 * cosLat * cosLat;
  const A = cosLat * (lonQ - QNG.lon0);
  const M = meridionalArc(latQ, INTL24);

  const easting =
    QNG.fe +
    QNG.k0 *
      nu *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5)) / 120);

  const northing =
    QNG.fn +
    QNG.k0 *
      (M -
        M0 +
        nu *
          tanLat *
          ((A * A) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6)) / 720));

  return {
    easting: Math.round(easting * 100) / 100,
    northing: Math.round(northing * 100) / 100,
  };
}

/**
 * Converts QND95 / Qatar National Grid (EPSG:2932) Easting/Northing (meters) back to WGS84 [lon, lat].
 */
export function qnd95ToWgs84(easting, northing) {
  const e2 = e2Of(INTL24);
  const ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const M = M0 + (northing - QNG.fn) / QNG.k0;
  const mu = M / (INTL24.a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
    ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu) +
    ((1097 * Math.pow(e1, 4)) / 512) * Math.sin(8 * mu);

  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const nu1 = INTL24.a / Math.sqrt(1 - e2 * sin1 * sin1);
  const rho1 = (INTL24.a * (1 - e2)) / Math.pow(1 - e2 * sin1 * sin1, 1.5);
  const T1 = tan1 * tan1;
  const C1 = ep2 * cos1 * cos1;
  const D = (easting - QNG.fe) / (nu1 * QNG.k0);

  const latQ =
    phi1 -
    ((nu1 * tan1) / rho1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6)) /
          720);

  const lonQ =
    QNG.lon0 +
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5)) / 120) /
      cos1;

  const [xq, yq, zq] = geodeticToCartesian(lonQ, latQ, 0, INTL24);
  const [lonW, latW] = cartesianToGeodetic(xq + DX, yq + DY, zq + DZ, WGS84);
  return {
    lon: Math.round(lonW * RAD2DEG * 1000000) / 1000000,
    lat: Math.round(latW * RAD2DEG * 1000000) / 1000000,
  };
}

export function formatQnd95(easting, northing) {
  return `E ${Math.round(easting).toLocaleString('en-US')} m · N ${Math.round(northing).toLocaleString('en-US')} m`;
}

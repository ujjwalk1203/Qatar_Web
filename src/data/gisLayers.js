// Geographic GIS datasets aligned to CRA Qatar (QND95 / EPSG:2932) documents:
// - CGIS Landbase (Doha Bay coastline, West Bay / Al Dafna / Corniche road network & cadastral parcels)
// - Satellite Imagery basemap configuration (Esri / CRA Enterprise portal)
// - Landuse zoning polygons (Commercial, Diplomatic, Government, Coastal Park, Utility Corridor)
// - QARS / PIN layers (Qatar Address Referencing System Zone/Street/Building blue plates & 8-digit PINs)
// - CRA ArcGIS Enterprise Web Map configuration via environment variables

export const ARCGIS_ENTERPRISE_CONFIG = {
  portalUrl: import.meta.env?.VITE_ARCGIS_PORTAL_URL || '',
  webMapId: import.meta.env?.VITE_ARCGIS_WEBMAP_ID || '',
  spatialReferenceWkid: 2932,
  spatialReferenceLabel: 'QND95 / Qatar National Grid (EPSG:2932)',
  serviceUrls: {
    cgisLandbase: import.meta.env?.VITE_CGIS_LANDBASE_URL || '',
    satelliteImagery: import.meta.env?.VITE_CGIS_IMAGERY_URL || '',
    landuse: import.meta.env?.VITE_CGIS_LANDUSE_URL || '',
    qarsPin: import.meta.env?.VITE_QARS_PIN_URL || '',
    craDucts: import.meta.env?.VITE_CRA_DUCTS_URL || '',
    craManholes: import.meta.env?.VITE_CRA_MANHOLES_URL || '',
  },
};

export const GIS_BASEMAPS = [
  {
    id: 'cgis-landbase',
    label: 'CGIS Landbase',
    arcgisBasemap: 'streets-navigation-vector',
  },
  {
    id: 'satellite',
    label: 'Satellite Imagery',
    arcgisBasemap: 'hybrid',
  },
  {
    id: 'gray-vector',
    label: 'Vector Gray (GIS)',
    arcgisBasemap: 'gray-vector',
  },
];

export const GIS_LAYER_CATALOG = [
  { id: 'cgisLandbase', label: 'CGIS Landbase (Parcels & Roads)', defaultVisible: true },
  { id: 'landuse', label: 'Landuse Zoning', defaultVisible: true },
  { id: 'qarsPin', label: 'QARS / PIN Plates', defaultVisible: true },
  { id: 'craDucts', label: 'CRA Duct Spans', defaultVisible: true },
  { id: 'craManholes', label: 'CRA Manholes', defaultVisible: true },
];

// West Bay / Diplomatic Quarter / Al Dafna / Corniche coastline polygon (WGS84 lon, lat)
export const DOHA_BAY_WATER = [
  [51.547, 25.352],
  [51.553, 25.344],
  [51.557, 25.335],
  [51.560, 25.326],
  [51.564, 25.317],
  [51.576, 25.317],
  [51.576, 25.352],
  [51.547, 25.352],
];

// CGIS Landbase primary & secondary road centerlines in West Bay / Corniche
export const CGIS_ROADS = [
  {
    id: 'RD-CORNICHE',
    name: 'Al Corniche St',
    arabicName: 'شارع الكورنيش',
    class: 'primary',
    coords: [
      [51.544, 25.348],
      [51.548, 25.339],
      [51.551, 25.330],
      [51.557, 25.322],
      [51.562, 25.316],
    ],
  },
  {
    id: 'RD-OMAR',
    name: 'Omar Al Mukhtar St',
    arabicName: 'شارع عمر المختار',
    class: 'primary',
    coords: [
      [51.517, 25.329],
      [51.523, 25.328],
      [51.531, 25.332],
      [51.539, 25.334],
      [51.549, 25.334],
    ],
  },
  {
    id: 'RD-MAJLIS',
    name: 'Majlis Al Taawon St',
    arabicName: 'شارع مجلس التعاون',
    class: 'primary',
    coords: [
      [51.520, 25.324],
      [51.533, 25.327],
      [51.546, 25.329],
      [51.555, 25.326],
    ],
  },
  {
    id: 'RD-DIPLOMATIC',
    name: 'Diplomatic St',
    arabicName: 'الشارع الدبلوماسي',
    class: 'secondary',
    coords: [
      [51.532, 25.346],
      [51.534, 25.335],
      [51.536, 25.323],
    ],
  },
  {
    id: 'RD-DAFNA',
    name: 'Al Funduq / Al Dafna St',
    arabicName: 'شارع الفندق / الدفنة',
    class: 'secondary',
    coords: [
      [51.538, 25.345],
      [51.546, 25.342],
      [51.551, 25.338],
    ],
  },
];

// CGIS Cadastral Parcel footprints (West Bay & Al Dafna blocks)
export const CGIS_PARCELS = [
  { id: 'P-61042108', pin: '61042108', coords: [[51.519, 25.327], [51.527, 25.327], [51.527, 25.332], [51.519, 25.332], [51.519, 25.327]] },
  { id: 'P-61042214', pin: '61042214', coords: [[51.529, 25.332], [51.537, 25.332], [51.537, 25.338], [51.529, 25.338], [51.529, 25.332]] },
  { id: 'P-60031504', pin: '60031504', coords: [[51.539, 25.327], [51.547, 25.327], [51.547, 25.333], [51.539, 25.333], [51.539, 25.327]] },
  { id: 'P-63051922', pin: '63051922', coords: [[51.544, 25.338], [51.551, 25.338], [51.551, 25.345], [51.544, 25.345], [51.544, 25.338]] },
  { id: 'P-60038811', pin: '60038811', coords: [[51.551, 25.320], [51.559, 25.320], [51.559, 25.326], [51.551, 25.326], [51.551, 25.320]] },
];

// Qatar Landuse zoning polygons (MME / CGIS classification colors)
export const LANDUSE_ZONES = [
  {
    id: 'LU-01',
    code: 'COM-CBD',
    category: 'Commercial / West Bay CBD',
    fill: 'rgba(217, 119, 87, 0.22)',
    stroke: '#c45a3a',
    coords: [
      [51.518, 25.325],
      [51.530, 25.325],
      [51.530, 25.335],
      [51.518, 25.335],
      [51.518, 25.325],
    ],
  },
  {
    id: 'LU-02',
    code: 'DIP-GOV',
    category: 'Diplomatic & Government',
    fill: 'rgba(138, 21, 56, 0.16)',
    stroke: '#8a1538',
    coords: [
      [51.531, 25.331],
      [51.544, 25.331],
      [51.544, 25.343],
      [51.531, 25.343],
      [51.531, 25.331],
    ],
  },
  {
    id: 'LU-03',
    code: 'MIX-RES',
    category: 'Mixed-Use / Al Dafna',
    fill: 'rgba(224, 179, 54, 0.20)',
    stroke: '#b8860b',
    coords: [
      [51.544, 25.336],
      [51.554, 25.336],
      [51.554, 25.346],
      [51.544, 25.346],
      [51.544, 25.336],
    ],
  },
  {
    id: 'LU-04',
    code: 'PRK-COR',
    category: 'Corniche Promenade & Open Space',
    fill: 'rgba(46, 139, 87, 0.20)',
    stroke: '#2e8b57',
    coords: [
      [51.547, 25.320],
      [51.561, 25.320],
      [51.561, 25.332],
      [51.547, 25.332],
      [51.547, 25.320],
    ],
  },
];

// QARS (Qatar Address Referencing System) & PIN (Property Identification Number) layer features
export const QARS_PIN_FEATURES = [
  {
    id: 'QARS-61-810-14',
    pin: '61042108',
    zone: 61,
    street: 810,
    building: 14,
    district: 'West Bay',
    landuse: 'Commercial / West Bay CBD',
    lon: 51.5234,
    lat: 25.3284,
    assetId: 'MH-101',
  },
  {
    id: 'QARS-61-835-22',
    pin: '61042214',
    zone: 61,
    street: 835,
    building: 22,
    district: 'Diplomatic Quarter',
    landuse: 'Diplomatic & Government',
    lon: 51.5343,
    lat: 25.3352,
    assetId: 'MH-102',
  },
  {
    id: 'QARS-60-901-08',
    pin: '60031504',
    zone: 60,
    street: 901,
    building: 8,
    district: 'Corniche North',
    landuse: 'Corniche Promenade & Open Space',
    lon: 51.5462,
    lat: 25.3293,
    assetId: 'MH-103',
  },
  {
    id: 'QARS-60-904-31',
    pin: '60038811',
    zone: 60,
    street: 904,
    building: 31,
    district: 'Corniche South',
    landuse: 'Corniche Promenade & Open Space',
    lon: 51.5582,
    lat: 25.3223,
    assetId: 'MH-104',
  },
  {
    id: 'QARS-63-850-19',
    pin: '63051922',
    zone: 63,
    street: 850,
    building: 19,
    district: 'Al Dafna',
    landuse: 'Mixed-Use / Al Dafna',
    lon: 51.5491,
    lat: 25.3422,
    assetId: 'MH-105',
  },
];
